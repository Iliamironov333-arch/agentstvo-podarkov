
const SITE_ORIGIN = "https://iliamironov333-arch.github.io";
const API_NAME = "agentstvo-podarkov-api";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin === SITE_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed ? origin : SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Telegram-Init-Data",
    "Vary": "Origin"
  };
}

function response(data, request, status = 200) {
  return json(data, status, corsHeaders(request));
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(message)
    )
  );
}

function hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function validateTelegram(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userText = params.get("user");

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) ||
      !authDate || !userText) return null;

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 30 || now - authDate > 3600) return null;

  params.delete("hash");
  params.delete("signature");

  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await hmac(
    new TextEncoder().encode("WebAppData"),
    botToken
  );
  const expected = hex(await hmac(secretKey, checkString));

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ hash.toLowerCase().charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const user = JSON.parse(userText);
    if (!user.id) return null;
    return {
      id: String(user.id),
      username: user.username || null,
      first_name: user.first_name || ""
    };
  } catch {
    return null;
  }
}

async function getUser(request, env) {
  return validateTelegram(
    request.headers.get("X-Telegram-Init-Data") || "",
    env.BOT_TOKEN
  );
}

async function ensureUser(env, user) {
  await env.DB.prepare(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      updated_at = datetime('now')
  `).bind(user.id, user.username, user.first_name).run();
}

async function telegram(env, method, payload) {
  const result = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const data = await result.json();
  if (!result.ok || !data.ok) {
    throw new Error(`Telegram API ${method} failed`);
  }
  return data.result;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function makeId() {
  return crypto.randomUUID();
}

async function notifyOwner(env, message) {
  if (!env.ADMIN_TELEGRAM_ID) return;
  try {
    await telegram(env, "sendMessage", {
      chat_id: env.ADMIN_TELEGRAM_ID,
      text: message
    });
  } catch (error) {
    console.error("Owner notification failed:", String(error));
  }
}

async function handleWebhook(request, env) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");

  if (!expected || supplied !== expected) {
    return json({ ok: false, error: "Unauthorized webhook" }, 401);
  }

  const update = await readJson(request);
  if (!update) return json({ ok: false, error: "Invalid JSON" }, 400);

  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    let ok = false;
    let errorMessage = "Заказ не найден или уже оплачен.";

    try {
      const order = await env.DB.prepare(`
        SELECT id, telegram_id, total_stars, payment_status
        FROM orders WHERE id = ?
      `).bind(q.invoice_payload).first();

      ok = !!order &&
        order.telegram_id === String(q.from.id) &&
        order.total_stars === q.total_amount &&
        q.currency === "XTR" &&
        order.payment_status === "pending";

      if (!ok) errorMessage = "Не удалось подтвердить заказ.";
    } catch (error) {
      console.error("Pre-checkout validation failed:", String(error));
    }

    await telegram(env, "answerPreCheckoutQuery", {
      pre_checkout_query_id: q.id,
      ok,
      ...(!ok ? { error_message: errorMessage } : {})
    });

    return json({ ok: true });
  }

  const message = update.message;
  const payment = message?.successful_payment;

  if (payment) {
    const orderId = payment.invoice_payload;
    const telegramId = String(message.from.id);

    if (payment.currency !== "XTR") {
      return json({ ok: false, error: "Unexpected currency" }, 400);
    }

    // Conditional update prevents the same payment being applied twice.
    const result = await env.DB.prepare(`
      UPDATE orders
      SET payment_status = 'paid',
          fulfillment_status = 'awaiting_delivery',
          paid_at = datetime('now')
      WHERE id = ?
        AND telegram_id = ?
        AND payment_status = 'pending'
        AND total_stars = ?
    `).bind(
      orderId,
      telegramId,
      payment.total_amount
    ).run();

    if (result.meta.changes === 1) {
      await env.DB.prepare(`
        INSERT INTO payments (
          order_id, telegram_id, telegram_payment_charge_id,
          currency, amount_stars, status, confirmed_at
        ) VALUES (?, ?, ?, 'XTR', ?, 'paid', datetime('now'))
      `).bind(
        orderId,
        telegramId,
        payment.telegram_payment_charge_id,
        payment.total_amount
      ).run();

      const order = await env.DB.prepare(`
        SELECT product_title FROM orders WHERE id = ?
      `).bind(orderId).first();

      await notifyOwner(
        env,
        `⭐ Оплата подтверждена!\n` +
        `Заказ: ${orderId}\n` +
        `Покупатель Telegram ID: ${telegramId}\n` +
        `Товар: ${order?.product_title || "Цифровой товар"}\n` +
        `Сумма: ${payment.total_amount} Stars\n` +
        `Нужно вручную отправить покупателю картинку.`
      );
    }

    return json({ ok: true });
  }

  return json({ ok: true, ignored: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/api/health") {
        return response({
          ok: true,
          service: API_NAME,
          databaseConfigured: !!env.DB,
          botConfigured: !!env.BOT_TOKEN
        }, request);
      }

      if (request.method === "POST" && path === "/api/telegram/webhook") {
        if (!env.DB || !env.BOT_TOKEN) {
          return json({ ok: false, error: "Server configuration missing" }, 503);
        }
        return await handleWebhook(request, env);
      }

      if (!env.DB || !env.BOT_TOKEN) {
        return response({
          ok: false,
          error: "Server configuration missing"
        }, request, 503);
      }

      // All remaining /api routes require Telegram Mini App authentication.
      if (!path.startsWith("/api/")) {
        return response({ ok: false, error: "Not found" }, request, 404);
      }

      const user = await getUser(request, env);
      if (!user) {
        return response({
          ok: false,
          error: "Telegram authorization failed. Open the app from your bot."
        }, request, 401);
      }

      await ensureUser(env, user);

      if (request.method === "GET" && path === "/api/me") {
        const profile = await env.DB.prepare(`
          SELECT telegram_id, username, first_name,
                 balance_stars, created_at
          FROM users WHERE telegram_id = ?
        `).bind(user.id).first();

        const vip = await env.DB.prepare(`
          SELECT plan_type, status, starts_at, expires_at
          FROM vip_subscriptions
          WHERE telegram_id = ? AND status = 'active'
          ORDER BY id DESC LIMIT 1
        `).bind(user.id).first();

        return response({ ok: true, user: profile, vip: vip || null }, request);
      }

      if (request.method === "GET" && path === "/api/products") {
        const result = await env.DB.prepare(`
          SELECT id, title, description, image_url, category, price_stars
          FROM products
          WHERE is_active = 1
          ORDER BY created_at DESC
        `).all();

        return response({ ok: true, products: result.results }, request);
      }

      if (request.method === "GET" && path === "/api/favorites") {
        const result = await env.DB.prepare(`
          SELECT product_id FROM favorites WHERE telegram_id = ?
        `).bind(user.id).all();

        return response({
          ok: true,
          favorites: result.results.map(row => row.product_id)
        }, request);
      }

      if (request.method === "POST" && path === "/api/favorites") {
        const body = await readJson(request);
        if (!body || typeof body.product_id !== "string") {
          return response({ ok: false, error: "product_id required" }, request, 400);
        }

        const product = await env.DB.prepare(`
          SELECT id FROM products WHERE id = ? AND is_active = 1
        `).bind(body.product_id).first();

        if (!product) {
          return response({ ok: false, error: "Product not found" }, request, 404);
        }

        if (body.action === "remove") {
          await env.DB.prepare(`
            DELETE FROM favorites WHERE telegram_id = ? AND product_id = ?
          `).bind(user.id, body.product_id).run();
        } else {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO favorites (telegram_id, product_id)
            VALUES (?, ?)
          `).bind(user.id, body.product_id).run();
        }

        return response({ ok: true }, request);
      }

      if (request.method === "GET" && path === "/api/orders") {
        const result = await env.DB.prepare(`
          SELECT id, product_id, product_title, quantity, price_stars,
                 discount_percent, total_stars, payment_status,
                 fulfillment_status, created_at, paid_at, delivered_at
          FROM orders
          WHERE telegram_id = ?
          ORDER BY created_at DESC
          LIMIT 100
        `).bind(user.id).all();

        return response({ ok: true, orders: result.results }, request);
      }

      if (request.method === "POST" && path === "/api/orders") {
        const body = await readJson(request);
        if (!body || typeof body.product_id !== "string") {
          return response({ ok: false, error: "product_id required" }, request, 400);
        }

        const product = await env.DB.prepare(`
          SELECT id, title, price_stars
          FROM products
          WHERE id = ? AND is_active = 1
        `).bind(body.product_id).first();

        if (!product) {
          return response({ ok: false, error: "Product not found" }, request, 404);
        }

        const orderId = makeId();
        const quantity = Math.max(1, Math.min(10, Number(body.quantity) || 1));
        const discount = 10;
        const subtotal = product.price_stars * quantity;
        const total = Math.max(1, Math.round(subtotal * (100 - discount) / 100));

        await env.DB.prepare(`
          INSERT INTO orders (
            id, telegram_id, product_id, product_title, quantity,
            price_stars, discount_percent, total_stars,
            payment_status, fulfillment_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'awaiting_payment')
        `).bind(
          orderId, user.id, product.id, product.title, quantity,
          product.price_stars, discount, total
        ).run();

        return response({
          ok: true,
          order: {
            id: orderId,
            product_id: product.id,
            product_title: product.title,
            quantity,
            price_stars: product.price_stars,
            discount_percent: discount,
            total_stars: total,
            payment_status: "pending"
          },
          next: "POST /api/payments/invoice"
        }, request, 201);
      }

      if (request.method === "POST" && path === "/api/payments/invoice") {
        const body = await readJson(request);
        if (!body || typeof body.order_id !== "string") {
          return response({ ok: false, error: "order_id required" }, request, 400);
        }

        const order = await env.DB.prepare(`
          SELECT id, product_title, total_stars, payment_status
          FROM orders
          WHERE id = ? AND telegram_id = ?
        `).bind(body.order_id, user.id).first();

        if (!order || order.payment_status !== "pending") {
          return response({ ok: false, error: "Pending order not found" }, request, 404);
        }

        const invoiceUrl = await telegram(env, "createInvoiceLink", {
          title: order.product_title.slice(0, 32),
          description: `Цифровой товар. Заказ ${order.id}`.slice(0, 255),
          payload: order.id,
          provider_token: "",
          currency: "XTR",
          prices: [{
            label: order.product_title.slice(0, 32),
            amount: order.total_stars
          }]
        });

        return response({ ok: true, invoice_url: invoiceUrl }, request);
      }

      if (request.method === "POST" && path === "/api/support/chat") {
        const body = await readJson(request);
        const message = typeof body?.message === "string"
          ? body.message.trim()
          : "";

        if (!message || message.length > 2000) {
          return response({
            ok: false,
            error: "Message must contain 1–2000 characters"
          }, request, 400);
        }

        await env.DB.prepare(`
          INSERT INTO support_messages (telegram_id, message)
          VALUES (?, ?)
        `).bind(user.id, message).run();

        await notifyOwner(
          env,
          `💬 Обращение в поддержку\n` +
          `Telegram ID: ${user.id}\n\n${message}`
        );

        return response({
          ok: true,
          saved: true,
          reply: "Сообщение сохранено. Ожидайте ответа."
        }, request);
      }

      return response({ ok: false, error: "Not found" }, request, 404);
    } catch (error) {
      console.error("Worker request failed:", String(error));
      return response({
        ok: false,
        error: "Internal server error"
      }, request, 500);
    }
  }
};
