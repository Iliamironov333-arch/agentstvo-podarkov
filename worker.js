const SITE_ORIGIN = "https://iliamironov333-arch.github.io";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin === SITE_ORIGIN ||
    origin === "https://iliamironov333-arch.github.io";

  return {
    "Access-Control-Allow-Origin": allowed ? origin : SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Init-Data",
    "Vary": "Origin"
  };
}

function response(data, request, status = 200) {
  const headers = corsHeaders(request);
  headers["Content-Type"] = "application/json; charset=utf-8";
  headers["Cache-Control"] = "no-store";
  return new Response(JSON.stringify(data), { status, headers });
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
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

  if (!hash || !authDate || !userText) return null;

  // Reject expired data and timestamps too far in the future.
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
  const expectedHash = hex(await hmac(secretKey, checkString));

  if (expectedHash.length !== hash.length) return null;

  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= expectedHash.charCodeAt(i) ^ hash.toLowerCase().charCodeAt(i);
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
  const initData = request.headers.get("X-Telegram-Init-Data") || "";
  return validateTelegram(initData, env.BOT_TOKEN);
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

    if (request.method === "GET" && path === "/api/health") {
      return response({ ok: true, service: "agentstvo-podarkov-api" }, request);
    }

    if (!env.DB) {
      return response({ ok: false, error: "D1 database is not configured" }, request, 503);
    }

    if (!env.BOT_TOKEN) {
      return response({ ok: false, error: "Bot token secret is not configured" }, request, 503);
    }

    if (path === "/api/me" && request.method === "GET") {
      const user = await getUser(request, env);
      if (!user) {
        return response({ ok: false, error: "Telegram authorization failed. Open the app from your bot." }, request, 401);
      }

      await env.DB.prepare(`
        INSERT INTO users (telegram_id, username, first_name)
        VALUES (?, ?, ?)
        ON CONFLICT(telegram_id) DO UPDATE SET
          username = excluded.username,
          first_name = excluded.first_name,
          updated_at = datetime('now')
      `).bind(user.id, user.username, user.first_name).run();

      const profile = await env.DB.prepare(`
        SELECT telegram_id, username, first_name, balance, vip_type, created_at
        FROM users WHERE telegram_id = ?
      `).bind(user.id).first();

      return response({ ok: true, user: profile }, request);
    }

    if (path === "/api/support/chat" && request.method === "POST") {
      const user = await getUser(request, env);
      if (!user) {
        return response({ ok: false, error: "Telegram authorization failed" }, request, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return response({ ok: false, error: "Invalid JSON" }, request, 400);
      }

      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message || message.length > 2000) {
        return response({ ok: false, error: "Message must contain 1–2000 characters" }, request, 400);
      }

      await env.DB.prepare(`
        INSERT INTO users (telegram_id, username, first_name)
        VALUES (?, ?, ?)
        ON CONFLICT(telegram_id) DO NOTHING
      `).bind(user.id, user.username, user.first_name).run();

      await env.DB.prepare(`
        INSERT INTO support_messages (telegram_id, role, message)
        VALUES (?, 'user', ?)
      `).bind(user.id, message).run();

      return response({ ok: true, saved: true, reply: "Сообщение сохранено. Ответ оператора пока не подключён." }, request);
    }

    return response({ ok: false, error: "Not found" }, request, 404);
  }
};
