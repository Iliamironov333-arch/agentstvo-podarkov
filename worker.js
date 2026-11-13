import { handleAiTelegramUpdate, handleAiScheduled, handleAiAdminRoute } from "./ai-moderator.js";

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
async function columnExists(env, tableName, columnName) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(String(tableName)) || !/^[a-z_][a-z0-9_]*$/i.test(String(columnName))) return false;
  try {
    const result = await env.DB.prepare("PRAGMA table_info(" + tableName + ")").all();
    return (result.results || []).some(column => column.name === columnName);
  } catch { return false; }
}
function promoScopeValues(value) {
  let items = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      items = Array.isArray(parsed) ? parsed : value.split(",");
    } catch { items = value.split(","); }
  }
  return [...new Set(items.map(item => String(item || "").trim().slice(0,100)).filter(Boolean))].slice(0,100);
}
function promoEligibleSubtotal(catalog, quantities, promo) {
  const productIds = promoScopeValues(promo.product_ids);
  const categoryIds = promoScopeValues(promo.category_ids);
  const scoped = productIds.length > 0 || categoryIds.length > 0;
  let eligible = 0;
  for (const [id, qty] of quantities) {
    const product = catalog.find(item => String(item.id) === String(id));
    if (!product) continue;
    if (!scoped || productIds.includes(String(id)) || categoryIds.includes(String(product.category || ""))) {
      eligible += Number(product.price_stars) * Number(qty);
    }
  }
  return eligible;
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
  else if (String(order.status)==="pending") fallbackStatus = "unpaid";
  else if (["ready","completed","done"].includes(order.status)) fallbackStatus = "ready";
  else if (["in_progress","processing","work"].includes(order.status)) fallbackStatus = "in_progress";
  return { admin_status: latestStatus?.details?.status || fallbackStatus, history, migrations_pending: !!result.migration_pending };
}
function containsProhibitedLanguage(value) {
 const tokens=String(value||"").toLowerCase().replace(/ё/g,"е").split(/[^а-яa-z]+/).filter(Boolean);
 const patterns=[/бля(?:д|т)/,/су(?:к|ч)а/,/хуй/,/хуе/,/хуя/,/хуи/,/пизд/,/^еб/,/ебл/,/ебн/,/мудак/,/гандон/,/долбоеб/,/уеб/,/мразь/,/fuck/i,/shit/i];
 return tokens.some(token=>patterns.some(pattern=>pattern.test(token)));
}
async function extractTextValues(value,depth=0,out=[]) {
 if(depth>6||out.length>100||value==null)return out;
 if(typeof value==="string"){out.push(value.slice(0,4000));return out;}
 if(Array.isArray(value)){for(const item of value)await extractTextValues(item,depth+1,out);return out;}
 if(typeof value==="object"){for(const item of Object.values(value))await extractTextValues(item,depth+1,out);}
 return out;
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
  const textMessage=String(message||"").slice(0,3900);
  try{
    const title=textMessage.split("\n")[0].slice(0,180)||"Уведомление Агентства";
    await env.DB.prepare("INSERT INTO admin_notifications(type,title,body,reference_id) VALUES('agency',?,?,NULL)").bind(title,textMessage.slice(0,3000)).run();
  }catch(error){console.error("Mini App owner notification failed:",String(error).slice(0,250));}
  if (!env.ADMIN_TELEGRAM_ID || !env.BOT_TOKEN) return;
  try {
    await telegram(env, "sendMessage", { chat_id: env.ADMIN_TELEGRAM_ID, text: textMessage });
  } catch (error) { console.error("Owner notification failed:", String(error)); }
}
async function deliverOrderImages(env, orderId, telegramId) {
  const rowsResult = await env.DB.prepare("SELECT id,delivery_status FROM order_items WHERE order_id=? ORDER BY id")
    .bind(orderId).all();
  const rows = rowsResult.results || [];
  if (!rows.length) {
    await notifyOwner(env, "⚠️ Заказ " + orderId + " оплачен, но в order_items нет товаров. Отправка уведомления остановлена.");
    return false;
  }
  if (rows.every(row => row.delivery_status === "sent")) return true;

  // Claim pending rows so webhook retries cannot send duplicate confirmations.
  const claim = await env.DB.prepare("UPDATE order_items SET delivery_status='sending',delivery_started_at=CURRENT_TIMESTAMP WHERE order_id=? AND (delivery_status='pending' OR (delivery_status='sending' AND (delivery_started_at IS NULL OR delivery_started_at < datetime('now','-10 minutes'))))")
    .bind(orderId).run();
  if (!claim.meta || claim.meta.changes < 1) return false;

  try {
    const message = "🎁 Спасибо за покупку в «Агентстве подарков»!\n\n✅ Оплата успешно получена. Ваш заказ оформлен.\n\nСаму работу Илья доставит отдельно. Спасибо, что выбрали нас! 💛";
    await telegram(env, "sendMessage", { chat_id: String(telegramId), text: message });

    await env.DB.prepare("UPDATE order_items SET delivery_status='sent',delivered_at=CURRENT_TIMESTAMP,delivery_started_at=NULL WHERE order_id=? AND delivery_status='sending'")
      .bind(orderId).run();
    // Text payment confirmation is delivered automatically; the actual artwork is delivered manually by the seller.
    return true;
  } catch (error) {
    await env.DB.prepare("UPDATE order_items SET delivery_status='pending',delivery_started_at=CURRENT_TIMESTAMP WHERE order_id=? AND delivery_status='sending'")
      .bind(orderId).run();
    await notifyOwner(env, "⚠️ Не удалось отправить подтверждение оплаты покупателю\nЗаказ: " + orderId + "\nОшибка: " + String(error).slice(0, 500));
    return false;
  }
}

async function processPendingOrderPostcards(env, limit = 10) {
  const rows = await env.DB.prepare(
    "SELECT DISTINCT o.id AS order_id,o.telegram_id FROM orders o INNER JOIN order_items i ON i.order_id=o.id WHERE o.payment_status='paid' AND (i.delivery_status='pending' OR (i.delivery_status='sending' AND (i.delivery_started_at IS NULL OR i.delivery_started_at < datetime('now','-10 minutes')))) AND (i.delivery_started_at IS NULL OR i.delivery_started_at < datetime('now','-15 minutes')) ORDER BY o.paid_at ASC LIMIT ?"
  ).bind(Math.max(1,Math.min(25,Number(limit)||10))).all();
  let delivered = 0;
  for (const row of rows.results || []) {
    try {
      if (await deliverOrderImages(env, row.order_id, String(row.telegram_id))) delivered++;
    } catch (error) {
      console.error("Pending postcard retry failed:", row.order_id, String(error).slice(0,300));
    }
  }
  return { attempted: (rows.results || []).length, delivered };
}

async function getProducts(env) {
  const result = await env.DB.prepare("SELECT id,title,description,image_url,category,price_stars,is_new,created_at FROM products WHERE is_active=1 ORDER BY CAST(id AS INTEGER)")
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

async function calculateDeliveryQuote(address, priority) {
  const clean = String(address || "").trim().replace(/\s+/g," ").slice(0,350);
  if (clean.length < 8) throw new Error("Укажите полный адрес доставки: улицу и номер дома.");
  const headers = { "User-Agent": "AgentstvoPodarkov/1.1 (delivery calculation)", "Accept-Language": "ru" };
  const queries = [
    clean + ", Екатеринбург, Свердловская область, Россия",
    clean + ", Екатеринбург, Россия",
    clean + ", Екатеринбург"
  ];
  let candidates = [];
  for (const textQuery of queries) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ru&q=" + encodeURIComponent(textQuery);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Сервис проверки адреса временно недоступен. Попробуйте ещё раз чуть позже.");
    const results = await response.json();
    if (Array.isArray(results)) candidates = candidates.concat(results);
    if (candidates.length) break;
  }
  const cityMatch = place => {
    const a = place?.address || {};
    const cityText = [a.city,a.town,a.municipality,a.city_district,a.county,place?.display_name]
      .filter(Boolean).join(" ").toLowerCase();
    return cityText.includes("екатеринбург");
  };
  const place = candidates.find(cityMatch) || null;
  if (!place) {
    if (candidates.length) throw new Error("Доставка доступна только по Екатеринбургу. Проверьте город в адресе.");
    throw new Error("Адрес не найден. Укажите улицу и номер дома в Екатеринбурге.");
  }
  const lat = Number(place.lat), lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Не удалось определить координаты адреса. Уточните адрес.");
  const routeResponse = await fetch("https://router.project-osrm.org/route/v1/driving/60.601094,56.908881;" + lon + "," + lat + "?overview=false&steps=false&alternatives=false");
  if (!routeResponse.ok) throw new Error("Сервис расчёта маршрута временно недоступен. Попробуйте ещё раз.");
  const routeData = await routeResponse.json();
  const meters = Number(routeData.routes?.[0]?.distance);
  if (!routeData.routes?.length || !Number.isFinite(meters) || meters <= 0) throw new Error("Не удалось построить автомобильный маршрут до адреса. Проверьте номер дома.");
  const distanceKm = Math.round((meters / 1000) * 100) / 100;
  const deliveryStars = Math.min(450, Math.ceil(distanceKm * 23));
  const priorityStars = priority ? 100 : 0;
  return { address: clean, distance_km: distanceKm, delivery_stars: deliveryStars, priority_delivery: !!priority, priority_stars: priorityStars, total_delivery_stars: deliveryStars + priorityStars };
}

async function cancelPendingOrderAndRefund(env, orderId, telegramId) {
  const order = await env.DB.prepare("SELECT balance_applied_stars FROM orders WHERE id=? AND telegram_id=? AND payment_status='pending'")
    .bind(orderId,telegramId).first();
  if (!order) return false;
  const amount = Math.max(0,Number(order.balance_applied_stars || 0));
  const statements = [
    env.DB.prepare("UPDATE orders SET payment_status='cancelled',fulfillment_status='cancelled',balance_applied_stars=0 WHERE id=? AND telegram_id=? AND payment_status='pending' AND balance_applied_stars=?")
      .bind(orderId,telegramId,amount),
    env.DB.prepare("INSERT OR IGNORE INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'order_refund',?,? WHERE changes()=1 AND ?>0")
      .bind(telegramId,amount,"Возврат баланса за отменённый заказ "+orderId,"order-refund:"+orderId,amount),
    env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND EXISTS (SELECT 1 FROM balance_transactions WHERE idempotency_key=?)")
      .bind(amount,telegramId,"order-refund:"+orderId),
    env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE kind='order' AND reference_id=? AND telegram_id=? AND status='pending'").bind(orderId,telegramId),
  ];
  if (await tableExists(env,"promo_codes") && await tableExists(env,"promo_redemptions")) {
    statements.push(env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),updated_at=CURRENT_TIMESTAMP WHERE code=(SELECT code FROM promo_redemptions WHERE order_id=? AND status='reserved')").bind(orderId));
    statements.push(env.DB.prepare("UPDATE promo_redemptions SET status='released' WHERE order_id=? AND status='reserved'").bind(orderId));
  }
  const results = await env.DB.batch(statements);
  if(results[0]?.meta?.changes&&await tableExists(env,"gift_bundles")){
    await env.DB.prepare("UPDATE gift_bundles SET status='draft',order_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='ordered'").bind(orderId).run();
  }
  return !!results[0]?.meta?.changes;
}

async function releaseExpiredOrderReservations(env) {
  try {
    const hasAiDrafts = await tableExists(env,"ai_order_drafts");
    const expired = await env.DB.prepare(hasAiDrafts
      ? "SELECT id,telegram_id FROM orders WHERE payment_status='pending' AND created_at<datetime('now','-1 day') AND id NOT IN (SELECT order_id FROM ai_order_drafts WHERE order_id IS NOT NULL AND status='approved') ORDER BY created_at LIMIT 100"
      : "SELECT id,telegram_id FROM orders WHERE payment_status='pending' AND created_at<datetime('now','-1 day') ORDER BY created_at LIMIT 100").all();
    let released = 0;
    for (const order of expired.results || []) {
      if (await cancelPendingOrderAndRefund(env,order.id,String(order.telegram_id))) released++;
    }
    return {released};
  } catch (error) {
    console.error("Expired order cleanup failed:",String(error).slice(0,300));
    return {released:0,error:true};
  }
}

async function createOrderChatAnswer(env, history, orderContext) {
  if (!env.OPENAI_API_KEY) throw new Error("ИИ-консультант временно недоступен.");
  const instructions = [
    await getGlobalAiToneInstruction(env),
    "Ты — ИИ-консультант Агентства подарков в персональном чате конкретного заказа.",
    "Помогай покупателю уточнять и предлагать изменения к уже оформленному заказу. Общайся доброжелательно, задавай по одному уточняющему вопросу, если запрос неоднозначен.",
    "Ты НЕ имеешь права утверждать, что заказ уже изменён, отменён, оплачен или принят владельцем. Все изменения сначала передаются владельцу на проверку.",
    "Не меняй цены, оплату, адрес доставки, статус заказа или состав товаров самостоятельно. Если покупатель просит изменить содержание работы, поздравление, пожелания, оформление или комплект, кратко сформулируй предложение для владельца.",
    "Верни строго JSON: {\"reply\":\"ответ покупателю\",\"change_summary\":\"краткое описание запрошенного изменения или пустая строка\",\"proposed_changes\":{\"customer_request\":\"точная суть просьбы\"}}.",
    "Если покупатель просто задаёт вопрос или ещё не определился, change_summary должна быть пустой строкой.",
    orderContext?.order_type==="gift_builder_draft_not_yet_ordered" ? "Это ещё не оформленный черновик подарка. Не называй его заказом, не утверждай, что что-либо уже куплено или отправлено владельцу. Помоги подобрать дополнения и улучшить идею. Если клиент просит изменить параметры черновика, подскажи ему, что можно вернуться к настройкам конструктора." : "",
    "Контекст заказа: " + JSON.stringify(orderContext).slice(0,5000)
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4o-mini", instructions,
      input: history.slice(-30).map(item => ({ role: item.role, content: item.content })), max_output_tokens: 650 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("ИИ-консультант не смог ответить. Попробуйте позже.");
  let output = typeof data.output_text === "string" ? data.output_text : "";
  if (!output && Array.isArray(data.output)) output = data.output.flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => part.type === "output_text" && typeof part.text === "string").map(part => part.text).join("\n");
  const match = output.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return { reply: String(parsed.reply || "").slice(0,4000),
        change_summary: String(parsed.change_summary || "").slice(0,700),
        proposed_changes: parsed.proposed_changes && typeof parsed.proposed_changes === "object" ? parsed.proposed_changes : {} };
    } catch {}
  }
  if (!output.trim()) throw new Error("ИИ-консультант не вернул ответ.");
  return { reply: output.trim().slice(0,4000), change_summary: "", proposed_changes: {} };
}

async function createSupportAnswer(env, history, isVip) {
  if (!env.OPENAI_API_KEY) throw new Error("ИИ-помощник ещё не подключён: добавьте OPENAI_API_KEY в Cloudflare Worker Secrets.");
  const questionsUsed = history.reduce((total, item) => total + (item.role === "assistant" ? (String(item.content || "").match(/\\?/g) || []).length : 0), 0);
  const forceFinal = questionsUsed >= 16;
  const instructions = [
    await getGlobalAiToneInstruction(env),
    "Ты — официальный ИИ-помощник мини-приложения «Агентство подарков». Отвечай на русском языке, доброжелательно, ясно и кратко.",
    "Помогай по вопросам каталога, авторских работ, индивидуальных заказов, оплаты Telegram Stars, заказов, баланса, поддержки и VIP.",
    "Если клиент обсуждает свою будущую работу или индивидуальный заказ, проведи консультацию максимум из 16 вопросов за весь диалог: задавай по одному вопросу, не повторяй уже известное, выясни задумку, получателя, повод, бюджет, размер, стиль, цвета, материалы/технику, детализацию и срок.",
    "Для индивидуального заказа уточняй бюджет только в рублях. Никогда не спрашивай, предпочитает ли клиент рубли или Telegram Stars, и не предлагай выбор валюты/способа оплаты в ходе консультации. Не путай бюджет в рублях с оплатой товаров каталога через Telegram Stars.",
    "При подборе индивидуальной работы предложи 2–3 варианта готового заказа, предварительно оцени стоимость и подстрой предложение под бюджет. Чётко говори, что цена ориентировочная и окончательно подтверждается владельцем.",
    "Не превращай консультацию в мастер-класс: не объясняй, как самостоятельно изготовить работу, и не выдавай пошаговые инструкции. Помогай выбрать и заказать готовую работу Агентства.",
    "Не выдумывай наличие товара, статус заказа, факт оплаты, сроки доставки, баланс или условия, которых нет в проверенных данных.",
    "Не проси пароли, токены, API-ключи, коды Telegram или платёжные реквизиты.",
    "Если не знаешь ответ, честно скажи об этом и предложи обратиться к владельцу. Не утверждай, что сам изменил заказ, баланс или оплату.",
    "Не обещай возврат, доставку или изменение данных без подтверждения владельца.",
    isVip ? "Пользователь VIP: давай более подробные рекомендации по выбору подарков, но не выдумывай факты и не меняй правила оплаты." : "Пользователь без VIP: предоставляй базовую поддержку и рекомендации по каталогу.",
    forceFinal ? "В диалоге уже использовано 16 вопросов. Больше не задавай вопросов: подготовь итоговую рекомендацию, варианты и предварительную оценку стоимости с имеющимися данными." : ""
  ].filter(Boolean).join("\n");
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

async function estimateCustomOrderPrice(env, answers, fallbackStars) {
  if (!env.OPENAI_API_KEY) return { price_stars: fallbackStars, source: "rules_fallback", note: "ИИ-оценка временно недоступна; использован базовый расчёт." };
  const prompt = [
    "Оцени предварительную стоимость готовой авторской художественной работы для заказа в Агентстве подарков.",
    "Верни только JSON без Markdown: {\"price_stars\": число, \"note\": \"короткое объяснение\"}.",
    "Цена только в целых Telegram Stars, диапазон 250..100000. Оцени сложность, размер, материалы, детализацию и срочность. Не используй курс рубля и не придумывай конвертацию бюджета.",
    "Это ориентир, не окончательная цена: владелец подтвердит или изменит её вручную.",
    "Данные заказа: " + JSON.stringify(answers).slice(0,3500)
  ].join("\n");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4o-mini", input: prompt, max_output_tokens: 220 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("OpenAI estimate HTTP " + response.status);
    let output = typeof data.output_text === "string" ? data.output_text : "";
    if (!output && Array.isArray(data.output)) output = data.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === "output_text").map(item => item.text || "").join("\n");
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI estimate JSON missing");
    const parsed = JSON.parse(match[0]);
    const price = Number(parsed.price_stars);
    if (!Number.isSafeInteger(price) || price < 250 || price > 100000) throw new Error("AI estimate outside allowed range");
    return { price_stars: price, source: "ai", note: String(parsed.note || "Предварительная оценка ИИ").slice(0,300) };
  } catch (error) {
    console.error("Custom order AI estimate failed:", String(error).slice(0,300));
    return { price_stars: fallbackStars, source: "rules_fallback", note: "ИИ-оценка временно недоступна; использован базовый расчёт." };
  }
}

async function getGlobalAiToneInstruction(env){
 try{
  const row=await env.DB.prepare("SELECT settings_json FROM ai_moderator_settings WHERE id=1").first();
  const saved=JSON.parse(row?.settings_json||"{}");
  const tone=saved.global_tone||"respectful";
  const map={
   friendly:"Общий тон Агентства: дружелюбный, живой и поддерживающий, без фамильярности.",
   respectful:"Общий тон Агентства: уважительный, спокойный, ясный и профессиональный.",
   promotional:"Общий тон Агентства: мягко-рекламный, показывай полезные возможности и идеи без давления и навязывания покупки.",
   creative:"Общий тон Агентства: творческий и вдохновляющий, предлагай интересные формулировки и идеи, не выдумывая факты."
  };
  return map[tone]||map.respectful;
 }catch{return "Общий тон Агентства: уважительный, спокойный и ясный.";}
}
async function createCraftAnswer(env,messages){
 if(!env.OPENAI_API_KEY)throw new Error("ИИ-мастерская временно не подключена.");
 const assistantTurns=messages.filter(m=>m.role==="assistant").length;
 const questionsUsed=Math.max(0,assistantTurns-1);
 const forceFinal=questionsUsed>=16;
 const instructions=[
  await getGlobalAiToneInstruction(env),
  "Ты — консультант по индивидуальным заказам Агентства подарков. Твоя задача — помочь клиенту выбрать и заказать готовую авторскую работу у Агентства, а НЕ научить клиента делать поделку самостоятельно.",
  "Главная цель диалога: понять задумку и бюджет клиента, предложить подходящие варианты готовых работ, рассчитать предварительную стоимость заказа и подготовить понятное резюме для владельца.",
  "Сначала уточни идею, для кого подарок и по какому поводу. Затем последовательно уточни бюджет только в рублях, размер, стиль, желаемые цвета, материалы/технику, уровень детализации, важные элементы и желаемый срок. Не спрашивай, в какой валюте считать, и не предлагай выбирать между рублями и Telegram Stars: бюджет индивидуальной работы обсуждается в рублях. Не задавай вопрос, если ответ уже есть в переписке.",
  "Задавай строго ОДИН короткий вопрос за сообщение. Если клиент не знает, чего хочет, предложи 2–3 конкретные идеи на выбор. Не превращай беседу в анкету: вопросы должны быть естественными и относиться к заказу.",
  "Не более 16 вопросов консультанта за весь диалог. Первое приветствие не считается вопросом. Если уже задано 16 вопросов, больше ничего не спрашивай — сразу подготовь итог по имеющимся данным и явно отметь неизвестные детали.",
  "Когда данных достаточно, предложи 2–3 варианта заказа: название/концепция, что будет входить в готовую работу, чем варианты отличаются и предварительная цена каждого. Сравни цены с бюджетом клиента и выбери лучший вариант в пределах бюджета. Если ни один не помещается, предложи более доступный вариант или честно сообщи о разнице.",
  "Рассчитывай предварительную стоимость готовой работы в Telegram Stars по сложности, размеру, детализации, материалам и срочности. Это ориентир ИИ, а не официальный прайс; не выдумывай закупочные цены и не конвертируй бюджет в рублях в Stars по выдуманному курсу. Покажи диапазон в Stars и объясни факторы. Окончательную цену подтверждает владелец; владелец может назначить её вручную в карточке индивидуального заказа.",
  "ВАЖНО: не пиши инструкцию по изготовлению, список пошаговых действий, мастер-класс, шаблон самостоятельной сборки или советы «сделай сам». Не расписывай этапы изготовления. Вместо этого описывай результат, комплектацию готовой работы и то, что получит заказчик.",
  "Если бюджет неизвестен — сначала спроси его. Если клиент не хочет называть бюджет, можно продолжить с несколькими ценовыми уровнями, не блокируя консультацию.",
  "Когда итоговый подбор готов, начни ответ строго с [READY]. Пока уточняешь пожелания, начни строго с [ASK]. Не используй [READY], пока не предложил подходящий вариант и не оценил стоимость.",
  forceFinal ? "ОБЯЗАТЕЛЬНО: лимит из 16 вопросов уже достигнут. Никаких новых вопросов. Сейчас выдай итоговый подбор с имеющимися данными, вариантами и предварительными ценами, начни с [READY]." : "",
  "Учитывай безопасность: не предлагай опасные материалы, огонь, токсичные вещества, опасные конструкции или рискованные действия.",
  "Пиши по-русски, дружелюбно, конкретно и аккуратно. Не обещай, что заказ уже принят или оплачен."
 ].filter(Boolean).join("\n");
 const input=messages.map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,1500)}));
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4o-mini",instructions,input,max_output_tokens:1400})});
 const d=await r.json().catch(()=>({}));if(!r.ok){console.error("Craft assistant failed:",r.status,d.error?.message||"");throw new Error(d.error?.message||"Не удалось получить ответ ИИ-мастерской.");}
 let a=typeof d.output_text==="string"?d.output_text:"";if(!a&&Array.isArray(d.output))a=d.output.flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x.type==="output_text"&&typeof x.text==="string").map(x=>x.text).join("\n");if(!a.trim())throw new Error("ИИ-мастерская не вернула ответ.");
 a=a.trim();let ready=a.startsWith("[READY]");a=a.replace(/^\[(?:READY|ASK)\]\s*/,"").slice(0,7000);
 if(forceFinal&&!ready)throw new Error("Не удалось завершить подбор после 16 вопросов. Попробуй отправить последнее сообщение ещё раз.");
 return {reply:a,ready,questions_used:questionsUsed};
}
async function createVipSupportAnswer(env,message){
 const instructions=[await getGlobalAiToneInstruction(env),"Ты — старший специалист VIP-поддержки официального Агентства подарков.","Отвечай по-русски уважительно, внимательно и конкретно. У пользователя действующая VIP-подписка.","Помогай по заказам, каталогу, оплате, балансу и услугам Агентства. Не выдумывай статусы, платежи, сроки, цены или выполненные действия.","Если для решения нужен владелец, предложи явно запросить передачу обращения. Не обещай срок ответа."].join("\n");
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_VIP_MODEL||env.OPENAI_MODEL||"gpt-4o-mini",instructions,input:message,max_output_tokens:1000})});
 const d=await r.json().catch(()=>({}));if(!r.ok){console.error("VIP support failed:",r.status,JSON.stringify(d).slice(0,800));throw new Error("VIP-помощь временно недоступна.");}
 let a=typeof d.output_text==="string"?d.output_text:"";if(!a&&Array.isArray(d.output))a=d.output.flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x.type==="output_text"&&typeof x.text==="string").map(x=>x.text).join("\n");if(!a.trim())throw new Error("VIP-помощник не вернул ответ.");return a.trim().slice(0,4000);
}

async function syncTelegramWebhook(env) {
  if (!env.BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.DB) return;
  const expectedUrl = "https://agentstvo-podarkov.iliamironov333.workers.dev/api/telegram/webhook";
  const secretHash = toHex(new Uint8Array(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(env.TELEGRAM_WEBHOOK_SECRET)
  )));
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS webhook_sync_state (id INTEGER PRIMARY KEY CHECK (id=1), secret_hash TEXT NOT NULL, checked_at TEXT NOT NULL)").run();
  const previous = await env.DB.prepare("SELECT secret_hash, checked_at FROM webhook_sync_state WHERE id=1").first();
  if (previous && previous.secret_hash === secretHash) {
    const fresh = await env.DB.prepare("SELECT CASE WHEN datetime(?) > datetime('now','-5 minutes') THEN 1 ELSE 0 END AS fresh")
      .bind(previous.checked_at).first();
    if (fresh?.fresh === 1) return;
  }
  const info = await telegram(env, "getWebhookInfo", {});
  const hasForbiddenError = /403|forbidden|wrong response/i.test(String(info.last_error_message || ""));
  if (!previous || info.url !== expectedUrl || hasForbiddenError) {
    await telegram(env, "setWebhook", {
      url: expectedUrl,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "edited_message", "callback_query", "pre_checkout_query"],
      drop_pending_updates: false,
      max_connections: 40
    });
    console.log("Telegram webhook synchronized with current Worker secret.");
  }
  await env.DB.prepare("INSERT INTO webhook_sync_state (id,secret_hash,checked_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET secret_hash=excluded.secret_hash,checked_at=CURRENT_TIMESTAMP")
    .bind(secretHash).run();
}

async function handleWebhook(request, env) {
  const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || !safeEqual(supplied || "", env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
  const update = await readJson(request);
  if (update.callback_query?.data?.startsWith("ai_order_approve:")) {
    await handleAiTelegramUpdate(update, env);
    return json({ ok: true });
  }
  const groupUpdateMessage = update.message || update.edited_message;
  if (groupUpdateMessage && !groupUpdateMessage.successful_payment &&
      (groupUpdateMessage.chat?.type === "group" || groupUpdateMessage.chat?.type === "supergroup")) {
    await handleAiTelegramUpdate(update, env);
    return json({ ok: true });
  }
  // Personal bot commands must be handled separately from group moderation.
  const incomingMessage = update.message;
  if (incomingMessage?.chat?.type === "private" && typeof incomingMessage.text === "string") {
    const command = incomingMessage.text.trim().split(/\\s+/, 1)[0].split("@")[0].toLowerCase();
    if (command === "/start") {
      if (incomingMessage.from?.id) await ensureUser(env, incomingMessage.from);
      await telegram(env, "sendMessage", {
        chat_id: incomingMessage.chat.id,
        text: "🎁 Добро пожаловать в «Агентство подарков»!\\n\\nЗдесь можно посмотреть каталог, выбрать подарок и оформить заказ. Нажмите кнопку ниже, чтобы открыть мини-приложение.",
        reply_markup: {
          inline_keyboard: [[{ text: "🎁 Открыть Агентство подарков", web_app: { url: SITE_ORIGIN + "/agentstvo-podarkov/?v=20261113-gift-builder-v2" } }]]
        }
      });
      return json({ ok: true });
    }
  }
  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    let valid = false;
    try {
      const intent = await env.DB.prepare("SELECT payload,telegram_id,kind,plan_type,amount_stars,status FROM payment_intents WHERE payload=?")
        .bind(q.invoice_payload).first();
      valid = !!intent && (intent.kind === "topup" && String(intent.plan_type||"").startsWith("group_invoice:") || String(intent.telegram_id) === String(q.from.id)) &&
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
  if (!intent || (!(intent.kind === "topup" && String(intent.plan_type||"").startsWith("group_invoice:")) && String(intent.telegram_id) !== telegramId) ||
      Number(intent.amount_stars) !== Number(payment.total_amount)) {
    console.error("Payment intent mismatch", payload);
    return json({ ok: true });
  }
  const chargeId = String(payment.telegram_payment_charge_id || "");
  if (!chargeId) return json({ ok: true });

  if (intent.kind === "topup" && String(intent.plan_type||"").startsWith("group_invoice:")) {
    if (intent.status !== "pending") return json({ ok: true });
    const result = await env.DB.prepare("UPDATE payment_intents SET status='paid',charge_id=?,paid_at=CURRENT_TIMESTAMP WHERE payload=? AND status='pending' AND amount_stars=?")
      .bind(chargeId, payload, payment.total_amount).run();
    if (result.meta && result.meta.changes === 1) {
      const groupChatId = String(intent.reference_id || "");
      const invoiceTitle = String(intent.plan_type || "group_invoice:Счёт Агентства подарков").replace(/^group_invoice:/,"");
      if (groupChatId) {
        try {
          await telegram(env, "sendMessage", { chat_id: groupChatId,
            text: "✅ Счёт «" + invoiceTitle + "» оплачен.\nСумма: " + payment.total_amount + " Stars.\nПлательщик: " + (message.from.first_name || "Участник") + ". Спасибо!" });
        } catch (error) { console.error("Group invoice payment notice failed:", String(error)); }
      }
      await notifyOwner(env, "⭐ Оплачен групповой счёт Агентства подарков\nСчёт: " + invoiceTitle +
        "\nПлательщик Telegram ID: " + telegramId + "\nСумма: " + payment.total_amount + " Stars");
    }
    return json({ ok: true });
  }

  if (intent.kind === "order") {
    const promoSchemaReady = await tableExists(env,"promo_codes");
    const order = await env.DB.prepare(promoSchemaReady
      ? "SELECT id,product_title,total_stars,payment_status,promo_code,balance_applied_stars FROM orders WHERE id=? AND telegram_id=?"
      : "SELECT id,product_title,total_stars,payment_status,NULL AS promo_code,balance_applied_stars FROM orders WHERE id=? AND telegram_id=?")
      .bind(intent.reference_id, telegramId).first();
    if (!order) return json({ ok: true });
    const earned = Math.floor(Number(order.total_stars || intent.amount_stars) / 3);
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
      statements.push(env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),redeemed_count=redeemed_count+1,updated_at=CURRENT_TIMESTAMP WHERE code=(SELECT code FROM promo_redemptions WHERE order_id=? AND status='reserved') AND changes()=1").bind(order.id));
      statements.push(env.DB.prepare("UPDATE promo_redemptions SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='reserved' AND changes()=1").bind(order.id));
      const results = await env.DB.batch(statements);
      if (!results[1] || !results[1].meta || results[1].meta.changes !== 1) return json({ ok: true });
      const custom=await env.DB.prepare("SELECT id,subject FROM custom_orders WHERE id=? AND telegram_id=?").bind(order.id,telegramId).first();
      if(custom){
        await env.DB.prepare("UPDATE custom_orders SET status='new' WHERE id=? AND telegram_id=? AND status='pending'").bind(order.id,telegramId).run();
        try {
          const aiDraft = await env.DB.prepare("SELECT id,chat_id,telegram_id,details_json FROM ai_order_drafts WHERE order_id=? AND status='approved'").bind(order.id).first();
          if (aiDraft) {
            await env.DB.prepare("UPDATE ai_order_drafts SET status='paid',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(aiDraft.id).run();
            let draftDetails={};try{draftDetails=JSON.parse(aiDraft.details_json||"{}");}catch{}
            const customerChatId=draftDetails.source==="group"?String(aiDraft.telegram_id):String(aiDraft.chat_id);
            await telegram(env,"sendMessage",{chat_id:customerChatId,text:"✅ Оплата Вашего индивидуального заказа успешно получена! Заказ передан владельцу в работу."});
          }
        } catch (error) { console.error("AI custom order confirmation failed:",String(error).slice(0,300)); }
        await notifyOwner(env,"🎨 Оплачен индивидуальный заказ\nID: "+order.id+"\nПокупатель: "+telegramId+"\nРабота: "+custom.subject+"\nИтого: "+order.total_stars+" ⭐\nСписано с баланса: "+Number(order.balance_applied_stars||0)+" ⭐\nОплачено Telegram: "+payment.total_amount+" ⭐");
        return json({ok:true});
      }
      const deliveryInfo=await env.DB.prepare("SELECT address,delivery_details,delivery_note,distance_km,delivery_stars,priority_delivery,priority_stars FROM order_delivery WHERE order_id=?").bind(order.id).first();
      await notifyOwner(env, "🎁 Оплачен заказ!\nID: " + order.id + "\nПокупатель: " + telegramId +
        "\nИтого заказа: " + order.total_stars + " ⭐\nСписано с баланса: " + Number(order.balance_applied_stars||0) + " ⭐\nОплата Telegram: " + payment.total_amount + " ⭐\nБаллы: +" + earned + "\nТовар: " + order.product_title +
        (deliveryInfo ? (String(deliveryInfo.address || "").startsWith("Самовывоз") ? "\n" + deliveryInfo.address + "\nДоставка: бесплатно" : "\nАдрес доставки: " + deliveryInfo.address + (deliveryInfo.delivery_details ? ", " + deliveryInfo.delivery_details : "") + "\nРасстояние: " + deliveryInfo.distance_km + " км\nДоставка: " + deliveryInfo.delivery_stars + " ⭐" + (deliveryInfo.priority_delivery ? "\nПриоритет: +100 ⭐" : "")) : ""));
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


async function processCampaignBatch(env, limit = 15) {
  if (!env.DB || !env.BOT_TOKEN) return { processed: 0, skipped: true };
  if (!(await tableExists(env,"campaigns")) || !(await tableExists(env,"campaign_recipients"))) return { processed: 0, skipped: true, migration_pending: true };
  await env.DB.prepare("UPDATE campaign_recipients SET status='uncertain',last_error='Неизвестно, успел ли Telegram доставить сообщение до сбоя. Проверьте историю чата перед повтором.',updated_at=CURRENT_TIMESTAMP WHERE status='sending' AND started_at < datetime('now','-10 minutes')").run();
  const rows = await env.DB.prepare(
    "SELECT r.id AS recipient_id,r.telegram_id,r.attempts,c.id AS campaign_id,c.body,c.media_url,c.button_text,c.button_url FROM campaign_recipients r JOIN campaigns c ON c.id=r.campaign_id WHERE r.status='pending' AND c.status IN ('queued','sending') ORDER BY c.id,r.id LIMIT ?"
  ).bind(Math.min(25, Math.max(1, Number(limit) || 15))).all();
  let processed = 0;
  for (const row of rows.results || []) {
    const claim = await env.DB.prepare("UPDATE campaign_recipients SET status='sending',attempts=attempts+1,started_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
      .bind(row.recipient_id).run();
    if (!claim.meta || claim.meta.changes !== 1) continue;
    try {
      const replyMarkup = row.button_text && row.button_url
        ? { inline_keyboard: [[{ text: row.button_text, url: row.button_url }]] } : undefined;
      if (row.media_url) {
        const payload = { chat_id: String(row.telegram_id), photo: row.media_url, caption: row.body };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        await telegram(env, "sendPhoto", payload);
      } else {
        const payload = { chat_id: String(row.telegram_id), text: row.body };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        await telegram(env, "sendMessage", payload);
      }
      await env.DB.prepare("UPDATE campaign_recipients SET status='sent',sent_at=CURRENT_TIMESTAMP,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='sending'")
        .bind(row.recipient_id).run();
    } catch (error) {
      const safeError = String(error?.message || error).replace(/bot\d+:[^\s]+/gi, "[скрыто]").slice(0, 300);
      await env.DB.prepare("UPDATE campaign_recipients SET status='failed',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='sending'")
        .bind(safeError, row.recipient_id).run();
    }
    processed++;
  }
  await env.DB.prepare(
    "UPDATE campaigns SET status=CASE WHEN EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=campaigns.id AND status IN ('pending','sending')) THEN 'sending' WHEN EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=campaigns.id AND status IN ('failed','uncertain')) THEN 'partial' ELSE 'completed' END,updated_at=CURRENT_TIMESTAMP WHERE status IN ('queued','sending')"
  ).run();
  return { processed };
}


async function cloudflareD1Api(env, endpoint, options = {}) {
  const token=env.CLOUDFLARE_API_TOKEN;
  if(!token)throw new Error("Не настроен секрет CLOUDFLARE_API_TOKEN. Добавьте API-токен Cloudflare с правами D1 Read и D1 Write.");
  const accountId="ec1e70a15ecba9cd22cabb6ad865c986";
  const databaseId="077f0476-4ec0-4ddb-8236-be3575182b0a";
  const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+accountId+"/d1/database/"+databaseId+endpoint,{
    method:options.method||"GET",
    headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:options.body?JSON.stringify(options.body):undefined
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)throw new Error((data.errors||[]).map(x=>x.message).join("; ")||("Cloudflare API вернул HTTP "+response.status));
  return data.result||{};
}

async function releaseExpiredPromoReservations(env) {
  try {
    if (!env.DB || !(await tableExists(env,"promo_codes")) || !(await tableExists(env,"promo_redemptions"))) return { released: 0, skipped: true };
    const expired=await env.DB.prepare("SELECT COUNT(*) AS total FROM promo_redemptions r JOIN orders o ON o.id=r.order_id WHERE r.status='reserved' AND o.payment_status='pending' AND o.created_at<datetime('now','-1 day')").first();
    const count=Number(expired?.total||0);
    if(!count)return {released:0};
    await env.DB.batch([
      env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-(SELECT COUNT(*) FROM promo_redemptions r JOIN orders o ON o.id=r.order_id WHERE r.code=promo_codes.code AND r.status='reserved' AND o.payment_status='pending' AND o.created_at<datetime('now','-1 day'))),updated_at=CURRENT_TIMESTAMP"),
      env.DB.prepare("UPDATE promo_redemptions SET status='released' WHERE status='reserved' AND order_id IN (SELECT id FROM orders WHERE payment_status='pending' AND created_at<datetime('now','-1 day'))"),
      env.DB.prepare("UPDATE orders SET payment_status='cancelled',fulfillment_status='cancelled' WHERE payment_status='pending' AND created_at<datetime('now','-1 day') AND id IN (SELECT order_id FROM promo_redemptions WHERE status='released')"),
      env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE status='pending' AND created_at<datetime('now','-1 day') AND payload IN (SELECT order_id FROM promo_redemptions WHERE status='released')")
    ]);
    return {released:count};
  } catch(error) {
    console.error("Expired promo reservation cleanup failed:",String(error).slice(0,300));
    return {released:0,error:true};
  }
}

async function writeSystemError(env, error, path) {
  try {
    if (!env.DB) return;
    const raw=String(error?.message||error||"Unknown error");
    const safe=raw.replace(/bot\d+:[^\s]+/gi,"[скрытый токен]").replace(/sk-[A-Za-z0-9_-]{12,}/g,"[скрытый ключ]").replace(/Bearer\s+[^\s]+/gi,"Bearer [скрыто]").slice(0,700);
    await env.DB.prepare("INSERT INTO system_error_log (severity,source,message,status) VALUES ('error',?,?, 'new')")
      .bind(String(path||"worker").slice(0,180),safe).run();
  } catch (logError) { console.error("System error log unavailable:",String(logError).slice(0,250)); }
}



const AI_ADMIN_PERMISSION_KEYS = ["ai_bot_manage","ai_bot_logs","ai_watch_end","ai_orders_view","ai_orders_manage","reports_view"];
const ADMIN_PERMISSION_KEYS = [
  "dashboard_view","users_view","users_balance","users_ban","users_unban",
  "orders_view","orders_manage","catalog_view","catalog_manage",
  "support_view","support_reply","campaigns_manage","announcements_manage",
  "promos_manage","analytics_view","backup_manage","system_manage", ...AI_ADMIN_PERMISSION_KEYS
];
function adminPermissionForPath(path, method) {
  if (path === "/api/admin/session") return null;
  if (path === "/api/admin/ai-bot/settings") return "ai_bot_manage";
  if (path === "/api/admin/ai-logs" || path === "/api/admin/ai-warnings" || path === "/api/admin/ai-complaints" || path === "/api/admin/ai-questions") return "ai_bot_logs";
  if (path === "/api/admin/ai-watchlist" || path === "/api/admin/ai-action") return "ai_watch_end";
  if (path === "/api/admin/ai-orders") return method === "GET" ? "ai_orders_view" : "ai_orders_manage";
  if (path === "/api/admin/ai-reports") return "reports_view";
  if (path.startsWith("/api/admin/staff")) return "staff_manage";
  if (path === "/api/admin/users" || path === "/api/admin/user") return "users_view";
  if (path === "/api/admin/balance-adjust") return "users_balance";
  if (path === "/api/admin/block-user") return "users_ban";
  if (path === "/api/admin/unblock-user") return "users_unban";
  if (path === "/api/admin/orders" || path === "/api/admin/order") return "orders_view";
  if (path === "/api/admin/order-update" || path === "/api/admin/order-notify") return "orders_manage";
  if (path === "/api/admin/order-chat") return method === "GET" ? "orders_view" : "orders_manage";
  if (path === "/api/admin/products") return "catalog_view";
  if (path.startsWith("/api/admin/product-")) return "catalog_manage";
  if (path.startsWith("/api/admin/support/")) {
    if (["/api/admin/support/reply","/api/admin/support/ticket-reply","/api/admin/support/ticket-status","/api/admin/support/conversation-mode","/api/admin/support/notes"].includes(path)) return "support_reply";
    return "support_view";
  }
  if (path.startsWith("/api/admin/campaign")) return "campaigns_manage";
  if (path.startsWith("/api/admin/announcement")) return "announcements_manage";
  if (path.startsWith("/api/admin/promo")) return "promos_manage";
  if (path === "/api/admin/analytics") return "analytics_view";
  if (path.startsWith("/api/admin/backup")) return "backup_manage";
  if (path === "/api/admin/dashboard") return "dashboard_view";
  if (path === "/api/admin/error-log" || path === "/api/admin/error-resolve" ||
      path === "/api/admin/feature-flags" || path === "/api/admin/system-controls" ||
      path === "/api/admin/technical-status" || path === "/api/admin/server-diagnostics" ||
      path === "/api/admin/webhook-reconnect") return "system_manage";
  return "owner_only";
}
function defaultAdminPermissions(role = "owner") {
  return Object.fromEntries(ADMIN_PERMISSION_KEYS.map(key => [key, !AI_ADMIN_PERMISSION_KEYS.includes(key) || role === "owner" || key === "ai_bot_manage"]));
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(processCampaignBatch(env, 15).catch(error => console.error("Campaign queue processor failed:", String(error).slice(0,500))));
    ctx.waitUntil(releaseExpiredOrderReservations(env));
    ctx.waitUntil(releaseExpiredPromoReservations(env));
    ctx.waitUntil(handleAiScheduled(env).catch(error => console.error("AI moderator scheduled task failed:", String(error).slice(0,500))));
    ctx.waitUntil(syncTelegramWebhook(env).catch(error => console.error("Telegram webhook auto-sync failed:", String(error).slice(0,500))));
    // Automatic postcard retries are disabled. Paid orders are confirmed by text; artwork is delivered manually.
  },
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
        let webhookSync = "ok";
        let webhookSyncError = null;
        try { await syncTelegramWebhook(env); }
        catch (error) {
          webhookSync = "failed";
          webhookSyncError = String(error).slice(0,500);
          console.error("Telegram webhook health sync failed:", webhookSyncError);
        }
        return json({ ok: true, service: "agentstvo-podarkov-api",
          databaseConfigured: !!env.DB, botConfigured: !!env.BOT_TOKEN,
          webhookSync, webhookSyncError }, 200, origin);
      }
      if (path === "/api/telegram/webhook" && method === "POST") {
        if (!env.DB || !env.BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "Webhook is not configured" }, 500, origin);
        // Self-heal Telegram's registered secret before validating the incoming update.
        // If this request carried the old secret, Telegram will retry after setWebhook.
        try { await syncTelegramWebhook(env); }
        catch (error) { console.error("Telegram webhook preflight sync failed:", String(error).slice(0,500)); }
        return handleWebhook(request, env);
      }
      if (!path.startsWith("/api/")) return json({ error: "Not found" }, 404, origin);
      if (!env.DB || !env.BOT_TOKEN) return json({ error: "Server is not configured" }, 500, origin);

      const productImageMatch = path.match(/^\/api\/product-image\/([^/]+)$/);
      if (productImageMatch && method === "GET") {
        const image = await env.DB.prepare("SELECT mime_type,image_data FROM product_images WHERE product_id=?").bind(decodeURIComponent(productImageMatch[1])).first();
        if (!image) return json({ error: "Изображение не найдено." }, 404, origin);
        const binary = atob(image.image_data);
        const bytes = new Uint8Array(binary.length);
        for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        return new Response(bytes, { status: 200, headers: { "Content-Type": image.mime_type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", ...corsHeaders(origin) } });
      }

      const user = await validateTelegram(request.headers.get("X-Telegram-Init-Data"), env.BOT_TOKEN);
      if (!user) return json({ error: "Telegram authentication failed. Откройте Mini App через Telegram." }, 401, origin);
      const telegramId = String(user.id);
      await ensureUser(env, user);

      if (path === "/api/announcements" && method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT id,title,body,link_url,starts_at,ends_at FROM announcements WHERE status='published' AND (starts_at IS NULL OR starts_at='' OR datetime(starts_at)<=datetime('now')) AND (ends_at IS NULL OR ends_at='' OR datetime(ends_at)>=datetime('now')) AND (audience_type='all' OR (audience_type='selected' AND EXISTS (SELECT 1 FROM json_each(announcements.audience_ids) WHERE CAST(value AS TEXT)=?))) ORDER BY created_at DESC LIMIT 10"
        ).bind(telegramId).all();
        return json({ ok: true, announcements: rows.results || [] }, 200, origin);
      }

      // Administrative access is checked on the server for every request.
      if (path.startsWith("/api/admin/")) {
        const ownerId = String(env.ADMIN_TELEGRAM_ID || "").trim();
        if (!ownerId) return json({ error: "Owner access is not configured." }, 503, origin);
        const rootOwner = telegramId === ownerId;
        let staff = null;
        if (!rootOwner) {
          try {
            staff = await env.DB.prepare("SELECT telegram_id,role,permissions_json,status FROM admin_staff WHERE telegram_id=?")
              .bind(telegramId).first();
          } catch (error) {
            if (isMissingTableError(error, "admin_staff")) return json({ error: "Система должностей ещё не установлена. Требуется миграция 0015_admin_staff.sql." }, 503, origin);
            throw error;
          }
          if (!staff || staff.status !== "active" || !["moderator","owner"].includes(staff.role)) {
            return json({ error: "Административный доступ не предоставлен." }, 403, origin);
          }
        }
        let permissions = rootOwner || staff?.role === "owner" ? defaultAdminPermissions() : {};
        if (!rootOwner && staff?.role === "moderator") {
          try { permissions = { ...defaultAdminPermissions("moderator"), ...JSON.parse(staff.permissions_json || "{}") }; }
          catch { permissions = {}; }
          for (const key of Object.keys(permissions)) permissions[key] = permissions[key] === true;
        }
        if (path === "/api/admin/session" && method === "GET") {
          const hasAdminAccess = rootOwner || staff?.role === "owner" || ADMIN_PERMISSION_KEYS.some(key => permissions[key] === true);
          return json({ ok: true, owner: rootOwner || staff?.role === "owner", root_owner: rootOwner,
            admin_access: hasAdminAccess, role: rootOwner ? "owner" : staff.role, permissions }, 200, origin);
        }
        const requiredPermission = adminPermissionForPath(path, method);
        if (!rootOwner && path !== "/api/admin/session" && staff?.role === "moderator" && !ADMIN_PERMISSION_KEYS.some(key => permissions[key] === true)) {
          return json({ error: "Все административные права отозваны владельцем." }, 403, origin);
        }
        if (!rootOwner && requiredPermission === "owner_only") return json({ error: "Это действие доступно только владельцу." }, 403, origin);
        // Action permissions include the read access needed to select a target, but do not grant other write permissions.
        const permissionFallbacks = {
          users_view: ["users_balance", "users_ban", "users_unban"],
          orders_view: ["orders_manage"],
          catalog_view: ["catalog_manage"],
          support_view: ["support_reply"],
          ai_orders_view: ["ai_orders_manage"]
        };
        const hasRequiredPermission = requiredPermission === "staff_manage" ||
          permissions[requiredPermission] === true ||
          (permissionFallbacks[requiredPermission] || []).some(key => permissions[key] === true);
        if (!rootOwner && requiredPermission && !hasRequiredPermission) {
          return json({ error: "У этой должности нет разрешения на данное действие: " + requiredPermission }, 403, origin);
        }
        if (!rootOwner && requiredPermission === "staff_manage") {
          return json({ error: "Управление должностями доступно только основному владельцу." }, 403, origin);
        }

        if (path === "/api/admin/server-diagnostics" && method === "GET") {
          const checkedAt = new Date().toISOString();
          const expectedWebhookUrl = new URL("/api/telegram/webhook", request.url).toString();
          const result = {
            checked_at: checkedAt,
            worker: { ok: true, url: new URL(request.url).origin },
            database: { ok: false },
            telegram: { ok: false },
            webhook_secret_configured: !!env.TELEGRAM_WEBHOOK_SECRET,
            webhook: { url: null, matches_expected: false, pending_update_count: 0, last_error_message: null, allowed_updates: [] },
            group: { id: null, bot_is_admin: false },
            overall_ok: false
          };
          try { await env.DB.prepare("SELECT 1 AS ready").first(); result.database.ok = true; }
          catch (error) { result.database.error = String(error.message || error).slice(0,240); }
          let bot = null;
          try { bot = await telegram(env, "getMe", {}); result.telegram = { ok: true, username: bot.username || null, id: bot.id || null }; }
          catch (error) { result.telegram.error = String(error.message || error).slice(0,240); }
          try {
            const info = await telegram(env, "getWebhookInfo", {});
            result.webhook = {
              url: info.url || null,
              matches_expected: info.url === expectedWebhookUrl,
              pending_update_count: Number(info.pending_update_count || 0),
              last_error_message: info.last_error_message || null,
              last_error_date: info.last_error_date || null,
              allowed_updates: Array.isArray(info.allowed_updates) ? info.allowed_updates : [],
              has_custom_certificate: !!info.has_custom_certificate,
              ip_address: info.ip_address || null
            };
          } catch (error) { result.webhook.error = String(error.message || error).slice(0,240); }
          try {
            if (await tableExists(env, "ai_moderator_settings")) {
              const settings = await env.DB.prepare("SELECT group_chat_id FROM ai_moderator_settings WHERE id=1").first();
              const groupId = settings?.group_chat_id ? String(settings.group_chat_id) : null;
              result.group.id = groupId;
              if (groupId && bot) {
                try {
                  await telegram(env, "getChat", { chat_id: groupId });
                  const member = await telegram(env, "getChatMember", { chat_id: groupId, user_id: bot.id });
                  result.group.bot_status = member.status || "unknown";
                  result.group.bot_is_admin = ["administrator","creator"].includes(member.status);
                  result.group.can_delete_messages = member.status === "creator" || member.can_delete_messages === true;
                  result.group.can_restrict_members = member.status === "creator" || member.can_restrict_members === true;
                } catch (error) { result.group.error = String(error.message || error).slice(0,240); }
              }
            } else result.group.error = "Таблица настроек ИИ-модератора не найдена.";
          } catch (error) { result.group.error = String(error.message || error).slice(0,240); }
          result.overall_ok = result.worker.ok && result.database.ok && result.telegram.ok &&
            result.webhook.matches_expected && result.webhook_secret_configured &&
            (!result.group.id || result.group.bot_is_admin);
          return json(result, 200, origin);
        }
        if (path === "/api/admin/webhook-reconnect" && method === "POST") {
          const secret = String(env.TELEGRAM_WEBHOOK_SECRET || "");
          if (!secret) return json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET не настроен в Worker." }, 503, origin);
          if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) return json({ ok: false, error: "TELEGRAM_WEBHOOK_SECRET содержит символы, которые Telegram не принимает. Задайте новый секрет в Cloudflare." }, 409, origin);
          const webhookUrl = new URL("/api/telegram/webhook", request.url).toString();
          try {
            await telegram(env, "setWebhook", {
              url: webhookUrl,
              secret_token: secret,
              allowed_updates: ["message","edited_message","callback_query","pre_checkout_query"],
              drop_pending_updates: false,
              max_connections: 40
            });
            const info = await telegram(env, "getWebhookInfo", {});
            const matches = info.url === webhookUrl;
            if (await tableExists(env, "admin_action_log")) {
              await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)")
                .bind(telegramId,"telegram_webhook_reconnected",JSON.stringify({url:webhookUrl,matches_expected:matches,pending_update_count:Number(info.pending_update_count||0)})).run();
            }
            return json({
              ok: matches,
              url: info.url || null,
              matches_expected: matches,
              pending_update_count: Number(info.pending_update_count || 0),
              last_error_message: info.last_error_message || null,
              allowed_updates: Array.isArray(info.allowed_updates) ? info.allowed_updates : [],
              message: matches ? "Webhook зарегистрирован и проверен." : "Telegram вернул другой адрес webhook."
            }, matches ? 200 : 502, origin);
          } catch (error) {
            return json({ ok: false, error: String(error.message || error).slice(0,500) }, 502, origin);
          }
        }

        if (path === "/api/admin/staff" && method === "GET") {
          const rows = await env.DB.prepare("SELECT s.telegram_id,s.role,s.permissions_json,s.status,s.created_at,s.updated_at,u.username,u.first_name FROM admin_staff s LEFT JOIN users u ON u.telegram_id=s.telegram_id ORDER BY s.created_at DESC").all();
          return json({ ok: true, staff: rows.results || [], permission_keys: ADMIN_PERMISSION_KEYS }, 200, origin);
        }
        if (path === "/api/admin/staff/role" && method === "POST") {
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          const role = body.role;
          if (!targetId || !["owner","moderator","client"].includes(role)) return json({ error: "Укажите Telegram ID и корректную должность." }, 400, origin);
          if (targetId === ownerId) return json({ error: "Основного владельца нельзя изменить через список сотрудников." }, 409, origin);
          const target = await env.DB.prepare("SELECT telegram_id FROM users WHERE telegram_id=?").bind(targetId).first();
          if (!target) return json({ error: "Сначала пользователь должен открыть Mini App хотя бы один раз." }, 404, origin);
          const existing = await env.DB.prepare("SELECT permissions_json FROM admin_staff WHERE telegram_id=?").bind(targetId).first();
          // New moderators receive no permissions until the owner explicitly enables selected ones.
          let savedPermissions = role === "moderator"
            ? Object.fromEntries(ADMIN_PERMISSION_KEYS.map(key => [key, false]))
            : defaultAdminPermissions();
          if (existing?.permissions_json) {
            try { savedPermissions = { ...savedPermissions, ...JSON.parse(existing.permissions_json) }; } catch {}
          }
          const permissionsJson = JSON.stringify(savedPermissions);
          await env.DB.prepare("INSERT INTO admin_staff (telegram_id,role,permissions_json,status,created_by,updated_by) VALUES (?,?,?,'active',?,?) ON CONFLICT(telegram_id) DO UPDATE SET role=excluded.role,status='active',updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
            .bind(targetId, role, permissionsJson, telegramId, telegramId).run();
          await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
            .bind(telegramId,targetId,"staff_role_changed",JSON.stringify({ role })).run();
          return json({ ok: true, telegram_id: targetId, role }, 200, origin);
        }
        if (path === "/api/admin/staff/permissions" && method === "POST") {
          const body = await readJson(request);
          const targetId = typeof body.telegram_id === "string" ? body.telegram_id.trim().slice(0,64) : "";
          if (!targetId || !body.permissions || typeof body.permissions !== "object" || Array.isArray(body.permissions)) return json({ error: "Укажите пользователя и список разрешений." }, 400, origin);
          if (targetId === ownerId) return json({ error: "Права основного владельца нельзя ограничить через этот экран." }, 409, origin);
          const target = await env.DB.prepare("SELECT role FROM admin_staff WHERE telegram_id=? AND status='active'").bind(targetId).first();
          if (!target || target.role !== "moderator") return json({ error: "Изменять индивидуальные права можно только действующему модератору." }, 404, origin);
          const normalized = {};
          for (const key of ADMIN_PERMISSION_KEYS) normalized[key] = body.permissions[key] === true;
          await env.DB.prepare("UPDATE admin_staff SET permissions_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?")
            .bind(JSON.stringify(normalized),telegramId,targetId).run();
          await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
            .bind(telegramId,targetId,"staff_permissions_changed",JSON.stringify({ permissions: normalized })).run();
          return json({ ok: true, telegram_id: targetId, permissions: normalized }, 200, origin);
        }
        if (path === "/api/admin/backup/status" && method === "GET") {
          try {
            const session = env.DB.withSession("first-primary");
            await session.prepare("SELECT 1 AS ready").first();
            const bookmark = session.getBookmark();
            return json({
              ok: true,
              time_travel_available: !!bookmark,
              bookmark: bookmark || null,
              checked_at: new Date().toISOString(),
              recovery_type: "cloudflare_d1_time_travel"
            }, 200, origin);
          } catch (error) {
            console.error("D1 Time Travel status check failed:", String(error).slice(0,300));
            return json({
              ok: true,
              time_travel_available: false,
              bookmark: null,
              checked_at: new Date().toISOString(),
              recovery_type: "manual_export_only"
            }, 200, origin);
          }
        }
        if (path === "/api/admin/backup/export" && method === "GET") {
          const listed = await env.DB.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
          const tables = listed.results || [];
          const backupTables = [];
          let totalRows = 0;
          for (const table of tables) {
            const safeName = String(table.name || "");
            if (!safeName || safeName.includes("\u0000")) continue;
            const quoted = '"' + safeName.replace(/"/g, '""') + '"';
            const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM " + quoted).first();
            const count = Number(countRow?.total || 0);
            totalRows += count;
            if (totalRows > 20000) return json({error:"Резервная копия слишком большая для одного файла ("+totalRows+" строк). Нужен поэтапный экспорт."},413,origin);
            const rows = await env.DB.prepare("SELECT * FROM " + quoted).all();
            backupTables.push({name:safeName,create_sql:table.sql||null,row_count:count,rows:rows.results||[]});
          }
          const payload = {format:"agentstvo-podarkov-d1-backup",version:1,created_at:new Date().toISOString(),table_count:backupTables.length,total_rows:totalRows,tables:backupTables};
          const serialized = JSON.stringify(payload);
          if (new TextEncoder().encode(serialized).byteLength > 12*1024*1024) return json({error:"Резервная копия превышает 12 МБ. Нужен поэтапный экспорт."},413,origin);
          const filename = "agentstvo-podarkov-backup-" + new Date().toISOString().replace(/[:.]/g,"-") + ".json";
          return new Response(serialized,{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":'attachment; filename="'+filename+'"',...corsHeaders(origin)}});
        }
        if(path==="/api/admin/backup-history"&&method==="GET"){
          if(!(await tableExists(env,"admin_action_log")))return json({ok:true,history:[],migration_pending:true},200,origin);
          const rows=await env.DB.prepare("SELECT id,action_type,details,created_at FROM admin_action_log WHERE action_type IN ('d1_sql_export_created','d1_time_travel_restore') ORDER BY id DESC LIMIT 50").all();
          return json({ok:true,history:rows.results||[]},200,origin);
        }
        if(path==="/api/admin/backup-status"&&method==="GET"){
          try{
            const result=await cloudflareD1Api(env,"/time_travel/bookmark");
            return json({ok:true,bookmark:result.bookmark||null,provider:"Cloudflare D1 Time Travel",automatic:true},200,origin);
          }catch(error){return json({error:String(error.message||error).slice(0,500),configured:!!env.CLOUDFLARE_API_TOKEN},env.CLOUDFLARE_API_TOKEN?502:503,origin);}
        }
        if(path==="/api/admin/backup-export"&&method==="POST"){
          try{
            const body=await readJson(request),currentBookmark=typeof body.current_bookmark==="string"?body.current_bookmark.trim().slice(0,120):"";
            const result=await cloudflareD1Api(env,"/export",{method:"POST",body:{output_format:"polling",dump_options:{compatibility:"d1"},...(currentBookmark?{current_bookmark:currentBookmark}:{})}});
            if(result.status==="complete"&&await tableExists(env,"admin_action_log"))await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)").bind(telegramId,"d1_sql_export_created",JSON.stringify({filename:result.result?.filename||null,bookmark:result.at_bookmark||null})).run();
            return json({ok:true,status:result.status||"unknown",at_bookmark:result.at_bookmark||null,filename:result.result?.filename||null,signed_url:result.result?.signed_url||null,messages:result.messages||[]},200,origin);
          }catch(error){return json({error:String(error.message||error).slice(0,500)},502,origin);}
        }
        if(path==="/api/admin/backup-restore"&&method==="POST"){
          const body=await readJson(request),bookmark=typeof body.bookmark==="string"?body.bookmark.trim().slice(0,120):"",timestamp=typeof body.timestamp==="string"?body.timestamp.trim().slice(0,40):"";
          if(body.confirmation!=="RESTORE D1"||(!bookmark&&!timestamp)|| (bookmark&&timestamp))return json({error:"Для восстановления укажите одну точку времени и введите RESTORE D1."},400,origin);
          try{
            const before=await cloudflareD1Api(env,"/time_travel/bookmark");
            const query=bookmark?"?bookmark="+encodeURIComponent(bookmark):"?timestamp="+encodeURIComponent(timestamp);
            const restored=await cloudflareD1Api(env,"/time_travel/restore"+query,{method:"POST"});
            if(await tableExists(env,"admin_action_log"))await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)").bind(telegramId,"d1_time_travel_restore",JSON.stringify({previous_bookmark:before.bookmark||null,target_bookmark:bookmark||null,target_timestamp:timestamp||null,new_bookmark:restored.bookmark||null})).run();
            return json({ok:true,message:restored.message||"D1 восстановлена.",previous_bookmark:restored.previous_bookmark||before.bookmark||null,new_bookmark:restored.bookmark||null},200,origin);
          }catch(error){return json({error:String(error.message||error).slice(0,500)},502,origin);}
        }
        if(path==="/api/admin/promos"&&method==="GET"){
          if(!(await tableExists(env,"promo_codes")))return json({ok:true,promos:[],migration_pending:true,scope_migration_pending:true},200,origin);
          const scopeReady=await columnExists(env,"promo_codes","product_ids")&&await columnExists(env,"promo_codes","category_ids");
          const rows=await env.DB.prepare(scopeReady
            ? "SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active,product_ids,category_ids,created_at,updated_at FROM promo_codes ORDER BY created_at DESC LIMIT 100"
            : "SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active,'[]' AS product_ids,'[]' AS category_ids,created_at,updated_at FROM promo_codes ORDER BY created_at DESC LIMIT 100").all();
          return json({ok:true,promos:rows.results||[],scope_migration_pending:!scopeReady},200,origin);
        }
        if(path==="/api/admin/promo-save"&&method==="POST"){
          if(!(await tableExists(env,"promo_codes")))return json({error:"Требуется миграция 0013_promo_codes.sql."},503,origin);
          const body=await readJson(request),code=String(body.code||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,32);
          const percent=Number(body.discount_percent),maxUses=body.max_uses===""||body.max_uses===null||body.max_uses===undefined?null:Number(body.max_uses);
          const starts=typeof body.starts_at==="string"&&body.starts_at.trim()?body.starts_at.trim().replace("T"," ").slice(0,19).padEnd(19,":00"):null;
          const ends=typeof body.ends_at==="string"&&body.ends_at.trim()?body.ends_at.trim().replace("T"," ").slice(0,19).padEnd(19,":00"):null;
          const active=body.is_active===true||body.is_active===1?1:0;
          const productIds=promoScopeValues(body.product_ids),categoryIds=promoScopeValues(body.category_ids);
          if(!/^[A-Z0-9_-]{3,32}$/.test(code)||!Number.isSafeInteger(percent)||percent<1||percent>90||(maxUses!==null&&(!Number.isSafeInteger(maxUses)||maxUses<1)))return json({error:"Проверьте код, скидку 1–90% и лимит использований."},400,origin);
          if(starts&&ends&&Date.parse(starts)>=Date.parse(ends))return json({error:"Дата окончания должна быть позже даты начала."},400,origin);
          const scopeReady=await columnExists(env,"promo_codes","product_ids")&&await columnExists(env,"promo_codes","category_ids");
          if((productIds.length||categoryIds.length)&&!scopeReady)return json({error:"Для ограничений по товарам и категориям требуется миграция 0014_promo_code_scopes.sql."},503,origin);
          if(productIds.length||categoryIds.length){
            const catalogRows=await env.DB.prepare("SELECT id,category FROM products").all();
            const knownIds=new Set((catalogRows.results||[]).map(row=>String(row.id)));
            const knownCategories=new Set((catalogRows.results||[]).map(row=>String(row.category||"")).filter(Boolean));
            if(productIds.some(id=>!knownIds.has(id))||categoryIds.some(category=>!knownCategories.has(category)))return json({error:"Проверьте ID товаров и названия категорий: найдены значения, которых нет в каталоге."},400,origin);
          }
          if(scopeReady){
            await env.DB.prepare("INSERT INTO promo_codes (code,discount_percent,max_uses,starts_at,ends_at,is_active,product_ids,category_ids) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET discount_percent=excluded.discount_percent,max_uses=excluded.max_uses,starts_at=excluded.starts_at,ends_at=excluded.ends_at,is_active=excluded.is_active,product_ids=excluded.product_ids,category_ids=excluded.category_ids,updated_at=CURRENT_TIMESTAMP")
              .bind(code,percent,maxUses,starts,ends,active,JSON.stringify(productIds),JSON.stringify(categoryIds)).run();
          }else{
            await env.DB.prepare("INSERT INTO promo_codes (code,discount_percent,max_uses,starts_at,ends_at,is_active) VALUES (?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET discount_percent=excluded.discount_percent,max_uses=excluded.max_uses,starts_at=excluded.starts_at,ends_at=excluded.ends_at,is_active=excluded.is_active,updated_at=CURRENT_TIMESTAMP")
              .bind(code,percent,maxUses,starts,ends,active).run();
          }
          if(await tableExists(env,"admin_action_log"))await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)").bind(telegramId,"promo_code_saved",JSON.stringify({code,discount_percent:percent,max_uses:maxUses,is_active:active,product_ids:productIds,category_ids:categoryIds})).run();
          return json({ok:true,code},200,origin);
        }
        if (path === "/api/admin/products" && method === "GET") {
          const rows = await env.DB.prepare("SELECT id,title,description,image_url,category,price_stars,is_active,created_at FROM products ORDER BY CAST(id AS INTEGER),created_at DESC").all();
          const categories = await env.DB.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category)<>'' ORDER BY category").all();
          return json({ ok: true, products: rows.results || [], categories: (categories.results || []).map(row => row.category) }, 200, origin);
        }
        if (path === "/api/admin/product-images" && method === "GET") {
          if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return json({error:"Cloudinary не настроен."},503,origin);
          const auth = btoa(env.CLOUDINARY_API_KEY + ":" + env.CLOUDINARY_API_SECRET);
          const cursor = new URL(request.url).searchParams.get("cursor");
          const cloudPath = "https://api.cloudinary.com/v1_1/dzdxfmsn/resources/image/upload?prefix=agentstvo-podarkov%2Fproduct-&max_results=500" + (cursor ? "&next_cursor=" + encodeURIComponent(cursor) : "");
          const cloudResponse = await fetch(cloudPath, {headers:{Authorization:"Basic "+auth}});
          const cloudData = await cloudResponse.json().catch(()=>({}));
          if (!cloudResponse.ok) return json({error:"Не удалось прочитать Cloudinary: "+String(cloudData.error?.message||"ошибка API").slice(0,200)},502,origin);
          const products = await env.DB.prepare("SELECT id,image_url FROM products").all();
          const orphans = (cloudData.resources||[]).filter(asset=>!(products.results||[]).some(p=>p.image_url && String(p.image_url).includes("/"+String(asset.public_id||"")))).map(asset=>({
            public_id:String(asset.public_id||""),secure_url:String(asset.secure_url||""),bytes:Number(asset.bytes||0),created_at:asset.created_at||null
          })).filter(asset=>asset.public_id.startsWith("agentstvo-podarkov/product-") && asset.secure_url);
          return json({ok:true,orphans,checked_assets:(cloudData.resources||[]).length,next_cursor:cloudData.next_cursor||null},200,origin);
        }
        if (path === "/api/admin/product-image-delete" && method === "POST") {
          if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return json({error:"Cloudinary не настроен."},503,origin);
          const body = await readJson(request);
          const publicId = typeof body.public_id === "string" ? body.public_id.trim() : "";
          if (!/^agentstvo-podarkov\/product-[A-Za-z0-9_-]+$/.test(publicId)) return json({error:"Недопустимый идентификатор изображения."},400,origin);
          const products = await env.DB.prepare("SELECT id,image_url FROM products").all();
          if ((products.results||[]).some(p=>p.image_url && String(p.image_url).includes("/"+publicId))) return json({error:"Это изображение ещё используется товаром. Удаление отменено."},409,origin);
          const auth = btoa(env.CLOUDINARY_API_KEY + ":" + env.CLOUDINARY_API_SECRET);
          const cloudResponse = await fetch("https://api.cloudinary.com/v1_1/dzdxfmsn/resources/image/upload", {
            method:"DELETE",headers:{"Authorization":"Basic "+auth,"Content-Type":"application/json"},body:JSON.stringify({public_ids:[publicId],invalidate:true})
          });
          const cloudData = await cloudResponse.json().catch(()=>({}));
          if (!cloudResponse.ok || !cloudData.deleted || cloudData.deleted[publicId]!=="deleted") return json({error:"Cloudinary не подтвердил удаление: "+String(cloudData.error?.message||"файл не удалён").slice(0,200)},502,origin);
          return json({ok:true,public_id:publicId},200,origin);
        }
        if (path === "/api/admin/product-image-upload" && method === "POST") {
          const form = await request.formData();
          const id = typeof form.get("product_id") === "string" ? String(form.get("product_id")).trim().slice(0,100) : "";
          const file = form.get("image");
          if (!id || !file || typeof file.arrayBuffer !== "function") return json({error:"Выберите товар и файл изображения."},400,origin);
          if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return json({error:"Поддерживаются только JPG, PNG и WEBP."},400,origin);
          if (file.size < 1 || file.size > 900*1024) return json({error:"Размер изображения после сжатия не должен превышать 900 КБ."},413,origin);
          if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return json({error:"Cloudinary ещё не подключён: добавьте CLOUDINARY_API_KEY и CLOUDINARY_API_SECRET в секреты Worker."},503,origin);
          const product = await env.DB.prepare("SELECT id FROM products WHERE id=?").bind(id).first();
          if (!product) return json({error:"Сначала сохраните товар."},404,origin);
          const cloudName = "dzdxfmsn";
          const timestamp = Math.floor(Date.now()/1000);
          const publicId = "product-" + id;
          const signatureParams = {folder:"agentstvo-podarkov",overwrite:"true",public_id:publicId,timestamp:String(timestamp)};
          const signatureText = Object.keys(signatureParams).sort().map(key => key+"="+signatureParams[key]).join("&") + env.CLOUDINARY_API_SECRET;
          const signatureBytes = await crypto.subtle.digest("SHA-1",new TextEncoder().encode(signatureText));
          const signature = Array.from(new Uint8Array(signatureBytes)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
          const uploadForm = new FormData();
          uploadForm.append("file",new Blob([await file.arrayBuffer()],{type:file.type}),file.name || ("product-"+id));
          uploadForm.append("api_key",env.CLOUDINARY_API_KEY);
          uploadForm.append("timestamp",String(timestamp));
          uploadForm.append("public_id",publicId);
          uploadForm.append("folder","agentstvo-podarkov");
          uploadForm.append("overwrite","true");
          uploadForm.append("signature",signature);
          const cloudResponse = await fetch("https://api.cloudinary.com/v1_1/"+cloudName+"/image/upload",{method:"POST",body:uploadForm});
          const cloudResult = await cloudResponse.json().catch(()=>({}));
          if (!cloudResponse.ok || !cloudResult.secure_url) {
            const reason = String(cloudResult.error?.message || "Cloudinary не принял изображение.").slice(0,240);
            return json({error:"Ошибка Cloudinary: "+reason},502,origin);
          }
          const imageUrl = String(cloudResult.secure_url).replace("/image/upload/","/image/upload/f_auto,q_auto/");
          await env.DB.prepare("UPDATE products SET image_url=? WHERE id=?").bind(imageUrl,id).run();
          try { await env.DB.prepare("DELETE FROM product_images WHERE product_id=?").bind(id).run(); } catch {}
          return json({ok:true,image_url:imageUrl,size_bytes:Number(cloudResult.bytes||file.size),storage:"cloudinary"},200,origin);
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
            if (!imageUrl) await env.DB.prepare("DELETE FROM product_images WHERE product_id=?").bind(id).run();
          } else {
            const newId = makeId();
            await env.DB.prepare("INSERT INTO products (id,title,description,image_url,category,price_stars,is_active,is_new) VALUES (?,?,?,?,?,?,?,1)")
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
          const description = "Операция администратора: " + reason;
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
          await notifyOwner(env, "⭐ Изменение баланса администратором\nПользователь: " + targetId + "\nОперация: " + (amount > 0 ? "+" : "") + amount + " баллов\nПричина: " + reason);
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
              .bind(telegramId, targetId, JSON.stringify({ reason: "Разблокировка администратором" }))
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
        if (path === "/api/admin/custom-order-price" && method === "POST") {
          const b=await readJson(request),id=typeof b.order_id==="string"?b.order_id.trim().slice(0,100):"",price=Number(b.price_stars);
          if(!id||!Number.isSafeInteger(price)||price<1||price>100000)return json({error:"Укажите итоговую цену от 1 до 100 000 Stars."},400,origin);
          const c=await env.DB.prepare("SELECT id,telegram_id,subject,status FROM custom_orders WHERE id=?").bind(id).first();
          if(!c)return json({error:"Индивидуальный заказ не найден."},404,origin);
          if(["cancelled","canceled"].includes(String(c.status)))return json({error:"Отменённый заказ нельзя выставить на оплату."},409,origin);
          const old=await env.DB.prepare("SELECT payment_status,balance_applied_stars FROM orders WHERE id=? AND telegram_id=?").bind(id,String(c.telegram_id)).first();
          if(old?.payment_status==="paid")return json({error:"Заказ уже оплачен. Изменять цену нельзя."},409,origin);
          if(old&&Number(old.balance_applied_stars||0)>0)return json({error:"По заказу уже списана часть баланса. Сначала отмените неоплаченный заказ, чтобы вернуть списанные баллы."},409,origin);
          if(old){
            await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE kind='order' AND reference_id=? AND telegram_id=? AND status='pending'").bind(id,String(c.telegram_id)).run();
            await env.DB.prepare("UPDATE orders SET price_stars=?,total_stars=?,product_title=? WHERE id=? AND telegram_id=? AND payment_status='pending' AND balance_applied_stars=0").bind(price,price,"Индивидуальная работа: "+c.subject,id,String(c.telegram_id)).run();
            const u=await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(String(c.telegram_id)).first();
            const want=Math.min(price,Math.max(0,Number(u?.balance_stars||0)));let used=0;
            if(want>0){
              const d=await env.DB.batch([
                env.DB.prepare("UPDATE users SET balance_stars=balance_stars-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance_stars>=?").bind(want,String(c.telegram_id),want),
                env.DB.prepare("INSERT INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'custom_order_payment',?,? WHERE changes()=1").bind(String(c.telegram_id),-want,"Оплата индивидуального заказа "+id,"custom-order-payment:"+id+":"+makeId())
              ]);
              if(d[0]?.meta?.changes===1)used=want;
            }
            await env.DB.prepare("UPDATE orders SET balance_applied_stars=?,payment_status=CASE WHEN ?=total_stars THEN 'paid' ELSE 'pending' END,fulfillment_status=CASE WHEN ?=total_stars THEN 'awaiting_delivery' ELSE 'awaiting_payment' END,paid_at=CASE WHEN ?=total_stars THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=? AND telegram_id=? AND payment_status='pending' AND balance_applied_stars=0").bind(used,used,used,used,id,String(c.telegram_id)).run();
            await env.DB.prepare("UPDATE custom_orders SET total_stars=?,status=CASE WHEN ?=total_stars THEN 'new' ELSE 'pending' END WHERE id=?").bind(price,used,id).run();
          }else{
            await env.DB.prepare("INSERT INTO orders (id,telegram_id,product_id,product_title,quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status,balance_applied_stars) VALUES (?,?,NULL,?,1,?,0,?,'pending','awaiting_payment',0)").bind(id,String(c.telegram_id),"Индивидуальная работа: "+c.subject,price,price).run();
            const u=await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(String(c.telegram_id)).first();
            const want=Math.min(price,Math.max(0,Number(u?.balance_stars||0)));let used=0;
            if(want>0){
              const d=await env.DB.batch([
                env.DB.prepare("UPDATE users SET balance_stars=balance_stars-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance_stars>=?").bind(want,String(c.telegram_id),want),
                env.DB.prepare("INSERT INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'custom_order_payment',?,? WHERE changes()=1").bind(String(c.telegram_id),-want,"Оплата индивидуального заказа "+id,"custom-order-payment:"+id)
              ]);
              if(d[0]?.meta?.changes===1)used=want;
            }
            await env.DB.prepare("UPDATE orders SET balance_applied_stars=?,payment_status=CASE WHEN ?=total_stars THEN 'paid' ELSE 'pending' END,fulfillment_status=CASE WHEN ?=total_stars THEN 'awaiting_delivery' ELSE 'awaiting_payment' END,paid_at=CASE WHEN ?=total_stars THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=? AND telegram_id=?").bind(used,used,used,used,id,String(c.telegram_id)).run();
            await env.DB.prepare("UPDATE custom_orders SET total_stars=?,status=CASE WHEN ?=total_stars THEN 'new' ELSE 'pending' END WHERE id=?").bind(price,used,id).run();
          }
          const final=await env.DB.prepare("SELECT payment_status,balance_applied_stars FROM orders WHERE id=? AND telegram_id=?").bind(id,String(c.telegram_id)).first();
          const due=Math.max(0,price-Number(final?.balance_applied_stars||0));
          let invoiceUrl="";
          if(due>0){
            const payload="custom_order_"+makeId();
            await env.DB.prepare("INSERT INTO payment_intents (payload,telegram_id,kind,reference_id,amount_stars,bonus_points,plan_type,status) VALUES (?,?,'order',?,?,0,NULL,'pending')")
              .bind(payload,String(c.telegram_id),id,due).run();
            try{
              invoiceUrl=await createInvoice(env,"Индивидуальный заказ","Оплата индивидуальной работы Агентства подарков",payload,due);
              await telegram(env,"sendMessage",{chat_id:String(c.telegram_id),text:"🎨 Ваша индивидуальная работа согласована!\n\n"+c.subject+"\nИтоговая цена: "+price+" ⭐\nСписано с баланса: "+Number(final?.balance_applied_stars||0)+" ⭐\nОсталось оплатить: "+due+" ⭐. Нажмите кнопку ниже для оплаты.",reply_markup:{inline_keyboard:[[{text:"Оплатить заказ · "+due+" ⭐",url:invoiceUrl}]]}});
            }catch(error){
              await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND status='pending'").bind(payload).run();
              console.error("Custom order invoice delivery failed:",String(error).slice(0,250));
              throw new Error("Цена сохранена, но не удалось отправить счёт покупателю. Повторите подтверждение цены.");
            }
          } else {
            await telegram(env,"sendMessage",{chat_id:String(c.telegram_id),text:"🎨 Ваша индивидуальная работа полностью оплачена с внутреннего баланса. Заказ передан владельцу Агентства подарков."});
          }
          await notifyOwner(env,"🎨 Цена индивидуального заказа назначена\nID: "+id+"\nПокупатель: "+c.telegram_id+"\nИтог: "+price+" ⭐\nСписано с баланса: "+Number(final?.balance_applied_stars||0)+" ⭐\nОсталось: "+due+" ⭐");
          try{await telegram(env,"sendMessage",{chat_id:String(c.telegram_id),text:"🎨 Агентство подарков\n\nИтоговая стоимость индивидуальной работы: "+price+" ⭐.\n"+(due===0?"Заказ полностью оплачен с внутреннего баланса.":"Списано с баланса: "+Number(final?.balance_applied_stars||0)+" ⭐. Осталось оплатить: "+due+" ⭐. Откройте Mini App → Заказы → Оплатить.")});}catch(e){console.error("Custom price notification failed:",String(e).slice(0,250));}
          return json({ok:true,order_id:id,price_stars:price,payment_status:final?.payment_status,balance_used_stars:Number(final?.balance_applied_stars||0),invoice_amount_stars:due},200,origin);
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
          if (hasStatus && orderType === "custom" && status !== "cancelled") {
            const linked=await env.DB.prepare("SELECT payment_status FROM orders WHERE id=? AND telegram_id=?").bind(orderId,String(order.telegram_id)).first();
            if(!linked||linked.payment_status!=="paid")return json({error:"Сначала назначьте цену и дождитесь оплаты индивидуального заказа."},409,origin);
          }
          if (hasStatus && orderType === "custom" && status === "cancelled") {
            const linked=await env.DB.prepare("SELECT payment_status FROM orders WHERE id=? AND telegram_id=?").bind(orderId,String(order.telegram_id)).first();
            if(linked?.payment_status==="paid")return json({error:"Оплаченный индивидуальный заказ нельзя отменить без подтверждённого возврата."},409,origin);
            if(linked?.payment_status==="pending")await cancelPendingOrderAndRefund(env,orderId,String(order.telegram_id));
          }
          const previous = await getAdminOrderMeta(env, orderType, order);
          const statements = [];
          if (hasStatus) {
            const details = JSON.stringify({ order_type: orderType, order_id: orderId, status, previous_status: previous.admin_status });
            if (orderType === "product" && status === "cancelled") {
              statements.push(env.DB.prepare("UPDATE orders SET payment_status='cancelled',fulfillment_status='cancelled' WHERE id=? AND payment_status='pending'").bind(orderId));
              statements.push(env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND status='pending'").bind(orderId));
              if(await tableExists(env,"promo_codes")){
                statements.push(env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),updated_at=CURRENT_TIMESTAMP WHERE code=(SELECT code FROM promo_redemptions WHERE order_id=? AND status='reserved')").bind(orderId));
                statements.push(env.DB.prepare("UPDATE promo_redemptions SET status='released' WHERE order_id=? AND status='reserved'").bind(orderId));
              }
            } else if (orderType === "custom") {
              statements.push(env.DB.prepare("UPDATE custom_orders SET status=? WHERE id=?").bind(status, orderId));
            }
            statements.push(env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?, 'order_status_changed', ?)").bind(telegramId, String(order.telegram_id), details));
          }
          if (comment) {
            statements.push(env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?, 'order_comment', ?)").bind(telegramId, String(order.telegram_id), JSON.stringify({ order_type: orderType, order_id: orderId, comment })));
          }
          await env.DB.batch(statements);
          let notification = { attempted: false, sent: false };
          if (hasStatus) {
            notification.attempted = true;
            const labels = { new: "принят и ожидает обработки", in_progress: "находится в работе", ready: "готов", cancelled: "отменён" };
            const statusText = labels[status] || "обновлён";
            const message = "🎁 Агентство подарков\\n\\nСтатус вашего заказа № " + orderId + " изменён: " + statusText + ".\\nЕсли у вас есть вопросы, ответьте на это сообщение.";
            try {
              await telegram(env, "sendMessage", { chat_id: String(order.telegram_id), text: message });
              notification.sent = true;
            } catch (error) {
              notification.error = "Статус сохранён, но сообщение покупателю отправить не удалось.";
              console.error("Order status notification failed:", String(error).slice(0,300));
            }
            try {
              await notifyOwner(env, "📦 Заказ № " + orderId + ": статус изменён на «" + statusText + "». Покупатель " + String(order.telegram_id) + (notification.sent ? " уведомлён." : ". Уведомление покупателю не доставлено."));
            } catch (error) {
              console.error("Order owner notification failed:", String(error).slice(0,300));
            }
          }
          return json({ ok: true, order_id: orderId, order_type: orderType, status: hasStatus ? status : previous.admin_status, comment_saved: !!comment, notification }, 200, origin);
        }
        if (path === "/api/admin/order-chat" && method === "GET") {
          const orderId=String(url.searchParams.get("order_id")||"").trim().slice(0,100);
          if(!orderId)return json({error:"Не указан номер заказа."},400,origin);
          const rows=await env.DB.prepare("SELECT sender_type,content,created_at FROM order_chat_messages WHERE order_id=? ORDER BY id LIMIT 200").bind(orderId).all();
          const changes=await env.DB.prepare("SELECT id,telegram_id,proposed_json,ai_summary,status,created_at FROM order_change_requests WHERE order_id=? ORDER BY created_at DESC LIMIT 50").bind(orderId).all();
          const cancellations=await env.DB.prepare("SELECT id,reason,status,created_at FROM order_cancellation_requests WHERE order_id=? ORDER BY created_at DESC LIMIT 20").bind(orderId).all();
          return json({ok:true,messages:rows.results||[],changes:changes.results||[],cancellations:cancellations.results||[]},200,origin);
        }
        if (path === "/api/admin/order-chat" && method === "POST") {
          const body=await readJson(request),orderId=String(body.order_id||"").trim().slice(0,100),action=String(body.action||"reply");
          if(!orderId)return json({error:"Не указан номер заказа."},400,origin);
          const product=await env.DB.prepare("SELECT telegram_id FROM orders WHERE id=?").bind(orderId).first();
          const custom=await env.DB.prepare("SELECT telegram_id FROM custom_orders WHERE id=?").bind(orderId).first();
          const target=product||custom;
          if(!target)return json({error:"Заказ не найден."},404,origin);
          if(action==="reply"){
            const message=typeof body.message==="string"?body.message.trim().slice(0,2000):"";
            const senderType=body.sender_type==="ai"?"ai":"owner";
            if(!message)return json({error:"Введите сообщение покупателю."},400,origin);
            await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,?,?)").bind(orderId,String(target.telegram_id),senderType,message).run();
            let notification={sent:false};
            try{await telegram(env,"sendMessage",{chat_id:String(target.telegram_id),text:(senderType==="ai"?"🤖 ИИ-консультант":"💬 Владелец")+" по заказу № "+orderId+"\n\n"+message});notification.sent=true;}
            catch(error){notification.error=String(error.message||error).slice(0,240);}
            return json({ok:true,notification},200,origin);
          }
          if(action==="accept_change"&&!rootOwner)return json({error:"Подтверждать изменения заказа может только основной владелец."},403,origin);
          if(action==="resolve_cancellation"&&!rootOwner)return json({error:"Обрабатывать возвраты и отмены может только основной владелец."},403,origin);
          if(action==="accept_change"){
            const changeId=String(body.change_id||"").trim().slice(0,100),ownerNote=String(body.note||"").trim().slice(0,500);
            if(!changeId)return json({error:"Не указан запрос на изменение."},400,origin);
            const change=await env.DB.prepare("SELECT id,order_id,telegram_id,proposed_json,ai_summary,status FROM order_change_requests WHERE id=? AND order_id=? AND status='pending'").bind(changeId,orderId).first();
            if(!change)return json({error:"Предложение уже обработано или не найдено."},409,origin);
            const productOrder=await env.DB.prepare("SELECT * FROM orders WHERE id=? AND telegram_id=?").bind(orderId,String(target.telegram_id)).first();
            const customOrder=await env.DB.prepare("SELECT * FROM custom_orders WHERE id=? AND telegram_id=?").bind(orderId,String(target.telegram_id)).first();
            const createdAt=String(productOrder?.created_at||customOrder?.created_at||"").trim().replace(" ","T");
            const createdIso=/([zZ]|[+-]\\d{2}:?\\d{2})$/.test(createdAt)?createdAt:createdAt+"Z";
            const age=Date.now()-Date.parse(createdIso);
            if(!Number.isFinite(age)||age<0||age>72*60*60*1000)return json({error:"Изменения по заказу можно подтвердить только в течение первых 3 дней."},409,origin);
            if((productOrder&&(["cancelled","superseded"].includes(String(productOrder.payment_status))||["cancelled","superseded","delivered"].includes(String(productOrder.fulfillment_status))))||(customOrder&&["cancelled","canceled","superseded","completed","done"].includes(String(customOrder.status))))return json({error:"Этот заказ уже закрыт и не может быть изменён."},409,origin);
            const newOrderId=makeId(),summary=String(change.ai_summary||"Изменение по просьбе покупателя").slice(0,700),note=ownerNote||"Изменение подтверждено владельцем.";
            let changeData={};try{changeData=JSON.parse(change.proposed_json||"{}");}catch{changeData={customer_request:String(change.proposed_json||"")};}
            const revisionDetails={summary,owner_note:note,proposed_changes:changeData,approved_by:telegramId};
            let sourceBundle=null;
            if(productOrder){
              sourceBundle=await env.DB.prepare("SELECT title,bundle_json FROM gift_bundles WHERE order_id=? AND telegram_id=?").bind(orderId,String(target.telegram_id)).first().catch(()=>null);
              await env.DB.batch([
                env.DB.prepare("INSERT INTO orders(id,telegram_id,product_id,product_title,quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status,paid_at,promo_code,discount_stars,balance_applied_stars) SELECT ?,telegram_id,product_id,product_title || ' · обновлённая версия',quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status,paid_at,promo_code,discount_stars,balance_applied_stars FROM orders WHERE id=?").bind(newOrderId,orderId),
                env.DB.prepare("INSERT INTO order_items(order_id,product_id,product_title,quantity,image_url,delivery_status) SELECT ?,product_id,product_title,quantity,image_url,delivery_status FROM order_items WHERE order_id=?").bind(newOrderId,orderId),
                env.DB.prepare("INSERT INTO order_delivery(order_id,telegram_id,address,delivery_details,delivery_note,distance_km,delivery_stars,priority_delivery,priority_stars) SELECT ?,telegram_id,address,delivery_details,delivery_note,distance_km,delivery_stars,priority_delivery,priority_stars FROM order_delivery WHERE order_id=?").bind(newOrderId,orderId),
                env.DB.prepare("UPDATE orders SET payment_status='superseded',fulfillment_status='superseded',balance_applied_stars=0 WHERE id=? AND telegram_id=?").bind(orderId,String(target.telegram_id)),
                env.DB.prepare("UPDATE payment_intents SET reference_id=? WHERE kind='order' AND reference_id=? AND telegram_id=? AND status='pending'").bind(newOrderId,orderId,String(target.telegram_id)),
                env.DB.prepare("UPDATE payments SET order_id=? WHERE order_id=?").bind(newOrderId,orderId)
              ]);
            }
            if(productOrder&&sourceBundle){
              let revisedBundle={};try{revisedBundle=JSON.parse(sourceBundle.bundle_json||"{}");}catch{revisedBundle={};}
              revisedBundle.owner_approved_change=revisionDetails;
              await env.DB.prepare("INSERT INTO gift_bundles(id,telegram_id,order_id,title,bundle_json,status) VALUES(?,?,?,?,?,'ordered')")
                .bind(makeId(),String(target.telegram_id),newOrderId,sourceBundle.title||"Подарочный набор",JSON.stringify(revisedBundle)).run();
            }
            if(customOrder){
              const answers=(()=>{try{return JSON.parse(customOrder.answers_json||"{}");}catch{return {original_answers:customOrder.answers_json||""};}})();
              answers.owner_approved_change=revisionDetails;
              await env.DB.prepare("INSERT INTO custom_orders(id,telegram_id,username,first_name,subject,answers_json,total_stars,status) VALUES(?,?,?,?,?,?,?,?)")
                .bind(newOrderId,String(target.telegram_id),customOrder.username,customOrder.first_name,customOrder.subject,JSON.stringify(answers),customOrder.total_stars,customOrder.status).run();
              await env.DB.prepare("UPDATE custom_orders SET status='superseded' WHERE id=? AND telegram_id=?").bind(orderId,String(target.telegram_id)).run();
            }
            if(!productOrder&&!customOrder)return json({error:"Заказ не найден."},404,origin);
            await env.DB.batch([
              env.DB.prepare("INSERT INTO order_revisions(id,previous_order_id,new_order_id,change_request_id,telegram_id,change_summary,change_json) VALUES(?,?,?,?,?,?,?)").bind(makeId(),orderId,newOrderId,changeId,String(target.telegram_id),summary,JSON.stringify(revisionDetails)),
              env.DB.prepare("UPDATE order_change_requests SET status='accepted',resolved_by=?,resolution_note=?,resolved_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(telegramId,note,changeId),
              env.DB.prepare("UPDATE order_chat_messages SET order_id=? WHERE order_id=? AND telegram_id=?").bind(newOrderId,orderId,String(target.telegram_id)),
              env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'system',?)").bind(newOrderId,String(target.telegram_id),"Владелец подтвердил изменение. Создана новая версия заказа № "+newOrderId+". "+summary+" "+note)
            ]);
            try{await telegram(env,"sendMessage",{chat_id:String(target.telegram_id),text:"✅ Владелец подтвердил изменение вашего заказа.\n\nСтарая версия № "+orderId+" закрыта. Новая версия заказа: № "+newOrderId+".\n\n"+summary+"\n"+note});}catch(error){console.error("Order revision notification failed:",String(error).slice(0,240));}
            await notifyOwner(env,"✅ ИЗМЕНЕНИЕ ЗАКАЗА ПОДТВЕРЖДЕНО\nСтарая версия: "+orderId+"\nНовая версия: "+newOrderId+"\nПокупатель: "+target.telegram_id+"\n"+summary);
            return json({ok:true,status:"accepted",new_order_id:newOrderId,previous_order_id:orderId},200,origin);
          }
          if(action==="resolve_cancellation"){
            const requestId=String(body.request_id||"").trim().slice(0,100),decision=body.decision==="approve"?"approve":"reject",note=String(body.note||"").trim().slice(0,500);
            if(!requestId)return json({error:"Не указан запрос на отмену."},400,origin);
            const cancellation=await env.DB.prepare("SELECT id,status FROM order_cancellation_requests WHERE id=? AND order_id=? AND telegram_id=? AND status='requested'").bind(requestId,orderId,String(target.telegram_id)).first();
            if(!cancellation)return json({error:"Запрос на отмену уже обработан или не найден."},409,origin);
            if(decision==="approve"&&product){
              const paidOrder=await env.DB.prepare("SELECT balance_applied_stars FROM orders WHERE id=? AND telegram_id=? AND payment_status='paid'").bind(orderId,String(target.telegram_id)).first();
              if(!paidOrder)return json({error:"Заказ уже не находится в оплаченном статусе."},409,origin);
              const payment=await env.DB.prepare("SELECT telegram_payment_charge_id,status FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1").bind(orderId).first();
              if(payment&&payment.status!=="refunded"){
                if(payment.telegram_payment_charge_id){
                  try{await telegram(env,"refundStarPayment",{user_id:Number(target.telegram_id),telegram_payment_charge_id:payment.telegram_payment_charge_id});}
                  catch(error){return json({error:"Telegram не подтвердил возврат Stars: "+String(error.message||error).slice(0,180)},502,origin);}
                  await env.DB.prepare("UPDATE payments SET status='refunded' WHERE order_id=? AND telegram_payment_charge_id=?").bind(orderId,payment.telegram_payment_charge_id).run();
                }else if(body.refund_confirmed!==true){
                  return json({error:"У платежа нет Telegram charge ID. Выполните возврат вручную и подтвердите его здесь."},409,origin);
                }
              }
              const balanceRefund=Math.max(0,Number(paidOrder.balance_applied_stars||0));
              const refundResults=await env.DB.batch([
                env.DB.prepare("UPDATE orders SET payment_status='cancelled',fulfillment_status='cancelled',balance_applied_stars=0 WHERE id=? AND telegram_id=? AND payment_status='paid'").bind(orderId,String(target.telegram_id)),
                env.DB.prepare("INSERT OR IGNORE INTO balance_transactions(telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'order_refund',?,? WHERE changes()=1 AND ?>0").bind(String(target.telegram_id),balanceRefund,"Возврат внутреннего баланса за отменённый заказ "+orderId,"order-cancel-refund:"+orderId,balanceRefund),
                env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND changes()=1").bind(balanceRefund,String(target.telegram_id)),
                env.DB.prepare("UPDATE custom_orders SET status='cancelled' WHERE id=? AND telegram_id=?").bind(orderId,String(target.telegram_id))
              ]);
              if(refundResults[0]?.meta?.changes!==1)return json({error:"Не удалось подтвердить отмену. Обновите заказ."},409,origin);
            }else if(decision==="approve"&&custom){
              await env.DB.prepare("UPDATE custom_orders SET status='cancelled' WHERE id=? AND telegram_id=?").bind(orderId,String(target.telegram_id)).run();
            }
            const status=decision==="approve"?"approved":"rejected";
            await env.DB.batch([
              env.DB.prepare("UPDATE order_cancellation_requests SET status=?,resolved_by=?,resolution_note=?,resolved_at=CURRENT_TIMESTAMP WHERE id=? AND status='requested'").bind(status,telegramId,note,requestId),
              env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'system',?)").bind(orderId,String(target.telegram_id),decision==="approve"?"Владелец подтвердил отмену заказа. "+note:"Владелец отклонил запрос на отмену. "+note)
            ]);
            try{await telegram(env,"sendMessage",{chat_id:String(target.telegram_id),text:(decision==="approve"?"❌ Заказ № "+orderId+" отменён.":"ℹ️ Запрос на отмену заказа № "+orderId+" отклонён.")+"\n"+note});}catch(error){console.error("Order cancellation notification failed:",String(error).slice(0,240));}
            return json({ok:true,status},200,origin);
          }
          if(action==="reject_change"){
            const changeId=String(body.change_id||"").trim().slice(0,100);
            if(!changeId)return json({error:"Не указан запрос на изменение."},400,origin);
            const result=await env.DB.prepare("UPDATE order_change_requests SET status='rejected',resolved_by=?,resolution_note=?,resolved_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=? AND status='pending'")
              .bind(telegramId,String(body.note||"Изменение отклонено владельцем").slice(0,500),changeId,orderId).run();
            if(!result.meta?.changes)return json({error:"Запрос уже обработан или не найден."},409,origin);
            const note=String(body.note||"Владелец не подтвердил это изменение. Вы можете обсудить детали в чате.").slice(0,1000);
            await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'system',?)").bind(orderId,String(target.telegram_id),"Владелец рассмотрел предложение: "+note).run();
            try{await telegram(env,"sendMessage",{chat_id:String(target.telegram_id),text:"📦 По вашему заказу № "+orderId+" есть ответ владельца:\n"+note});}catch(error){console.error("Order change decision notification failed:",String(error).slice(0,240));}
            return json({ok:true,status:"rejected"},200,origin);
          }
          return json({error:"Неизвестное действие чата заказа."},400,origin);
        }
        if (path === "/api/admin/order" && method === "GET") {
          const url = new URL(request.url);
          const orderId = (url.searchParams.get("order_id") || "").trim().slice(0,100);
          const orderType = url.searchParams.get("order_type");
          if (!orderId || !["product","custom"].includes(orderType)) return json({ error: "Укажите номер и тип заказа." }, 400, origin);
          if (orderType === "product") {
            const [order, items, payment, delivery, bundle, revisions] = await Promise.all([
              env.DB.prepare("SELECT o.*,u.first_name,u.username FROM orders o LEFT JOIN users u ON u.telegram_id=o.telegram_id WHERE o.id=?").bind(orderId).first(),
              env.DB.prepare("SELECT product_title,quantity,image_url,delivery_status,delivered_at FROM order_items WHERE order_id=? ORDER BY id").bind(orderId).all(),
              env.DB.prepare("SELECT amount_stars,currency,status,created_at,confirmed_at FROM payments WHERE order_id=?").bind(orderId).first(),
              env.DB.prepare("SELECT address,delivery_details,delivery_note,distance_km,delivery_stars,priority_delivery,priority_stars FROM order_delivery WHERE order_id=?").bind(orderId).first(),
              env.DB.prepare("SELECT bundle_json FROM gift_bundles WHERE order_id=?").bind(orderId).first(),
              env.DB.prepare("SELECT previous_order_id,change_summary,change_json,created_at FROM order_revisions WHERE new_order_id=? ORDER BY created_at DESC").bind(orderId).all()
            ]);
            if (!order) return json({ error: "Заказ не найден." }, 404, origin);
            const meta = await getAdminOrderMeta(env, orderType, order);
            let giftBundle=null;try{giftBundle=bundle?JSON.parse(bundle.bundle_json||"{}"):null;}catch{giftBundle=null;}
            return json({ ok: true, order_type: orderType, order, items: items.results || [], payment: payment || null, delivery: delivery || null, gift_bundle:giftBundle, revisions:revisions.results||[], admin_status: meta.admin_status, history: meta.history, migrations_pending: meta.migrations_pending }, 200, origin);
          }
          const order = await env.DB.prepare("SELECT c.*,o.payment_status,o.balance_applied_stars FROM custom_orders c LEFT JOIN orders o ON o.id=c.id AND o.telegram_id=c.telegram_id WHERE c.id=?").bind(orderId).first();
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
          const customStatus = "COALESCE(" + customOverride + ",CASE WHEN c.status='superseded' THEN 'superseded' WHEN c.status IN ('cancelled','canceled') THEN 'cancelled' WHEN c.status='pending' THEN 'unpaid' WHEN c.status IN ('ready','completed','done') THEN 'ready' WHEN c.status IN ('in_progress','processing','work') THEN 'in_progress' ELSE 'new' END)";
          const [products, custom] = await Promise.all([
            type === "custom" ? Promise.resolve({ results: [] }) : env.DB.prepare(
              "SELECT * FROM (SELECT o.id,o.telegram_id,u.first_name,u.username,'product' AS order_type,o.product_title AS title,o.quantity,o.total_stars,o.payment_status,o.fulfillment_status,o.created_at," + productStatus + " AS admin_status,COALESCE((SELECT d.priority_delivery FROM order_delivery d WHERE d.order_id=o.id),0) AS priority_delivery FROM orders o LEFT JOIN users u ON u.telegram_id=o.telegram_id) WHERE fulfillment_status<>'superseded' AND (?='' OR id LIKE ? OR telegram_id LIKE ? OR title LIKE ?) AND (?='all' OR admin_status=?) ORDER BY created_at DESC LIMIT ?"
            ).bind(term,like,like,like,status,status,limit).all(),
            type === "product" ? Promise.resolve({ results: [] }) : env.DB.prepare(
              "SELECT * FROM (SELECT c.id,c.telegram_id,c.first_name,c.username,'custom' AS order_type,'Индивидуальный заказ: ' || c.subject AS title,1 AS quantity,c.total_stars,NULL AS payment_status,NULL AS fulfillment_status,c.created_at," + customStatus + " AS admin_status,0 AS priority_delivery FROM custom_orders c) WHERE admin_status<>'superseded' AND (?='' OR id LIKE ? OR telegram_id LIKE ? OR title LIKE ?) AND (?='all' OR admin_status=?) ORDER BY created_at DESC LIMIT ?"
            ).bind(term,like,like,like,status,status,limit).all()
          ]);
          const rows = [...(products.results || []), ...(custom.results || [])]
            .sort((a,b)=>Number(b.priority_delivery||0)-Number(a.priority_delivery||0)||String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,limit);
          return json({ ok: true, orders: rows, filters: { q: term, type, status }, updated_at: new Date().toISOString() }, 200, origin);
        }
        if (path === "/api/admin/dashboard" && method === "GET") {
          const [users, orders, customOrders, revenue, waitingOrders, waitingCustom, pendingPayments] = await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM users").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM custom_orders").first(),
            env.DB.prepare("SELECT COALESCE(SUM(amount_stars),0) AS total FROM payments WHERE status='paid' AND currency='XTR'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE payment_status='paid' AND fulfillment_status='awaiting_delivery'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM custom_orders WHERE status='new'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE payment_status='pending'").first()
          ]);
          return json({
            ok: true,
            metrics: {
              users: Number(users?.total || 0),
              orders: Number(orders?.total || 0) + Number(customOrders?.total || 0),
              product_orders: Number(orders?.total || 0),
              custom_orders: Number(customOrders?.total || 0),
              revenue_stars: Number(revenue?.total || 0),
              awaiting_processing: Number(waitingOrders?.total || 0) + Number(waitingCustom?.total || 0),
              pending_payments: Number(pendingPayments?.total || 0)
            },
            updated_at: new Date().toISOString()
          }, 200, origin);
        }
        if (path === "/api/admin/analytics" && method === "GET") {
          const [dailyRevenue, dailyOrders, dailyCustomOrders, newUsers, totals, promoStats, customerStats, customStatuses] = await Promise.all([
            env.DB.prepare("SELECT date(confirmed_at) AS day,COALESCE(SUM(amount_stars),0) AS stars,COUNT(*) AS payments FROM payments WHERE status='paid' AND currency='XTR' AND confirmed_at>=datetime('now','-30 days') GROUP BY date(confirmed_at) ORDER BY day").all(),
            env.DB.prepare("SELECT date(created_at) AS day,COUNT(*) AS orders FROM orders WHERE created_at>=datetime('now','-30 days') GROUP BY date(created_at) ORDER BY day").all(),
            env.DB.prepare("SELECT date(created_at) AS day,COUNT(*) AS requests FROM custom_orders WHERE created_at>=datetime('now','-30 days') GROUP BY date(created_at) ORDER BY day").all(),
            env.DB.prepare("SELECT date(created_at) AS day,COUNT(*) AS users FROM users WHERE created_at>=datetime('now','-30 days') GROUP BY date(created_at) ORDER BY day").all(),
            env.DB.prepare("SELECT (SELECT COUNT(*) FROM orders WHERE payment_status='paid') AS paid_orders,(SELECT COUNT(*) FROM custom_orders) AS custom_orders,(SELECT COUNT(*) FROM users) AS users,(SELECT COALESCE(SUM(amount_stars),0) FROM payments WHERE status='paid' AND currency='XTR') AS revenue_stars,(SELECT COALESCE(AVG(amount_stars),0) FROM payments WHERE status='paid' AND currency='XTR') AS average_check").first(),
            optionalTableRows(env.DB.prepare("SELECT p.code,p.discount_percent,p.max_uses,p.reserved_count,p.redeemed_count,COALESCE(SUM(CASE WHEN r.status='paid' THEN r.discount_stars ELSE 0 END),0) AS discount_stars,COUNT(CASE WHEN r.status='paid' THEN 1 END) AS paid_uses,COUNT(CASE WHEN r.status='reserved' THEN 1 END) AS pending_uses FROM promo_codes p LEFT JOIN promo_redemptions r ON r.code=p.code GROUP BY p.code ORDER BY paid_uses DESC,p.created_at DESC LIMIT 20"),"promo_codes"),
            env.DB.prepare("SELECT (SELECT COUNT(DISTINCT telegram_id) FROM orders WHERE payment_status='paid') AS paid_customers,(SELECT COUNT(*) FROM (SELECT telegram_id FROM orders WHERE payment_status='paid' GROUP BY telegram_id HAVING COUNT(*)>1)) AS repeat_paid_customers,(SELECT COUNT(*) FROM (SELECT telegram_id FROM orders WHERE created_at>=datetime('now','-30 days') UNION SELECT telegram_id FROM custom_orders WHERE created_at>=datetime('now','-30 days'))) AS active_customers_30d").first(),
            env.DB.prepare("SELECT status,COUNT(*) AS requests FROM custom_orders GROUP BY status ORDER BY requests DESC").all()
          ]);
          return json({ok:true,period_days:30,daily_revenue:dailyRevenue.results||[],daily_orders:dailyOrders.results||[],daily_custom_orders:dailyCustomOrders.results||[],new_users:newUsers.results||[],custom_status_stats:customStatuses.results||[],promo_stats:promoStats.results||[],promo_migration_pending:!!promoStats.migration_pending,totals:{
            paid_orders:Number(totals?.paid_orders||0),custom_orders:Number(totals?.custom_orders||0),users:Number(totals?.users||0),
            revenue_stars:Number(totals?.revenue_stars||0),average_check_stars:Math.round(Number(totals?.average_check||0)),
            active_customers_30d:Number(customerStats?.active_customers_30d||0),paid_customers:Number(customerStats?.paid_customers||0),repeat_paid_customers:Number(customerStats?.repeat_paid_customers||0),
            promo_discount_stars:(promoStats.results||[]).reduce((sum,row)=>sum+Number(row.discount_stars||0),0),
            promo_paid_uses:(promoStats.results||[]).reduce((sum,row)=>sum+Number(row.paid_uses||0),0)
          },updated_at:new Date().toISOString()},200,origin);
        }
        if (path === "/api/admin/support/conversations" && method === "GET") {
          const url = new URL(request.url);
          const term = (url.searchParams.get("q") || "").trim().slice(0,64);
          const likeTerm = "%" + term + "%";
          const likeUsername = "%" + term.replace(/^@/, "") + "%";
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
          const rows = await env.DB.prepare(
            "SELECT s.telegram_id,u.first_name,u.username,COUNT(*) AS message_count,MAX(s.created_at) AS last_message_at,(SELECT content FROM support_chat_messages x WHERE x.telegram_id=s.telegram_id ORDER BY x.id DESC LIMIT 1) AS last_message,(SELECT role FROM support_chat_messages x WHERE x.telegram_id=s.telegram_id ORDER BY x.id DESC LIMIT 1) AS last_role,(SELECT COUNT(*) FROM support_messages t WHERE t.telegram_id=s.telegram_id) AS ticket_count,(SELECT MAX(t.created_at) FROM support_messages t WHERE t.telegram_id=s.telegram_id) AS last_ticket_at FROM support_chat_messages s LEFT JOIN users u ON u.telegram_id=s.telegram_id WHERE (?='' OR s.telegram_id LIKE ? OR u.username LIKE ? OR u.first_name LIKE ?) GROUP BY s.telegram_id ORDER BY last_message_at DESC LIMIT ?"
          ).bind(term, likeTerm, likeUsername, likeTerm, limit).all();
          return json({ ok: true, conversations: rows.results || [] }, 200, origin);
        }
        if (path === "/api/admin/support/conversation" && method === "GET") {
          const url = new URL(request.url);
          const targetId = (url.searchParams.get("telegram_id") || "").trim().slice(0,64);
          if (!targetId) return json({ error: "Укажите Telegram ID." }, 400, origin);
          const [controlsReady, senderTypeReady] = await Promise.all([
            tableExists(env, "support_conversation_controls"),
            columnExists(env, "support_chat_messages", "sender_type")
          ]);
          const messageQuery = senderTypeReady
            ? env.DB.prepare("SELECT role,content,sender_type,created_at FROM support_chat_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 200").bind(targetId)
            : env.DB.prepare("SELECT role,content,'ai' AS sender_type,created_at FROM support_chat_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 200").bind(targetId);
          const controlQuery = controlsReady
            ? env.DB.prepare("SELECT mode,updated_at FROM support_conversation_controls WHERE telegram_id=?").bind(targetId).first()
            : Promise.resolve(null);
          const [profile, messages, control, productOrders, customOrders, tickets, notes, balanceHistory] = await Promise.all([
            env.DB.prepare("SELECT telegram_id,first_name,username,created_at,balance_stars,updated_at FROM users WHERE telegram_id=?").bind(targetId).first(),
            messageQuery,
            controlQuery,
            env.DB.prepare("SELECT id,product_title AS title,total_stars,payment_status AS payment_status,fulfillment_status AS status,created_at,paid_at FROM orders WHERE telegram_id=? ORDER BY created_at DESC LIMIT 50").bind(targetId).all(),
            optionalTableRows(env.DB.prepare("SELECT id,'Индивидуальный заказ: ' || subject AS title,total_stars,status,created_at FROM custom_orders WHERE telegram_id=? ORDER BY created_at DESC LIMIT 50").bind(targetId), "custom_orders"),
            env.DB.prepare("SELECT id,message,status,created_at FROM support_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 50").bind(targetId).all(),
            optionalTableRows(env.DB.prepare("SELECT id,admin_telegram_id,note,created_at FROM support_internal_notes WHERE telegram_id=? ORDER BY id DESC LIMIT 100").bind(targetId), "support_internal_notes"),
            env.DB.prepare("SELECT amount_stars,operation_type,description,created_at FROM balance_transactions WHERE telegram_id=? ORDER BY id DESC LIMIT 20").bind(targetId).all()
          ]);
          if (!profile) return json({ error: "Пользователь не найден." }, 404, origin);
          const orders = [
            ...(productOrders.results || []).map(row => ({...row, order_type:"product"})),
            ...(customOrders.results || []).map(row => ({...row, order_type:"custom"}))
          ].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,50);
          return json({
            ok: true, user: profile, mode: control?.mode || "ai", mode_updated_at: control?.updated_at || null,
            conversation_migration_pending: !controlsReady || !senderTypeReady,
            messages: (messages.results || []).reverse(), orders, tickets: tickets.results || [],
            notes: notes.results || [], notes_migration_pending: !!notes.migration_pending,
            balance_history: balanceHistory.results || []
          }, 200, origin);
        }
        if (path === "/api/admin/support/tickets" && method === "GET") {
          const url = new URL(request.url);
          const status = ["all","open","in_progress","closed"].includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "all";
          const term = (url.searchParams.get("q") || "").trim().slice(0,64);
          const likeTerm = "%" + term + "%";
          const likeUsername = "%" + term.replace(/^@/, "") + "%";
          const [rows, summary] = await Promise.all([
            env.DB.prepare(
              "SELECT s.id,s.telegram_id,s.message,s.status,s.created_at,u.first_name,u.username,(SELECT COUNT(*) FROM support_messages t WHERE t.telegram_id=s.telegram_id) AS customer_ticket_count,(SELECT MAX(t.created_at) FROM support_messages t WHERE t.telegram_id=s.telegram_id) AS customer_last_ticket_at FROM support_messages s LEFT JOIN users u ON u.telegram_id=s.telegram_id WHERE (?='all' OR s.status=?) AND (?='' OR s.telegram_id LIKE ? OR s.message LIKE ? OR u.username LIKE ? OR u.first_name LIKE ?) ORDER BY CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,s.id DESC LIMIT 100"
            ).bind(status,status,term,likeTerm,likeTerm,likeUsername,likeTerm).all(),
            env.DB.prepare(
              "SELECT COUNT(*) AS total,COUNT(DISTINCT telegram_id) AS buyers,SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed,SUM(CASE WHEN created_at>=datetime('now','-7 days') THEN 1 ELSE 0 END) AS last_7_days FROM support_messages"
            ).first()
          ]);
          return json({ ok: true, tickets: rows.results || [], summary: {
            total:Number(summary?.total||0), buyers:Number(summary?.buyers||0),
            open:Number(summary?.open||0), in_progress:Number(summary?.in_progress||0),
            closed:Number(summary?.closed||0), last_7_days:Number(summary?.last_7_days||0)
          } }, 200, origin);
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
        if (path === "/api/admin/support/ticket-reply" && method === "POST") {
          const body = await readJson(request);
          const id = Number(body.id);
          const message = typeof body.message === "string" ? body.message.trim().slice(0,4000) : "";
          if (!Number.isSafeInteger(id) || id < 1 || message.length < 1) return json({ error: "Укажите обращение и текст ответа." }, 400, origin);
          const ticket = await env.DB.prepare("SELECT id,telegram_id,status FROM support_messages WHERE id=?").bind(id).first();
          if (!ticket) return json({ error: "Обращение не найдено." }, 404, origin);
          try {
            await telegram(env, "sendMessage", { chat_id: String(ticket.telegram_id), text: "🎁 Агентство подарков · ответ владельца\\n\\n" + message });
          } catch (error) {
            console.error("Support ticket reply failed:", String(error).slice(0,300));
            return json({ error: "Не удалось отправить ответ покупателю. Статус обращения не изменён." }, 502, origin);
          }
          await env.DB.prepare("UPDATE support_messages SET status='in_progress' WHERE id=?").bind(id).run();
          if (await tableExists(env, "admin_action_log")) {
            try {
              await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)")
                .bind(telegramId, String(ticket.telegram_id), "support_ticket_reply", JSON.stringify({ ticket_id: id, length: message.length })).run();
            } catch (error) { console.error("Support ticket reply audit failed:", String(error).slice(0,200)); }
          }
          return json({ ok: true, sent: true, status: "in_progress" }, 200, origin);
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

        if (path === "/api/admin/campaigns" && method === "GET") {
          if (!(await tableExists(env,"campaigns")) || !(await tableExists(env,"campaign_recipients"))) return json({error:"Требуется миграция 0011_mass_mailing.sql."},503,origin);
          const rows = await env.DB.prepare("SELECT c.id,c.title,c.body,c.audience_type,c.audience_ids,c.media_url,c.button_text,c.button_url,c.status,c.created_at,c.updated_at,(SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id=c.id) AS total,(SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.status='sent') AS sent,(SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.status='failed') AS failed,(SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.status IN ('pending','sending')) AS pending,(SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.status='uncertain') AS uncertain FROM campaigns c ORDER BY c.id DESC LIMIT 100").all();
          return json({ok:true,campaigns:rows.results||[]},200,origin);
        }
        if (path === "/api/admin/campaign-preview" && method === "POST") {
          const body=await readJson(request), audienceType=["all","buyers","inactive","selected"].includes(body.audience_type)?body.audience_type:"";
          const ids=Array.isArray(body.audience_ids)?[...new Set(body.audience_ids.map(x=>String(x).trim()).filter(x=>/^\\d{1,24}$/.test(x)))].slice(0,500):[];
          if(!audienceType)return json({error:"Выберите аудиторию."},400,origin);
          if(audienceType==="selected"&&!ids.length)return json({error:"Укажите Telegram ID получателей."},400,origin);
          let sql="SELECT COUNT(*) AS total FROM users u",bind=[];
          if(audienceType==="buyers")sql+=" WHERE EXISTS (SELECT 1 FROM orders o WHERE o.telegram_id=u.telegram_id AND o.payment_status='paid')";
          else if(audienceType==="inactive")sql+=" WHERE COALESCE(u.updated_at,u.created_at)<=datetime('now','-30 days')";
          else if(audienceType==="selected"){sql+=" WHERE u.telegram_id IN (SELECT CAST(value AS TEXT) FROM json_each(?))";bind.push(JSON.stringify(ids));}
          const row=await env.DB.prepare(sql).bind(...bind).first();
          return json({ok:true,recipient_count:Number(row?.total||0),unknown_ids:audienceType==="selected"?ids.length-Number(row?.total||0):0,audience_type:audienceType},200,origin);
        }
        if (path === "/api/admin/campaign-save" && method === "POST") {
          if (!(await tableExists(env,"campaigns"))) return json({error:"Требуется миграция 0011_mass_mailing.sql."},503,origin);
          const body=await readJson(request),id=Number(body.id||0);
          const title=typeof body.title==="string"?body.title.trim().slice(0,100):"";
          const content=typeof body.body==="string"?body.body.trim().slice(0,4000):"";
          const audienceType=["all","buyers","inactive","selected"].includes(body.audience_type)?body.audience_type:"";
          const ids=Array.isArray(body.audience_ids)?[...new Set(body.audience_ids.map(x=>String(x).trim()).filter(x=>/^\\d{1,24}$/.test(x)))].slice(0,500):[];
          const mediaUrl=typeof body.media_url==="string"?body.media_url.trim().slice(0,1000):"";
          const buttonText=typeof body.button_text==="string"?body.button_text.trim().slice(0,40):"";
          const buttonUrl=typeof body.button_url==="string"?body.button_url.trim().slice(0,500):"";
          if(title.length<2||content.length<1)return json({error:"Заполните название и текст рассылки."},400,origin);
          if(!audienceType||(audienceType==="selected"&&!ids.length))return json({error:"Проверьте выбранную аудиторию и Telegram ID."},400,origin);
          if(mediaUrl){try{const u=new URL(mediaUrl);if(u.protocol!=="https:")throw new Error("protocol");}catch{return json({error:"Медиа должно быть доступно по HTTPS-ссылке."},400,origin);}}
          if((buttonText&&!buttonUrl)||(!buttonText&&buttonUrl))return json({error:"Для кнопки заполните и подпись, и ссылку."},400,origin);
          if(buttonUrl){try{const u=new URL(buttonUrl);if(!["https:","http:"].includes(u.protocol))throw new Error("protocol");}catch{return json({error:"Ссылка кнопки должна быть корректным HTTP(S)-адресом."},400,origin);}}
          if(mediaUrl&&content.length>1000)return json({error:"Для рассылки с фотографией текст подписи ограничен 1000 символами."},400,origin);
          if(id>0){
            const existing=await env.DB.prepare("SELECT id,status FROM campaigns WHERE id=?").bind(id).first();
            if(!existing)return json({error:"Черновик рассылки не найден."},404,origin);
            if(existing.status!=="draft")return json({error:"Изменять можно только черновик. Запущенную рассылку редактировать нельзя."},409,origin);
            await env.DB.prepare("UPDATE campaigns SET title=?,body=?,audience_type=?,audience_ids=?,media_url=?,button_text=?,button_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'")
              .bind(title,content,audienceType,JSON.stringify(ids),mediaUrl||null,buttonText||null,buttonUrl||null,id).run();
          }else{
            const result=await env.DB.prepare("INSERT INTO campaigns (title,body,audience_type,audience_ids,media_url,button_text,button_url,status,created_by) VALUES (?,?,?,?,?,?,?,'draft',?)")
              .bind(title,content,audienceType,JSON.stringify(ids),mediaUrl||null,buttonText||null,buttonUrl||null,telegramId).run();
            return json({ok:true,id:result.meta?.last_row_id||null},201,origin);
          }
          return json({ok:true,id},200,origin);
        }
        if (path === "/api/admin/campaign-queue" && method === "POST") {
          if (!(await tableExists(env,"campaigns")) || !(await tableExists(env,"campaign_recipients"))) return json({error:"Требуется миграция 0011_mass_mailing.sql."},503,origin);
          const body=await readJson(request),id=Number(body.id);
          if(body.confirm!==true)return json({error:"Требуется явное подтверждение запуска рассылки."},400,origin);
          if(!Number.isSafeInteger(id)||id<1)return json({error:"Укажите черновик рассылки."},400,origin);
          const campaign=await env.DB.prepare("SELECT id,audience_type,audience_ids,status FROM campaigns WHERE id=?").bind(id).first();
          if(!campaign)return json({error:"Рассылка не найдена."},404,origin);
          if(campaign.status!=="draft")return json({error:"Эту рассылку уже запускали или она не является черновиком."},409,origin);
          const insert="INSERT INTO campaign_recipients (campaign_id,telegram_id,status) SELECT ?,u.telegram_id,'pending' FROM users u ";
          let audienceSql="",audienceBinds=[id];
          if(campaign.audience_type==="buyers")audienceSql="WHERE EXISTS (SELECT 1 FROM orders o WHERE o.telegram_id=u.telegram_id AND o.payment_status='paid')";
          else if(campaign.audience_type==="inactive")audienceSql="WHERE COALESCE(u.updated_at,u.created_at)<=datetime('now','-30 days')";
          else if(campaign.audience_type==="selected") {audienceSql="WHERE u.telegram_id IN (SELECT CAST(value AS TEXT) FROM json_each(?))";audienceBinds.push(campaign.audience_ids||"[]");}
          const batch=[
            env.DB.prepare(insert+audienceSql).bind(...audienceBinds),
            env.DB.prepare("UPDATE campaigns SET status=CASE WHEN (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id=?)=0 THEN 'completed' ELSE 'queued' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'").bind(id,id)
          ];
          if (await tableExists(env,"admin_action_log")) batch.push(env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) SELECT ?, 'campaign_queued', ? WHERE EXISTS (SELECT 1 FROM campaigns WHERE id=? AND status IN ('queued','completed'))").bind(telegramId,JSON.stringify({campaign_id:id}),id));
          await env.DB.batch(batch);
          const total=await env.DB.prepare("SELECT COUNT(*) AS total FROM campaign_recipients WHERE campaign_id=?").bind(id).first();
          return json({ok:true,id,recipient_count:Number(total?.total||0),status:Number(total?.total||0)?"queued":"completed"},200,origin);
        }

        if (path === "/api/admin/campaign-report" && method === "GET") {
          const url=new URL(request.url),id=Number(url.searchParams.get("id"));
          if(!Number.isSafeInteger(id)||id<1)return json({error:"Укажите номер рассылки."},400,origin);
          const campaign=await env.DB.prepare("SELECT id,title,status FROM campaigns WHERE id=?").bind(id).first();
          if(!campaign)return json({error:"Рассылка не найдена."},404,origin);
          const counts=await env.DB.prepare("SELECT status,COUNT(*) AS total FROM campaign_recipients WHERE campaign_id=? GROUP BY status").bind(id).all();
          const rows=await env.DB.prepare("SELECT r.telegram_id,u.first_name,u.username,r.status,r.attempts,r.last_error,r.sent_at,r.updated_at FROM campaign_recipients r LEFT JOIN users u ON u.telegram_id=r.telegram_id WHERE r.campaign_id=? ORDER BY CASE r.status WHEN 'failed' THEN 1 WHEN 'uncertain' THEN 2 WHEN 'sending' THEN 3 WHEN 'pending' THEN 4 ELSE 5 END,r.id DESC LIMIT 200").bind(id).all();
          return json({ok:true,campaign,counts:counts.results||[],recipients:rows.results||[],limit:200},200,origin);
        }
        if (path === "/api/admin/campaign-retry" && method === "POST") {
          const body=await readJson(request),id=Number(body.id);
          if(!Number.isSafeInteger(id)||id<1)return json({error:"Укажите рассылку."},400,origin);
          const campaign=await env.DB.prepare("SELECT id,status FROM campaigns WHERE id=?").bind(id).first();
          if(!campaign)return json({error:"Рассылка не найдена."},404,origin);
          if(!["partial","completed"].includes(campaign.status))return json({error:"Повторить можно только завершённую рассылку с ошибками."},409,origin);
          const reset=await env.DB.prepare("UPDATE campaign_recipients SET status='pending',last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE campaign_id=? AND status='failed'").bind(id).run();
          if(!reset.meta||reset.meta.changes<1)return json({error:"Неудачных доставок для повтора нет."},404,origin);
          await env.DB.prepare("UPDATE campaigns SET status='queued',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
          return json({ok:true,requeued:reset.meta.changes},200,origin);
        }
        if (path === "/api/admin/announcements" && method === "GET") {
          const rows = await env.DB.prepare("SELECT id,title,body,link_url,starts_at,ends_at,audience_type,audience_ids,status,created_at,updated_at FROM announcements ORDER BY id DESC LIMIT 100").all();
          return json({ ok: true, announcements: rows.results || [] }, 200, origin);
        }
        if (path === "/api/admin/announcement-preview" && method === "POST") {
          const body = await readJson(request);
          const audienceType = body.audience_type === "selected" ? "selected" : "all";
          const ids = Array.isArray(body.audience_ids) ? [...new Set(body.audience_ids.map(x=>String(x).trim()).filter(x=>/^\\d{1,24}$/.test(x)))].slice(0,500) : [];
          const row = audienceType === "all"
            ? await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first()
            : await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE telegram_id IN (SELECT CAST(value AS TEXT) FROM json_each(?))").bind(JSON.stringify(ids)).first();
          return json({ ok: true, recipient_count: Number(row?.total || 0), audience_type: audienceType, unknown_ids: audienceType === "selected" ? ids.length - Number(row?.total || 0) : 0 }, 200, origin);
        }
        if (path === "/api/admin/announcement-save" && method === "POST") {
          const body = await readJson(request);
          const id = Number(body.id || 0);
          const title = typeof body.title === "string" ? body.title.trim().slice(0,100) : "";
          const content = typeof body.body === "string" ? body.body.trim().slice(0,3000) : "";
          const linkUrl = typeof body.link_url === "string" ? body.link_url.trim().slice(0,500) : "";
          const startsAt = typeof body.starts_at === "string" && body.starts_at.trim() ? body.starts_at.trim().slice(0,40) : null;
          const endsAt = typeof body.ends_at === "string" && body.ends_at.trim() ? body.ends_at.trim().slice(0,40) : null;
          const audienceType = body.audience_type === "selected" ? "selected" : body.audience_type === "all" ? "all" : "";
          const audienceIds = Array.isArray(body.audience_ids) ? [...new Set(body.audience_ids.map(x=>String(x).trim()).filter(x=>/^\d{1,24}$/.test(x)))].slice(0,500) : [];
          const status = ["draft","published","archived"].includes(body.status) ? body.status : "draft";
          if (!title || title.length < 2 || !content) return json({ error: "Заполните заголовок и текст объявления." }, 400, origin);
          if (!audienceType || (audienceType === "selected" && !audienceIds.length)) return json({ error: "Для выбранной аудитории укажите хотя бы один Telegram ID." }, 400, origin);
          if (linkUrl) { try { const parsed=new URL(linkUrl); if (!["https:","http:"].includes(parsed.protocol)) throw new Error("protocol"); } catch { return json({ error: "Ссылка должна быть корректным HTTP(S)-адресом." }, 400, origin); } }
          if (startsAt && Number.isNaN(Date.parse(startsAt))) return json({ error: "Некорректная дата начала." }, 400, origin);
          if (endsAt && Number.isNaN(Date.parse(endsAt))) return json({ error: "Некорректная дата окончания." }, 400, origin);
          if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return json({ error: "Дата окончания должна быть позже даты начала." }, 400, origin);
          if (id > 0) {
            const existing = await env.DB.prepare("SELECT id FROM announcements WHERE id=?").bind(id).first();
            if (!existing) return json({ error: "Объявление не найдено." }, 404, origin);
            await env.DB.prepare("UPDATE announcements SET title=?,body=?,link_url=?,starts_at=?,ends_at=?,audience_type=?,audience_ids=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
              .bind(title,content,linkUrl || null,startsAt,endsAt,audienceType,JSON.stringify(audienceIds),status,id).run();
          } else {
            await env.DB.prepare("INSERT INTO announcements (title,body,link_url,starts_at,ends_at,audience_type,audience_ids,status,created_by) VALUES (?,?,?,?,?,?,?,?,?)")
              .bind(title,content,linkUrl || null,startsAt,endsAt,audienceType,JSON.stringify(audienceIds),status,telegramId).run();
          }
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)")
              .bind(telegramId,"announcement_saved",JSON.stringify({id:id || null,status,audience_type:audienceType})).run();
          }
          return json({ ok: true }, 200, origin);
        }
        if (path === "/api/admin/announcement-status" && method === "POST") {
          const body = await readJson(request);
          const id = Number(body.id);
          const status = ["draft","published","archived"].includes(body.status) ? body.status : "";
          if (!Number.isSafeInteger(id) || id < 1 || !status) return json({ error: "Укажите объявление и корректный статус." }, 400, origin);
          const result = await env.DB.prepare("UPDATE announcements SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
          if (!result.meta || result.meta.changes !== 1) return json({ error: "Объявление не найдено." }, 404, origin);
          if (await tableExists(env,"admin_action_log")) {
            await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)")
              .bind(telegramId,"announcement_status_changed",JSON.stringify({id,status})).run();
          }
          return json({ ok: true, id, status }, 200, origin);
        }


        if (path === "/api/admin/technical-status" && method === "GET") {
          const [users,products,orders,pendingPayments,errors,settings]=await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM users").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM products").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE payment_status='pending'").first(),
            (async()=>{try{return await env.DB.prepare("SELECT COUNT(*) AS total FROM system_error_log WHERE status='new'").first()}catch(e){if(isMissingTableError(e,"system_error_log"))return {total:null};throw e;}})(),
            env.DB.prepare("SELECT key,value,updated_at FROM app_settings WHERE key LIKE 'feature_%' OR key='sales_paused'").all()
          ]);
          const tableChecks={
            users:true,products:true,orders:true,app_settings:true,order_items:await tableExists(env,"order_items"),
            system_error_log:await tableExists(env,"system_error_log"),admin_action_log:await tableExists(env,"admin_action_log"),
            user_blocks:await tableExists(env,"user_blocks"),support_conversation_controls:await tableExists(env,"support_conversation_controls"),
            support_internal_notes:await tableExists(env,"support_internal_notes"),announcements:await tableExists(env,"announcements"),
            campaigns:await tableExists(env,"campaigns"),campaign_recipients:await tableExists(env,"campaign_recipients"),
            promo_codes:await tableExists(env,"promo_codes"),promo_redemptions:await tableExists(env,"promo_redemptions"),
            admin_staff:await tableExists(env,"admin_staff")
          };
          const migrations={
            "0004_order_item_images":tableChecks.order_items&&await columnExists(env,"order_items","image_url"),
            "0005_delivery_retry_lease":await columnExists(env,"order_items","delivery_started_at"),
            "0006_admin_action_log":tableChecks.admin_action_log,
            "0007_user_blocks":tableChecks.user_blocks,
            "0008_support_human_takeover":tableChecks.support_conversation_controls&&await columnExists(env,"support_chat_messages","sender_type"),
            "0009_support_internal_notes":tableChecks.support_internal_notes,
            "0010_announcements":tableChecks.announcements,
            "0011_mass_mailing":tableChecks.campaigns&&tableChecks.campaign_recipients,
            "0012_system_monitoring":tableChecks.system_error_log,
            "0013_promo_codes":tableChecks.promo_codes&&tableChecks.promo_redemptions&&await columnExists(env,"orders","promo_code")&&await columnExists(env,"orders","discount_stars"),
            "0014_promo_code_scopes":await columnExists(env,"promo_codes","product_ids")&&await columnExists(env,"promo_codes","category_ids"),
            "0015_admin_staff":tableChecks.admin_staff&&await columnExists(env,"admin_staff","permissions_json")&&await columnExists(env,"admin_staff","status")
          };
          return json({ok:true,database:"connected",integrations:{telegram_bot:!!env.BOT_TOKEN,telegram_webhook:!!env.TELEGRAM_WEBHOOK_SECRET,openai:!!env.OPENAI_API_KEY},counts:{users:Number(users?.total||0),products:Number(products?.total||0),orders:Number(orders?.total||0),pending_payments:Number(pendingPayments?.total||0)},new_errors:errors?.total==null?null:Number(errors.total),tables:tableChecks,migrations,settings:settings.results||[],checked_at:new Date().toISOString()},200,origin);
        }
        if (path === "/api/admin/feature-flags" && method === "GET") {
          const keys=["feature_product_orders","feature_custom_orders","feature_points_topup","feature_support","feature_vip"];
          const rows=await env.DB.prepare("SELECT key,value,updated_at FROM app_settings WHERE key IN ('feature_product_orders','feature_custom_orders','feature_points_topup','feature_support','feature_vip')").all();
          const found=new Map((rows.results||[]).map(row=>[row.key,row]));
          const flags={};for(const key of keys)flags[key]=found.has(key)?found.get(key).value==="1":true;
          return json({ok:true,flags,updated_at:Object.fromEntries([...found.entries()].map(([k,v])=>[k,v.updated_at]))},200,origin);
        }
        if (path === "/api/admin/feature-flags" && method === "POST") {
          const body=await readJson(request),allowed=["feature_product_orders","feature_custom_orders","feature_points_topup","feature_support","feature_vip"];
          if(!allowed.includes(body.key)||typeof body.enabled!=="boolean")return json({error:"Укажите известный переключатель и его состояние."},400,origin);
          await env.DB.prepare("INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(body.key,body.enabled?"1":"0").run();
          if(await tableExists(env,"admin_action_log"))await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,action_type,details) VALUES (?,?,?)").bind(telegramId,"feature_flag_changed",JSON.stringify({key:body.key,enabled:body.enabled})).run();
          return json({ok:true,key:body.key,enabled:body.enabled},200,origin);
        }
        if (path === "/api/admin/error-log" && method === "GET") {
          if(!(await tableExists(env,"system_error_log")))return json({ok:true,errors:[],migration_pending:true},200,origin);
          const rows=await env.DB.prepare("SELECT id,severity,source,message,status,created_at,resolved_at FROM system_error_log ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END,id DESC LIMIT 100").all();
          return json({ok:true,errors:rows.results||[]},200,origin);
        }
        if (path === "/api/admin/error-resolve" && method === "POST") {
          const body=await readJson(request),id=Number(body.id);
          if(!Number.isSafeInteger(id)||id<1)return json({error:"Укажите запись журнала."},400,origin);
          const result=await env.DB.prepare("UPDATE system_error_log SET status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE id=? AND status='new'").bind(id).run();
          if(!result.meta||result.meta.changes!==1)return json({error:"Новая ошибка не найдена."},404,origin);
          return json({ok:true,id,status:"resolved"},200,origin);
        }
        if (path === "/api/admin/system-controls" && method === "GET") {
          const row = await env.DB.prepare("SELECT value,updated_at FROM app_settings WHERE key='sales_paused'").first();
          return json({ ok: true, sales_paused: row?.value === "1", updated_at: row?.updated_at || null }, 200, origin);
        }
        const aiAdminResponse = await handleAiAdminRoute(path,method,request,env,telegramId,rootOwner,permissions);
        if (aiAdminResponse) return json(await aiAdminResponse.json(),aiAdminResponse.status,origin);
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


      const featureGateMap={
        "/api/orders":"feature_product_orders",
        "/api/custom-orders":"feature_custom_orders",
        "/api/balance/topup":"feature_points_topup",
        "/api/support/chat":"feature_support",
        "/api/vip/subscribe":"feature_vip",
        "/api/vip/support":"feature_support"
      };
      const featureKey=method==="POST"?featureGateMap[path]:null;
      if(featureKey){
        const feature=await env.DB.prepare("SELECT value FROM app_settings WHERE key=?").bind(featureKey).first();
        if(feature?.value==="0")return json({error:"Эта функция временно отключена владельцем."},503,origin);
      }

      // Emergency sales pause: keep the catalog readable and existing paid orders intact.
      if (method === "POST" && ["/api/orders","/api/custom-orders","/api/balance/topup","/api/vip/subscribe"].includes(path)) {
        const salesPause = await env.DB.prepare("SELECT value FROM app_settings WHERE key='sales_paused'").first();
        if (salesPause?.value === "1") return json({ error: "Оформление новых покупок временно приостановлено владельцем. Уже оплаченные заказы продолжают обрабатываться." }, 503, origin);
      }

      if (method === "POST" && !path.startsWith("/api/admin/") && path !== "/api/telegram/webhook") {
        let incoming={};try{incoming=await request.clone().json();}catch{}
        const texts=await extractTextValues(incoming);
        if(texts.some(containsProhibitedLanguage)){
          const reason="Автоматическая модерация: обнаружена нецензурная или оскорбительная лексика.";
          const active=await env.DB.prepare("SELECT id FROM user_blocks WHERE telegram_id=? AND status='active' LIMIT 1").bind(telegramId).first();
          if(!active){
            await env.DB.batch([
              env.DB.prepare("INSERT INTO user_blocks (telegram_id,block_type,reason,blocked_by) VALUES (?,'full',?,'automatic_moderation')").bind(telegramId,reason),
              env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES ('automatic_moderation',?,'user_block',?)").bind(telegramId,JSON.stringify({block_type:"full",reason}))
            ]);
            await notifyOwner(env,"🚫 Автоматическая полная блокировка\nTelegram ID: "+telegramId+"\nПричина: нецензурная или оскорбительная лексика. Проверьте блокировку в карточке пользователя.");
          }
          return json({error:"Доступ ограничен автоматической модерацией из-за нецензурной или оскорбительной лексики. Если это ошибка, обратитесь к владельцу Агентства."},403,origin);
        }
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
        // Reputation equals lifetime Telegram Stars actually paid. Top-ups count; internal-balance spending does not count again.
        const reputation = await env.DB.prepare("SELECT COALESCE(SUM(amount_stars),0) AS total FROM payment_intents WHERE telegram_id=? AND status='paid'")
          .bind(telegramId).first();
        return json({ points: Number(me?.balance_stars || 0), balance_stars: Number(me?.balance_stars || 0),
          reputation_points: Number(reputation?.total || 0),
          first_name: me?.first_name || user.first_name || "", username: me?.username || user.username || "",
          orders: orders.results || [], vip: vip || null }, 200, origin);
      }

      if (path === "/api/order-chat" && method === "GET") {
        const orderId=String(url.searchParams.get("order_id")||"").trim().slice(0,100);
        if(!orderId)return json({error:"Не указан номер заказа."},400,origin);
        const product=await env.DB.prepare("SELECT id,telegram_id,product_title,total_stars,payment_status,fulfillment_status,created_at FROM orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        const custom=await env.DB.prepare("SELECT id,telegram_id,subject,answers_json,total_stars,status,created_at FROM custom_orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        if(!product&&!custom)return json({error:"Заказ не найден."},404,origin);
        const rows=await env.DB.prepare("SELECT sender_type,content,created_at FROM order_chat_messages WHERE order_id=? AND telegram_id=? ORDER BY id LIMIT 150").bind(orderId,telegramId).all();
        const changes=await env.DB.prepare("SELECT id,ai_summary,status,created_at FROM order_change_requests WHERE order_id=? AND telegram_id=? ORDER BY created_at DESC LIMIT 20").bind(orderId,telegramId).all();
        const current=product||custom;
        if(product?.fulfillment_status==="superseded"||product?.payment_status==="superseded"||custom?.status==="superseded"){
          const revision=await env.DB.prepare("SELECT new_order_id FROM order_revisions WHERE previous_order_id=? ORDER BY created_at DESC LIMIT 1").bind(orderId).first();
          return json({ok:true,superseded:true,new_order_id:revision?.new_order_id||null,order:current,chat_available:false,messages:[],changes:[]},200,origin);
        }
        const chatCreatedAt=String(current.created_at||"").trim().replace(" ","T");
        const chatCreatedAtIso=/([zZ]|[+-]\\d{2}:?\\d{2})$/.test(chatCreatedAt)?chatCreatedAt:chatCreatedAt+"Z";
        const chatAgeMs=Date.now()-Date.parse(chatCreatedAtIso);
        const chatAvailable=Number.isFinite(chatAgeMs)&&chatAgeMs>=0&&chatAgeMs<=72*60*60*1000;
        return json({ok:true,order:current,order_type:product?"product":"custom",chat_available:chatAvailable,messages:rows.results||[],changes:changes.results||[]},200,origin);
      }
      if (path === "/api/order-chat" && method === "POST") {
        const body=await readJson(request),orderId=String(body.order_id||"").trim().slice(0,100),message=typeof body.message==="string"?body.message.trim().slice(0,2000):"";
        if(!orderId||!message)return json({error:"Укажите заказ и сообщение."},400,origin);
        const product=await env.DB.prepare("SELECT id,telegram_id,product_title,total_stars,payment_status,fulfillment_status,created_at FROM orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        const custom=await env.DB.prepare("SELECT id,telegram_id,subject,answers_json,total_stars,status,created_at FROM custom_orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        const order=product||custom;
        if(!order)return json({error:"Заказ не найден."},404,origin);
        if(product?.fulfillment_status==="superseded"||product?.payment_status==="superseded"||custom?.status==="superseded"){
          const revision=await env.DB.prepare("SELECT new_order_id FROM order_revisions WHERE previous_order_id=? ORDER BY created_at DESC LIMIT 1").bind(orderId).first();
          return json({error:"Создана новая версия заказа.",superseded:true,new_order_id:revision?.new_order_id||null},409,origin);
        }
        const chatCreatedAt=String(order.created_at||"").trim().replace(" ","T");
        const chatCreatedAtIso=/([zZ]|[+-]\d{2}:?\d{2})$/.test(chatCreatedAt)?chatCreatedAt:chatCreatedAt+"Z";
        const chatAgeMs=Date.now()-Date.parse(chatCreatedAtIso);
        if(!Number.isFinite(chatAgeMs)||chatAgeMs<0||chatAgeMs>72*60*60*1000)return json({error:"ИИ-консультант по заказу доступен в течение первых 3 дней после оформления."},409,origin);
        await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'buyer',?)").bind(orderId,telegramId,message).run();
        const rows=await env.DB.prepare("SELECT sender_type,content FROM order_chat_messages WHERE order_id=? AND telegram_id=? ORDER BY id DESC LIMIT 30").bind(orderId,telegramId).all();
        const history=(rows.results||[]).reverse().map(row=>({role:row.sender_type==="buyer"?"user":"assistant",content:row.content}));
        let answer;
        try{answer=await createOrderChatAnswer(env,history,{order_type:product?"product":"custom",order_id:orderId,title:product?.product_title||custom?.subject,total_stars:order.total_stars,payment_status:product?.payment_status||null,fulfillment_status:product?.fulfillment_status||null,custom_answers:custom?.answers_json||null});}
        catch(error){
          try{await notifyOwner(env,"💬 СООБЩЕНИЕ В ЧАТЕ ЗАКАЗА\nЗаказ: "+orderId+"\nПокупатель: "+telegramId+"\nСообщение: "+message+"\n\nИИ временно не смог ответить.");}catch(notificationError){console.error("Order chat owner notification failed:",String(notificationError).slice(0,200));}
          return json({error:error.message||"ИИ-консультант временно недоступен."},503,origin);
        }
        if(!answer.reply)return json({error:"ИИ-консультант не подготовил ответ."},503,origin);
        try{await notifyOwner(env,"💬 СООБЩЕНИЕ В ЧАТЕ ЗАКАЗА\\nЗаказ: "+orderId+"\\nПокупатель: "+telegramId+"\\nСообщение: "+message+(answer.change_summary?"\\n\\n📝 Запрошенное изменение: "+answer.change_summary:""));}catch(notificationError){console.error("Order chat owner notification failed:",String(notificationError).slice(0,200));}
        await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'ai',?)").bind(orderId,telegramId,answer.reply).run();
        let changeId=null;
        if(answer.change_summary){
          changeId=makeId();
          await env.DB.prepare("INSERT INTO order_change_requests(id,order_id,telegram_id,proposed_json,ai_summary,status) VALUES(?,?,?,?,?,'pending')").bind(changeId,orderId,telegramId,JSON.stringify(answer.proposed_changes||{customer_request:message}),answer.change_summary).run();
        }
        return json({ok:true,reply:answer.reply,change_request_id:changeId},200,origin);
      }

      if (path === "/api/orders/pay" && method === "POST") {
        const body=await readJson(request),orderId=typeof body.order_id==="string"?body.order_id.trim().slice(0,100):"";
        if(!orderId)return json({error:"Не указан номер заказа."},400,origin);
        const order=await env.DB.prepare("SELECT id,product_title,total_stars,payment_status,balance_applied_stars FROM orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        if(!order)return json({error:"Заказ не найден."},404,origin);
        if(order.payment_status!=="pending")return json({error:"Заказ уже оплачен или отменён."},409,origin);
        const due=Math.max(0,Number(order.total_stars||0)-Number(order.balance_applied_stars||0));
        if(!due){
          const paid=await env.DB.prepare("UPDATE orders SET payment_status='paid',fulfillment_status='awaiting_delivery',paid_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND payment_status='pending' AND balance_applied_stars>=total_stars").bind(orderId,telegramId).run();
          if(paid.meta?.changes===1)return json({ok:true,paid:true,order_id:orderId},200,origin);
          return json({error:"Не удалось подтвердить оплату с баланса. Обновите список заказов."},409,origin);
        }
        const payload=orderId+":retry:"+makeId();
        const invoice_url=await createPaymentIntent(env,{payload,telegram_id:telegramId,kind:"order",reference_id:orderId,amount_stars:due,title:"Оплата заказа "+orderId.slice(0,8),description:String(order.product_title||"Заказ").slice(0,150)+"; остаток "+due+" Stars"});
        return json({ok:true,invoice_url,order_id:orderId,invoice_amount_stars:due,balance_used_stars:Number(order.balance_applied_stars||0)},200,origin);
      }

      if (path === "/api/orders/cancel" && method === "POST") {
        const body=await readJson(request),orderId=typeof body.order_id==="string"?body.order_id.trim().slice(0,100):"";
        const reason=typeof body.reason==="string"?body.reason.trim().slice(0,500):"";
        if(!orderId)return json({error:"Не указан номер заказа."},400,origin);
        const linked=await env.DB.prepare("SELECT id,telegram_id,payment_status,created_at FROM orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        const custom=await env.DB.prepare("SELECT id,status,created_at FROM custom_orders WHERE id=? AND telegram_id=?").bind(orderId,telegramId).first();
        const createdAt=linked?.created_at||custom?.created_at;
        if(!createdAt)return json({error:"Заказ не найден."},404,origin);
        const createdAtText=String(createdAt).trim().replace(" ","T");
        const createdAtIso=/([zZ]|[+-]\d{2}:?\d{2})$/.test(createdAtText)?createdAtText:createdAtText+"Z";
        const ageMs=Date.now()-Date.parse(createdAtIso);
        if(!Number.isFinite(ageMs)||ageMs<0||ageMs>72*60*60*1000)return json({error:"Отменить заказ через Mini App можно только в течение первых 3 дней после оформления."},409,origin);
        if(!linked){
          if(!custom||["cancelled","canceled"].includes(String(custom.status)))return json({error:"Заказ уже отменён."},409,origin);
          await env.DB.prepare("UPDATE custom_orders SET status='cancelled' WHERE id=? AND telegram_id=?").bind(orderId,telegramId).run();
          await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'system',?)").bind(orderId,telegramId,"Покупатель отменил индивидуальный заказ.").run();
          await notifyOwner(env,"❌ Отмена индивидуального заказа\nID: "+orderId+"\nПокупатель: "+telegramId+"\nПричина: "+(reason||"Не указана"));
          return json({ok:true,cancelled:true,refunded:false},200,origin);
        }
        if(linked.payment_status==="pending"){
          const cancelled=await cancelPendingOrderAndRefund(env,orderId,telegramId);
          if(!cancelled)return json({error:"Не удалось отменить заказ. Обновите список заказов."},409,origin);
          await env.DB.prepare("UPDATE custom_orders SET status='cancelled' WHERE id=? AND telegram_id=?").bind(orderId,telegramId).run();
          return json({ok:true,cancelled:true,refunded:true},200,origin);
        }
        if(linked.payment_status==="paid"){
          const requestId=makeId();
          const cancellationInsert=await env.DB.prepare("INSERT INTO order_cancellation_requests(id,order_id,telegram_id,reason,status) VALUES(?,?,?,?,'requested') ON CONFLICT DO NOTHING")
            .bind(requestId,orderId,telegramId,reason).run();
          if(!cancellationInsert.meta?.changes)return json({ok:true,requested:true,already_requested:true,refunded:false,message:"Запрос на отмену уже передан владельцу. Дождитесь решения."},200,origin);
          await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'system',?)")
            .bind(orderId,telegramId,"Покупатель отправил запрос на отмену оплаченного заказа. Ожидается решение владельца.").run();
          await notifyOwner(env,"⚠️ ЗАПРОС НА ОТМЕНУ ОПЛАЧЕННОГО ЗАКАЗА\nID: "+orderId+"\nПокупатель: "+telegramId+"\nПричина: "+(reason||"Не указана")+"\nПроверьте оплату и подтвердите возврат вручную.");
          return json({ok:true,requested:true,refunded:false,message:"Запрос на отмену передан владельцу. Оплаченный заказ будет отменён после проверки возврата."},200,origin);
        }
        return json({error:"Этот заказ уже отменён или имеет закрытый статус."},409,origin);
      }
      if (path === "/api/orders" && method === "GET") {
        const result = await env.DB.prepare("SELECT id AS order_id,'product' AS order_type,product_title AS title,total_stars AS amount,payment_status AS status,fulfillment_status,created_at FROM orders WHERE telegram_id=? AND fulfillment_status<>'superseded' UNION ALL SELECT c.id AS order_id,'custom' AS order_type,'Индивидуальный заказ: ' || c.subject AS title,c.total_stars AS amount,CASE WHEN o.payment_status='paid' THEN c.status WHEN o.payment_status IS NOT NULL THEN o.payment_status ELSE 'awaiting_price' END AS status,o.fulfillment_status,c.created_at FROM custom_orders c LEFT JOIN orders o ON o.id=c.id AND o.telegram_id=c.telegram_id WHERE c.telegram_id=? AND c.status<>'superseded' ORDER BY created_at DESC LIMIT 50")
          .bind(telegramId, telegramId).all();
        return json({ orders: result.results || [] }, 200, origin);
      }
      if (path === "/api/custom-orders" && method === "POST") {
        const body = await readJson(request), a = body.answers && typeof body.answers === "object" ? body.answers : {};
        const subject = typeof a.subject === "string" ? a.subject.trim().slice(0,300) : "";
        const wishes = typeof a.wishes === "string" ? a.wishes.trim().slice(0,700) : "";
        for (const key of ["style","format","palette","complexity","deadline"]) if (!Object.prototype.hasOwnProperty.call(CUSTOM_PRICE_OPTIONS[key],a[key])) return json({error:"Проверь ответы опроса: выбран неизвестный вариант."},400,origin);
        if(subject.length<3)return json({error:"Опиши, что нужно изобразить (минимум 3 символа)."},400,origin);
        const p=CUSTOM_PRICE_OPTIONS,fallbackStars=Math.min(700,250+p.style[a.style]+p.format[a.format]+p.palette[a.palette]+p.complexity[a.complexity]+p.deadline[a.deadline]),id=makeId();
        const materials=Array.isArray(a.materials)?[...new Set(a.materials.filter(x=>["watercolor","gouache","pastel","pencils","markers","liners"].includes(x)))]:[];if(!materials.length)return json({error:"Выберите хотя бы один художественный материал."},400,origin);
        const estimate=await estimateCustomOrderPrice(env,{style:a.style,subject,format:a.format,palette:a.palette,materials,complexity:a.complexity,deadline:a.deadline,wishes,budget_rub:Number.isFinite(Number(a.budget_rub))&&Number(a.budget_rub)>0?Math.min(1000000,Number(a.budget_rub)):null},fallbackStars);
        const total=estimate.price_stars,saved=JSON.stringify({style:a.style,subject,format:a.format,palette:a.palette,materials,complexity:a.complexity,deadline:a.deadline,wishes,ai_estimate_stars:total,ai_estimate_source:estimate.source,ai_estimate_note:estimate.note});
        await env.DB.prepare("INSERT INTO custom_orders (id,telegram_id,username,first_name,subject,answers_json,total_stars,status) VALUES (?,?,?,?,?,?,?,'new')").bind(id,telegramId,user.username||null,user.first_name||null,subject,saved,total).run();
        const L={style:{classic:"Классический",watercolor:"Акварельный",perspective:"С перспективой",autumn:"Осенний",realistic:"Реалистичный",artist_choice:"На усмотрение художника"},format:{postcard:"Открытка",a5:"А5",a4:"А4",large:"Большой формат"},palette:{natural:"Естественная",bright:"Яркая",pastel:"Пастельная",custom:"На усмотрение художника"},materials:{watercolor:"Акварель",gouache:"Гуашь",pastel:"Пастель",pencils:"Цветные карандаши",markers:"Фломастеры",liners:"Линеры"},complexity:{simple:"Простая",medium:"Средняя",detailed:"Высокая"},deadline:{standard:"Обычный срок",priority:"Приоритетный заказ"}};
        await notifyOwner(env,"🎨 НОВЫЙ ИНДИВИДУАЛЬНЫЙ ЗАКАЗ\nID: "+id+"\nПокупатель: "+(user.first_name||"Без имени")+(user.username?" (@"+user.username+")":"")+"\nTelegram ID: "+telegramId+"\n\nЧто изобразить: "+subject+"\nСтиль: "+L.style[a.style]+"\nФормат: "+L.format[a.format]+"\nЦвета: "+L.palette[a.palette]+"\nМатериалы: "+materials.map(x=>L.materials[x]).join(", ")+"\nСложность: "+L.complexity[a.complexity]+"\nСрок: "+L.deadline[a.deadline]+"\nПожелания: "+(wishes||"Не указаны")+"\n\nПредварительная оценка ИИ: "+total+" ⭐. "+estimate.note+"\nОкончательную цену подтверждает владелец.");
        return json({ok:true,order_id:id,total_stars:total,estimate_source:estimate.source,estimate_note:estimate.note,status:"new"},200,origin);
      }

        if (path === "/api/promo/validate" && method === "POST") {
          const body=await readJson(request),code=String(body.code||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,32);
          if(!code)return json({error:"Введите промокод."},400,origin);
          if(!(await tableExists(env,"promo_codes")))return json({error:"Промокоды ещё не подключены: требуется миграция 0013_promo_codes.sql."},503,origin);
          const scopeReady=await columnExists(env,"promo_codes","product_ids")&&await columnExists(env,"promo_codes","category_ids");
          const promo=await env.DB.prepare(scopeReady
            ? "SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active,product_ids,category_ids FROM promo_codes WHERE code=?"
            : "SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active,'[]' AS product_ids,'[]' AS category_ids FROM promo_codes WHERE code=?").bind(code).first();
          if(!promo||!promo.is_active)return json({error:"Промокод не найден или отключён."},404,origin);
          if(promo.starts_at&&Date.parse(promo.starts_at)>Date.now())return json({error:"Срок действия промокода ещё не начался."},400,origin);
          if(promo.ends_at&&Date.parse(promo.ends_at)<Date.now())return json({error:"Срок действия промокода закончился."},400,origin);
          if(promo.max_uses!==null&&Number(promo.reserved_count||0)+Number(promo.redeemed_count||0)>=Number(promo.max_uses))return json({error:"Лимит использований промокода исчерпан."},409,origin);
          if(!Array.isArray(body.items)||!body.items.length||body.items.length>43)return json({error:"Корзина пуста."},400,origin);
          const catalog=await getProducts(env),quantities=new Map();
          for(const item of body.items){const id=String(item.id??""),qty=Number(item.qty);if(!Number.isSafeInteger(qty)||qty<1||qty>10)return json({error:"Некорректное количество товара."},400,origin);quantities.set(id,(quantities.get(id)||0)+qty);}
          let subtotal=0;for(const [id,qty] of quantities){const product=catalog.find(p=>String(p.id)===id);if(!product)return json({error:"Товар больше недоступен."},409,origin);subtotal+=Number(product.price_stars)*qty;}
          if(!Number.isSafeInteger(subtotal)||subtotal<1)return json({error:"Некорректная сумма."},400,origin);
          const eligibleSubtotal=promoEligibleSubtotal(catalog,quantities,promo);
          if(eligibleSubtotal<1)return json({error:"Промокод не действует на товары в этой корзине."},400,origin);
          const discount=Math.min(eligibleSubtotal-1,Math.floor(eligibleSubtotal*Number(promo.discount_percent)/100));
          return json({ok:true,code:promo.code,discount_percent:Number(promo.discount_percent),subtotal,eligible_subtotal:eligibleSubtotal,discount_stars:discount,total_stars:subtotal-discount},200,origin);
        }
      if (path === "/api/gift-builder/draft" && method === "POST") {
        if (!(await tableExists(env,"gift_bundles"))) return json({error:"Конструктор ещё не установлен. Обновите приложение позже."},503,origin);
        const body=await readJson(request);
        const catalog=await getProducts(env);
        const selected=Array.isArray(body.items)?body.items:[];
        if(!selected.length||selected.length>20)return json({error:"Выберите от 1 до 20 товаров для набора."},400,origin);
        const quantities=new Map();
        for(const item of selected){
          const id=String(item.id||"");
          const qty=Number(item.qty);
          if(!catalog.some(p=>String(p.id)===id)||!Number.isInteger(qty)||qty<1||qty>10)return json({error:"В наборе есть неизвестный товар или некорректное количество."},400,origin);
          quantities.set(id,(quantities.get(id)||0)+qty);
          if(quantities.get(id)>10)return json({error:"Максимум 10 штук одного товара."},400,origin);
        }
        const items=[...quantities].map(([id,qty])=>({id,qty}));
        const seasonal=Array.isArray(body.seasonal_extras)?[...new Set(body.seasonal_extras.filter(x=>["sticker","drawing"].includes(x)))]:[];
        const postcard=body.postcard===true;
        const certificate=body.certificate===true;
        const filler=body.filler===true;
        const postcardText=typeof body.postcard_text==="string"?body.postcard_text.trim().slice(0,700):"";
        if(postcard&&postcardText.length<2)return json({error:"Напишите текст для открытки или отключите открытку."},400,origin);
        const layout=Array.isArray(body.layout)?body.layout.map(String).filter(id=>quantities.has(id)).slice(0,20):items.map(x=>x.id);
        const bundle={items,postcard,postcard_text:postcardText,certificate,filler,seasonal_extras:seasonal,layout,updated_at:new Date().toISOString()};
        const id=String(body.draft_id||"").trim().slice(0,80)||makeId();
        const existing=await env.DB.prepare("SELECT id,status FROM gift_bundles WHERE id=? AND telegram_id=?").bind(id,telegramId).first();
        if(existing&&existing.status!=="draft")return json({error:"Этот набор уже оформлен и больше не редактируется."},409,origin);
        if(existing)await env.DB.prepare("UPDATE gift_bundles SET bundle_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND status='draft'").bind(JSON.stringify(bundle),id,telegramId).run();
        else await env.DB.prepare("INSERT INTO gift_bundles(id,telegram_id,bundle_json,status) VALUES(?,?,?,'draft')").bind(id,telegramId,JSON.stringify(bundle)).run();
        const productTotal=items.reduce((sum,item)=>sum+Number(catalog.find(p=>String(p.id)===item.id)?.price_stars||0)*item.qty,0);
        const extras={postcard:postcard?35:0,certificate:certificate?25:0,filler:filler?40:0,sticker:seasonal.includes("sticker")?20:0,drawing:seasonal.includes("drawing")?70:0};
        return json({ok:true,draft_id:id,bundle,product_total:productTotal,extras_total:Object.values(extras).reduce((a,b)=>a+b,0),extras},200,origin);
      }

      if (path === "/api/gift-builder/consult" && method === "POST") {
        const body=await readJson(request),draftId=String(body.draft_id||"").trim().slice(0,80),message=typeof body.message==="string"?body.message.trim().slice(0,1800):"";
        if(!draftId||!message)return json({error:"Напишите вопрос ИИ-консультанту."},400,origin);
        const draft=await env.DB.prepare("SELECT bundle_json,status FROM gift_bundles WHERE id=? AND telegram_id=?").bind(draftId,telegramId).first();
        if(!draft||draft.status!=="draft")return json({error:"Черновик подарка не найден или уже оформлен."},404,origin);
        await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'buyer',?)").bind(draftId,telegramId,message).run();
        const rows=await env.DB.prepare("SELECT sender_type,content FROM order_chat_messages WHERE order_id=? AND telegram_id=? ORDER BY id DESC LIMIT 24").bind(draftId,telegramId).all();
        const history=(rows.results||[]).reverse().map(row=>({role:row.sender_type==="buyer"?"user":"assistant",content:row.content}));
        let answer;
        try{answer=await createOrderChatAnswer(env,history,{order_type:"gift_builder_draft_not_yet_ordered",status:"draft",bundle_json:draft.bundle_json});}
        catch(error){try{await notifyOwner(env,"💬 Вопрос по собираемому подарку\nЧерновик: "+draftId+"\nПокупатель: "+telegramId+"\n"+message);}catch{}return json({error:error.message||"ИИ-консультант временно недоступен."},503,origin);}
        if(!answer.reply)return json({error:"ИИ-консультант не подготовил ответ."},503,origin);
        await env.DB.prepare("INSERT INTO order_chat_messages(order_id,telegram_id,sender_type,content) VALUES(?,?,'ai',?)").bind(draftId,telegramId,answer.reply).run();
        try{await notifyOwner(env,"🎁 Вопрос в конструкторе подарка\nЧерновик: "+draftId+"\nПокупатель: "+telegramId+"\n\n"+message);}catch(error){console.error("Gift builder notification failed:",String(error).slice(0,200));}
        return json({ok:true,reply:answer.reply},200,origin);
      }

      if (path === "/api/orders" && method === "POST") {
        const body = await readJson(request);
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 43) return json({ error: "Корзина пуста или некорректна" }, 400, origin);
        const deliveryMethod = body.delivery_method === "pickup" ? "pickup" : "courier";
        const deliveryAddress = typeof body.delivery_address === "string" ? body.delivery_address.trim().slice(0,350) : "";
        const deliveryDetails = typeof body.delivery_details === "string" ? body.delivery_details.trim().slice(0,180) : "";
        const deliveryNote = typeof body.delivery_note === "string" ? body.delivery_note.trim().slice(0,500) : "";
        const priorityDelivery = deliveryMethod === "courier" && body.priority_delivery === true;
        if (deliveryMethod === "courier" && deliveryAddress.length < 8) return json({error:"Перед оформлением укажите адрес доставки в Екатеринбурге."},400,origin);
        const catalog = await getProducts(env);
        const quantities = new Map();
        for (const item of body.items) {
          const id = String(item.id ?? "");
          const qty = Number(item.qty);
          if (!Number.isInteger(qty) || qty < 1 || qty > 10 || !catalog.some(p => String(p.id) === id)) return json({ error: "Некорректный товар или количество" }, 400, origin);
          quantities.set(id, (quantities.get(id) || 0) + qty);
          if (quantities.get(id) > 10) return json({ error: "Максимум 10 единиц одного товара" }, 400, origin);
        }
        const items = Array.from(quantities.entries()).map(([id, qty]) => {
          const product = catalog.find(p => String(p.id) === id);
          return { id, title: product.title, qty, unit_price: Number(product.price_stars), image_url: product.image_url || null };
        });
        let giftBundle=null,builderExtraTotal=0,builderExtraLines=[];
        const giftBundleId=typeof body.gift_bundle_id==="string"?body.gift_bundle_id.trim().slice(0,80):"";
        if(giftBundleId){
          const draft=await env.DB.prepare("SELECT bundle_json,status FROM gift_bundles WHERE id=? AND telegram_id=?").bind(giftBundleId,telegramId).first();
          if(!draft||draft.status!=="draft")return json({error:"Черновик подарка не найден или уже оформлен. Откройте конструктор и сохраните набор ещё раз."},409,origin);
          try{giftBundle=JSON.parse(draft.bundle_json||"{}");}catch{return json({error:"Не удалось прочитать сохранённый набор."},409,origin);}
          const selected=Array.isArray(giftBundle.items)?giftBundle.items:[];
          for(const selectedItem of selected){
            const matching=items.find(item=>item.id===String(selectedItem.id));
            if(!matching||matching.qty<Number(selectedItem.qty))return json({error:"Состав корзины не совпадает с сохранённым набором. Вернитесь в конструктор и добавьте набор заново."},409,origin);
          }
          const seasonal=Array.isArray(giftBundle.seasonal_extras)?giftBundle.seasonal_extras:[];
          const extras=[
            ["Индивидуальная открытка",giftBundle.postcard?35:0],
            ["Подарочный сертификат",giftBundle.certificate?25:0],
            ["Наполнитель",giftBundle.filler?40:0],
            ["Сезонные стикеры",seasonal.includes("sticker")?20:0],
            ["Маленький сезонный рисунок",seasonal.includes("drawing")?70:0]
          ];
          builderExtraLines=extras.filter(x=>x[1]>0);
          builderExtraTotal=builderExtraLines.reduce((sum,x)=>sum+x[1],0);
          if(giftBundle.postcard&&String(giftBundle.postcard_text||"").trim().length<2)return json({error:"В открытке отсутствует поздравление."},400,origin);
        }
        const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
        if (!Number.isSafeInteger(subtotal) || subtotal < 1) return json({ error: "Некорректная сумма заказа" }, 400, origin);
        let discount = 0, promoCode = null, discountPercent = 0;
        const requestedPromo = typeof body.promo_code === "string" ? body.promo_code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,32) : "";
        const promoSchemaReady = await tableExists(env,"promo_codes") && await tableExists(env,"promo_redemptions");
        if(requestedPromo){
          if(!promoSchemaReady)return json({error:"Промокоды ещё не подключены: требуется миграция 0013_promo_codes.sql."},503,origin);
          const scopeReady=await columnExists(env,"promo_codes","product_ids")&&await columnExists(env,"promo_codes","category_ids");
          const promo=await env.DB.prepare(scopeReady
            ? "SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active,product_ids,category_ids FROM promo_codes WHERE code=?"
            : "SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active,'[]' AS product_ids,'[]' AS category_ids FROM promo_codes WHERE code=?").bind(requestedPromo).first();
          if(!promo||!promo.is_active)return json({error:"Промокод не найден или отключён."},404,origin);
          if(promo.starts_at&&Date.parse(promo.starts_at)>Date.now())return json({error:"Срок действия промокода ещё не начался."},400,origin);
          if(promo.ends_at&&Date.parse(promo.ends_at)<Date.now())return json({error:"Срок действия промокода закончился."},400,origin);
          if(promo.max_uses!==null&&Number(promo.reserved_count||0)+Number(promo.redeemed_count||0)>=Number(promo.max_uses))return json({error:"Лимит использований промокода исчерпан."},409,origin);
          const eligibleSubtotal=promoEligibleSubtotal(catalog,quantities,promo);
          if(eligibleSubtotal<1)return json({error:"Промокод не действует на товары в этой корзине."},400,origin);
          promoCode=promo.code;discountPercent=Number(promo.discount_percent);discount=Math.min(eligibleSubtotal-1,Math.floor(eligibleSubtotal*discountPercent/100));
        }
        let delivery;
        if (deliveryMethod === "pickup") {
          delivery = {
            address: "Самовывоз — пункт выдачи: Новаторов, 8",
            distance_km: 0,
            delivery_stars: 0,
            priority_delivery: false,
            priority_stars: 0,
            total_delivery_stars: 0
          };
        } else {
          try {
            delivery = await calculateDeliveryQuote(deliveryAddress,priorityDelivery);
          } catch (deliveryError) {
            const message = String(deliveryError?.message || "Не удалось рассчитать доставку.");
            const clientInputError = /Адрес не найден|Доставка доступна только|Укажите полный адрес|Уточните адрес|Проверьте номер дома/i.test(message);
            console.warn("Delivery quote rejected:",message.slice(0,250));
            return json({error:message},clientInputError?422:503,origin);
          }
        }
        const goodsTotal = subtotal-discount;
        const total = goodsTotal+builderExtraTotal+delivery.total_delivery_stars;
        if (!Number.isSafeInteger(total) || total < 1) return json({ error: "Некорректная сумма заказа" }, 400, origin);
        const userBalance = await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(telegramId).first();
        const requestedBalanceUse = Math.min(total,Math.max(0,Number(userBalance?.balance_stars||0)));
        const orderId = makeId();
        const title = items.map(item => item.title + " × " + item.qty).join("; ")+(builderExtraLines.length?" · Дополнения: "+builderExtraLines.map(x=>x[0]).join(", "):"");
        const orderInsert = env.DB.prepare("INSERT INTO orders (id,telegram_id,product_id,product_title,quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status,promo_code,discount_stars,balance_applied_stars) VALUES (?,?,?,?,?,?,?,?, 'pending','awaiting_payment',?,?,?)")
          .bind(orderId,telegramId,items.length===1?items[0].id:null,title,items.reduce((sum,item)=>sum+item.qty,0),subtotal+builderExtraTotal,discountPercent,total,promoCode,discount,requestedBalanceUse);
        const orderStatements = [
          orderInsert,
          ...items.map(item => env.DB.prepare("INSERT INTO order_items (order_id,product_id,product_title,quantity,image_url,delivery_status) VALUES (?,?,?,?,?,'pending')")
            .bind(orderId,item.id,item.title,item.qty,item.image_url)),
          env.DB.prepare("INSERT INTO order_delivery (order_id,telegram_id,address,delivery_details,delivery_note,distance_km,delivery_stars,priority_delivery,priority_stars) VALUES (?,?,?,?,?,?,?,?,?)")
            .bind(orderId,telegramId,delivery.address,deliveryDetails,deliveryNote,delivery.distance_km,delivery.delivery_stars,priorityDelivery?1:0,delivery.priority_stars)
        ];
        if(giftBundleId)orderStatements.push(env.DB.prepare("UPDATE gift_bundles SET order_id=?,status='ordered',updated_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND status='draft'").bind(orderId,giftBundleId,telegramId));
        if(promoCode){
          const reservation=await env.DB.prepare("UPDATE promo_codes SET reserved_count=reserved_count+1,updated_at=CURRENT_TIMESTAMP WHERE code=? AND is_active=1 AND (max_uses IS NULL OR reserved_count+redeemed_count<max_uses) AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)").bind(promoCode).run();
          if(!reservation.meta||reservation.meta.changes!==1)return json({error:"Промокод только что исчерпал лимит. Попробуйте другой."},409,origin);
          orderStatements.push(env.DB.prepare("INSERT INTO promo_redemptions (order_id,code,telegram_id,discount_stars,status) VALUES (?,?,?,?,'reserved')").bind(orderId,promoCode,telegramId,discount));
        }
        try {
          await env.DB.batch(orderStatements);
          if(giftBundleId)await env.DB.prepare("UPDATE order_chat_messages SET order_id=? WHERE order_id=? AND telegram_id=?").bind(orderId,giftBundleId,telegramId).run();
        } catch(orderError) {
          if(promoCode)await env.DB.batch([
            env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(promoCode),
            env.DB.prepare("UPDATE promo_redemptions SET status='released' WHERE order_id=? AND status='reserved'").bind(orderId)
          ]);
          throw orderError;
        }
        let balanceUsed = 0;
        if(requestedBalanceUse>0){
          const debitResults=await env.DB.batch([
            env.DB.prepare("UPDATE users SET balance_stars=balance_stars-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance_stars>=?")
              .bind(requestedBalanceUse,telegramId,requestedBalanceUse),
            env.DB.prepare("INSERT INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'order_payment',?,? WHERE changes()=1")
              .bind(telegramId,-requestedBalanceUse,"Оплата заказа "+orderId,"order-payment:"+orderId)
          ]);
          if(debitResults[0]?.meta?.changes===1) balanceUsed=requestedBalanceUse;
          else await env.DB.prepare("UPDATE orders SET balance_applied_stars=0 WHERE id=? AND payment_status='pending'").bind(orderId).run();
        }
        if(balanceUsed===total){
          const paid=await env.DB.prepare("UPDATE orders SET payment_status='paid',fulfillment_status='awaiting_delivery',paid_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND payment_status='pending' AND balance_applied_stars=?")
            .bind(orderId,telegramId,total).run();
          if(!paid.meta||paid.meta.changes!==1){await cancelPendingOrderAndRefund(env,orderId,telegramId);return json({error:"Не удалось завершить оплату с баланса. Попробуйте ещё раз."},409,origin);}
          const earned=Math.floor(total/3);
          if(earned>0)await env.DB.batch([
            env.DB.prepare("INSERT OR IGNORE INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'purchase_reward',?,? WHERE changes()=1 OR EXISTS (SELECT 1 FROM orders WHERE id=? AND payment_status='paid')")
              .bind(telegramId,earned,"Баллы за покупку: "+title,"purchase:"+orderId,orderId),
            env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND changes()=1")
              .bind(earned,telegramId)
          ]);
          if(promoCode)await env.DB.batch([
            env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),redeemed_count=redeemed_count+1,updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(promoCode),
            env.DB.prepare("UPDATE promo_redemptions SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='reserved'").bind(orderId)
          ]);
          await notifyOwner(env,"🎁 НОВЫЙ ОПЛАЧЕННЫЙ ЗАКАЗ С БАЛАНСА\nID: "+orderId+"\nПокупатель: "+telegramId+"\nТовары: "+title+"\nАдрес: "+delivery.address+"\nДистанция: "+delivery.distance_km+" км\nДоставка: "+delivery.delivery_stars+" ⭐"+(priorityDelivery?"\nПриоритет: +100 ⭐":"")+"\nИтого: "+total+" ⭐\nСписано с баланса: "+balanceUsed+" ⭐");
          try{await deliverOrderImages(env,orderId,telegramId);}catch(deliveryError){console.error("Balance-paid order delivery failed:",String(deliveryError).slice(0,300));}
          return json({ok:true,paid:true,order_id:orderId,total_stars:total,balance_used_stars:balanceUsed,delivery_stars:delivery.total_delivery_stars,builder_extra_stars:builderExtraTotal,distance_km:delivery.distance_km},200,origin);
        }
        const invoiceAmount=total-balanceUsed;
        try{
          const invoiceUrl=await createPaymentIntent(env,{payload:orderId,telegram_id:telegramId,kind:"order",reference_id:orderId,amount_stars:invoiceAmount,title:"Заказ "+orderId.slice(0,8),description:title+". Доставка "+delivery.total_delivery_stars+" ⭐; списание с баланса "+balanceUsed+" ⭐."});
          return json({ok:true,invoice_url:invoiceUrl,order_id:orderId,total_stars:total,balance_used_stars:balanceUsed,invoice_amount_stars:invoiceAmount,delivery_stars:delivery.total_delivery_stars,builder_extra_stars:builderExtraTotal,distance_km:delivery.distance_km},200,origin);
        }catch(error){
          await cancelPendingOrderAndRefund(env,orderId,telegramId);
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
        const activeVip = await env.DB.prepare("SELECT id FROM vip_subscriptions WHERE telegram_id=? AND status='active' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) LIMIT 1").bind(telegramId).first();
        if (activeVip) return json({ error: "У вас уже действует VIP-подписка." }, 409, origin);
        const pendingVipRows = await env.DB.prepare("SELECT payload,plan_type,amount_stars FROM payment_intents WHERE telegram_id=? AND kind='vip' AND status='pending' ORDER BY created_at DESC").bind(telegramId).all();
        for (const pendingVip of (pendingVipRows.results || [])) {
          const fullPrice = Number(VIP_PRICES[pendingVip.plan_type] || 0);
          const refund = Math.max(0,fullPrice-Number(pendingVip.amount_stars||0));
          await env.DB.batch([
            env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND telegram_id=? AND kind='vip' AND status='pending'").bind(pendingVip.payload,telegramId),
            env.DB.prepare("INSERT OR IGNORE INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'vip_refund',?,? WHERE changes()=1 AND ?>0").bind(telegramId,refund,"Возврат внутреннего баланса за устаревший счёт VIP","vip-refund:"+pendingVip.payload,refund),
            env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND changes()=1").bind(refund,telegramId)
          ]);
        }
        const current = await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(telegramId).first();
        const balanceUsed = Math.min(amount,Math.max(0,Number(current?.balance_stars||0)));
        if(balanceUsed>0){
          const debit=await env.DB.batch([
            env.DB.prepare("UPDATE users SET balance_stars=balance_stars-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance_stars>=?").bind(balanceUsed,telegramId,balanceUsed),
            env.DB.prepare("INSERT INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'vip_payment',?,? WHERE changes()=1").bind(telegramId,-balanceUsed,"Оплата VIP "+planType,"vip-payment:"+telegramId+":"+makeId())
          ]);
          if(debit[0]?.meta?.changes!==1)return json({error:"Баланс изменился. Обновите страницу."},409,origin);
        }
        const remainder=amount-balanceUsed;
        if(remainder===0){
          await env.DB.prepare("INSERT INTO vip_subscriptions (telegram_id,plan_type,status,starts_at,expires_at) VALUES (?,?,'active',CURRENT_TIMESTAMP,CASE WHEN ?='subscription' THEN datetime(CURRENT_TIMESTAMP,'+30 days') ELSE NULL END)").bind(telegramId,planType,planType).run();
          await notifyOwner(env,"VIP оформлен с внутреннего баланса. Пользователь: "+telegramId+". Списано: "+balanceUsed+" Stars.");
          return json({ok:true,paid:true,balance_used_stars:balanceUsed,plan_type:planType},200,origin);
        }
        const payload = "vip:" + telegramId + ":" + makeId();
        try{
          const invoiceUrl=await createPaymentIntent(env,{payload,telegram_id:telegramId,kind:"vip",plan_type:planType,amount_stars:remainder,title:planType==="lifetime"?"VIP навсегда":"VIP на месяц",description:"Остаток VIP после баланса: "+remainder+" Stars"});
          return json({ok:true,invoice_url:invoiceUrl,payload,plan_type:planType,balance_used_stars:balanceUsed,invoice_amount_stars:remainder},200,origin);
        }catch(error){
          if(balanceUsed>0)await env.DB.batch([
            env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?").bind(balanceUsed,telegramId),
            env.DB.prepare("INSERT INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) VALUES (?,?,'vip_refund',?,?)").bind(telegramId,balanceUsed,"Возврат: не удалось создать счёт VIP","vip-refund:"+payload)
          ]);
          throw error;
        }
      }

      if (path === "/api/vip/cancel" && method === "POST") {
        const body = await readJson(request);
        const payload = typeof body.payload === "string" ? body.payload.trim().slice(0,160) : "";
        if (!payload) return json({ error: "Не найден идентификатор счёта VIP." }, 400, origin);
        const intent = await env.DB.prepare("SELECT plan_type,amount_stars FROM payment_intents WHERE payload=? AND telegram_id=? AND kind='vip' AND status='pending'").bind(payload,telegramId).first();
        if (!intent) return json({ ok:true, refunded:false, message:"Счёт уже обработан или отменён." },200,origin);
        const fullPrice = Number(VIP_PRICES[intent.plan_type] || 0);
        const refund = Math.max(0,fullPrice-Number(intent.amount_stars||0));
        const results = await env.DB.batch([
          env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND telegram_id=? AND kind='vip' AND status='pending'").bind(payload,telegramId),
          env.DB.prepare("INSERT OR IGNORE INTO balance_transactions (telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'vip_refund',?,? WHERE changes()=1 AND ?>0").bind(telegramId,refund,"Возврат внутреннего баланса за отменённый счёт VIP","vip-refund:"+payload,refund),
          env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND changes()=1").bind(refund,telegramId)
        ]);
        if (!results[0]?.meta || results[0].meta.changes !== 1) return json({ ok:true, refunded:false },200,origin);
        return json({ ok:true, refunded:refund>0, refunded_stars:refund },200,origin);
      }

      if (path === "/api/craft/create" && method === "POST") {
        const b=await readJson(request),messages=Array.isArray(b.messages)?b.messages.slice(-34):[];
        if(!messages.length||messages.length>34||messages.some(m=>!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>7000))return json({error:"Диалог пустой или содержит некорректные сообщения."},400,origin);
        if(messages[messages.length-1].role!=="user")return json({error:"Сначала отправьте свой ответ."},400,origin);
        try{
          const result=await createCraftAnswer(env,messages);
          let draftId=null,estimatedStars=0;
          if(result.ready){
            draftId=String(b.conversation_id||"");
            if(!/^[0-9a-f-]{30,40}$/i.test(draftId))draftId=makeId();
            const existing=await env.DB.prepare("SELECT id,telegram_id,status FROM ai_order_drafts WHERE id=?").bind(draftId).first();
            if(existing&&String(existing.telegram_id)!==String(telegramId))return json({error:"Не удалось сохранить диалог мастерской."},409,origin);
            if(!existing){
              const estimate=await estimateCustomOrderPrice(env,{source:"miniapp_workshop",conversation:messages,proposal:result.reply},250);
              estimatedStars=estimate.price_stars;
              const firstRequest=messages.find(m=>m.role==="user")?.content||"Индивидуальная работа";
              const subject=String(firstRequest).replace(/\s+/g," ").trim().slice(0,120)||"Индивидуальная работа";
              const details={source:"miniapp_workshop",summary:String(result.reply||"").slice(0,2000),conversation:messages.slice(-16).map(m=>({role:m.role,content:String(m.content||"").slice(0,350)})),owner_messages:[],estimate_note:String(estimate.note||"").slice(0,180)};
              await env.DB.prepare("INSERT INTO ai_order_drafts(id,chat_id,telegram_id,username,first_name,subject,details_json,estimated_stars,status) VALUES(?,?,?,?,?,?,?,?, 'review')")
                .bind(draftId,String(telegramId),String(telegramId),user.username||null,user.first_name||null,subject,JSON.stringify(details),estimatedStars).run();
              await notifyOwner(env,"🧵 НОВЫЙ ЗАПРОС ИЗ ИИ-МАСТЕРСКОЙ\nID: "+draftId+"\nКлиент: "+(user.first_name||"Покупатель")+(user.username?" (@"+user.username+")":"")+"\nTelegram ID: "+telegramId+"\n\n"+result.reply.slice(0,2600)+"\n\nПредварительная оценка ИИ: "+estimatedStars+" ⭐\nОткройте Админ-панель → ИИ-заказы, чтобы изменить цену, ответить клиенту и подтвердить заказ.");
            } else {
              draftId=existing.id;
              const row=await env.DB.prepare("SELECT estimated_stars FROM ai_order_drafts WHERE id=?").bind(draftId).first();
              estimatedStars=Number(row?.estimated_stars||0);
            }
          }
          return json({ok:true,reply:result.reply,ready:result.ready,questions_used:result.questions_used,draft_id:draftId,estimated_stars:estimatedStars},200,origin);
        }catch(e){console.error("Craft assistant failed:",String(e));return json({error:e.message||"Не удалось продолжить диалог мастерской."},503,origin);}
      }
      if (path === "/api/craft/messages" && method === "GET") {
        const draftId=String(url.searchParams.get("draft_id")||"").slice(0,80);
        const draft=await env.DB.prepare("SELECT telegram_id,details_json,status FROM ai_order_drafts WHERE id=? AND telegram_id=? AND status IN ('review','approved','paid')").bind(draftId,String(telegramId)).first();
        if(!draft)return json({error:"Диалог мастерской не найден."},404,origin);
        let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
        if(details.source!=="miniapp_workshop")return json({error:"Это не диалог ИИ-мастерской."},404,origin);
        return json({ok:true,messages:Array.isArray(details.owner_messages)?details.owner_messages:[],conversation:Array.isArray(details.conversation)?details.conversation:[],status:draft.status,subject:draft.subject,estimated_stars:draft.estimated_stars,approved_stars:draft.approved_stars},200,origin);
      }
      if (path === "/api/craft/messages" && method === "POST") {
        const b=await readJson(request),draftId=String(b.draft_id||"").slice(0,80),message=typeof b.message==="string"?b.message.trim().slice(0,1500):"";
        if(!draftId||!message)return json({error:"Введите сообщение для мастера."},400,origin);
        const draft=await env.DB.prepare("SELECT telegram_id,details_json,status FROM ai_order_drafts WHERE id=? AND telegram_id=? AND status IN ('review','approved','paid')").bind(draftId,String(telegramId)).first();
        if(!draft)return json({error:"Диалог мастерской не найден."},404,origin);
        let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
        if(details.source!=="miniapp_workshop")return json({error:"Это не диалог ИИ-мастерской."},404,origin);
        details.conversation=Array.isArray(details.conversation)?details.conversation:[];
        details.conversation.push({role:"user",content:message});
        details.conversation=details.conversation.slice(-16);
        details.owner_messages=Array.isArray(details.owner_messages)?details.owner_messages.slice(-8):[];
        await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(details),draftId).run();
        await notifyOwner(env,"💬 Новое сообщение в чате ИИ-мастерской\nЗаказ: "+draftId+"\nПокупатель: "+telegramId+"\n\n"+message+"\n\nОтветьте покупателю в Админ-панели → ИИ-заказы.");
        return json({ok:true,conversation:details.conversation},200,origin);
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
        const rows = await env.DB.prepare("SELECT role,content FROM support_chat_messages WHERE telegram_id=? ORDER BY id DESC LIMIT 34")
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
      await writeSystemError(env,error,new URL(request.url).pathname);
      return json({ error: "Внутренняя ошибка сервера. Попробуйте позже." }, 500, origin);
    }
  }
};