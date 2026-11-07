const SITE_ORIGIN = "https://iliamironov333-arch.github.io";
const DISCOUNT_PERCENT = 0;
const VIP_PRICES = { subscription: 500, lifetime: 2000 };
// Пополнение доступно на любую целую сумму от 1 до 10 000 Stars.
const CUSTOM_PRICE_OPTIONS = {"style":{"classic":0,"watercolor":80,"perspective":120,"autumn":40,"realistic":150,"artist_choice":0},"format":{"postcard":0,"a5":40,"a4":90,"large":140},"palette":{"natural":0,"bright":25,"pastel":35,"custom":55},"complexity":{"simple":0,"medium":45,"detailed":90},"deadline":{"standard":0,"priority":100}};
const PRODUCT_META = [
  ["0","Зима в горах","🏔️","winter"],["1","Тёплая зима","⛄","winter"],
  ["2","Новогодний ананас","🍍","winter"],["3","Тыква","🎃","art"],
  ["4","Мышь на лыжах","🐭","animals"],["5","Белая башня","🏰","home"],
  ["6","Довольная собака","🐶","animals"],["7","Пляжная картина","🏖️","art"],
  ["8","Татошка","🧸","animals"],["9","Летнее здание","🏡","home"],
  ["10","Сомы в пруду","🐟","animals"],["11","Доисторическое искусство","🦕","art"],
  ["12","Попугай","🦜","animals"],["13","Александр Сергеевич Пушкин","📜","art"],
  ["14","Здание в перспективе","🏛️","home"],["15","Тропический дракон","🐉","animals"],
  ["16","Картина в перспективе","🖼️","art"],["17","Кит","🐋","animals"],
  ["18","Арбузный дом","🍉","home"],["19","Ротонда","🏛️","home"],
  ["20","Ночной маяк","🗼","home"],["21","Арбузный лес","🌳","home"],
  ["22","Гусь в поле","🪿","animals"],["23","Ночной цветок","🌺","art"],
  ["24","Редкая птица","🦚","animals"],["25","Сахарница с чайником","🫖","art"],
  ["26","Петушок","🐓","animals"],["27","Голубь","🕊️","animals"],
  ["28","Жаворонок","🐦","animals"],["29","Ворона индеец","🐦‍⬛","animals"],
  ["30","Город у моря","🌆","home"],["31","Ёлочное украшение","🔔","winter"],
  ["32","Довольный морж","🦭","animals"],["33","Фермерский дом","🏠","home"],
  ["34","Новогодняя снежинка","❄️","winter"],["35","Новогодний фонарь","🏮","winter"],
  ["36","Дом на холмах","⛰️","home"],["37","Морской отдых","🌊","art"],
  ["38","Мальчик в деревне","🧑‍🌾","art"],["39","Торговый центр рыба","🐠","animals"],
  ["40","Большой новогодний шар","🔮","winter"],["41","Таинственный лес","🌲","winter"],
  ["42","Сырная планета","🧀","art"]
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Init-Data, X-Telegram-Bot-Api-Secret-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}
function json(data, status = 200, origin = SITE_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}
async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
function makeId() { return crypto.randomUUID(); }
function isMissingTableError(error, tableName) {
  const message = String(error || "").toLowerCase();
  return message.includes("no such table") && message.includes(String(tableName).toLowerCase());
}
async function optionalTableRows(statement, tableName) {
  try { return await statement.all(); }
  catch (error) {
    if (isMissingTableError(error, tableName)) return { results: [], migration_pending: true };
    throw error;
  }
}
async function tableExists(env, tableName) {
  try { await env.DB.prepare("SELECT 1 FROM " + tableName + " LIMIT 1").first(); return true; }
  catch (error) { if (isMissingTableError(error, tableName)) return false; throw error; }
}
async function getAdminOrderMeta(env, orderType, order) {
  const result = await optionalTableRows(
    env.DB.prepare("SELECT actor_telegram_id,action_type,details,created_at FROM admin_action_log WHERE target_telegram_id=? AND action_type IN ('order_status_changed','order_comment') ORDER BY id DESC LIMIT 100")
      .bind(String(order.telegram_id)),
    "admin_action_log"
  );
  const history = [];
  for (const row of result.results || []) {
    let details = {};
    try { details = JSON.parse(row.details || "{}"); } catch { continue; }
    if (String(details.order_id) !== String(order.id) || details.order_type !== orderType) continue;
    history.push({ actor_telegram_id: row.actor_telegram_id, action_type: row.action_type, details, created_at: row.created_at });
  }
  const latestStatus = history.find(item => item.action_type === "order_status_changed");
  let fallbackStatus = "new";
  if (orderType === "product") {
    if (order.payment_status === "pending") fallbackStatus = "unpaid";
    else if (order.payment_status === "cancelled" || order.fulfillment_status === "cancelled") fallbackStatus = "cancelled";
    else if (order.fulfillment_status === "delivered") fallbackStatus = "ready";
  } else if (["cancelled","canceled"].includes(order.status)) fallbackStatus = "cancelled";
  else if (["ready","completed","done"].includes(order.status)) fallbackStatus = "ready";
  else if (["in_progress","processing","work"].includes(order.status)) fallbackStatus = "in_progress";
  return { admin_status: latestStatus?.details?.status || fallbackStatus, history, migrations_pending: !!result.migration_pending };
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}
function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
async function validateTelegram(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const suppliedHash = params.get("hash");
    if (!suppliedHash) return null;
    params.delete("hash");
    const checkString = Array.from(params.entries())
      .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
      .map(([key, value]) => key + "=" + value).join("\n");
    const secret = await hmac(new TextEncoder().encode("WebAppData"), botToken);
    const calculated = toHex(await hmac(secret, checkString));
    if (!safeEqual(calculated, suppliedHash)) return null;
    const authDate = Number(params.get("auth_date"));
    const age = Date.now() / 1000 - authDate;
    if (!Number.isFinite(authDate) || age < -60 || age > 86400) return null;
    const user = JSON.parse(params.get("user") || "null");
    return user && user.id ? user : null;
  } catch { return null; }
}
async function telegram(env, method, body) {
  if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN не настроен в Cloudflare");
  const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || ("Telegram " + method + " failed"));
  return result.result;
}
async function ensureUser(env, user) {
  await env.DB.prepare("INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=CURRENT_TIMESTAMP")
    .bind(String(user.id), user.username || null, user.first_name || null).run();
}
async function notifyOwner(env, message) {
  if (!env.ADMIN_TELEGRAM_ID || !env.BOT_TOKEN) return;
  try {
    await telegram(env, "sendMessage", { chat_id: env.ADMIN_TELEGRAM_ID, text: message });
  } catch (error) { console.error("Owner notification failed:", String(error)); }
}
async function deliverOrderImages(env, orderId, telegramId) {
  const rowsResult = await env.DB.prepare("SELECT id,delivery_status FROM order_items WHERE order_id=? ORDER BY id")
    .bind(orderId).all();
  const rows = rowsResult.results || [];
  if (!rows.length) {
    await notifyOwner(env, "⚠️ Заказ " + orderId + " оплачен, но в order_items нет товаров. Отправка открытки остановлена.");
    return false;
  }
  if (rows.every(row => row.delivery_status === "sent")) return true;

  // Claim the order's pending delivery rows to prevent two webhook retries from sending two postcards.
  const claim = await env.DB.prepare("UPDATE order_items SET delivery_status='sending',delivery_started_at=CURRENT_TIMESTAMP WHERE order_id=? AND (delivery_status='pending' OR (delivery_status='sending' AND (delivery_started_at IS NULL OR delivery_started_at < datetime('now','-10 minutes'))))")
    .bind(orderId).run();
  if (!claim.meta || claim.meta.changes < 1) return false;

  try {
    const assetUrl = "https://raw.githubusercontent.com/Iliamironov333-arch/agentstvo-podarkov/main/assets/thank-you.jpg.b64";
    const assetResponse = await fetch(assetUrl, { cf: { cacheTtl: 3600 } });
    if (!assetResponse.ok) throw new Error("Не удалось получить открытку из GitHub: HTTP " + assetResponse.status);
    const base64 = (await assetResponse.text()).trim();
    if (!base64.startsWith("/9j/") || base64.length < 1000) throw new Error("Файл открытки повреждён или имеет неверный формат.");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const form = new FormData();
    form.append("chat_id", String(telegramId));
    form.append("caption", "🎁 Спасибо за покупку! Ваш заказ оплачен. Саму работу Илья доставит отдельно.");
    form.append("photo", new Blob([bytes], { type: "image/jpeg" }), "thank-you.jpg");
    const telegramResponse = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendPhoto", {
      method: "POST",
      body: form
    });
    const telegramResult = await telegramResponse.json();
    if (!telegramResponse.ok || !telegramResult.ok) {
      throw new Error("Telegram sendPhoto: " + (telegramResult.description || telegramResponse.status));
    }

    await env.DB.prepare("UPDATE order_items SET delivery_status='sent',delivered_at=CURRENT_TIMESTAMP,delivery_started_at=NULL WHERE order_id=? AND delivery_status='sending'")
      .bind(orderId).run();
    // The postcard is delivered automatically; the actual artwork is delivered manually by the seller.
    // Keep the order in awaiting_delivery until the seller completes the artwork delivery.
    return true;
  } catch (error) {
    await env.DB.prepare("UPDATE order_items SET delivery_status='pending',delivery_started_at=NULL WHERE order_id=? AND delivery_status='sending'")
      .bind(orderId).run();
    await notifyOwner(env, "⚠️ Не удалось отправить открытку покупателю\nЗаказ: " + orderId + "\nОшибка: " + String(error).slice(0, 500));
    return false;
  }
}

async function getProducts(env) {
  const result = await env.DB.prepare("SELECT id,title,description,image_url,category,price_stars FROM products WHERE is_active=1 ORDER BY CAST(id AS INTEGER)")
    .all();
  if (result.results && result.results.length) {
    return result.results.map(p => {
      const meta = PRODUCT_META.find(x => x[0] === String(p.id));
      return { ...p, id: String(p.id), emoji: meta ? meta[2] : "🎁" };
    });
  }
  return [];
}
async function createInvoice(env, title, description, payload, amount) {
  return telegram(env, "createInvoiceLink", {
    title: String(title).slice(0, 32),
    description: String(description).slice(0, 255),
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: String(title).slice(0, 32), amount: Number(amount) }]
  });
}
async function createPaymentIntent(env, data) {
  await env.DB.prepare("INSERT INTO payment_intents (payload,telegram_id,kind,reference_id,amount_stars,bonus_points,plan_type,status) VALUES (?,?,?,?,?,?,?,'pending')")
    .bind(data.payload, String(data.telegram_id), data.kind, data.reference_id || null,
      data.amount_stars, data.bonus_points || 0, data.plan_type || null).run();
  try {
    return await createInvoice(env, data.title, data.description, data.payload, data.amount_stars);
  } catch (error) {
    await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND status='pending'")
      .bind(data.payload).run();
    throw error;
  }
}

async function createSupportAnswer(env, history, isVip) {
  if (!env.OPENAI_API_KEY) throw new Error("ИИ-помощник ещё не подключён: добавьте OPENAI_API_KEY в Cloudflare Worker Secrets.");
  const instructions = [
    "Ты — официальный ИИ-помощник мини-приложения «Агентство подарков». Отвечай на русском языке, доброжелательно, ясно и кратко.",
    "Помогай по вопросам каталога, авторских работ, индивидуальных заказов, оплаты Telegram Stars, заказов, баланса, поддержки и VIP.",
    "Не выдумывай наличие товара, статус заказа, факт оплаты, сроки доставки, баланс или условия, которых нет в проверенных данных.",
    "Не проси пароли, токены, API-ключи, коды Telegram или платёжные реквизиты.",
    "Если не знаешь ответ, честно скажи об этом и предложи обратиться к владельцу. Не утверждай, что сам изменил заказ, баланс или оплату.",
    "Не обещай возврат, доставку или изменение данных без подтверждения владельца.",
    isVip ? "Пользователь VIP: давай более подробные рекомендации по выбору подарков, но не выдумывай факты и не меняй правила оплаты." : "Пользователь без VIP: предоставляй базовую поддержку и рекомендации по каталогу."
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4o-mini", instructions,
      input: history.map(item => ({ role: item.role, content: item.content })), max_output_tokens: 500 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("OpenAI support request failed:", response.status, JSON.stringify(data).slice(0, 1000));
    throw new Error("Сервис помощника временно недоступен. Попробуй позже.");
  }
  let answer = typeof data.output_text === "string" ? data.output_text : "";
  if (!answer && Array.isArray(data.output)) {
    answer = data.output.flatMap(item => Array.isArray(item.content) ? item.content : [])
      .filter(part => part.type === "output_text" && typeof part.text === "string")
      .map(part => part.text).join("\n");
  }
  if (!answer.trim()) throw new Error("Помощник не вернул ответ. Попробуй ещё раз.");
  return answer.trim().slice(0, 4000);
}

async function createCraftAnswer(env,theme,material,level){
 if(!env.OPENAI_API_KEY)throw new Error("ИИ-мастерская временно не подключена.");
 const instructions=["Ты — ИИ-мастер Агентства подарков, специалист по оригинальным поделкам ручной работы.","Отвечай по-русски. Создавай конкретную и выполнимую идею, а не общие советы.","Структура: название; концепция; материалы; инструменты; пошаговое изготовление; оформление и персонализация; примерное время; советы по аккуратности и безопасности.","Учитывай материалы и сложность. Если материалы не указаны, предложи доступные и недорогие варианты.","Не предлагай огонь, токсичные вещества, опасные конструкции или рискованные действия. Для потенциально опасных инструментов укажи, что нужна помощь взрослого.","Не выдумывай цены и наличие материалов."].join("\n");
 const input="Задумка: "+theme+"\nМатериалы: "+material+"\nСложность: "+level+"\nРазработай полноценный проект поделки.";
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4o-mini",instructions,input,max_output_tokens:900})});
 const d=await r.json().catch(()=>({}));if(!r.ok){console.error("Craft assistant failed:",r.status,JSON.stringify(d).slice(0,800));throw new Error("ИИ-мастерская временно недоступна. Попробуйте позже.");}
 let a=typeof d.output_text==="string"?d.output_text:"";if(!a&&Array.isArray(d.output))a=d.output.flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x.type==="output_text"&&typeof x.text==="string").map(x=>x.text).join("\n");if(!a.trim())throw new Error("ИИ-мастерская не вернула результат.");return a.trim().slice(0,7000);
}
async function createVipSupportAnswer(env,message){
 const instructions=["Ты — старший специалист VIP-поддержки официального Агентства подарков.","Отвечай по-русски уважительно, внимательно и конкретно. У пользователя действующая VIP-подписка.","Помогай по заказам, каталогу, оплате, балансу и услугам Агентства. Не выдумывай статусы, платежи, сроки, цены или выполненные действия.","Если для решения нужен владелец, предложи явно запросить передачу обращения. Не обещай срок ответа."].join("\n");
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4o-mini",instructions,input:message,max_output_tokens:600})});
 const d=await r.json().catch(()=>({}));if(!r.ok){console.error("VIP support failed:",r.status,JSON.stringify(d).slice(0,800));throw new Error("VIP-помощь временно недоступна.");}
 let a=typeof d.output_text==="string"?d.output_text:"";if(!a&&Array.isArray(d.output))a=d.output.flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x.type==="output_text"&&typeof x.text==="string").map(x=>x.text).join("\n");if(!a.trim())throw new Error("VIP-помощник не вернул ответ.");return a.trim().slice(0,4000);
}

async function handleWebhook(request, env) {
  const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || !safeEqual(supplied || "", env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
  const update = await readJson(request);
  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    let valid = false;
    try {
      const intent = await env.DB.prepare("SELECT payload,telegram_id,amount_stars,status FROM payment_intents WHERE payload=?")
        .bind(q.invoice_payload).first();
      valid = !!intent && String(intent.telegram_id) === String(q.from.id) &&
        Number(intent.amount_stars) === Number(q.total_amount) &&
        q.currency === "XTR" && intent.status === "pending";
    } catch (error) { console.error("Pre-checkout lookup failed:", String(error)); }
    await telegram(env, "answerPreCheckoutQuery", {
      pre_checkout_query_id: q.id,
      ok: valid,
      ...(!valid ? { error_message: "Счёт недействителен или уже обработан. Создайте новый счёт." } : {})
    });
    return json({ ok: true });
  }
  const message = update.message;
  const payment = message && message.successful_payment;
  if (!payment) return json({ ok: true });
  if (payment.currency !== "XTR") return json({ ok: false, error: "Unexpected currency" }, 400);
  const telegramId = String(message.from.id);
  const payload = String(payment.invoice_payload || "");
  const intent = await env.DB.prepare("SELECT * FROM payment_intents WHERE payload=?")
    .bind(payload).first();
  if (!intent || String(intent.telegram_id) !== telegramId ||
      Number(intent.amount_stars) !== Number(payment.total_amount)) {
    console.error("Payment intent mismatch", payload);
    return json({ ok: true });
  }
  const chargeId = String(payment.telegram_payment_charge_id || "");
  if (!chargeId) return json({ ok: true });

  if (intent.kind === "order") {
    const order = await env.DB.prepare("SELECT id,product_title,total_stars,payment_status FROM orders WHERE id=? AND telegram_id=?")
      .bind(intent.reference_id, telegramId).first();
    if (!order) return json({ ok: true });
    const earned = Math.floor(Number(intent.amount_stars) / 3);
    if (intent.status === "pending") {
      const statements = [
        env.DB.prepare("UPDATE payment_intents SET status='paid',charge_id=?,paid_at=CURRENT_TIMESTAMP WHERE payload=? AND status='pending' AND telegram_id=? AND amount_stars=?")
          .bind(chargeId, payload, telegramId, payment.total_amount),
        env.DB.prepare("UPDATE orders SET payment_status='paid',fulfillment_status='awaiting_delivery',paid_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND payment_status='pending' AND EXISTS (SELECT 1 FROM payment_intents WHERE payload=? AND status='paid' AND charge_id=?)")
          .bind(order.id, telegramId, payload, chargeId),
        env.DB.prepare("INSERT OR IGNORE INTO payments (order_id,telegram_id,telegram_payment_charge_id,currency,amount_stars,status,confirmed_at) SELECT ?,?,?,'XTR',?,'paid',CURRENT_TIMESTAMP WHERE changes()=1")
          .bind(order.id, telegramId, chargeId, payment.total_amount)
      ];
      if (earned > 0) {
        statements.push(env.DB.prepare("INSERT OR IGNORE INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'purchase_reward',?,? WHERE changes()=1")
          .bind(telegramId, earned, "Баллы за покупку: " + order.product_title, "purchase:" + order.id));
        statements.push(env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND changes()=1")
          .bind(earned, telegramId));
      }
      const results = await env.DB.batch(statements);
      if (!results[1] || !results[1].meta || results[1].meta.changes !== 1) return json({ ok: true });
      await notifyOwner(env, "🎁 Оплачен заказ!\nID: " + order.id + "\nПокупатель: " + telegramId +
        "\nСумма: " + payment.total_amount + " ⭐\nБаллы: +" + earned + "\nТовар: " + order.product_title);
    } else if (intent.status !== "paid" || String(intent.charge_id || "") !== chargeId || order.payment_status !== "paid") {
      return json({ ok: true });
    }
    const delivered = await deliverOrderImages(env, order.id, telegramId);
    if (!delivered) return json({ ok: false, error: "Image delivery pending retry" }, 500);
    return json({ ok: true });
  }

  if (intent.kind === "topup") {
    const points = Number(intent.amount_stars) + Number(intent.bonus_points || 0);
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE payment_intents SET status='paid',charge_id=?,paid_at=CURRENT_TIMESTAMP WHERE payload=? AND status='pending' AND telegram_id=? AND amount_stars=?")
        .bind(chargeId, payload, telegramId, payment.total_amount),
      env.DB.prepare("INSERT OR IGNORE INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'topup',?,? WHERE changes()=1")
        .bind(telegramId, points, "Пополнение: " + payment.total_amount + " Stars" + (intent.bonus_points ? " + бонус " + intent.bonus_points : ""), "topup:" + payload),
      env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND changes()=1")
        .bind(points, telegramId)
    ]);
    if (results[0] && results[0].meta && results[0].meta.changes === 1) {
      await notifyOwner(env, "⭐ Баланс пополнен\nПользователь: " + telegramId +
        "\nОплачено: " + payment.total_amount + " Stars\nЗачислено: " + points + " баллов");
    }
    return json({ ok: true });
  }

  if (intent.kind === "vip") {
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE payment_intents SET status='paid',charge_id=?,paid_at=CURRENT_TIMESTAMP WHERE payload=? AND status='pending' AND telegram_id=? AND amount_stars=?")
        .bind(chargeId, payload, telegramId, payment.total_amount),
      env.DB.prepare("INSERT INTO vip_subscriptions (telegram_id,plan_type,status,starts_at,expires_at) SELECT ?,?,'active',CURRENT_TIMESTAMP,CASE WHEN ?='subscription' THEN datetime(COALESCE((SELECT MAX(expires_at) FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND expires_at>CURRENT_TIMESTAMP),'now'),'+30 days') ELSE NULL END WHERE changes()=1")
        .bind(telegramId, intent.plan_type, intent.plan_type, telegramId)
    ]);
    if (results[0] && results[0].meta && results[0].meta.changes === 1) {
      await notifyOwner(env, "👑 Оплачен VIP\nПользователь: " + telegramId +
        "\nТариф: " + intent.plan_type + "\nСумма: " + payment.total_amount + " Stars");
    }
    return json({ ok: true });
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin && requestOrigin !== SITE_ORIGIN) return json({ error: "Origin not allowed" }, 403);
    const origin = requestOrigin || SITE_ORIGIN;

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    try {
      if (path === "/api/health" && method === "GET") {
        return json({ ok: true, service: "agentstvo-podarkov-api",
          databaseConfigured: !!env.DB, botConfigured: !!env.BOT_TOKEN }, 200, origin);
      }
      if (path === "/api/telegram/webhook" && method === "POST") {
        if (!env.DB || !env.BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "Webhook is not configured" }, 500, origin);
        return handleWebhook(request, env);
      }
      if (!path.startsWith("/api/")) return json({ error: "Not found" }, 404, origin);
      if (!env.DB || !env.BOT_TOKEN) return json({ error: "Server is not configured" }, 500, origin);

      const user = await validateTelegram(request.headers.get("X-Telegram-Init-Data"), env.BOT_TOKEN);
      if (!user) return json({ error: "Telegram authentication failed. Откройте Mini App через Telegram." }, 401, origin);
      const telegramId = String(user.id);
      await ensureUser(env, user);

      // Every owner endpoint is protected on the server, not merely hidden in the Mini App.
      if (path.startsWith("/api/admin/")) {
        const ownerId = String(env.ADMIN_TELEGRAM_ID || "").trim();
        if (!ownerId) return json({ error: "Owner access is not configured." }, 503, origin);
        if (telegramId !== ownerId) return json({ error: "Owner access required." }, 403, origin);
        if (path === "/api/admin/session" && method === "GET") {
          return json({ ok: true, owner: true }, 200, origin);
        }
        if (path === "/api/admin/products" && method === "GET") {
          const rows = await env.DB.prepare("SELECT id,title,description,image_url,category,price_stars,is_active,created_at FROM products ORDER BY CAST(id AS INTEGER),created_at DESC").all();
          const categories = await env.DB.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category)<>'' ORDER BY category").all();
          return json({ ok: true, products: rows.results || [], categories: (categories.results || []).map(row => row.category) }, 200, origin);
        }
        if (path === "/api/admin/product-save" && method === "POST") {
          const body = await readJson(request);
          const id = typeof body.id === "string" ? body.id.trim().slice(0,100) : "";
          const title = typeof body.title === "string" ? body.title.trim().slice(0,120) : "";
          const description = typeof body.description === "string" ? body.description.trim().slice(0,2000) : "";
          const imageUrl = typeof body.image_url === "string" ? body.image_url.trim().slice(0,1000) : "";
          const category = typeof body.category === "string" ? body.category.trim().slice(0,60) : "";
          const price = Number(body.price_stars);
          const isActive = body.is_active === true || body.is_active === 1 ? 1 : 0;
          if (title.length < 2) return json({ error: "Название должно содержать минимум 2 символа." }, 400, origin);
          if (!Number.isSafeInteger(price) || price < 0 || price > 1000000) return json({ error: "Укажите корректную цену в Stars." }, 400, origin);
          if (!category) return json({ error: "Укажите категорию товара." }, 400, origin);
          if (imageUrl) {
            try { const parsed = new URL(imageUrl); if (parsed.protocol !== "https:") throw new Error("protocol"); }
            catch { return json({ error: "Ссылка на изображение должна начинаться с https://." }, 400, origin); }
          }
          if (id) {
            const existing = await env.DB.prepare("SELECT id FROM products WHERE id=?").bind(id).first();
            if (!existing) return json({ error: "Товар не найден." }, 404, origin);
            await env.DB.prepare("UPDATE products SET title=?,description=?,image_url=?,category=?,price_stars=?,is_active=? WHERE id=?")
              .bind(title, description || null, imageUrl || null, category, price, isActive, id).run();
          } else {
            const newId = makeId();
            await env.DB.prepare("INSERT INTO products (id,title,description,image_url,category,price_stars,is_active) VALUES (?,?,?,?,?,?,?)")
              .bind(newId, title, description || null, imageUrl || null, category, price, isActive).run();
            return json({ ok: true, id: newId, created: true }, 201, origin);
          }
          return json({ ok: true, id, created: false }, 200, origin);
        }
        if (path === "/api/admin/product-delete" && method === "POST") {
          const body = await readJson(request);
          const id = typeof body.id === "string" ? body.id.trim().slice(0,100) : "";
          if (!id) return json({ error: "Укажите товар." }, 400, origin);
          const existing = await env.DB.prepare("SELECT id FROM products WHERE id=?").bind(id).first();
          if (!existing) return json({ error: "Товар не найден." }, 404, origin);
          const [orders,items,favorites] = await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE product_id=?").bind(id).first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM order_items WHERE product_id=?").bind(id).first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM favorites WHERE product_id=?").bind(id).first()
          ]);
          if (Number(orders?.total||0)+Number(items?.total||0)+Number(favorites?.total||0)>0) {
            return json({ error: "Товар связан с заказами или избранным. Чтобы сохранить историю, его можно только скрыть из каталога." }, 409, origin);
          }
          await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
          return json({ ok: true, deleted: true }, 200, origin);
        }
        if (path === "/api/admin/users" && method === "GET") {
          const url = new URL(request.url);
          const term = (url.searchParams.get("q") || "").trim().slice(0, 64);
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 25)));
          const rows = term
            ? await env.DB.prepare("SELECT telegram_id,username,first_name,balance_stars,created_at FROM users WHERE telegram_id LIKE ? OR username LIKE ? OR first_name LIKE ? ORDER BY created_at DESC LIMIT ?")
                .bind("%" + term + "%", "%" + term.replace(/^@/, "") + "%", "%" + term + "%", limit).all()
            : await env.DB.prepare("SELECT telegram_id,username,first_name,balance_stars,created_at FROM users ORDER BY created_at DESC LIMIT ?")
                .bind(limit).all();
          return json({ ok: true, users: rows.results || [] }, 200, origin);
        }
        if (path === "/api/admin/user" && method === "GET") {
          const url = new URL(request.url);
          const targetId = (url.searchParams.get("telegram_id") || "").trim().slice(0, 64);
          if (!targetId) return json({ error: "Укажите Telegram ID пользователя." }, 400, origin);
          const [profile, orders, transactions, blocks, adminHistory] = await Promise.all([
            env.DB.prepare("SELECT telegram_id,username,first_name,balance_stars,created_at FROM users WHERE telegram_id=?").bind(targetId).first(),
            env.DB.prepare("SELECT id,product_title,total_stars,payment_status,fulfillment_status,created_at,paid_at FROM orders WHERE telegram_id=? ORDER BY created_at DESC LIMIT 50").bind(targetId).all(),
            env.DB.prepare("SELECT amount_stars,operation_type,description,created_at FROM balance_transactions WHERE telegram_id=? ORDER BY id DESC LIMIT 50").bind(targetId).all(),
            optionalTableRows(env.DB.prepare("SELECT id,block_type,reason,status,blocked_by,blocked_at,unblocked_by,unblocked_at FROM user_blocks WHERE telegram_id=? ORDER BY blocked_at DESC LIMIT 30").bind(targetId), "user_blocks"),
            optionalTableRows(env.DB.prepare("SELECT actor_telegram_id,action_type,details,created_at FROM admin_action_log WHERE target_telegram_id=? ORDER BY id DESC LIMIT 50").bind(targetId), "admin_action_log")
          ]);
          if (!profile) return json({ error: "Пользователь не найден." }, 404, origin);
          return json({ ok: true, user: profile, orders: orders.results || [], balance_history: transactions.results || [], block_history: blocks.results || [], admin_history: adminHistory.results || [], migrations_pending: !!(blocks.migration_pending || adminHistory.migration_pending) }, 200, origin);
        }
        if (path === "/api/admin/balance-adjust" && method === "POST") {
          if (!(await tableExists(env, "admin_action_log"))) return json({ error: "Требуется применить миграцию 0006_admin_action_log.sql перед управлением баллами." }, 503, origin);
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          const amount = Number(body.amount);
          const reason = typeof body.reason === "string" ? body.reason.trim().slice(0,300) : "";
          if (!targetId) return json({ error: "Укажите Telegram ID пользователя." }, 400, origin);
          if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) {
            return json({ error: "Укажите целое количество баллов от 1 до 1 000 000 со знаком плюс или минус." }, 400, origin);
          }
          if (reason.length < 3) return json({ error: "Укажите причину операции (минимум 3 символа)." }, 400, origin);
          const target = await env.DB.prepare("SELECT telegram_id,balance_stars FROM users WHERE telegram_id=?")
            .bind(targetId).first();
          if (!target) return json({ error: "Пользователь не найден." }, 404, origin);
          const operationId = makeId();
          const description = "Операция владельца: " + reason;
          const results = await env.DB.batch([
            env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance_stars+?>=0")
              .bind(amount, targetId, amount),
            env.DB.prepare("INSERT INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'admin_adjustment',?,? WHERE changes()=1")
              .bind(targetId, amount, description, "admin:" + operationId),
            env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) SELECT ?,?,'balance_adjustment',? WHERE changes()=1")
              .bind(telegramId, targetId, JSON.stringify({ amount, reason, operation_id: operationId }))
          ]);
          if (!results[0]?.meta || results[0].meta.changes !== 1) {
            const latest = await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(targetId).first();
            if (!latest) return json({ error: "Пользователь не найден." }, 404, origin);
            return json({ error: "Недостаточно баллов для списания или операция не выполнена. Баланс не изменён.", balance: Number(latest.balance_stars || 0) }, 409, origin);
          }
          const updated = await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(targetId).first();
          await notifyOwner(env, "⭐ Изменение баланса владельцем\nПользователь: " + targetId + "\nОперация: " + (amount > 0 ? "+" : "") + amount + " баллов\nПричина: " + reason);
          return json({ ok: true, telegram_id: targetId, amount, balance: Number(updated?.balance_stars || 0) }, 200, origin);
        }
        if (path === "/api/admin/block-user" && method === "POST") {
          if (!(await tableExists(env, "user_blocks")) || !(await tableExists(env, "admin_action_log"))) return json({ error: "Требуются миграции 0006 и 0007 перед управлением блокировками." }, 503, origin);
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          const blockType = body.block_type;
          const reason = typeof body.reason === "string" ? body.reason.trim().slice(0,500) : "";
          if (!targetId) return json({ error: "Укажите Telegram ID пользователя." }, 400, origin);
          if (targetId === ownerId) return json({ error: "Нельзя заблокировать владельца панели." }, 400, origin);
          if (!["purchases","full"].includes(blockType)) return json({ error: "Выберите корректный тип блокировки." }, 400, origin);
          if (reason.length < 3) return json({ error: "Укажите причину блокировки (минимум 3 символа)." }, 400, origin);
          const target = await env.DB.prepare("SELECT telegram_id FROM users WHERE telegram_id=?").bind(targetId).first();
          if (!target) return json({ error: "Пользователь не найден." }, 404, origin);
          const results = await env.DB.batch([
            env.DB.prepare("INSERT INTO user_blocks (telegram_id,block_type,reason,blocked_by) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM user_blocks WHERE telegram_id=? AND status='active')")
              .bind(targetId, blockType, reason, telegramId, targetId),
            env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) SELECT ?,?,'user_block',? WHERE changes()=1")
              .bind(telegramId, targetId, JSON.stringify({ block_type: blockType, reason }))
          ]);
          if (!results[0]?.meta || results[0].meta.changes !== 1) {
            return json({ error: "У пользователя уже есть активная блокировка. Сначала снимите её." }, 409, origin);
          }
          return json({ ok: true, telegram_id: targetId, block_type: blockType }, 200, origin);
        }
        if (path === "/api/admin/unblock-user" && method === "POST") {
          if (!(await tableExists(env, "user_blocks")) || !(await tableExists(env, "admin_action_log"))) return json({ error: "Требуются миграции 0006 и 0007 перед управлением блокировками." }, 503, origin);
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          if (!targetId) return json({ error: "Укажите Telegram ID пользователя." }, 400, origin);
          const results = await env.DB.batch([
            env.DB.prepare("UPDATE user_blocks SET status='lifted',unblocked_by=?,unblocked_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND status='active'")
              .bind(telegramId, targetId),
            env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) SELECT ?,?,'user_unblock',? WHERE changes()=1")
              .bind(telegramId, targetId, JSON.stringify({ reason: "Разблокировка владельцем" }))
          ]);
          if (!results[0]?.meta || results[0].meta.changes !== 1) {
            return json({ error: "Активная блокировка не найдена." }, 404, origin);
          }
          return json({ ok: true, telegram_id: targetId }, 200, origin);
        }
        if (path === "/api/admin/order-notify" && method === "POST") {
          const body = await readJson(request);
          const orderId = typeof body.order_id === "string" ? body.order_id.trim().slice(0,100) : "";
          const orderType = body.order_type;
          if (!orderId || !["product","custom"].includes(orderType)) return json({ error: "Укажите номер и тип заказа." }, 400, origin);
          const order = orderType === "product"
            ? await env.DB.prepare("SELECT id,telegram_id,payment_status,fulfillment_status,total_stars FROM orders WHERE id=?").bind(orderId).first()
            : await env.DB.prepare("SELECT id,telegram_id,status,total_stars FROM custom_orders WHERE id=?").bind(orderId).first();
          if (!order) return json({ error: "Заказ не найден." }, 404, origin);
          const meta = await getAdminOrderMeta(env, orderType, order);
          const labels = { unpaid: "ожидает оплаты", new: "принят и ожидает обработки", in_progress: "находится в работе", ready: "готов", cancelled: "отменён" };
          const statusText = labels[meta.admin_status] || "обрабатывается";
          const text = "🎁 Агентство подарков\n\nИнформация по вашему заказу № " + orderId + ": " + statusText + ".\nСумма: " + Number(order.total_stars || 0) + " ⭐\nЕсли у вас есть вопросы, ответьте на это сообщение.";
          try {
            await telegram(env, "sendMessage", { chat_id: String(order.telegram_id), text });
          } catch (error) {
            console.error("Order notification failed:", String(error).slice(0,300));
            return json({ error: "Не удалось отправить сообщение. Возможно, покупатель не запускал бота или запретил сообщения." }, 502, origin);
          }
          await notifyOwner(env, "📨 Повторное уведомление по заказу " + orderId + " отправлено покупателю " + String(order.telegram_id));
          return json({ ok: true, order_id: orderId, notified: true }, 200, origin);
        }
        if (path === "/api/admin/order-update" && method === "POST") {
          if (!(await tableExists(env, "admin_action_log"))) return json({ error: "Требуется применить миграцию 0006_admin_action_log.sql перед управлением заказами." }, 503, origin);
          const body = await readJson(request);
          const orderId = typeof body.order_id === "string" ? body.order_id.trim().slice(0,100) : "";
          const orderType = body.order_type;
          const status = typeof body.status === "string" ? body.status : "";
          const hasStatus = ["new","in_progress","ready","cancelled"].includes(status);
          const comment = typeof body.comment === "string" ? body.comment.trim().slice(0,1000) : "";
          if (!orderId || !["product","custom"].includes(orderType)) return json({ error: "Укажите номер и тип заказа." }, 400, origin);
          if (status && !hasStatus) return json({ error: "Выберите корректный статус заказа." }, 400, origin);
          if (!hasStatus && !comment) return json({ error: "Укажите новый статус или комментарий." }, 400, origin);
          if (comment && comment.length < 3) return json({ error: "Комментарий должен содержать не менее 3 символов." }, 400, origin);
          const order = orderType === "product"
            ? await env.DB.prepare("SELECT id,telegram_id,payment_status,fulfillment_status FROM orders WHERE id=?").bind(orderId).first()
            : await env.DB.prepare("SELECT id,telegram_id,status FROM custom_orders WHERE id=?").bind(orderId).first();
          if (!order) return json({ error: "Заказ не найден." }, 404, origin);
          if (hasStatus && orderType === "product" && status === "cancelled" && order.payment_status === "paid") {
            return json({ error: "Оплаченный заказ нельзя отменить без подтверждённого возврата Telegram Stars. Сначала требуется отдельная процедура возврата." }, 409, origin);
          }
          if (hasStatus && orderType === "product" && order.payment_status === "cancelled" && status !== "cancelled") {
            return json({ error: "Отменённый неоплаченный заказ нельзя повторно открыть." }, 409, origin);
          }
          if (hasStatus && orderType === "product" && order.payment_status !== "paid" && status !== "cancelled") {
            return json({ error: "Сначала дождитесь подтверждения оплаты. Неоплаченный заказ нельзя перевести в рабочие статусы." }, 409, origin);
          }
          const previous = await getAdminOrderMeta(env, orderType, order);
          const statements = [];
          if (hasStatus) {
            const details = JSON.stringify({ order_type: orderType, order_id: orderId, status, previous_status: previous.admin_status });
            if (orderType === "product" && status === "cancelled") {
              statements.push(env.DB.prepare("UPDATE orders SET payment_status='cancelled',fulfillment_status='cancelled' WHERE id=? AND payment_status='pending'").bind(orderId));
              statements.push(env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND status='pending'").bind(orderId));
            } else if (orderType === "custom") {
              statements.push(env.DB.prepare("UPDATE custom_orders SET status=? WHERE id=?").bind(status, orderId));
            }
            statements.push(env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?, 'order_status_changed', ?)").bind(telegramId, String(order.telegram_id), details));
          }
          if (comment) {
            statements.push(env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?, 'order_comment', ?)").bind(telegramId, String(order.telegram_id), JSON.stringify({ order_type: orderType, order_id: orderId, comment })));
          }
          await env.DB.batch(statements);
          return json({ ok: true, order_id: orderId, order_type: orderType, status: hasStatus ? status : previous.admin_status, comment_saved: !!comment }, 200, origin);
        }
        if (path === "/api/admin/order" && method === "GET") {
          const url = new URL(request.url);
          const orderId = (url.searchParams.get("order_id") || "").trim().slice(0,100);
          const orderType = url.searchParams.get("order_type");
          if (!orderId || !["product","custom"].includes(orderType)) return json({ error: "Укажите номер и тип заказа." }, 400, origin);
          if (orderType === "product") {
            const [order, items, payment] = await Promise.all([
              env.DB.prepare("SELECT o.*,u.first_name,u.username FROM orders o LEFT JOIN users u ON u.telegram_id=o.telegram_id WHERE o.id=?").bind(orderId).first(),
              env.DB.prepare("SELECT product_title,quantity,image_url,delivery_status,delivered_at FROM order_items WHERE order_id=? ORDER BY id").bind(orderId).all(),
              env.DB.prepare("SELECT amount_stars,currency,status,created_at,confirmed_at FROM payments WHERE order_id=?").bind(orderId).first()
            ]);
            if (!order) return json({ error: "Заказ не найден." }, 404, origin);
            const meta = await getAdminOrderMeta(env, orderType, order);
            return json({ ok: true, order_type: orderType, order, items: items.results || [], payment: payment || null, admin_status: meta.admin_status, history: meta.history, migrations_pending: meta.migrations_pending }, 200, origin);
          }
          const order = await env.DB.prepare("SELECT * FROM custom_orders WHERE id=?").bind(orderId).first();
          if (!order) return json({ error: "Индивидуальный заказ не найден." }, 404, origin);
          const meta = await getAdminOrderMeta(env, orderType, order);
          return json({ ok: true, order_type: orderType, order, items: [], payment: null, admin_status: meta.admin_status, history: meta.history, migrations_pending: meta.migrations_pending }, 200, origin);
        }
        if (path === "/api/admin/orders" && method === "GET") {
          const url = new URL(request.url);
          const term = (url.searchParams.get("q") || "").trim().slice(0,80);
          const type = ["all","product","custom"].includes(url.searchParams.get("type")) ? url.searchParams.get("type") : "all";
          const status = ["all","unpaid","new","in_progress","ready","cancelled"].includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "all";
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
          const like = "%" + term + "%";
          const hasOrderAudit = await tableExists(env, "admin_action_log");
          const productOverride = hasOrderAudit ? "(SELECT json_extract(a.details,'$.status') FROM admin_action_log a WHERE a.action_type='order_status_changed' AND a.target_telegram_id=o.telegram_id AND json_valid(a.details) AND json_extract(a.details,'$.order_id')=o.id AND json_extract(a.details,'$.order_type')='product' ORDER BY a.id DESC LIMIT 1)" : "NULL";
          const customOverride = hasOrderAudit ? "(SELECT json_extract(a.details,'$.status') FROM admin_action_log a WHERE a.action_type='order_status_changed' AND a.target_telegram_id=c.telegram_id AND json_valid(a.details) AND json_extract(a.details,'$.order_id')=c.id AND json_extract(a.details,'$.order_type')='custom' ORDER BY a.id DESC LIMIT 1)" : "NULL";
          const productStatus = "COALESCE(" + productOverride + ",CASE WHEN o.payment_status='pending' THEN 'unpaid' WHEN o.payment_status='cancelled' OR o.fulfillment_status='cancelled' THEN 'cancelled' WHEN o.fulfillment_status='delivered' THEN 'ready' WHEN o.payment_status='paid' AND o.fulfillment_status='awaiting_delivery' THEN 'new' ELSE 'unpaid' END)";
          const customStatus = "COALESCE(" + customOverride + ",CASE WHEN c.status IN ('cancelled','canceled') THEN 'cancelled' WHEN c.status IN ('ready','completed','done') THEN 'ready' WHEN c.status IN ('in_progress','processing','work') THEN 'in_progress' ELSE 'new' END)";
          const [products, custom] = await Promise.all([
            type === "custom" ? Promise.resolve({ results: [] }) : env.DB.prepare(
              "SELECT * FROM (SELECT o.id,o.telegram_id,u.first_name,u.username,'product' AS order_type,o.product_title AS title,o.quantity,o.total_stars,o.payment_status,o.fulfillment_status,o.created_at," + productStatus + " AS admin_status FROM orders o LEFT JOIN users u ON u.telegram_id=o.telegram_id) WHERE (?='' OR id LIKE ? OR telegram_id LIKE ? OR title LIKE ?) AND (?='all' OR admin_status=?) ORDER BY created_at DESC LIMIT ?"
            ).bind(term,like,like,like,status,status,limit).all(),
            type === "product" ? Promise.resolve({ results: [] }) : env.DB.prepare(
              "SELECT * FROM (SELECT c.id,c.telegram_id,c.first_name,c.username,'custom' AS order_type,'Индивидуальный заказ: ' || c.subject AS title,1 AS quantity,c.total_stars,NULL AS payment_status,NULL AS fulfillment_status,c.created_at," + customStatus + " AS admin_status FROM custom_orders c) WHERE (?='' OR id LIKE ? OR telegram_id LIKE ? OR title LIKE ?) AND (?='all' OR admin_status=?) ORDER BY created_at DESC LIMIT ?"
            ).bind(term,like,like,like,status,status,limit).all()
          ]);
          const rows = [...(products.results || []), ...(custom.results || [])]
            .sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,limit);
          return json({ ok: true, orders: rows, filters: { q: term, type, status }, updated_at: new Date().toISOString() }, 200, origin);
        }
        if (path === "/api/admin/dashboard" && method === "GET") {
          const [users, orders, customOrders, revenue, waitingOrders, waitingCustom] = await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM users").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM custom_orders").first(),
            env.DB.prepare("SELECT COALESCE(SUM(amount_stars),0) AS total FROM payments WHERE status='paid' AND currency='XTR'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE payment_status='paid' AND fulfillment_status='awaiting_delivery'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM custom_orders WHERE status='new'").first()
          ]);
          return json({
            ok: true,
            metrics: {
              users: Number(users?.total || 0),
              orders: Number(orders?.total || 0) + Number(customOrders?.total || 0),
              revenue_stars: Number(revenue?.total || 0),
              awaiting_processing: Number(waitingOrders?.total || 0) + Number(waitingCustom?.total || 0)
            },
            updated_at: new Date().toISOString()
          }, 200, origin);
        }
        if (path === "/api/admin/support/conversations" && method === "GET") {
          const url = new URL(request.url);
          const term = (url.searchParams.get("q") || "").trim().slice(0,64);
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
          const rows = await env.DB.prepare(
            "SELECT s.telegram_id,u.first_name,u.username,COUNT(*) AS message_count,MAX(s.created_at) AS last_message_at,(SELECT content FROM support_chat_messages x WHERE x.telegram_id=s.telegram_id ORDER BY x.id DESC LIMIT 1) AS last_message,(SELECT role FROM support_chat_messages x WHERE x.telegram_id=s.telegram_id ORDER BY x.id DESC LIMIT 1) AS last_role FROM support_chat_messages s LEFT JOIN users u ON u.telegram_id=s.telegram_id WHERE (?='' OR s.telegram_id LIKE ? OR u.username LIKE ? OR u.first_name LIKE ?) GROUP BY s.telegram_id ORDER BY last_message_at DESC LIMIT ?"
          ).bind(term, "%" + term + "%", "%" + term.replace(/^@/, "") + "%", "%" + term + "%", limit).all();
          return json({ ok: true, conversations: rows.results || [] }, 200, origin);
        }
        if (path === "/api/admin/support/conversation" && method === "GET") {
          const url = new URL(request.url);
          const targetId = (url.searchParams.get("telegram_id") || "").trim().slice(0,64);
          if (!targetId) return json({ error: "Укажите Telegram ID." }, 400, origin);
          const [profile, messages, control] = await Promise.all([
            env.DB.prepare("SELECT telegram_id,first_name,username,created_at FROM users WHERE telegram_id=?").bind(targetId).first(),
            env.DB.prepare("SELECT role,content,sender_type,created_at FROM support_chat_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 200").bind(targetId).all(),
            env.DB.prepare("SELECT mode,updated_at FROM support_conversation_controls WHERE telegram_id=?").bind(targetId).first()
          ]);
          if (!profile) return json({ error: "Пользователь не найден." }, 404, origin);
          return json({ ok: true, user: profile, mode: control?.mode || "ai", mode_updated_at: control?.updated_at || null, messages: (messages.results || []).reverse() }, 200, origin);
        }
        if (path === "/api/admin/support/tickets" && method === "GET") {
          const status = ["all","open","in_progress","closed"].includes(new URL(request.url).searchParams.get("status")) ? new URL(request.url).searchParams.get("status") : "all";
          const rows = await env.DB.prepare(
            "SELECT s.id,s.telegram_id,s.message,s.status,s.created_at,u.first_name,u.username FROM support_messages s LEFT JOIN users u ON u.telegram_id=s.telegram_id WHERE (?='all' OR s.status=?) ORDER BY CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,s.id DESC LIMIT 100"
          ).bind(status,status).all();
          return json({ ok: true, tickets: rows.results || [] }, 200, origin);
        }
        if (path === "/api/admin/support/notes" && method === "GET") {
          const targetId = (new URL(request.url).searchParams.get("telegram_id") || "").trim().slice(0,64);
          if (!targetId) return json({ error: "Укажите Telegram ID." }, 400, origin);
          const notes = await optionalTableRows(env.DB.prepare(
            "SELECT id,admin_telegram_id,note,created_at FROM support_internal_notes WHERE telegram_id=? ORDER BY id DESC LIMIT 100"
          ).bind(targetId), "support_internal_notes");
          return json({ ok: true, notes: (notes.results || []).reverse(), migration_pending: !!notes.migration_pending }, 200, origin);
        }
        if (path === "/api/admin/support/notes" && method === "POST") {
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          const note = typeof body.note === "string" ? body.note.trim().slice(0,2000) : "";
          if (!targetId || note.length < 2) return json({ error: "Укажите пользователя и заметку (минимум 2 символа)." }, 400, origin);
          const user = await env.DB.prepare("SELECT telegram_id FROM users WHERE telegram_id=?").bind(targetId).first();
          if (!user) return json({ error: "Пользователь не найден." }, 404, origin);
          if (!(await tableExists(env,"support_internal_notes"))) return json({ error: "Требуется миграция 0009_support_internal_notes.sql для внутренних заметок." }, 503, origin);
          const saved = await env.DB.prepare("INSERT INTO support_internal_notes (telegram_id,admin_telegram_id,note) VALUES (?,?,?)")
            .bind(targetId,telegramId,note).run();
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
              .bind(telegramId,targetId,"support_internal_note_added",JSON.stringify({note_id:saved.meta?.last_row_id || null,length:note.length})).run();
          }
          return json({ ok: true }, 200, origin);
        }
        if (path === "/api/admin/support/conversation-mode" && method === "POST") {
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          const mode = body.mode === "human" ? "human" : body.mode === "ai" ? "ai" : "";
          if (!targetId || !mode) return json({ error: "Укажите пользователя и режим диалога." }, 400, origin);
          const exists = await env.DB.prepare("SELECT telegram_id FROM users WHERE telegram_id=?").bind(targetId).first();
          if (!exists) return json({ error: "Пользователь не найден." }, 404, origin);
          await env.DB.prepare("INSERT INTO support_conversation_controls (telegram_id,mode,updated_by) VALUES (?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET mode=excluded.mode,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
            .bind(targetId,mode,telegramId).run();
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
              .bind(telegramId,targetId,"support_mode_changed",JSON.stringify({mode})).run();
          }
          return json({ ok: true, telegram_id: targetId, mode }, 200, origin);
        }
        if (path === "/api/admin/support/reply" && method === "POST") {
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          const message = typeof body.message === "string" ? body.message.trim().slice(0,4000) : "";
          if (!targetId || !message) return json({ error: "Укажите пользователя и текст сообщения." }, 400, origin);
          const control = await env.DB.prepare("SELECT mode FROM support_conversation_controls WHERE telegram_id=?").bind(targetId).first();
          if (control?.mode !== "human") return json({ error: "Сначала включите режим владельца для этого диалога." }, 409, origin);
          const user = await env.DB.prepare("SELECT telegram_id FROM users WHERE telegram_id=?").bind(targetId).first();
          if (!user) return json({ error: "Пользователь не найден." }, 404, origin);
          await telegram(env,"sendMessage",{chat_id:targetId,text:message});
          await env.DB.prepare("INSERT INTO support_chat_messages (telegram_id,role,content,sender_type) VALUES (?,'assistant',?,'human')")
            .bind(targetId,message).run();
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
              .bind(telegramId,targetId,"support_human_reply",JSON.stringify({length:message.length})).run();
          }
          return json({ ok: true, sent: true }, 200, origin);
        }
        if (path === "/api/admin/support/ticket-status" && method === "POST") {
          const body = await readJson(request);
          const id = Number(body.id);
          const status = ["open","in_progress","closed"].includes(body.status) ? body.status : "";
          if (!Number.isSafeInteger(id) || id < 1 || !status) return json({ error: "Некорректный номер обращения или статус." }, 400, origin);
          const ticket = await env.DB.prepare("SELECT id,telegram_id,status FROM support_messages WHERE id=?").bind(id).first();
          if (!ticket) return json({ error: "Обращение не найдено." }, 404, origin);
          await env.DB.prepare("UPDATE support_messages SET status=? WHERE id=?").bind(status,id).run();
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
              .bind(telegramId,String(ticket.telegram_id),"support_ticket_status_changed",JSON.stringify({ticket_id:id,from:ticket.status,to:status})).run();
          }
          return json({ ok: true, id, status }, 200, origin);
        }
        if (path === "/api/admin/system-controls" && method === "GET") {
          const row = await env.DB.prepare("SELECT value,updated_at FROM app_settings WHERE key='sales_paused'").first();
          return json({ ok: true, sales_paused: row?.value === "1", updated_at: row?.updated_at || null }, 200, origin);
        }
        if (path === "/api/admin/system-controls" && method === "POST") {
          const body = await readJson(request);
          if (typeof body.sales_paused !== "boolean") return json({ error: "Укажите состояние остановки продаж." }, 400, origin);
          const value = body.sales_paused ? "1" : "0";
          await env.DB.prepare("INSERT INTO app_settings (key,value,updated_at) VALUES ('sales_paused',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP")
            .bind(value).run();
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)")
              .bind(telegramId,"sales_pause_changed",JSON.stringify({sales_paused:body.sales_paused})).run();
          }
          return json({ ok: true, sales_paused: body.sales_paused }, 200, origin);
        }
        return json({ error: "Admin route not found." }, 404, origin);
      }

      // Emergency sales pause: keep the catalog readable and existing paid orders intact.
      if (method === "POST" && ["/api/orders","/api/custom-orders","/api/balance/topup","/api/vip/subscribe"].includes(path)) {
        const salesPause = await env.DB.prepare("SELECT value FROM app_settings WHERE key='sales_paused'").first();
        if (salesPause?.value === "1") return json({ error: "Оформление новых покупок временно приостановлено владельцем. Уже оплаченные заказы продолжают обрабатываться." }, 503, origin);
      }

      // Enforce user restrictions server-side after owner routes, so the owner can always administer accounts.
      let activeBlock = null;
      try {
        activeBlock = await env.DB.prepare("SELECT block_type,reason FROM user_blocks WHERE telegram_id=? AND status='active' LIMIT 1")
          .bind(telegramId).first();
      } catch (error) {
        // Keep the storefront operational until the owner applies migration 0007.
        if (!isMissingTableError(error, "user_blocks")) throw error;
      }
      if (activeBlock?.block_type === "full") {
        return json({ error: "Доступ к Агентству ограничен владельцем. Причина: " + activeBlock.reason }, 403, origin);
      }
      if (activeBlock?.block_type === "purchases" && method === "POST" &&
          ["/api/orders","/api/custom-orders","/api/balance/topup","/api/vip/subscribe"].includes(path)) {
        return json({ error: "Покупки и оформление новых заказов для вашего аккаунта ограничены владельцем. Причина: " + activeBlock.reason }, 403, origin);
      }

      if (path === "/api/products" && method === "GET") {
        return json({ products: await getProducts(env) }, 200, origin);
      }

      if (path === "/api/me" && method === "GET") {
        const me = await env.DB.prepare("SELECT telegram_id,username,first_name,balance_stars,created_at FROM users WHERE telegram_id=?")
          .bind(telegramId).first();
        const orders = await env.DB.prepare("SELECT id AS order_id,created_at,total_stars AS amount,'XTR' AS currency,payment_status AS status FROM orders WHERE telegram_id=? ORDER BY created_at DESC LIMIT 20")
          .bind(telegramId).all();
        const vip = await env.DB.prepare("SELECT plan_type,status,starts_at,expires_at FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY id DESC LIMIT 1")
          .bind(telegramId).first();
        return json({ points: Number(me?.balance_stars || 0), balance_stars: Number(me?.balance_stars || 0),
          first_name: me?.first_name || user.first_name || "", username: me?.username || user.username || "",
          orders: orders.results || [], vip: vip || null }, 200, origin);
      }

      if (path === "/api/orders" && method === "GET") {
        const result = await env.DB.prepare("SELECT id AS order_id,'product' AS order_type,product_title AS title,total_stars AS amount,payment_status AS status,fulfillment_status,created_at FROM orders WHERE telegram_id=? UNION ALL SELECT id AS order_id,'custom' AS order_type,'Индивидуальный заказ: ' || subject AS title,total_stars AS amount,status,NULL AS fulfillment_status,created_at FROM custom_orders WHERE telegram_id=? ORDER BY created_at DESC LIMIT 50")
          .bind(telegramId, telegramId).all();
        return json({ orders: result.results || [] }, 200, origin);
      }
      if (path === "/api/custom-orders" && method === "POST") {
        const body = await readJson(request), a = body.answers && typeof body.answers === "object" ? body.answers : {};
        const subject = typeof a.subject === "string" ? a.subject.trim().slice(0,300) : "";
        const wishes = typeof a.wishes === "string" ? a.wishes.trim().slice(0,700) : "";
        for (const key of ["style","format","palette","complexity","deadline"]) if (!Object.prototype.hasOwnProperty.call(CUSTOM_PRICE_OPTIONS[key],a[key])) return json({error:"Проверь ответы опроса: выбран неизвестный вариант."},400,origin);
        if(subject.length<3)return json({error:"Опиши, что нужно изобразить (минимум 3 символа)."},400,origin);
        const p=CUSTOM_PRICE_OPTIONS,total=Math.min(700,250+p.style[a.style]+p.format[a.format]+p.palette[a.palette]+p.complexity[a.complexity]+p.deadline[a.deadline]),id=makeId();
        const materials=Array.isArray(a.materials)?[...new Set(a.materials.filter(x=>["watercolor","gouache","pastel","pencils","markers","liners"].includes(x)))]:[];if(!materials.length)return json({error:"Выберите хотя бы один художественный материал."},400,origin);const saved=JSON.stringify({style:a.style,subject,format:a.format,palette:a.palette,materials,complexity:a.complexity,deadline:a.deadline,wishes});
        await env.DB.prepare("INSERT INTO custom_orders (id,telegram_id,username,first_name,subject,answers_json,total_stars,status) VALUES (?,?,?,?,?,?,?,'new')").bind(id,telegramId,user.username||null,user.first_name||null,subject,saved,total).run();
        const L={style:{classic:"Классический",watercolor:"Акварельный",perspective:"С перспективой",autumn:"Осенний",realistic:"Реалистичный",artist_choice:"На усмотрение художника"},format:{postcard:"Открытка",a5:"А5",a4:"А4",large:"Большой формат"},palette:{natural:"Естественная",bright:"Яркая",pastel:"Пастельная",custom:"На усмотрение художника"},materials:{watercolor:"Акварель",gouache:"Гуашь",pastel:"Пастель",pencils:"Цветные карандаши",markers:"Фломастеры",liners:"Линеры"},complexity:{simple:"Простая",medium:"Средняя",detailed:"Высокая"},deadline:{standard:"Обычный срок",priority:"Приоритетный заказ"}};
        await notifyOwner(env,"🎨 НОВЫЙ ИНДИВИДУАЛЬНЫЙ ЗАКАЗ\nID: "+id+"\nПокупатель: "+(user.first_name||"Без имени")+(user.username?" (@"+user.username+")":"")+"\nTelegram ID: "+telegramId+"\n\nЧто изобразить: "+subject+"\nСтиль: "+L.style[a.style]+"\nФормат: "+L.format[a.format]+"\nЦвета: "+L.palette[a.palette]+"\nМатериалы: "+materials.map(x=>L.materials[x]).join(", ")+"\nСложность: "+L.complexity[a.complexity]+"\nСрок: "+L.deadline[a.deadline]+"\nПожелания: "+(wishes||"Не указаны")+"\n\nЦена: "+total+" ⭐ (ожидает подтверждения владельцем)");
        return json({ok:true,order_id:id,total_stars:total,status:"new"},200,origin);
      }

      if (path === "/api/orders" && method === "POST") {
        const body = await readJson(request);
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 43) return json({ error: "Корзина пуста или некорректна" }, 400, origin);
        const catalog = await getProducts(env);
        const quantities = new Map();
        for (const item of body.items) {
          const id = String(item.id ?? "");
          const qty = Number(item.qty);
          if (!Number.isInteger(qty) || qty < 1 || qty > 10 || !catalog.some(p => String(p.id) === id)) {
            return json({ error: "Некорректный товар или количество" }, 400, origin);
          }
          quantities.set(id, (quantities.get(id) || 0) + qty);
          if (quantities.get(id) > 10) return json({ error: "Максимум 10 единиц одного товара" }, 400, origin);
        }
        const items = Array.from(quantities.entries()).map(([id, qty]) => {
          const product = catalog.find(p => String(p.id) === id);
          return { id, title: product.title, qty, unit_price: Number(product.price_stars), image_url: product.image_url || null };
        });
        // The customer receives the shared payment-confirmation postcard; the seller delivers the artwork separately.
        const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
        if (!Number.isSafeInteger(subtotal) || subtotal < 1) return json({ error: "Некорректная сумма заказа" }, 400, origin);
        const discount = 0; // Каталожные цены уже содержат скидку.
        const total = subtotal;
        const orderId = makeId();
        const title = items.map(item => item.title + " × " + item.qty).join("; ");
        const orderStatements = [
          env.DB.prepare("INSERT INTO orders (id,telegram_id,product_id,product_title,quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status) VALUES (?,?,?,?,?,?,?,?, 'pending','awaiting_payment')")
            .bind(orderId, telegramId, items.length === 1 ? items[0].id : null, title,
              items.reduce((sum, item) => sum + item.qty, 0), subtotal, DISCOUNT_PERCENT, total),
          ...items.map(item => env.DB.prepare("INSERT INTO order_items (order_id,product_id,product_title,quantity,image_url,delivery_status) VALUES (?,?,?,?,?,'pending')")
            .bind(orderId, item.id, item.title, item.qty, item.image_url))
        ];
        // D1 batch is transactional: the order and all its line items are created together.
        await env.DB.batch(orderStatements);
        try {
          const invoiceUrl = await createPaymentIntent(env, { payload: orderId, telegram_id: telegramId,
            kind: "order", reference_id: orderId, amount_stars: total, title: "Заказ " + orderId.slice(0, 8),
            description: title });
          return json({ ok: true, invoice_url: invoiceUrl, order_id: orderId }, 200, origin);
        } catch (error) {
          await env.DB.prepare("UPDATE orders SET payment_status='cancelled',fulfillment_status='cancelled' WHERE id=? AND payment_status='pending'")
            .bind(orderId).run();
          throw error;
        }
      }

      if (path === "/api/balance" && method === "GET") {
        const me = await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(telegramId).first();
        const transactions = await env.DB.prepare("SELECT amount_stars,operation_type,description,created_at FROM balance_transactions WHERE telegram_id=? ORDER BY id DESC LIMIT 50")
          .bind(telegramId).all();
        return json({ balance_stars: Number(me?.balance_stars || 0), transactions: transactions.results || [] }, 200, origin);
      }

      if (path === "/api/balance/topup" && method === "POST") {
        const body = await readJson(request);
        const amount = Number(body.amount_stars);
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10000) {
          return json({ error: "Введите целую сумму от 1 до 10 000 Stars." }, 400, origin);
        }
        const bonus = amount > 500 ? 50 : 0;
        const payload = "topup:" + telegramId + ":" + makeId();
        const invoiceUrl = await createPaymentIntent(env, { payload, telegram_id: telegramId, kind: "topup",
          amount_stars: amount, bonus_points: bonus, title: "Пополнение баланса",
          description: "Зачисление " + (amount + bonus) + " баллов на баланс" });
        return json({ ok: true, invoice_url: invoiceUrl, amount_stars: amount, points: amount + bonus, bonus_points: bonus }, 200, origin);
      }

      if (path === "/api/case/open" && method === "POST") {
        return json({ error: "Открытие случайных кейсов временно отключено." }, 403, origin);
      }

      if (path === "/api/vip" && method === "GET") {
        const vip = await env.DB.prepare("SELECT id,plan_type,status,starts_at,expires_at FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY id DESC LIMIT 1")
          .bind(telegramId).first();
        return json({ vip: vip || null }, 200, origin);
      }

      if (path === "/api/vip/subscribe" && method === "POST") {
        const body = await readJson(request);
        const planType = body.plan_type === "monthly" ? "subscription" : body.plan_type;
        if (!Object.prototype.hasOwnProperty.call(VIP_PRICES, planType)) return json({ error: "Неизвестный VIP-тариф" }, 400, origin);
        const amount = VIP_PRICES[planType];
        const payload = "vip:" + telegramId + ":" + makeId();
        const invoiceUrl = await createPaymentIntent(env, { payload, telegram_id: telegramId, kind: "vip",
          plan_type: planType, amount_stars: amount, title: planType === "lifetime" ? "VIP навсегда" : "VIP на месяц",
          description: planType === "lifetime" ? "Постоянный VIP-доступ" : "VIP-доступ на 30 дней" });
        return json({ ok: true, invoice_url: invoiceUrl, plan_type: planType }, 200, origin);
      }

      if (path === "/api/craft/create" && method === "POST") {
        const b=await readJson(request),theme=typeof b.theme==="string"?b.theme.trim().slice(0,1200):"",material=typeof b.material==="string"?b.material.slice(0,100):"На усмотрение помощника",level=["Простая","Средняя","Сложная"].includes(b.level)?b.level:"Средняя";
        if(theme.length<3)return json({error:"Опишите задумку поделки подробнее."},400,origin);
        try{const answer=await createCraftAnswer(env,theme,material,level),title=answer.split("\n").find(x=>x.trim())?.replace(/^#+\s*/,"").slice(0,100)||"Идея поделки";return json({ok:true,title,answer},200,origin);}
        catch(e){console.error("Craft assistant failed:",String(e));return json({error:e.message||"Не удалось создать идею поделки."},503,origin);}
      }
      if (path === "/api/vip/support" && method === "POST") {
        const vip=await env.DB.prepare("SELECT 1 AS active FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) LIMIT 1").bind(telegramId).first();
        if(!vip)return json({error:"VIP-помощь доступна только при действующей VIP-подписке."},403,origin);
        const b=await readJson(request),message=typeof b.message==="string"?b.message.trim():"";
        if(!message||message.length>2000)return json({error:"Сообщение должно содержать от 1 до 2000 символов."},400,origin);
        try{const reply=await createVipSupportAnswer(env,message);if(/(владелец|оператор|человек|администратор|жалоба|позови|позвать)/i.test(message)){await env.DB.prepare("INSERT INTO support_messages (telegram_id,message) VALUES (?,?)").bind(telegramId,"[VIP] "+message).run();await notifyOwner(env,"👑 VIP-обращение\nTelegram ID: "+telegramId+"\n\n"+message);}return json({ok:true,reply,vip:true},200,origin);}
        catch(e){console.error("VIP support failed:",String(e));return json({error:e.message||"VIP-помощь временно недоступна."},503,origin);}
      }
      if (path === "/api/support/chat" && method === "GET") {
        const rows = await env.DB.prepare("SELECT role,content,created_at FROM support_chat_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 30")
          .bind(telegramId).all();
        const vip = await env.DB.prepare("SELECT 1 AS active FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) LIMIT 1")
          .bind(telegramId).first();
        return json({ messages: (rows.results || []).reverse(), vip: !!vip }, 200, origin);
      }

      if (path === "/api/support/chat" && method === "POST") {
        const body = await readJson(request);
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (!message || message.length > 2000) return json({ error: "Сообщение должно содержать от 1 до 2000 символов" }, 400, origin);
        const vip = await env.DB.prepare("SELECT 1 AS active FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) LIMIT 1")
          .bind(telegramId).first();
        const conversationControl = await env.DB.prepare("SELECT mode FROM support_conversation_controls WHERE telegram_id=?").bind(telegramId).first();
        await env.DB.prepare("INSERT INTO support_chat_messages (telegram_id,role,content,sender_type) VALUES (?,'user',?,'buyer')")
          .bind(telegramId, message).run();
        if (conversationControl?.mode === "human") {
          await notifyOwner(env, "💬 Новое сообщение в диалоге под управлением владельца\nTelegram ID: " + telegramId + "\n\n" + message);
          return json({ ok: true, reply: "Сообщение передано владельцу. ИИ-помощник временно приостановлен.", vip: !!vip, saved: true, handoff: true }, 200, origin);
        }
        if (!env.OPENAI_API_KEY) return json({ error: "ИИ-помощник ещё не подключён. Владелец должен добавить OPENAI_API_KEY в Cloudflare Worker Secrets." }, 503, origin);
        const rows = await env.DB.prepare("SELECT role,content FROM support_chat_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 12")
          .bind(telegramId).all();
        const history = (rows.results || []).reverse();
        let reply;
        try {
          reply = await createSupportAnswer(env, history, !!vip);
        } catch (error) {
          console.error("Support assistant failed:", String(error));
          return json({ error: error.message || "Не удалось получить ответ помощника." }, 503, origin);
        }
        await env.DB.prepare("INSERT INTO support_chat_messages (telegram_id,role,content,sender_type) VALUES (?,'assistant',?,'ai')")
          .bind(telegramId, reply).run();
        const ownerRequested = /(владелец|оператор|человек|администратор|жалоба|позови|позвать)/i.test(message);
        if (ownerRequested) {
          await env.DB.prepare("INSERT INTO support_messages (telegram_id,message) VALUES (?,?)").bind(telegramId, message).run();
          await notifyOwner(env, "💬 Запрос на помощь владельца\nTelegram ID: " + telegramId + "\n\n" + message);
        }
        return json({ ok: true, reply, vip: !!vip, saved: true }, 200, origin);
      }

      return json({ error: "Маршрут не найден" }, 404, origin);
    } catch (error) {
      console.error("Worker request failed:", String(error));
      return json({ error: "Внутренняя ошибка сервера. Попробуйте позже." }, 500, origin);
    }
  }
};