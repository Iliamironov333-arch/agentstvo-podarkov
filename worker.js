
const SITE_ORIGIN = "https://iliamironov333-arch.github.io";
const DISCOUNT_PERCENT = 10;
const CASE_COST = 100;
const CASE_REWARDS = [0, 10, 25, 50, 100, 200];
const VIP_MONTH_STARS = 500;
const VIP_LIFETIME_STARS = 2000;

const PRODUCTS = [
  [0,"Зима в горах",200,"🏔️","winter"],
  [1,"Тёплая зима",90,"⛄","winter"],
  [2,"Новогодний ананас",260,"🍍","winter"],
  [3,"Тыква",50,"🎃","art"],
  [4,"Мышь на лыжах",150,"🐭","animals"],
  [5,"Белая башня",200,"🏰","home"],
  [6,"Довольная собака",400,"🐶","animals"],
  [7,"Пляжная картина",70,"🏖️","art"],
  [8,"Татошка",400,"🧸","animals"],
  [9,"Летнее здание",400,"🏡","home"],
  [10,"Сомы в пруду",400,"🐟","animals"],
  [11,"Доисторическое искусство",680,"🦕","art"],
  [12,"Попугай",250,"🦜","animals"],
  [13,"Александр Сергеевич Пушкин",400,"📜","art"],
  [14,"Здание в перспективе",500,"🏛️","home"],
  [15,"Тропический дракон",600,"🐉","animals"],
  [16,"Картина в перспективе",560,"🖼️","art"],
  [17,"Кит",200,"🐋","animals"],
  [18,"Арбузный дом",200,"🍉","home"],
  [19,"Ротонда",280,"🏛️","home"],
  [20,"Ночной маяк",210,"🗼","home"],
  [21,"Арбузный лес",170,"🌳","home"],
  [22,"Гусь в поле",220,"🪿","animals"],
  [23,"Ночной цветок",180,"🌺","art"],
  [24,"Редкая птица",230,"🦚","animals"],
  [25,"Сахарница с чайником",250,"🫖","art"],
  [26,"Петушок",300,"🐓","animals"],
  [27,"Голубь",180,"🕊️","animals"],
  [28,"Жаворонок",200,"🐦","animals"],
  [29,"Ворона индеец",190,"🐦‍⬛","animals"],
  [30,"Город у моря",210,"🌆","home"],
  [31,"Ёлочное украшение",90,"🔔","winter"],
  [32,"Довольный морж",260,"🦭","animals"],
  [33,"Фермерский дом",140,"🏠","home"],
  [34,"Новогодняя снежинка",90,"❄️","winter"],
  [35,"Новогодний фонарь",240,"🏮","winter"],
  [36,"Дом на холмах",220,"⛰️","home"],
  [37,"Морской отдых",150,"🌊","art"],
  [38,"Мальчик в деревне",230,"🧑‍🌾","art"],
  [39,"Торговый центр рыба",190,"🐠","animals"],
  [40,"Большой новогодний шар",150,"🔮","winter"],
  [41,"Таинственный лес",200,"🌲","winter"],
  [42,"Сырная планета",200,"🧀","art"]
];

const json = (data, status = 200, origin = SITE_ORIGIN) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "Content-Type, X-Telegram-Init-Data, X-Telegram-Bot-Api-Secret-Token",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Vary": "Origin"
    }
  });

const readJson = async request => {
  try { return await request.json(); }
  catch { return {}; }
};

const makeId = () => crypto.randomUUID();
const productId = id => String(id);

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(data)
  ));
}

const hex = bytes =>
  [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");

async function validateTelegram(initData, botToken) {
  if (!initData || !botToken) return null;

  try {
    const params = new URLSearchParams(initData);
    const suppliedHash = params.get("hash");
    if (!suppliedHash) return null;

    params.delete("hash");
    params.delete("signature");

    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = await hmac(
      new TextEncoder().encode("WebAppData"), botToken
    );

    if (hex(await hmac(secret, checkString)) !== suppliedHash) return null;

    const authDate = Number(params.get("auth_date"));
    const age = Date.now() / 1000 - authDate;
    if (!authDate || age < -60 || age > 86400) return null;

    const user = JSON.parse(params.get("user") || "null");
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

async function telegram(env, method, body) {
  if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN не настроен");

  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed`);
  }
  return result.result;
}

async function ensureUser(env, user) {
  await env.DB.prepare(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    String(user.id),
    user.username || null,
    user.first_name || null
  ).run();
}

async function notifyOwner(env, message) {
  if (!env.ADMIN_TELEGRAM_ID || !env.BOT_TOKEN) return;
  try {
    await telegram(env, "sendMessage", {
      chat_id: env.ADMIN_TELEGRAM_ID,
      text: message
    });
  } catch (e) {
    console.error("Admin notification failed:", e.message);
  }
}

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT id, title, description, image_url, category, price_stars
    FROM products WHERE is_active = 1 ORDER BY created_at DESC
  `).all();

  if (result.results?.length) {
    return result.results.map(p => ({
      ...p,
      id: String(p.id),
      emoji: PRODUCTS.find(x => String(x[0]) === String(p.id))?.[3] || "🎁"
    }));
  }

  // Запасной каталог из HTML. Для оформления заказа товары
  // должны также присутствовать в таблице products.
  return PRODUCTS.map(p => ({
    id: String(p[0]),
    title: p[1],
    price_stars: p[2],
    emoji: p[3],
    category: p[4]
  }));
}

async function createInvoice(env, order) {
  return telegram(env, "createInvoiceLink", {
    title: `Заказ ${order.id.slice(0, 8)}`,
    description: String(order.product_title).slice(0, 255),
    payload: order.id,
    currency: "XTR",
    prices: [{
      label: String(order.product_title).slice(0, 32),
      amount: Number(order.total_stars)
    }]
  });
}

async function createBalanceTransaction(
  env, telegramId, amount, type, description, idempotencyKey
) {
  return env.DB.prepare(`
    INSERT INTO balance_transactions
      (telegram_id, amount_stars, operation_type, description, idempotency_key)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    String(telegramId), amount, type, description, idempotencyKey
  ).run();
}

async function handleWebhook(request, env) {
  const supplied = request.headers.get(
    "X-Telegram-Bot-Api-Secret-Token"
  );

  if (!env.TELEGRAM_WEBHOOK_SECRET ||
      supplied !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: "Forbidden" }, 403);
  }

  const update = await readJson(request);

  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    let valid = false;

    try {
      const order = await env.DB.prepare(`
        SELECT id, telegram_id, total_stars, payment_status
        FROM orders WHERE id = ?
      `).bind(q.invoice_payload).first();

      valid = !!order &&
        String(order.telegram_id) === String(q.from.id) &&
        Number(order.total_stars) === Number(q.total_amount) &&
        q.currency === "XTR" &&
        order.payment_status === "pending";

      await telegram(env, "answerPreCheckoutQuery", {
        pre_checkout_query_id: q.id,
        ok: valid,
        ...(!valid ? {
          error_message: "Заказ недействителен или уже оплачен."
        } : {})
      });
    } catch (e) {
      console.error("Pre-checkout error:", e.message);
    }

    return json({ ok: true });
  }

  const message = update.message;
  const payment = message?.successful_payment;

  if (payment && payment.currency === "XTR") {
    const telegramId = String(message.from.id);
    const orderId = payment.invoice_payload;

    try {
      // Уникальные ограничения orders.id и payments.order_id
      // защищают от повторной обработки одного платежа.
      const result = await env.DB.prepare(`
        UPDATE orders
        SET payment_status = 'paid',
            fulfillment_status = 'awaiting_delivery',
            paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND telegram_id = ?
          AND total_stars = ?
          AND payment_status = 'pending'
      `).bind(
        orderId, telegramId, payment.total_amount
      ).run();

      if (result.meta?.changes) {
        await env.DB.prepare(`
          INSERT INTO payments (
            order_id, telegram_id, telegram_payment_charge_id,
            currency, amount_stars, status, confirmed_at
          ) VALUES (?, ?, ?, 'XTR', ?, 'paid', CURRENT_TIMESTAMP)
        `).bind(
          orderId,
          telegramId,
          payment.telegram_payment_charge_id,
          payment.total_amount
        ).run();

        const order = await env.DB.prepare(`
          SELECT product_title FROM orders WHERE id = ?
        `).bind(orderId).first();

        await notifyOwner(env,
          `🎁 Оплачен заказ!\n` +
          `ID: ${orderId}\n` +
          `Покупатель: ${telegramId}\n` +
          `Сумма: ${payment.total_amount} ⭐\n` +
          `Товары: ${order?.product_title || "см. заказ"}`
        );
      }
    } catch (e) {
      console.error("Payment processing error:", e.message);
    }
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get("Origin") || SITE_ORIGIN;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers":
            "Content-Type, X-Telegram-Init-Data, X-Telegram-Bot-Api-Secret-Token",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Vary": "Origin"
        }
      });
    }

    try {
      if (path === "/api/health" && method === "GET") {
        return json({
          ok: true,
          service: "agentstvo-podarkov-api",
          databaseConfigured: !!env.DB,
          botConfigured: !!env.BOT_TOKEN
        }, 200, origin);
      }

      if (path === "/api/telegram/webhook" && method === "POST") {
        if (!env.DB || !env.BOT_TOKEN) {
          return json({ error: "Server not configured" }, 500, origin);
        }
        return handleWebhook(request, env);
      }

      if (!path.startsWith("/api/")) {
        return json({ error: "Not found" }, 404, origin);
      }

      if (!env.DB) {
        return json({ error: "D1 binding DB is missing" }, 500, origin);
      }

      const user = await validateTelegram(
        request.headers.get("X-Telegram-Init-Data"),
        env.BOT_TOKEN
      );

      if (!user) {
        return json({ error: "Telegram authentication failed" }, 401, origin);
      }

      const telegramId = String(user.id);
      await ensureUser(env, user);

      if (path === "/api/products" && method === "GET") {
        return json({ products: await getProducts(env) }, 200, origin);
      }

      if (path === "/api/me" && method === "GET") {
        const me = await env.DB.prepare(`
          SELECT telegram_id, username, first_name, balance_stars, created_at
          FROM users WHERE telegram_id = ?
        `).bind(telegramId).first();

        const orders = await env.DB.prepare(`
          SELECT id AS order_id, created_at, total_stars AS amount,
                 'XTR' AS currency, payment_status AS status
          FROM orders WHERE telegram_id = ?
          ORDER BY created_at DESC LIMIT 20
        `).bind(telegramId).all();

        const vip = await env.DB.prepare(`
          SELECT plan_type, status, starts_at, expires_at
          FROM vip_subscriptions
          WHERE telegram_id = ?
          ORDER BY id DESC LIMIT 1
        `).bind(telegramId).first();

        return json({
          points: Number(me?.balance_stars || 0),
          balance_stars: Number(me?.balance_stars || 0),
          first_name: me?.first_name || user.first_name || "",
          username: me?.username || user.username || "",
          orders: orders.results || [],
          vip: vip || null
        }, 200, origin);
      }

      if (path === "/api/orders" && method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id AS order_id, product_id, product_title, quantity,
                 price_stars, discount_percent, total_stars,
                 payment_status, fulfillment_status, created_at,
                 paid_at, delivered_at
          FROM orders WHERE telegram_id = ?
          ORDER BY created_at DESC LIMIT 50
        `).bind(telegramId).all();

        return json({ orders: result.results || [] }, 200, origin);
      }

      if (path === "/api/orders" && method === "POST") {
        const body = await readJson(request);
        if (!Array.isArray(body.items) || !body.items.length) {
          return json({ error: "Корзина пуста" }, 400, origin);
        }

        const catalog = await getProducts(env);
        const quantities = new Map();

        for (const item of body.items) {
          const id = String(item.id);
          const product = catalog.find(p => String(p.id) === id);
          const qty = Math.floor(Number(item.qty));

          if (!product || !Number.isInteger(qty) || qty < 1 || qty > 10) {
            return json({ error: "Некорректный товар или количество" }, 400, origin);
          }

          quantities.set(id, (quantities.get(id) || 0) + qty);
          if (quantities.get(id) > 10) {
            return json({ error: "Максимум 10 единиц одного товара" }, 400, origin);
          }
        }

        const items = [...quantities.entries()].map(([id, qty]) => {
          const p = catalog.find(x => String(x.id) === id);
          return {
            id,
            title: p.title,
            qty,
            unit_price: Number(p.price_stars)
          };
        });

        const subtotal = items.reduce(
          (sum, p) => sum + p.unit_price * p.qty, 0
        );

        // Осенняя скидка 10% из текущего интерфейса.
        const discount = Math.floor(subtotal * DISCOUNT_PERCENT / 100);
        const total = Math.max(1, subtotal - discount);
        const orderId = makeId();
        const title = items.map(p => `${p.title} × ${p.qty}`).join("; ");

        await env.DB.prepare(`
          INSERT INTO orders (
            id, telegram_id, product_id, product_title, quantity,
            price_stars, discount_percent, total_stars,
            payment_status, fulfillment_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'awaiting_payment')
        `).bind(
          orderId,
          telegramId,
          items.length === 1 ? items[0].id : null,
          title,
          items.reduce((sum, p) => sum + p.qty, 0),
          subtotal,
          DISCOUNT_PERCENT,
          total
        ).run();

        const invoiceUrl = await createInvoice(env, {
          id: orderId,
          product_title: title,
          total_stars: total
        });

        return json({
          ok: true,
          invoice_url: invoiceUrl,
          order_id: orderId
        }, 200, origin);
      }

      if (path === "/api/favorites" && method === "GET") {
        const result = await env.DB.prepare(`
          SELECT f.product_id, f.created_at,
                 p.title, p.description, p.image_url,
                 p.category, p.price_stars
          FROM favorites f
          LEFT JOIN products p ON p.id = f.product_id
          WHERE f.telegram_id = ?
          ORDER BY f.created_at DESC
        `).bind(telegramId).all();

        return json({ favorites: result.results || [] }, 200, origin);
      }

      if (path === "/api/favorites" && method === "POST") {
        const body = await readJson(request);
        const id = String(body.product_id ?? body.id ?? "");
        const action = body.action || "add";

        if (!id) {
          return json({ error: "Не указан товар" }, 400, origin);
        }

        if (action === "remove") {
          await env.DB.prepare(`
            DELETE FROM favorites
            WHERE telegram_id = ? AND product_id = ?
          `).bind(telegramId, id).run();
          return json({ ok: true, removed: true }, 200, origin);
        }

        const product = await env.DB.prepare(`
          SELECT id FROM products WHERE id = ? AND is_active = 1
        `).bind(id).first();

        if (!product) {
          return json({ error: "Товар не найден в таблице products" }, 404, origin);
        }

        await env.DB.prepare(`
          INSERT OR IGNORE INTO favorites (telegram_id, product_id)
          VALUES (?, ?)
        `).bind(telegramId, id).run();

        return json({ ok: true, added: true }, 200, origin);
      }

      if (path === "/api/balance" && method === "GET") {
        const userRow = await env.DB.prepare(`
          SELECT balance_stars FROM users WHERE telegram_id = ?
        `).bind(telegramId).first();

        const transactions = await env.DB.prepare(`
          SELECT amount_stars, operation_type, description, created_at
          FROM balance_transactions
          WHERE telegram_id = ?
          ORDER BY id DESC LIMIT 50
        `).bind(telegramId).all();

        return json({
          balance_stars: Number(userRow?.balance_stars || 0),
          transactions: transactions.results || []
        }, 200, origin);
      }

      if (path === "/api/balance/topup" && method === "POST") {
        const body = await readJson(request);
        const amount = Math.floor(Number(body.amount_stars));

        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
          return json({ error: "Некорректная сумма пополнения" }, 400, origin);
        }

        const payload = `topup:${telegramId}:${makeId()}`;
        const invoiceUrl = await telegram(env, "createInvoiceLink", {
          title: "Пополнение баланса",
          description: `Зачисление ${amount} Stars на баланс`,
          payload,
          currency: "XTR",
          prices: [{ label: "Пополнение баланса", amount }]
        });

        await env.DB.prepare(`
          INSERT INTO app_settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        `).bind(
          `pending_topup:${payload}`,
          JSON.stringify({ telegram_id: telegramId, amount_stars: amount })
        ).run();

        return json({ ok: true, invoice_url: invoiceUrl }, 200, origin);
      }

      if (path === "/api/case/open" && method === "POST") {
        const body = await readJson(request);
        const requestId = String(body.request_id || "");

        if (!requestId || requestId.length > 100) {
          return json({ error: "Некорректный request_id" }, 400, origin);
        }

        const idempotencyKey = `case:${telegramId}:${requestId}`;

        // Запись операции и списание выполняются атомарно.
        const reward = CASE_REWARDS[
          crypto.getRandomValues(new Uint32Array(1))[0] % CASE_REWARDS.length
        ];

        try {
          await env.DB.batch([
            env.DB.prepare(`
              INSERT INTO balance_transactions
                (telegram_id, amount_stars, operation_type, description, idempotency_key)
              VALUES (?, ?, 'case_open', ?, ?)
            `).bind(
              telegramId,
              -CASE_COST,
              `Открытие кейса; награда ${reward} баллов`,
              idempotencyKey
            ),
            env.DB.prepare(`
              UPDATE users
              SET balance_stars = balance_stars - ?, updated_at = CURRENT_TIMESTAMP
              WHERE telegram_id = ? AND balance_stars >= ?
            `).bind(CASE_COST, telegramId, CASE_COST)
          ]);

          const transaction = await env.DB.prepare(`
            SELECT amount_stars FROM balance_transactions
            WHERE idempotency_key = ?
          `).bind(idempotencyKey).first();

          const userRow = await env.DB.prepare(`
            SELECT balance_stars FROM users WHERE telegram_id = ?
          `).bind(telegramId).first();

          if (!transaction || Number(transaction.amount_stars) !== -CASE_COST ||
              Number(userRow?.balance_stars) < 0) {
            return json({ error: "Недостаточно баллов" }, 400, origin);
          }

          if (reward > 0) {
            const rewardKey = `${idempotencyKey}:reward`;
            await env.DB.batch([
              env.DB.prepare(`
                INSERT OR IGNORE INTO balance_transactions
                  (telegram_id, amount_stars, operation_type, description, idempotency_key)
                VALUES (?, ?, 'case_reward', ?, ?)
              `).bind(
                telegramId, reward, `Награда из кейса: ${reward} баллов`, rewardKey
              ),
              env.DB.prepare(`
                UPDATE users SET balance_stars = balance_stars + ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
                  AND EXISTS (
                    SELECT 1 FROM balance_transactions
                    WHERE idempotency_key = ?
                  )
              `).bind(reward, telegramId, rewardKey)
            ]);
          }

          const finalUser = await env.DB.prepare(`
            SELECT balance_stars FROM users WHERE telegram_id = ?
          `).bind(telegramId).first();

          return json({
            ok: true,
            points: Number(finalUser?.balance_stars || 0),
            reward,
            message: reward
              ? `🎉 В кейсе ${reward} баллов!`
              : "В этот раз без выигрыша. Попробуй позже!"
          }, 200, origin);
        } catch (e) {
          if (String(e.message).includes("UNIQUE")) {
            return json({
              error: "Этот кейс уже открыт",
              duplicate: true
            }, 409, origin);
          }
          throw e;
        }
      }

      if (path === "/api/vip" && method === "GET") {
        const vip = await env.DB.prepare(`
          SELECT id, plan_type, status, starts_at, expires_at
          FROM vip_subscriptions
          WHERE telegram_id = ?
          ORDER BY id DESC LIMIT 1
        `).bind(telegramId).first();

        return json({ vip: vip || null }, 200, origin);
      }

      if (p --- TRUNCATED --- 26,699 char