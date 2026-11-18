import { workersAiFetch, workersAiTranscribe, AGENCY_TEXT_MODEL, AGENCY_VISION_MODEL } from "./workers-ai-client.js";
const DEFAULT_AI_SETTINGS = {
  enabled: true,
  moderation_enabled: true,
  complaints_enabled: true,
  night_mode: true,
  night_whitelist: "",
  night_start: "23:00",
  night_end: "07:00",
  greeting_enabled: true,
  greeting_text: "🎁 Добро пожаловать в «Агентство подарков», {name}! Рады видеть Вас в нашей группе. Здесь можно спокойно обсудить подарки, задать вопросы и получить помощь.",
  rules_enabled: true,
  rules_text: "📌 Правила группы «Агентство подарков»\n\n1. Общайтесь уважительно. Оскорбления, травля и грубость запрещены.\n2. Не размещайте спам, массовую рассылку и рекламу без разрешения владельца.\n3. Не публикуйте мошеннические, фишинговые и азартные ссылки.\n4. Не отправляйте личные данные, пароли и коды.\n5. Не выдавайте предположения за официальные цены, сроки или решения Агентства.\n6. По вопросам заказов, оплаты и каталога обращайтесь к ИИ-помощнику или владельцу.\n7. Жалобы рассматриваются владельцем; жалоба сама по себе не доказывает нарушение.",
  moderation_instructions: "Вы — ИИ-модератор официальной группы «Агентство подарков». Следуйте этим правилам:\n1. Наказывайте только за очевидное нарушение, а при сомнении выбирайте ручную проверку.\n2. Отличайте дружескую шутку, цитату и обычное несогласие от целевого оскорбления или травли.\n3. Не считайте обычные ссылки, упоминания других проектов или нейтральные слова рекламой без явного рекламного призыва.\n4. Запрещайте азартные, мошеннические и фишинговые ссылки; не объявляйте безопасную ссылку опасной без оснований.\n5. Учитывайте контекст переписки и не делайте вывод по одному неоднозначному слову.\n6. Жалоба — повод проверить ситуацию, а не доказательство вины. Не наказывайте человека только из-за жалобы.\n7. Не раскрывайте участникам скрытое наблюдение и внутренние оценки.\n8. При невозможности проверить файл или медиа уведомляйте владельца; не назначайте наказание автоматически.\n9. Всегда фиксируйте точную понятную причину предупреждения.\n10. Не вмешивайтесь в обычные доброжелательные разговоры, не относящиеся к Агентству, если не требуется модерация.",
  ai_instructions: "Вы — официальный ИИ-помощник «Агентства подарков». Всегда обращайтесь к клиентам на «Вы». Отвечайте только по вопросам Агентства, каталога, заказов, оплаты и поддержки. Используйте только реальные данные каталога и переписки; не придумывайте цены, наличие, сроки и статусы. Если ответа нет — честно скажите об этом и передайте вопрос владельцу. Предлагайте только семантически подходящие товары. Не превращайте обычную беседу в рекламу.",
  profanity_rules: "Проверяйте явную нецензурную лексику и адресные оскорбления. Не наказывайте за нейтральное цитирование или обсуждение правил.",
  spam_rules: "Считайте спамом массовые повторы, навязчивые сообщения и одинаковые сообщения подряд. Не считайте обычную активную беседу спамом.",
  advertising_rules: "Удаляйте явную рекламу сторонних услуг, каналов и товаров без разрешения. Не считайте упоминание другого бренда само по себе рекламой.",
  links_rules: "Блокируйте казино, азартные игры, фишинг, мошенничество и вредоносные ссылки. Обычные безопасные ссылки разрешены.",
  repeated_rules: "Проверяйте именно повтор одинакового текста и флуд, а не короткие ответы вроде «да» или «спасибо».",
  media_rules: "Проверяйте только доступные Telegram данные. Если файл нельзя безопасно проверить, отправьте владельцу уведомление и не назначайте автоматическое наказание.",
  complaints_rules: "Жалоба не доказывает вину. Записывайте автора, адресата и контекст; скрытое наблюдение не раскрывайте.",
  night_rules: "С 23:00 до 07:00 по Екатеринбургу тщательнее проверяйте агрессивные сообщения, но не запрещайте обычные спокойные разговоры.",
  ai_orders_rules: "Не предлагайте клиенту оформить или создать заказ и не подталкивайте к покупке. Помогайте с ориентацией, каталогом и идеями. Начинайте сбор заказа только после ясной прямой просьбы самого клиента оформить или заказать.",
  profanity: true,
  spam: true,
  advertising: true,
  suspicious_links: true,
  repeated_messages: true,
  media_checks: true,
  ai_answers: true,
  ai_orders: true,
  companion_mode: false,
  companion_tone: "friendly",
  global_tone: "respectful",
  owner_suggestions: true,
  punishment_default: "warning",
  punishment_profanity: "warning",
  punishment_spam: "warning",
  punishment_advertising: "warning",
  punishment_suspicious_links: "warning",
  punishment_repeated_messages: "warning",
  punishment_media: "warning",
  warnings_before_restriction: 2,
  warning_active_days: 20,
  warning_history_days: 60,
  warning_escalation_action: "restriction",
  mute_duration_minutes: 60,
  restriction_duration_hours: 24,
  answer_interval_seconds: 5
};

function aiJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
async function aiReadJson(request) { try { return await request.json(); } catch { return {}; } }
async function aiTelegram(env, method, body) {
  const response = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.description || ("Telegram " + method + " failed"));
  return data.result;
}
async function aiAdminNotification(env,type,title,body,referenceId=null){
  try{await env.DB.prepare("INSERT INTO admin_notifications(type,title,body,reference_id) VALUES(?,?,?,?)").bind(String(type).slice(0,60),String(title).slice(0,180),String(body||"").slice(0,3000),referenceId?String(referenceId).slice(0,120):null).run();}
  catch(error){console.error("AI admin notification failed",String(error).slice(0,200));}
}
async function aiNotifyOwner(env, text) {
  const message=String(text).slice(0,3900);
  try{
    const title=message.split("\n")[0].slice(0,180)||"Уведомление ИИ-модератора";
    await env.DB.prepare("INSERT INTO admin_notifications(type,title,body,reference_id) VALUES('ai_moderator',?,?,NULL)").bind(title,message.slice(0,3000)).run();
  }catch(error){console.error("AI Mini App notification failed",String(error).slice(0,200));}
  if (!env.ADMIN_TELEGRAM_ID) return;
  try { await aiTelegram(env, "sendMessage", { chat_id: String(env.ADMIN_TELEGRAM_ID), text: message }); }
  catch (error) { console.error("AI moderator owner notification failed", String(error).slice(0,300)); }
}
async function aiLog(env, event) {
  try {
    await env.DB.prepare("INSERT INTO ai_moderation_events(chat_id,actor_telegram_id,target_telegram_id,event_type,severity,details_json) VALUES(?,?,?,?,?,?)")
      .bind(event.chat_id ? String(event.chat_id) : null, event.actor ? String(event.actor) : null,
        event.target ? String(event.target) : null, String(event.type || "event"),
        String(event.severity || "info"), JSON.stringify(event.details || {}).slice(0,5000)).run();
  } catch (error) { console.error("AI moderator log failed", String(error).slice(0,250)); }
}
async function aiSettings(env) {
  const row = await env.DB.prepare("SELECT enabled,complaints_enabled,settings_json,group_chat_id FROM ai_moderator_settings WHERE id=1").first();
  const pause=await env.DB.prepare("SELECT value FROM ai_runtime_state WHERE key='moderation_disabled_until'").first();
  const moderationTemporarilyDisabled=!!pause?.value && Date.parse(pause.value.replace(" ","T")+"Z")>Date.now();
  let saved = {};
  try { saved = JSON.parse(row?.settings_json || "{}"); } catch {}
  const configuredEnabled=row ? row.enabled===1 : true;
  return { ...DEFAULT_AI_SETTINGS, ...saved, enabled: configuredEnabled, configured_enabled:configuredEnabled,
    moderation_temporarily_disabled: moderationTemporarilyDisabled, moderation_disabled_until: pause?.value || null,
    complaints_enabled: row ? row.complaints_enabled === 1 : true, group_chat_id: row?.group_chat_id || null,
    night_whitelist: String(env.ADMIN_TELEGRAM_ID || saved.night_whitelist || "") };
}
async function aiSaveSettings(env, settings, actor) {
  const allowed = Object.keys(DEFAULT_AI_SETTINGS);
  const current = await aiSettings(env);
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(settings || {}, key)) {
    const value = settings[key];
    if (typeof DEFAULT_AI_SETTINGS[key] === "boolean") current[key] = value === true;
    else if (key === "answer_interval_seconds") current[key] = Math.max(5, Math.min(60, Number(value) || 5));
    else if (key === "global_tone") current[key] = ["friendly","respectful","promotional","creative"].includes(String(value)) ? String(value) : current[key];
    else if (key === "companion_tone") current[key] = ["friendly","respectful","promotional"].includes(String(value)) ? String(value) : current[key];
    else if (["warnings_before_restriction","warning_active_days","warning_history_days","mute_duration_minutes","restriction_duration_hours"].includes(key)) {
      const limits={warnings_before_restriction:[1,20],warning_active_days:[1,365],warning_history_days:[1,730],mute_duration_minutes:[1,10080],restriction_duration_hours:[1,8760]};
      const [min,max]=limits[key],number=Number(value);
      if(Number.isFinite(number))current[key]=Math.max(min,Math.min(max,Math.round(number)));
    }
    else if (key.startsWith("punishment_") || key === "warning_escalation_action") current[key] = ["warning","mute","restriction"].includes(String(value)) ? String(value) : current[key];
    else if (key === "night_start" || key === "night_end") current[key] = /^\d{2}:\d{2}$/.test(String(value)) ? String(value) : current[key];
    else if (typeof DEFAULT_AI_SETTINGS[key] === "string") current[key] = String(value ?? "").slice(0, key === "rules_text" ? 3000 : 6000);
  }
  if(Number(settings?.moderation_disabled_minutes)>0){
    const minutes=Math.max(5,Math.min(1440,Number(settings.moderation_disabled_minutes)));
    await env.DB.prepare("INSERT INTO ai_runtime_state(key,value,updated_at) VALUES('moderation_disabled_until',datetime('now',?),CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind("+"+minutes+" minutes").run();
  }
  if(settings?.resume_moderation===true)await env.DB.prepare("DELETE FROM ai_runtime_state WHERE key='moderation_disabled_until'").run();
  const enabled = (Object.prototype.hasOwnProperty.call(settings||{},"enabled") ? settings.enabled===true : current.configured_enabled) ? 1 : 0;
  const complaints = current.complaints_enabled ? 1 : 0;
  const stored = Object.fromEntries(allowed.map(key => [key, current[key]]));
  await env.DB.prepare("UPDATE ai_moderator_settings SET enabled=?,complaints_enabled=?,settings_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=1")
    .bind(enabled, complaints, JSON.stringify(stored), String(actor)).run();
  return current;
}
function aiIsGroup(chat) { return !!chat && (chat.type === "group" || chat.type === "supergroup"); }
function aiNightNow(settings = {}) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yekaterinburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const time = Number((parts.find(p => p.type === "hour")?.value || "0") + (parts.find(p => p.type === "minute")?.value || "0"));
  const start = Number(String(settings.night_start || "23:00").replace(":",""));
  const end = Number(String(settings.night_end || "07:00").replace(":",""));
  if(start===end)return false;
  return start>end ? time>=start || time<end : time>=start && time<end;
}
function aiText(message) { return String(message?.text || message?.caption || "").trim(); }
function aiSafeName(user) { return [user?.first_name,user?.last_name].filter(Boolean).join(" ").slice(0,100) || "Участник"; }
async function aiRememberMember(env, chatId, user) {
  if (!user?.id || user.is_bot) return;
  await env.DB.prepare("INSERT INTO users(telegram_id,username,first_name) VALUES(?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,updated_at=CURRENT_TIMESTAMP").bind(String(user.id),user.username||null,user.first_name||null).run();
  await env.DB.prepare("INSERT INTO ai_group_members(chat_id,telegram_id,username,first_name,last_name,last_seen_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(chat_id,telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,last_seen_at=CURRENT_TIMESTAMP")
    .bind(String(chatId),String(user.id),user.username || null,user.first_name || null,user.last_name || null).run();
}
async function aiWatch(env, chatId, targetId, reason, source = "system") {
  const active = await env.DB.prepare("SELECT id,expires_at FROM ai_watchlist WHERE chat_id=? AND telegram_id=? AND status='active' AND expires_at>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1")
    .bind(String(chatId),String(targetId)).first();
  if (active) {
    await env.DB.prepare("UPDATE ai_watchlist SET expires_at=datetime('now','+24 hours'),extended_count=extended_count+1,reason=?,source=? WHERE id=?")
      .bind(String(reason).slice(0,500),source,active.id).run();
    await aiLog(env,{chat_id:chatId,target:targetId,type:"watch_extended",details:{reason,source}});
  } else {
    await env.DB.prepare("INSERT INTO ai_watchlist(chat_id,telegram_id,reason,source,expires_at) VALUES(?,?,?,?,datetime('now','+24 hours'))")
      .bind(String(chatId),String(targetId),String(reason).slice(0,500),source).run();
    await aiLog(env,{chat_id:chatId,target:targetId,type:"watch_started",details:{reason,source}});
  }
}
function aiCategoryFromReason(reason) {
  const text=String(reason||"").toLowerCase();
  if(/оскорб|нецензур|агрессив|бран|мат/.test(text))return "profanity";
  if(/реклам/.test(text))return "advertising";
  if(/ссылк|казино|азарт|фишинг|мошенн|вредонос/.test(text))return "suspicious_links";
  if(/повтор|флуд|спам|частая отправка/.test(text))return /повтор/.test(text)?"repeated_messages":"spam";
  if(/изображ|вложен|медиа|файл|картин/.test(text))return "media";
  return "default";
}
async function aiApplyRestriction(env,chatId,userId,mode,settings,reason) {
  const minutes=mode==="mute"?Number(settings.mute_duration_minutes||60):Number(settings.restriction_duration_hours||24)*60;
  const until=Math.floor(Date.now()/1000)+Math.max(1,minutes)*60;
  const permissions=mode==="mute"
    ? {can_send_messages:false,can_send_audios:true,can_send_documents:true,can_send_photos:true,can_send_videos:true,can_send_video_notes:true,can_send_voice_notes:true,can_send_polls:true,can_send_other_messages:true,can_add_web_page_previews:true,can_change_info:false,can_invite_users:false,can_pin_messages:false}
    : {can_send_messages:false,can_send_audios:false,can_send_documents:false,can_send_photos:false,can_send_videos:false,can_send_video_notes:false,can_send_voice_notes:false,can_send_polls:false,can_send_other_messages:false,can_add_web_page_previews:false,can_change_info:false,can_invite_users:false,can_pin_messages:false};
  await aiTelegram(env,"restrictChatMember",{chat_id:chatId,user_id:Number(userId),until_date:until,permissions});
  await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:userId,type:mode==="mute"?"mute":"restriction",severity:"warning",details:{minutes,reason}});
  return minutes;
}
async function aiWarn(env, chatId, message, reason, category = "default") {
  const target=String(message.from.id),settings=await aiSettings(env);
  const normalizedCategory=category==="manual"?"default":category;
  const selected=settings["punishment_"+normalizedCategory]||settings.punishment_default||"warning";
  const action=category==="manual"?"warning":selected;
  const active=await env.DB.prepare("SELECT COUNT(*) AS total FROM ai_warnings WHERE telegram_id=? AND chat_id=? AND cancelled_at IS NULL AND active_until>CURRENT_TIMESTAMP")
    .bind(target,String(chatId)).first();
  const before=Number(active?.total||0);
  let warningCount=before,restrictionMinutes=0,effectiveAction=action;
  if(action==="warning"){
    await env.DB.prepare("INSERT INTO ai_warnings(chat_id,telegram_id,reason,source_message_id,active_until) VALUES(?,?,?,?,datetime('now',?))")
      .bind(String(chatId),target,String(reason).slice(0,500),message.message_id||null,"+"+Number(settings.warning_active_days||20)+" days").run();
    warningCount=before+1;
    if(warningCount>=Number(settings.warnings_before_restriction||2))effectiveAction=settings.warning_escalation_action||"restriction";
  }
  try {
    if(effectiveAction==="mute"||effectiveAction==="restriction"){const escalationSteps=action==="warning"&&effectiveAction==="restriction"?Math.max(1,warningCount-Number(settings.warnings_before_restriction||2)+1):1;const durationSettings={...settings,restriction_duration_hours:Math.min(8760,Number(settings.restriction_duration_hours||24)*escalationSteps)};restrictionMinutes=await aiApplyRestriction(env,chatId,target,effectiveAction,durationSettings,reason);}
  }catch(error){
    await aiNotifyOwner(env,"⚠️ Не удалось применить наказание к участнику "+target+". Проверьте права бота в группе.\nПричина: "+String(error).slice(0,300));
  }
  if(message.message_id)try{await aiTelegram(env,"deleteMessage",{chat_id:chatId,message_id:message.message_id});}catch{}
  const durationText=effectiveAction==="mute"?"Мут на "+restrictionMinutes+" мин.":effectiveAction==="restriction"?"Ограничение всех сообщений на "+Math.ceil(restrictionMinutes/60)+" ч.":"";
  const notice=action==="warning"?"⚠️ Предупреждение "+warningCount+". Причина: "+reason+(durationText?"\nДополнительно: "+durationText:""):"⛔ "+durationText+" Причина: "+reason;
  try{await aiTelegram(env,"sendMessage",{chat_id:chatId,text:notice,...(message.message_id?{reply_to_message_id:message.message_id,allow_sending_without_reply:true}:{})});}catch{}
  if(action==="warning")await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target,type:"warning",severity:"warning",details:{reason,warning_number:warningCount,effective_action:effectiveAction,restriction_minutes:restrictionMinutes}});
  await aiNotifyOwner(env,"⚠️ Нарушение в группе\nУчастник: "+aiSafeName(message.from)+" ("+target+")\nКатегория: "+normalizedCategory+"\nДействие: "+effectiveAction+"\n"+(action==="warning"?"Предупреждение: "+warningCount+" из "+settings.warnings_before_restriction+"\n":"")+(durationText?"Срок: "+durationText+"\n":"")+"Причина: "+reason);
  await aiCalmReminder(env,chatId);
}
async function aiCalmReminder(env,chatId){
  const recent=await env.DB.prepare("SELECT id FROM ai_moderation_events WHERE chat_id=? AND event_type='calm_reminder' AND created_at>=datetime('now','-15 minutes') LIMIT 1").bind(String(chatId)).first();
  if(recent)return;
  await aiTelegram(env,"sendMessage",{chat_id:chatId,text:"Пожалуйста, сохраняйте уважительный тон и спокойное общение. Спасибо за понимание."});
  await aiLog(env,{chat_id:chatId,actor:"ai_moderator",type:"calm_reminder"});
}
function aiClassifyLocal(message, settings) {
  const text = aiText(message).toLowerCase().replace(/ё/g,"е");
  const tokens=text.split(/[^а-яa-z]+/).filter(Boolean);
  const bad=[/бля(?:д|т)/,/су(?:к|ч)а/,/хуй/,/хуе/,/хуя/,/хуи/,/пизд/,/^еб/,/ебл/,/ебн/,/мудак/,/гандон/,/долбоеб/,/уеб/,/мразь/,/идиот/,/дурак/,/тупой/,/заткнись/,/^fuck$/i,/^shit$/i];
  if (settings.profanity && tokens.some(token=>bad.some(pattern=>pattern.test(token)))) return "Нецензурная или оскорбительная лексика";
  if(settings.profanity && settings.night_mode && aiNightNow(settings) && /(идиот|дурак|тупой|заткнись|отвали|пошел ты|пошла ты)/i.test(text))return "Агрессивное обращение в ночное время";
  const urls = [...text.matchAll(/https?:\/\/[^\s]+|t\.me\/[^\s]+|www\.[^\s]+/gi)].map(m=>m[0]);
  for(const entity of [...(message.entities||[]),...(message.caption_entities||[])])if(entity.type==="text_link"&&entity.url)urls.push(String(entity.url));
  if (settings.advertising && (/(куплю|продам|подписывай|реклама|заходи в канал|мой канал|промокод|заработок|инвестици|скидка только|покупайте у меня|заказывайте у меня|переходите по ссылке)/i.test(text))) return "Реклама без разрешения";
  return null;
}
async function aiIsFlood(env,chatId,userId,settings={}){
  const row=await env.DB.prepare("SELECT COUNT(*) AS total FROM ai_group_messages WHERE chat_id=? AND telegram_id=? AND role='user' AND created_at>=datetime('now','-10 seconds')").bind(String(chatId),String(userId)).first();
  const limit=aiNightNow(settings)?3:5;
  return Number(row?.total||0)>=limit;
}
async function aiIsRepeated(env, chatId, userId, text) {
  const recent = await env.DB.prepare("SELECT content,created_at FROM ai_group_messages WHERE chat_id=? AND telegram_id=? AND role='user' ORDER BY id DESC LIMIT 4")
    .bind(String(chatId),String(userId)).all();
  const same = (recent.results || []).filter(row=>row.content===text).length;
  return same >= 2;
}
async function aiGenerateText(env, instructions, input, tokens = 350) {
  if (!env.AI) throw new Error("Workers AI binding AI is not configured");
  const response = await workersAiFetch(env,{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:AGENCY_TEXT_MODEL,instructions,input,max_output_tokens:tokens})});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const providerError=data?.error||{};
    const error=new Error("Workers AI HTTP "+response.status+(providerError.code?" ("+String(providerError.code).slice(0,80)+")":""));
    error.status=response.status;
    error.code=String(providerError.code||"").slice(0,100);
    error.type=String(providerError.type||"").slice(0,100);
    error.providerMessage=String(providerError.message||"").slice(0,300);
    error.retryAfter=response.headers.get("retry-after")
      || response.headers.get("x-ratelimit-reset-requests")
      || response.headers.get("x-ratelimit-reset-tokens")
      || null;
    error.requestId=response.headers.get("x-request-id")||null;
    throw error;
  }
  let output = typeof data.output_text==="string" ? data.output_text : "";
  if (!output && Array.isArray(data.output)) output=data.output.flatMap(item=>Array.isArray(item.content)?item.content:[]).filter(item=>item.type==="output_text").map(item=>item.text||"").join("\n");
  if (!output.trim()) throw new Error("Empty Workers AI response");
  return output.trim().slice(0,3500);
}
async function aiEstimateGroupOrderPrice(env,summary){
  const instructions=[
    "Ты оцениваешь предварительную стоимость индивидуальной handmade-работы для Агентства подарков.",
    "Оцени трудоёмкость, сложность, количество и объём персонализации по описанию заказа. Обычные небольшие и средние работы оценивай от 280 до 450 Stars; 500–650 — только для сложных и трудоёмких; 700–800 — исключительно редко для очень больших или многосоставных работ. Не завышай цену.",
    "Верни только JSON: {\"price_stars\": целое число от 280 до 800, \"note\": \"короткое объяснение до 160 символов\"}.",
    "Это только предварительная оценка для владельца. Не утверждай, что цена окончательная, и не обещай сроки.",
    "Не придумывай дополнительные материалы или услуги, которых нет в описании."
  ].join("\n");
  const raw=await aiGenerateText(env,instructions,[{role:"user",content:String(summary||"").slice(0,3000)}],180);
  const match=raw.match(/\{[\s\S]*\}/);
  if(!match)throw new Error("ИИ не вернул структурированную оценку цены.");
  const parsed=JSON.parse(match[0]);
  const rawPrice=Number(parsed.price_stars);
  if(!Number.isFinite(rawPrice)||rawPrice<1)throw new Error("ИИ вернул недопустимую оценку цены.");
  const price=Math.max(280,Math.min(800,Math.round(rawPrice)));
  return {price_stars:price,note:String(parsed.note||"Предварительная оценка ИИ.").slice(0,160)};
}
async function aiInspectText(env,text,settings){
  const categories=[];
  if(settings.advertising)categories.push("реклама сторонних услуг и каналов");
  if(settings.spam)categories.push("спам и массовая рассылка");
  if(settings.suspicious_links)categories.push("мошеннические, фишинговые и азартные ссылки");
  if(settings.profanity)categories.push("оскорбления и агрессивные выпады");
  const customRules = [
    settings.profanity && settings.profanity_rules ? "Нецензурная лексика: " + settings.profanity_rules : "",
    settings.spam && settings.spam_rules ? "Спам: " + settings.spam_rules : "",
    settings.advertising && settings.advertising_rules ? "Реклама: " + settings.advertising_rules : "",
    settings.suspicious_links && settings.links_rules ? "Ссылки: " + settings.links_rules : "",
    settings.repeated_messages && settings.repeated_rules ? "Повторы: " + settings.repeated_rules : "",
    settings.media_checks && settings.media_rules ? "Медиа: " + settings.media_rules : "",
    settings.complaints_enabled && settings.complaints_rules ? "Жалобы: " + settings.complaints_rules : "",
    settings.night_mode && settings.night_rules ? "Ночной режим: " + settings.night_rules : ""
  ].filter(Boolean).join("\n");
  const prompt="Проверь сообщение Telegram-группы «Агентство подарков» только на следующие включённые категории: "+categories.join(", ")+". Обычные вопросы, обсуждение товаров Агентства, безопасные ссылки и доброжелательное общение разрешены. Не проверяй выключенные категории. Если не уверены, выбирайте review.\nПравила по категориям:\n"+customRules+"\nОбщая инструкция владельца:\n"+String(settings.moderation_instructions||"").slice(0,5000)+"\nВерните JSON с ключами decision, reason и confidence. Значение decision должно быть ok, review или violation. violation ставьте только при очевидном нарушении и уверенности не ниже 0.9.";
  const raw=await aiGenerateText(env,prompt,String(text).slice(0,2500),150);
  const match=raw.match(/\{[\s\S]*\}/);if(!match)throw new Error("Text classifier returned no JSON");
  const parsed=JSON.parse(match[0]);
  return {decision:["ok","review","violation"].includes(parsed.decision)?parsed.decision:"review",reason:String(parsed.reason||"Неоднозначное сообщение").slice(0,250),confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0))};
}
function aiAgencyIntent(text) {
  const value=String(text||"").trim();
  if(!value)return false;
  const aboutAgency=/(агентств|подар|товар|каталог|заказ|заказать|купить|покуп|стоим|цен[аыу]|оплат|stars|старс|баланс|достав|поддержк|акци|скидк|индивидуальн|мини.?апп|приложени|магазин|мастерск|создать своё|иде[яи]|творч|поделк|материал|описан|открытк|рисунок|фото|картин|изображ|покаж|ии|бот|помощник)/i.test(value);
  if(!aboutAgency)return false;
  return /[?？]|(?:^|[\s,!.])(?:что|как|где|когда|сколько|почему|можно|подскаж|объясн|расскаж|помог|хочу|нужно|ищу|интерес|оформ|закаж|купл|оплат|открой|найти|придум|предлож|опис|совет|сдела|нарис|покаж|ии|бот|помощник)/i.test(value);
}
function aiBuildGroupKeyboard(userText, answer, needsOwner=false){
  const combined=(String(userText||"")+"\n"+String(answer||"")).toLowerCase().replace(/ё/g,"е");
  const rows=[];
  const botUrl="https://t.me/Agentstvo_podarkov_bot";
  const supportUrl="https://t.me/Iliya_Mironov_33";
  const add=(buttons)=>{if(rows.length<3)rows.push(buttons);};
  const catalogIntent=/(поделк|издел|товар|подар|каталог|не могу найти|ищу|есть ли|посмотреть|покаж|ассортимент|фото|картин|изображ)/i.test(combined);
  const ideaIntent=/(иде|придум|подобрат|вариант|мастерск|творческ|сделать своими руками|как сделать)/i.test(combined);
  const navigationIntent=/(где кнопк|как открыть|как найти|не вижу|не могу открыть|меню|раздел|мини.?апп|приложени|кнопк|запустить|войти)/i.test(combined);
  const supportIntent=needsOwner || /(поддержк|связаться с владельц|передал вопрос владельц|не могу подтвердить)/i.test(String(answer||"").toLowerCase());
  if(catalogIntent)add([{text:"🎁 Открыть каталог",url:botUrl}]);
  if(ideaIntent)add([{text:"🎨 Подобрать идею",url:botUrl}]);
  if(navigationIntent && !catalogIntent && !ideaIntent)add([{text:"📱 Открыть Агентство",url:botUrl}]);
  if(supportIntent)add([{text:"💬 Связаться с поддержкой",url:supportUrl}]);
  if(!rows.length && /агентств|подар|заказ|оплат|баланс|каталог|товар|поделк/i.test(combined))add([{text:"📱 Открыть Агентство",url:botUrl}]);
  return rows.length?{inline_keyboard:rows}:null;
}
async function aiGroupReply(env,chatId,userId,text,replyToMessageId=null,replyMarkup=null){
  const settings=await aiSettings(env);
  const last=await env.DB.prepare("SELECT created_at FROM ai_group_messages WHERE chat_id=? AND telegram_id=? AND role='assistant' ORDER BY id DESC LIMIT 1").bind(String(chatId),String(userId||"")).first();
  if(last && (Date.now()-Date.parse(last.created_at.replace(" ","T")+"Z"))/1000<Number(settings.answer_interval_seconds||5))return false;
  const payload={chat_id:chatId,text:String(text).slice(0,3500),allow_sending_without_reply:true};
  if(replyToMessageId)payload.reply_to_message_id=Number(replyToMessageId);
  if(replyMarkup?.inline_keyboard?.length)payload.reply_markup=replyMarkup;
  const sent=await aiTelegram(env,"sendMessage",payload);
  await env.DB.prepare("INSERT INTO ai_group_messages(chat_id,message_id,telegram_id,role,content) VALUES(?,?,?,?,?)")
    .bind(String(chatId),Number(sent?.message_id)||null,String(userId||""),"assistant",String(text).slice(0,3500)).run();
  return Number(sent?.message_id)||true;
}
function aiToneInstruction(tone){
  const tones={
    friendly:"Глобальный тон: дружелюбный, живой, тёплый и естественный. Поддерживайте человека, но не фамильярничайте.",
    respectful:"Глобальный тон: уважительный, спокойный и ясный. Общайтесь вежливо, профессионально и без лишней эмоциональности.",
    promotional:"Глобальный тон: мягко-рекламный. Помогайте заметить подходящие идеи и возможности Агентства, но не давите и не превращайте каждый ответ в продажу.",
    creative:"Глобальный тон: творческий и вдохновляющий. Предлагайте необычные идеи, образные варианты и интересные решения, оставаясь точными в фактах."
  };
  return tones[tone]||tones.respectful;
}
async function aiGroupOrderReply(env,chatId,userId,draftId,details,text,replyToMessageId){
  const sent=await aiGroupReply(env,chatId,userId,text,replyToMessageId);
  if(!sent)return false;
  details.conversation=Array.isArray(details.conversation)?details.conversation:[];
  details.conversation.push({role:"assistant",content:String(text).slice(0,1200)});
  details.conversation=details.conversation.slice(-24);
  if(typeof sent==="number"){details.thread_message_ids=Array.isArray(details.thread_message_ids)?details.thread_message_ids:[];details.thread_message_ids.push(sent);details.thread_message_ids=details.thread_message_ids.slice(-30);}
  await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(details),draftId).run();
  return true;
}
function aiOrderAcceptance(message){
 const value=String(message||"").trim().toLowerCase().replace(/ё/g,"е").replace(/[!.,;:]+$/g,"").trim();
 return /^(?:да|ага|угу|согласен(?:на)?|подтверждаю|оформляем|заказываем|беру|подходит|все подходит|мне подходит|мне все подходит|меня устраивает|мне все устраивает|да,?\s*(?:мне\s+)?(?:все\s+)?(?:подходит|устраивает)|да,?\s*давайте\s*(?:оформим|закажем)|да,?\s*оформляем|да,?\s*заказываем)$/i.test(value);
}
async function aiApplyPromoToDraft(env,draftId,telegramId,message,details,estimatedStars=0){
 const raw=String(message||"").trim();
  let match=raw.match(/^(?:промокод|промо[- ]?код|код)\s*[:№-]?\s*([A-Z0-9_-]{3,32})$/i);
  if(!match&&/^[A-Z0-9_-]{3,32}$/i.test(raw)){
    const candidate=raw.toUpperCase();
    const exists=await env.DB.prepare("SELECT 1 AS ok FROM promo_codes WHERE code=?").bind(candidate).first().catch(()=>null);
    if(exists)match=[raw,candidate];
  }
  if(!match)return null;
  const code=String(match[1]).toUpperCase();
 try{
  const promo=await env.DB.prepare("SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active FROM promo_codes WHERE code=?").bind(code).first();
  if(!promo||!promo.is_active)return {ok:false,reply:"Этот промокод не найден или уже отключён. Проверьте написание."};
  const valid=await env.DB.prepare("SELECT 1 AS ok WHERE (? IS NULL OR datetime(?)<=datetime('now')) AND (? IS NULL OR datetime(?)>datetime('now')) AND (? IS NULL OR CAST(? AS INTEGER)+CAST(? AS INTEGER)<CAST(? AS INTEGER))")
   .bind(promo.starts_at,promo.starts_at,promo.ends_at,promo.ends_at,promo.max_uses,promo.reserved_count||0,promo.redeemed_count||0,promo.max_uses).first();
  if(!valid)return {ok:false,reply:"Срок действия промокода закончился или лимит использований уже исчерпан."};
  const columns=await env.DB.prepare("PRAGMA table_info(promo_codes)").all();
  const names=new Set((columns.results||[]).map(x=>x.name));
  if(names.has("product_ids")||names.has("category_ids")){
   const scoped=await env.DB.prepare("SELECT product_ids,category_ids FROM promo_codes WHERE code=?").bind(code).first();
   const productIds=String(scoped?.product_ids||"[]").trim(),categoryIds=String(scoped?.category_ids||"[]").trim();
   if((productIds!=="[]"&&productIds!=="")||(categoryIds!=="[]"&&categoryIds!==""))return {ok:false,reply:"Этот промокод действует только на товары каталога, а не на индивидуальные заказы."};
  }
  details.promo_code=code;details.promo_discount_percent=Number(promo.discount_percent);details.promo_added_at=new Date().toISOString();
  await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND status='collecting'")
   .bind(JSON.stringify(details),String(draftId),String(telegramId)).run();
  const preview=Number(estimatedStars)>0?Math.min(Number(estimatedStars)-1,Math.floor(Number(estimatedStars)*Number(promo.discount_percent)/100)):0;
  return {ok:true,reply:"🎟️ Промокод "+code+" принят: скидка "+Number(promo.discount_percent)+"% будет учтена при подтверждении заказа владельцем."+(preview>0?" По текущей предварительной оценке это примерно −"+preview+" ⭐.":"")};
 }catch(error){
  console.error("AI order promo validation failed:",String(error).slice(0,200));
  return {ok:false,reply:"Сейчас не удалось проверить промокод. Попробуйте ещё раз чуть позже."};
 }
}
async function aiGroupOrderStep(env,chatId,user,text,settings,replyToMessageId,replyToOriginalId=null){
  const lower=String(text||"").toLowerCase().trim();
  const orientationQuestion=/^(?:а\\s+)?(?:как|где|когда|почему|зачем|что|сколько|можно ли|подскажите|расскажите|объясните)\\b/i.test(lower)&&/[?？]/.test(text);
  const recentGroupRows=await env.DB.prepare("SELECT role,content FROM ai_group_messages WHERE chat_id=? AND telegram_id=? ORDER BY id DESC LIMIT 24").bind(String(chatId),String(user.id)).all();
  const recentGroupHistory=(recentGroupRows.results||[]).reverse();
  const askedOrderTopics=new Set();
  for(const item of recentGroupHistory){
    if(item.role!=="assistant")continue;
    const question=String(item.content||"").toLowerCase();
    if(/бюджет|стоимост|цен[уы]|рубл/.test(question))askedOrderTopics.add("budget");
    if(/для кого|получател|кому предназнач|повод/.test(question))askedOrderTopics.add("recipient");
    if(/размер|формат|стил|цвет|гамм/.test(question))askedOrderTopics.add("appearance");
    if(/материал|техник|детализац|подробн|сложност/.test(question))askedOrderTopics.add("craft");
    if(/срок|к какому числу|когда необходим/.test(question))askedOrderTopics.add("deadline");
  }
  const groupUserTurns=recentGroupHistory.filter(item=>item.role==="user"&&String(item.content||"").trim().length>=8);
  const groupCustomerIntent=groupUserTurns.some(item=>/(хочу|нужн|надо|заказать|закаж|сделать|создать|изготовить|мне бы|можно ли сделать)/i.test(String(item.content||""))&&/(картин|подар|открытк|поделк|издел|авторск|работ|рисунок|портрет|макет)/i.test(String(item.content||"")));
  const collectedGroupOrder=askedOrderTopics.size>=3&&groupUserTurns.length>=3&&groupCustomerIntent;
  const directOrderIntent=!orientationQuestion&&/(хочу\\s+(?:оформить|заказать|(?:индивидуальн\\w*\\s+)?(?:картин|подар|открытк|поделк|издел|работ|рисунок))|давайте\\s+(?:оформим|закажем)|оформ(?:ить|ляем)\\s+заказ|можно\\s+(?:оформить|заказать)\\s+сейчас|готов(?:а|о|ы)\\s+оформить|(?:оформи(?:те)?|закажи(?:те)?)\\s+(?:мне\\s+)?(?:этот\\s+)?заказ|мне\\s+(?:нужно|надо)\\s+(?:оформить|заказать)|мне\\s+(?:нужна|нужен|нужно)\\s+(?:индивидуальн\\w*\\s+)?(?:картин|подар|открытк|поделк|издел|работ|рисунок)|я\\s+решил(?:а)?\\s+(?:оформить|заказать)|можно\\s+(?:сделать|изготовить)\\s+(?:мне\\s+)?(?:картин|подар|открытк|поделк|издел|работ|рисунок))/i.test(text)&&!/(не\\s+хочу|не\\s+надо|не\\s+нужно|не\\s+собираюсь)/i.test(text);
  const explicit=directOrderIntent||collectedGroupOrder;
  const navigationIntent=!explicit&&(orientationQuestion||/\\b(?:каталог|меню|корзин\\w*|акци\\w*|магазин|раздел|кнопк\\w*|открыть|перейти|показать)\\b/i.test(lower));
  let active=null;
  let matchedOrderThread=false;
  if(replyToOriginalId){
    const candidates=await env.DB.prepare("SELECT d.id,d.chat_id,d.telegram_id,d.group_message_id,d.subject,d.details_json,d.status,d.estimated_stars,d.approved_stars,d.updated_at,d.last_activity_at,o.paid_at FROM ai_order_drafts d LEFT JOIN orders o ON o.id=d.order_id WHERE d.chat_id=? AND d.telegram_id=? AND d.status IN ('collecting','review','approved','paid') ORDER BY d.updated_at DESC LIMIT 50").bind(String(chatId),String(user.id)).all();
    let linked=null,linkedDetails={};
    for(const candidate of candidates.results||[]){
      let parsed={};try{parsed=JSON.parse(candidate.details_json||"{}");}catch{}
      const ids=Array.isArray(parsed.thread_message_ids)?parsed.thread_message_ids:[];
      if(Number(candidate.group_message_id)===Number(replyToOriginalId)||ids.some(id=>Number(id)===Number(replyToOriginalId))){
        linked=candidate;linkedDetails=parsed;break;
      }
    }
    if(linked&&linkedDetails.chat_deleted===true){
      // Владелец закрыл эту переписку: старый тред больше не обслуживается.
      return true;
    }
    const linkedExpiry=linked?.status==="paid"?(linked.paid_at||linked.updated_at):(linked?.last_activity_at||linked?.updated_at);
    if(linked&&await env.DB.prepare("SELECT 1 AS expired WHERE datetime(?)<=datetime('now','-3 days')").bind(linkedExpiry).first())return true;
    if(!linked&&!explicit){
      // Не прикрепляем ответ на чужое сообщение к заказу, но явное намерение
      // оформить заказ всё равно может начать новый черновик.
      return false;
    }
    if(linked&&navigationIntent)return false;
    if(linked)matchedOrderThread=true;
    if(linked?.status==="collecting"){
      active=linked;
    }else if(linked){
      linkedDetails.conversation=Array.isArray(linkedDetails.conversation)?linkedDetails.conversation:[];
      linkedDetails.conversation.push({role:"user",content:String(text).slice(0,1000)});
      if(linkedDetails.ai_enabled===false){
        linkedDetails.conversation=linkedDetails.conversation.slice(-24);
        await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(linkedDetails),linked.id).run();
        await aiNotifyOwner(env,"💬 Сообщение по групповому заказу (ИИ выключен)\nЗаказ: "+linked.id+"\nКлиент: "+aiSafeName(user)+" ("+user.id+")\n\n"+String(text).slice(0,700)+"\n\nОтветьте вручную в чате этого заказа.");
        return true;
      }
      try{
        const history=linkedDetails.conversation.filter(item=>item&&["user","assistant","owner"].includes(item.role)).slice(-24).map(item=>({role:item.role==="owner"?"assistant":item.role,content:item.content}));
        const context={order_chat:true,order_subject:linked.subject||"Заказ из группы",order_status:linked.status,order_summary:linkedDetails.summary||"",ai_estimate_stars:linked.estimated_stars||null,owner_confirmed_price_stars:linked.approved_stars||null,order_chat_instruction:"Это отдельная переписка только по одному заказу. Не используй и не добавляй сообщения других участников группы. Не меняй цену, статус, оплату или заказ."};
        const answer=await createSupportAnswer(env,history,false,context,[]);
        const sent=await aiGroupReply(env,chatId,user.id,answer,replyToMessageId);
        if(sent){
          linkedDetails.conversation.push({role:"assistant",content:answer});
          linkedDetails.conversation=linkedDetails.conversation.slice(-24);
          if(typeof sent==="number"){
            linkedDetails.thread_message_ids=Array.isArray(linkedDetails.thread_message_ids)?linkedDetails.thread_message_ids:[];
            linkedDetails.thread_message_ids.push(sent);
            linkedDetails.thread_message_ids=linkedDetails.thread_message_ids.slice(-30);
          }
        }
        await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(linkedDetails),linked.id).run();
      }catch(error){
        await aiNotifyOwner(env,"⚠️ ИИ не смог ответить в чате группового заказа "+linked.id+"\n"+String(error).slice(0,180));
      }
      return true;
    }
  }
  if(!active&&!replyToOriginalId&&!explicit&&!navigationIntent){
    const activeRows=await env.DB.prepare("SELECT id,subject,details_json FROM ai_order_drafts WHERE chat_id=? AND telegram_id=? AND status='collecting' AND last_activity_at>=datetime('now','-30 minutes') ORDER BY created_at DESC LIMIT 2").bind(String(chatId),String(user.id)).all();
    const rows=activeRows.results||[];
    if(rows.length>1){
      await aiGroupReply(env,chatId,user.id,"У Вас несколько незавершённых заказов. Чтобы я не перепутал пожелания, пожалуйста, ответьте именно на сообщение в переписке того заказа, который хотите продолжить.",replyToMessageId);
      return true;
    }
    if(rows.length===1)active=rows[0];
  }
  if(active&&!matchedOrderThread&&!navigationIntent&&(/^(?:кстати|другой вопрос|сменим тему|теперь другой вопрос|а теперь|не по теме|давай поговорим|расскажи мне|хочу обсудить|привет|здравствуйте|добрый день|добрый вечер|спасибо|пока|как дела)\b/i.test(lower)||/^(?:а\s+)?(?:как|где|когда|почему|зачем|что|сколько|можно ли|подскажите|расскажите|объясните)\b/i.test(lower)&&/[?？]/.test(text))){
    await env.DB.prepare("UPDATE ai_order_drafts SET status='cancelled',updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(active.id).run();
    await aiLog(env,{chat_id:chatId,actor:user.id,type:"group_order_paused_topic_change",details:{draft_id:active.id}});
    return false;
  }
  if(!active&&!explicit)return false;
  if(!settings.ai_orders){
    await aiGroupReply(env,chatId,user.id,"Я могу помочь сориентироваться по каталогу и возможностям Агентства. Сбор заказов в этой группе сейчас отключён.",replyToMessageId);
    return true;
  }
  let details={};if(active){try{details=JSON.parse(active.details_json||"{}");}catch{}}
  if(!active){
    const id=crypto.randomUUID();
    const historyUsers=recentGroupHistory.filter(item=>item.role==="user");
    const originalIdea=historyUsers.find(item=>/(картин|подар|открытк|поделк|издел|авторск|работ|рисунок|портрет|макет)/i.test(String(item.content||"")))||historyUsers[0]||{content:text};
    const priorDetails=historyUsers.filter(item=>item!==originalIdea).map(item=>String(item.content||"").trim()).filter(Boolean);
    let knownQuantity="";
    for(let i=1;i<recentGroupHistory.length;i++){
      const previous=recentGroupHistory[i-1],current=recentGroupHistory[i];
      if(previous.role==="assistant"&&/сколько|количество/i.test(String(previous.content||""))&&current.role==="user"&&/^(?:\\d+|один|одна|одно|две|два|три|четыре|пять|несколько|одно изделие|одна штука)[.! ]*$/i.test(String(current.content||"").trim()))knownQuantity=String(current.content||"").trim();
    }
    details={source:"group",ai_enabled:true,group_chat_id:String(chatId),
      conversation:collectedGroupOrder?recentGroupHistory.slice(-24).map(item=>({role:item.role,content:String(item.content||"").slice(0,1000)})):[{role:"user",content:String(text).slice(0,1000)}],
      order_fields:collectedGroupOrder?{item:String(originalIdea.content||text).slice(0,700),details:priorDetails.join(" · ").slice(0,1200),quantity:knownQuantity}:{},
      step:collectedGroupOrder?(knownQuantity?"confirm":"quantity"):"item"};
    await env.DB.prepare("INSERT INTO ai_order_drafts(id,chat_id,telegram_id,username,first_name,subject,details_json,estimated_stars,status,group_message_id) VALUES(?,?,?,?,?,?,?,0,'collecting',?)")
      .bind(id,String(chatId),String(user.id),user.username||null,user.first_name||null,String(originalIdea.content||"Заказ из группы").slice(0,120),JSON.stringify(details),replyToMessageId?Number(replyToMessageId):null).run();
    await aiNotifyOwner(env,"🟢 НОВЫЙ ЧЕРНОВИК ИНДИВИДУАЛЬНОГО ЗАКАЗА ИЗ ГРУППЫ\\nID: "+id+"\\nКлиент: "+aiSafeName(user)+" ("+user.id+")\\n\\nПокупатель начал оформление в группе. Счёт недоступен до согласия покупателя и проверки владельцем.");
    const nextQuestion=collectedGroupOrder?(knownQuantity?"Проверьте, пожалуйста, собранные пожелания и количество. Всё ли верно?\\n\\nИзделие: "+details.order_fields.item+"\\nПожелания: "+details.order_fields.details+"\\nКоличество: "+details.order_fields.quantity+"\\n\\nЕсли всё верно, ответьте «Да, всё верно».":"Я сохранил Вашу идею и уже собранные пожелания. Осталось уточнить только количество: сколько таких изделий Вам нужно?"):"Конечно, помогу оформить — спокойно и по шагам 😊\\nЧто именно Вы хотите заказать?";
    await aiGroupOrderReply(env,chatId,user.id,id,details,nextQuestion,replyToMessageId);
    return true;
  }
  details.conversation=Array.isArray(details.conversation)?details.conversation:[];
  if(details.proposal_pending_customer===true&&aiOrderAcceptance(text)){
    details.conversation.push({role:"user",content:String(text).slice(0,1000)});
    details.customer_accepted=true;details.customer_accepted_at=new Date().toISOString();details.proposal_pending_customer=false;
    const acceptedReply="Спасибо! Ваше согласие записано. Я передал заказ владельцу Агентства для проверки и окончательного подтверждения. ✨";
    details.conversation.push({role:"assistant",content:acceptedReply});
    await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,status='review',updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(JSON.stringify(details),active.id).run();
    await aiNotifyOwner(env,"🎁 ПОКУПАТЕЛЬ СОГЛАСИЛСЯ С ПРЕДЛОЖЕНИЕМ ИЗ ГРУППЫ\nID: "+active.id+"\nКлиент: "+aiSafeName(user)+" ("+user.id+")\n\nПроверьте описание и итоговую цену в Mini App → ИИ-заказы.");
    await aiGroupReply(env,chatId,user.id,acceptedReply,replyToMessageId);
    return true;
  }
  const promoResult=await aiApplyPromoToDraft(env,active.id,user.id,text,details,active.estimated_stars||0);
  if(promoResult){
    details.conversation.push({role:"user",content:String(text).slice(0,1000)});
    details.conversation.push({role:"assistant",content:promoResult.reply});
    details.conversation=details.conversation.slice(-24);
    await aiGroupOrderReply(env,chatId,user.id,active.id,details,promoResult.reply,replyToMessageId);
    return true;
  }
  details.conversation.push({role:"user",content:String(text).slice(0,1000)});
  details.order_fields=details.order_fields||{};
  if(details.ai_enabled===false&&!/^(отмена|отменить|передумал|передумала|не надо|стоп)$/i.test(lower)){
    details.conversation=details.conversation.slice(-24);
    await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(JSON.stringify(details),active.id).run();
    await aiNotifyOwner(env,"💬 Сообщение по групповому заказу (ИИ выключен)\nЗаказ: "+active.id+"\nКлиент: "+aiSafeName(user)+" ("+user.id+")\n\n"+String(text).slice(0,700)+"\n\nОтветьте вручную в разделе ИИ-заказы.");
    return true;
  }
  if(/^(отмена|отменить|передумал|передумала|не надо|стоп)$/i.test(lower)){
    await env.DB.prepare("UPDATE ai_order_drafts SET status='cancelled',updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(active.id).run();
    await aiGroupOrderReply(env,chatId,user.id,active.id,details,"Хорошо, сбор заказа остановлен. Если захотите вернуться к идее, я помогу 😊",replyToMessageId);return true;
  }
  if(details.step==="item"){
    details.order_fields.item=String(text).trim().slice(0,700);details.step="details";
    await aiGroupOrderReply(env,chatId,user.id,active.id,details,"Понял! А каким Вы представляете изделие: цвета, стиль, надпись, рисунок или другие важные детали?",replyToMessageId);
  }else if(details.step==="details"){
    details.order_fields.details=String(text).trim().slice(0,1200);details.step="quantity";
    await aiGroupOrderReply(env,chatId,user.id,active.id,details,"Отлично, записал. Сколько таких изделий Вам нужно? Если одно — так и напишите.",replyToMessageId);
  }else if(details.step==="quantity"){
    details.order_fields.quantity=String(text).trim().slice(0,100);details.step="confirm";
    await aiGroupOrderReply(env,chatId,user.id,active.id,details,"Проверьте, пожалуйста, всё ли верно:\n\nИзделие: "+details.order_fields.item+"\nПожелания: "+details.order_fields.details+"\nКоличество: "+details.order_fields.quantity+"\n\nЕсли всё правильно, ответьте «Да, всё верно». Если нужно остановиться — напишите «Отмена».",replyToMessageId);
  }else if(details.step==="confirm"){
    if(/^(да|верно|всё верно|все верно|подтверждаю|да,?\s*всё верно|да,?\s*все верно)[.! ]*$/i.test(lower)){
      const subject=String(details.order_fields.item||"Индивидуальный заказ").slice(0,120);
      details.summary="Изделие: "+details.order_fields.item+". Пожелания: "+details.order_fields.details+". Количество: "+details.order_fields.quantity+".";
      details.step="submitted";
      let estimatedStars=0;
      try{
        const estimate=await aiEstimateGroupOrderPrice(env,details.summary);
        estimatedStars=estimate.price_stars;
        details.estimate_note=estimate.note;
      }catch(error){
        details.estimate_note="ИИ-оценка временно недоступна; цену нужно указать вручную.";
        await aiLog(env,{chat_id:chatId,actor:"ai_order_estimator",target:user.id,type:"group_order_estimate_failed",details:{draft_id:active.id,error:String(error).slice(0,180)}});
      }
      details.estimated_stars=estimatedStars;
      details.proposal_pending_customer=true;details.customer_accepted=false;
      await env.DB.prepare("UPDATE ai_order_drafts SET subject=?,details_json=?,estimated_stars=?,status='collecting',updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(subject,JSON.stringify(details),estimatedStars,active.id).run();
      const estimateNotice=estimatedStars?"\nПредварительная оценка: "+estimatedStars+" ⭐.":"\nВладелец уточнит цену после проверки.";
      const promoNotice=details.promo_code?"\nПромокод "+details.promo_code+" · скидка "+details.promo_discount_percent+"% будет учтена при подтверждении.":"";
      await aiGroupOrderReply(env,chatId,user.id,active.id,details,"Проверьте итоговое предложение:\n\n"+details.summary+estimateNotice+promoNotice+"\n\nЕсли всё подходит, напишите «Да, оформляем». Если хотите изменить детали — напишите, что поправить. Счёт появится только после Вашего согласия и подтверждения владельцем. ✨",replyToMessageId);
      await aiLog(env,{chat_id:chatId,actor:user.id,target:env.ADMIN_TELEGRAM_ID,type:"group_order_proposal_sent",details:{draft_id:active.id}});return true;
    }
    details.step="item";details.order_fields={};
    await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(JSON.stringify(details),active.id).run();
    await aiGroupOrderReply(env,chatId,user.id,active.id,details,"Хорошо, давайте начнём описание заново. Что именно хотите заказать?",replyToMessageId);return true;
  }
  details.conversation=details.conversation.slice(-16);
  await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=? AND status='collecting'").bind(JSON.stringify(details),active.id).run();
  return true;
}
async function aiReplyToGroup(env,chatId,user,text,settings,replyToMessageId=null,replyToOriginalId=null){
  if(await aiGroupOrderStep(env,chatId,user,text,settings,replyToMessageId,replyToOriginalId))return;
  const recent=await env.DB.prepare("SELECT role,content FROM ai_group_messages WHERE chat_id=? AND telegram_id=? ORDER BY id DESC LIMIT 50").bind(String(chatId),String(user.id)).all();
  const context=(recent.results||[]).slice(0,16).reverse();
  const products=await env.DB.prepare("SELECT id,title,description,category,price_stars FROM products WHERE is_active=1 ORDER BY title LIMIT 100").all();
  const catalog=(products.results||[]).map(p=>({id:String(p.id),title:p.title,description:p.description,category:p.category,price_stars:p.price_stars}));
  const instructions=[
    "Вы — ИИ-помощник «Агентства подарков» в общей группе. У каждого участника отдельная переписка и собственный контекст: отвечайте именно этому человеку, не смешивайте вопросы разных участников. Пишите простым текстом без Markdown-разметки и звёздочек. В каждом ответе используйте 1–2 уместных эмодзи, не больше.",
    "В первую очередь помогайте с ориентацией: где кнопки, как открыть Mini App, как найти каталог, как заказать, где баланс и где мастерская. Объясняйте понятными шагами. Сервер сам добавляет подходящие кнопки к ответу: никогда не отказывайтесь от кнопки и не говорите, что не умеете её создать. Если кнопка может не открыться, обязательно объясните словами: откройте @Agentstvo_podarkov_bot, нажмите Start, затем «Открыть Агентство» и выберите нужный раздел.",
    "Помогайте придумать интересную идею для подарка или изделия: задавайте один уместный уточняющий вопрос, предлагайте несколько конкретных идей и описаний. Не требуйте сразу оформить заказ.",
    "Если человек хочет понять, что можно заказать, опирайтесь на реальный каталог и реальные товары. Если подходящей готовой работы нет, можно помочь придумать индивидуальную идею, не обещая, что Агентство уже производит её.",
    "Помощь сделать поделку самостоятельно дома — запасной сценарий. Предлагайте её только если человек прямо просит инструкцию для самостоятельного изготовления либо явно выбирает самостоятельный вариант. Не переводите обычный запрос о товаре в DIY.",
    "Вы можете быть собеседником: поддержать человека, поговорить, отреагировать на его идею или сомнение. Не превращайте дружескую беседу в рекламу или заказ.",
    "В групповой переписке не отправляйте клиента повторно в «Создать своё», если он уже описал идею и отвечал на уточняющие вопросы. Если человек явно хочет заказать индивидуальную работу, серверный сценарий соберёт данные в отдельный черновик ИИ-заказа, сохранит переписку и уведомит владельца; продолжайте этот сценарий и не просите повторять сведения. Счёт не отправляется до явного согласия покупателя и подтверждения владельца. Если человек только спрашивает или выбирает идею, консультируйте без создания заказа. Для готовой работы объясните путь: «Магазин» → выбрать товар → «＋ В корзину» или «⚡ Купить сразу» → корзина → «Оформить заказ». Не обещайте подтверждение или срок до решения владельца.",
    "Не подталкивайте к покупке и не завершайте обычный ответ рекламным призывом. Если клиент сам прямо хочет купить, спокойно объясните точный путь в Mini App; не начинайте сбор заказа прямо в группе.",
    "Отвечайте на новую тему отдельно и не переносите пожелания одного участника в диалог другого. Используйте только историю текущего участника.",
    "Запрос из «Создать своё» поступает владельцу на проверку. Только владелец подтверждает индивидуальную работу и цену; до подтверждения счёт не отправляется.",
    "Актуальное главное меню Mini App: «Магазин» — каталог готовых работ; «Создать своё» — пошаговая форма индивидуальной работы; «VIP-подписка» — VIP-возможности; «Мои заказы» — статусы и история; «Мой баланс» — баллы и операции; «Пополнить баланс» — оплата Stars; «ИИ помощник» — отдельный чат для вопросов, подбора подарка и обсуждения авторской работы; «О проекте» — правила и контакты; «Таблица лидеров» — репутация; «Скидки и акции» — действующие предложения. Категории каталога: «Все работы», «Осень», «Новинки», «Зима и Новый год», «Картины», «Животные», «Дома и здания», «Поделки», «Услуги». Не называйте разделы иначе и не придумывайте кнопки. В групповой переписке Вы уже являетесь ИИ-помощником: не отправляйте человека искать кнопку «ИИ помощник», если он уже общается с Вами.",
    "Не придумывайте товары, цены, сроки, наличие, оплату, обещания и решения владельца. Если точного ответа нет, честно скажите об этом и передайте вопрос владельцу.",
    "Не отвечайте на посторонние сообщения, если Вас не спросили и не упомянули. Верните ignore=true, если сообщение не относится к Агентству и не является обращением к собеседнику.",
    "Верните только JSON вида {\"answer\":\"ответ\",\"needs_owner\":true или false,\"ignore\":true или false}."
  ];
  instructions.push(aiToneInstruction(settings.global_tone));
  if(settings.companion_mode){
    const modes={friendly:"В режиме собеседника будьте особенно дружелюбным, поддерживающим и внимательным, без фамильярности.",respectful:"В режиме собеседника отвечайте спокойно, уважительно и сдержанно.",promotional:"В режиме собеседника мягко показывайте интересные возможности Агентства, но никогда не навязывайте заказ."};
    instructions.push(modes[settings.companion_tone]||modes.friendly);
  }
  if(settings.ai_instructions)instructions.push("Дополнительные инструкции владельца:\n"+String(settings.ai_instructions).slice(0,6000));
  instructions.push("ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: не предлагайте клиенту оформить заказ и не вставляйте предложение о заказе в разговор. Оформление начинается только по собственной ясной прямой просьбе клиента. Консультация, ориентация, вопросы о товарах, идеи и обычная беседа не являются согласием. При смене темы отвечайте на новую тему, не продолжайте прежний сценарий заказа. Черновик оформления в группе активен не дольше 30 минут бездействия; не считайте новые приветствия, благодарность или обычные вопросы ответами на старый заказ.");
  const input=[{role:"user",content:"Каталог (источник истины): "+JSON.stringify(catalog).slice(0,12000)},...context.map(m=>({role:m.role,content:m.content}))];
  const raw=await aiGenerateText(env,instructions.join("\n"),input,650);
  let answer=raw,needsOwner=false,ignore=false;
  try{const match=raw.match(/\{[\s\S]*\}/);if(match){const parsed=JSON.parse(match[0]);answer=String(parsed.answer||"").trim()||"Я пока не могу достоверно подтвердить эту информацию.";needsOwner=parsed.needs_owner===true;ignore=parsed.ignore===true;}}catch{}
  if(ignore){await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:"ai_unrelated_ignored"});return;}
  if(/не знаю|не могу достоверно подтвердить|нужно уточнить у владельца|не хватает данных/i.test(answer))needsOwner=true;
  // Жёсткая страховка от рекламного призыва оформить заказ в обычном ответе.
  if(/(?:хотите|желаете|давайте|предлагаю|предлагаем|можете|готовы|не хотите)\s+(?:оформить|создать|разместить)\s+(?:заказ|заявку)|(?:закажите|оформите)\s+(?:сейчас|прямо сейчас|у нас)|(?:оставьте|создайте)\s+(?:заявку|заказ)/i.test(answer)){
    answer="Я могу подсказать, как устроен каталог и какие возможности есть в Агентстве. Если у Вас есть вопрос, с удовольствием помогу разобраться.";
  }
  let questionId=null;
  if(needsOwner){
    try{const saved=await env.DB.prepare("INSERT INTO ai_owner_questions(chat_id,telegram_id,question) VALUES(?,?,?)").bind(String(chatId),String(user.id),text.slice(0,2000)).run();questionId=saved.meta?.last_row_id||null;}catch{}
    await aiNotifyOwner(env,"❔ ИИ-помощнику нужна помощь владельца"+(questionId?" · вопрос №"+questionId:"")+"\nУчастник: "+user.id+"\nВопрос: "+text.slice(0,700)+"\nОтветьте в Mini App → ИИ-бот → Вопросы владельцу.");
    answer="Я пока не могу достоверно подтвердить эту информацию. Передал Ваш вопрос владельцу и сообщу Вам, когда получу ответ.";
  }
    answer=String(answer||"").replace(/\*{1,2}/g,"").trim();
  if(!/[🎁✨📱💬🎨😊🙂😉🌷🧸🎉💡]/u.test(answer))answer+=" 😊";
  const replyMarkup=aiBuildGroupKeyboard(text,answer,needsOwner);
  if(replyMarkup && !/Agentstvo_podarkov_bot|Откройте бота|нажмите Start/i.test(answer))answer += "\n\nЕсли кнопка не откроется: найдите @Agentstvo_podarkov_bot, нажмите Start, затем «Открыть Агентство». Выберите нужный раздел вручную.";
  await aiGroupReply(env,chatId,user.id,answer,replyToMessageId,replyMarkup);
  await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:needsOwner?"ai_answer_referred":"ai_answer",details:{characters:answer.length,question_id:questionId}});
}
async function aiRollbackOrderDelivery(env,{draft,id,orderId,balanceUsed,error,realCallback,callback,isGroupOrder}){
  await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE kind='order' AND reference_id=? AND status='pending'").bind(orderId).run();
  const promoReservation=await env.DB.prepare("SELECT code FROM promo_redemptions WHERE order_id=? AND status='reserved'").bind(orderId).first();
  if(promoReservation)await env.DB.batch([
    env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(promoReservation.code),
    env.DB.prepare("UPDATE promo_redemptions SET status='released' WHERE order_id=? AND status='reserved'").bind(orderId)
  ]);
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_order_drafts SET status='review',order_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=?").bind(id,orderId),
    env.DB.prepare("DELETE FROM custom_orders WHERE id=?").bind(orderId),
    env.DB.prepare("DELETE FROM orders WHERE id=?").bind(orderId)
  ]);
  if(balanceUsed>0){
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?").bind(balanceUsed,String(draft.telegram_id)),
      env.DB.prepare("INSERT OR IGNORE INTO balance_transactions(telegram_id,amount_stars,operation_type,description,idempotency_key) VALUES(?,?,'custom_order_refund',?,?)").bind(String(draft.telegram_id),balanceUsed,"Возврат баланса: не удалось отправить подтверждение заказа "+orderId,"ai-order-refund:"+orderId)
    ]);
  }
  await aiNotifyOwner(env,"⚠️ ИИ-заказ не удалось отправить покупателю. Запрос возвращён в ИИ-заказы, списание баланса отменено.\nID черновика: "+id+"\nКлиент: "+draft.telegram_id+"\n"+String(error).slice(0,250));
  if(isGroupOrder){
    try{await aiTelegram(env,"sendMessage",{chat_id:String(draft.chat_id),reply_to_message_id:draft.group_message_id||undefined,text:"Не удалось отправить подтверждение в личный чат. Проверьте, что Вы открыли бота и нажали Start. Владелец сможет повторить подтверждение."});}
    catch(groupError){console.error("AI group order delivery notice failed",String(groupError).slice(0,250));}
  }
  if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Не удалось отправить заказ покупателю. Запрос возвращён в ИИ-заказы, баланс восстановлен.",show_alert:true});
  return false;
}
async function aiApproveOrder(env, callback) {
  const owner=String(env.ADMIN_TELEGRAM_ID||"");
  const realCallback = !String(callback.id||"").startsWith("admin_");
  if(String(callback.from?.id)!==owner) {
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Подтвердить заказ может только владелец.",show_alert:true});
    return;
  }
  const id=String(callback.data||"").slice("ai_order_approve:".length);
  const draft=await env.DB.prepare("SELECT * FROM ai_order_drafts WHERE id=? AND status='review'").bind(id).first();
  if(!draft){if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Заказ уже обработан или не найден.",show_alert:true});return;}
  if(!draft.approved_stars || Number(draft.approved_stars)<280 || Number(draft.approved_stars)>800) {
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Сначала укажите итоговую цену в Mini App → ИИ-заказы.",show_alert:true});return;
  }
  let draftDetails={};
  try{draftDetails=JSON.parse(draft.details_json||"{}");}catch{}
  if(draftDetails.customer_accepted!==true){
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Покупатель ещё не согласился с предложением. Подтверждение заказа пока недоступно.",show_alert:true});
    return false;
  }
  const isGroupOrder=draftDetails.source==="group";
  if(isGroupOrder){
    try{
      await aiTelegram(env,"sendChatAction",{chat_id:String(draft.telegram_id),action:"typing"});
    }catch(error){
      await aiNotifyOwner(env,"⚠️ Групповой заказ пока не подтверждён. Покупатель ещё не открыл личный чат с ботом.\nID черновика: "+id+"\nКлиент: "+draft.telegram_id+"\nПопросите покупателя открыть бота и нажать Start, затем повторно подтвердите заказ в Mini App → ИИ-заказы. Баланс не списывался.");
      try{await aiTelegram(env,"sendMessage",{chat_id:String(draft.chat_id),reply_to_message_id:draft.group_message_id||undefined,text:"Чтобы получить подтверждение и счёт, откройте личный чат с ботом и нажмите Start. После этого владелец сможет повторно подтвердить заказ. Баланс пока не списывался."});}
      catch(groupError){console.error("AI group order start notice failed",String(groupError).slice(0,250));}
      if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Покупатель должен открыть личный чат с ботом и нажать Start. Заказ не подтверждён, баланс не списывался.",show_alert:true});
      return false;
    }
  }
  const orderId=crypto.randomUUID();
  const title=String(draft.subject||"Индивидуальный заказ").slice(0,120);
  const baseAmount=Number(draft.approved_stars);
  const promoCode=String(draftDetails.promo_code||"").trim().toUpperCase();
  let promo=null,promoDiscountStars=0,discountStars=0;
  if(promoCode){
    promo=await env.DB.prepare("SELECT code,discount_percent,max_uses,reserved_count,redeemed_count,starts_at,ends_at,is_active FROM promo_codes WHERE code=?").bind(promoCode).first();
    const valid=promo&&promo.is_active&&(!promo.starts_at||!!(await env.DB.prepare("SELECT 1 AS ok WHERE datetime(?)<=datetime('now')").bind(promo.starts_at).first()))&&(!promo.ends_at||!!(await env.DB.prepare("SELECT 1 AS ok WHERE datetime(?)>datetime('now')").bind(promo.ends_at).first()))&&(promo.max_uses===null||Number(promo.reserved_count||0)+Number(promo.redeemed_count||0)<Number(promo.max_uses));
    if(!valid){await aiNotifyOwner(env,"⚠️ Промокод "+promoCode+" в ИИ-заказе "+id+" больше не действует. Проверьте код перед подтверждением.");if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Промокод больше не действует. Обновите предложение для клиента.",show_alert:true});return false;}
  }
  const rankRow=await env.DB.prepare("SELECT rank_code FROM reputation_profiles WHERE telegram_id=?").bind(String(draft.telegram_id)).first().catch(()=>null);
  const rankPercent=({ordinary:0,regular:5,vip:8,god:10,secret:15})[String(rankRow?.rank_code||"ordinary")]||0;
  const seasonalPercent=10;
  const seasonalDiscount=Math.floor(baseAmount*seasonalPercent/100);
  const rankDiscount=Math.floor((baseAmount-seasonalDiscount)*rankPercent/100);
  const afterGlobalDiscounts=baseAmount-seasonalDiscount-rankDiscount;
  if(promo)promoDiscountStars=Math.min(Math.max(0,afterGlobalDiscounts-1),Math.floor(afterGlobalDiscounts*Number(promo.discount_percent)/100));
  discountStars=seasonalDiscount+rankDiscount+promoDiscountStars;
  const discountPercent=Math.round(discountStars*100/baseAmount);
  const amount=baseAmount-discountStars;
  let promoReserved=false;
  if(promo){
    const reserve=await env.DB.prepare("UPDATE promo_codes SET reserved_count=reserved_count+1,updated_at=CURRENT_TIMESTAMP WHERE code=? AND is_active=1 AND (max_uses IS NULL OR reserved_count+redeemed_count<max_uses) AND (starts_at IS NULL OR datetime(starts_at)<=datetime('now')) AND (ends_at IS NULL OR datetime(ends_at)>datetime('now'))").bind(promoCode).run();
    if(Number(reserve.meta?.changes||0)!==1){if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Лимит промокода только что исчерпан. Обновите предложение.",show_alert:true});return false;}
    promoReserved=true;
  }
  const created=await env.DB.batch([
    env.DB.prepare("UPDATE ai_order_drafts SET status='approved',order_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='review' AND approved_stars>0")
      .bind(orderId,id),
    env.DB.prepare("INSERT INTO orders(id,telegram_id,product_id,product_title,quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status,promo_code,discount_stars) SELECT ?,?,NULL,?,1,?,?,?,'pending','awaiting_payment',?,? WHERE changes()=1")
      .bind(orderId,String(draft.telegram_id),title,baseAmount,discountPercent,amount,promoCode||null,discountStars),
    env.DB.prepare("INSERT INTO custom_orders(id,telegram_id,username,first_name,subject,answers_json,total_stars,status) SELECT ?,?,?,?,?,?, ?,'pending' WHERE changes()=1")
      .bind(orderId,String(draft.telegram_id),draft.username,draft.first_name,title,draft.details_json,amount),
    ...(promo?[env.DB.prepare("INSERT INTO promo_redemptions(order_id,code,telegram_id,discount_stars,status) SELECT ?,?,?,?,'reserved' WHERE changes()=1").bind(orderId,promoCode,String(draft.telegram_id),promoDiscountStars)]:[])
  ]);
  if(!created[0]?.meta?.changes || created[0].meta.changes!==1 || !created[1]?.meta?.changes || created[1].meta.changes!==1 || !created[2]?.meta?.changes || created[2].meta.changes!==1 || (promo&&(!created[3]?.meta?.changes||created[3].meta.changes!==1))){
    if(promoReserved)await env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1) WHERE code=?").bind(promoCode).run();
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Заказ уже подтверждён или изменён. Обновите раздел ИИ-заказов.",show_alert:true});
    return false;
  }
  const userRow=await env.DB.prepare("SELECT balance_stars FROM users WHERE telegram_id=?").bind(String(draft.telegram_id)).first();
  const requested=Math.min(amount,Math.max(0,Number(userRow?.balance_stars||0)));
  let balanceUsed=0;
  if(requested>0){
    const debit=await env.DB.batch([
      env.DB.prepare("UPDATE users SET balance_stars=balance_stars-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance_stars>=?").bind(requested,String(draft.telegram_id),requested),
      env.DB.prepare("INSERT INTO balance_transactions(telegram_id,amount_stars,operation_type,description,idempotency_key) SELECT ?,?,'custom_order_payment',?,? WHERE changes()=1").bind(String(draft.telegram_id),-requested,"Оплата индивидуального заказа "+orderId,"ai-order-payment:"+orderId)
    ]);
    if(debit[0]?.meta?.changes===1)balanceUsed=requested;
  }
  const due=Math.max(0,amount-balanceUsed);
  await env.DB.prepare("UPDATE orders SET balance_applied_stars=?,payment_status=CASE WHEN ?=total_stars THEN 'paid' ELSE 'pending' END,fulfillment_status=CASE WHEN ?=total_stars THEN 'awaiting_delivery' ELSE 'awaiting_payment' END,paid_at=CASE WHEN ?=total_stars THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?")
    .bind(balanceUsed,balanceUsed,balanceUsed,balanceUsed,orderId).run();
  await env.DB.prepare("UPDATE custom_orders SET status=CASE WHEN ?=total_stars THEN 'new' ELSE 'pending' END WHERE id=?").bind(balanceUsed,orderId).run();
  await env.DB.prepare("UPDATE ai_order_drafts SET status=CASE WHEN ?=0 THEN 'paid' ELSE 'approved' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=?")
    .bind(due,id,orderId).run();
  const discountLine="\nСкидка сезона и ранга: −"+(seasonalDiscount+rankDiscount)+" ⭐."+(promo?"\nПромокод "+promoCode+" · скидка "+Number(promo.discount_percent)+"% (−"+promoDiscountStars+" ⭐).":"");
   let invoiceUrl="";
  if(due>0){
    const payload="ai_order_"+crypto.randomUUID();
    await env.DB.prepare("INSERT INTO payment_intents(payload,telegram_id,kind,reference_id,amount_stars,bonus_points,plan_type,status) VALUES(?,?,'order',?,?,0,NULL,'pending')")
      .bind(payload,String(draft.telegram_id),orderId,due).run();
    try{
      invoiceUrl=await aiTelegram(env,"createInvoiceLink",{title:title.slice(0,32),description:"Индивидуальный заказ Агентства подарков",payload,provider_token:"",currency:"XTR",prices:[{label:title.slice(0,32),amount:due}]});
    }catch(error){
      await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=?").bind(payload).run();
      await env.DB.batch([
        env.DB.prepare("UPDATE ai_order_drafts SET status='review',order_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=?").bind(id,orderId),
        env.DB.prepare("DELETE FROM custom_orders WHERE id=? AND status='pending'").bind(orderId),
        env.DB.prepare("DELETE FROM orders WHERE id=? AND payment_status='pending'").bind(orderId)
      ]);
      const promoReservation=await env.DB.prepare("SELECT code FROM promo_redemptions WHERE order_id=? AND status='reserved'").bind(orderId).first();
       if(promoReservation)await env.DB.batch([
         env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(promoReservation.code),
         env.DB.prepare("UPDATE promo_redemptions SET status='released' WHERE order_id=? AND status='reserved'").bind(orderId)
       ]);
       if(balanceUsed>0){
        await env.DB.batch([
          env.DB.prepare("UPDATE users SET balance_stars=balance_stars+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?").bind(balanceUsed,String(draft.telegram_id)),
          env.DB.prepare("INSERT INTO balance_transactions(telegram_id,amount_stars,operation_type,description,idempotency_key) VALUES(?,?,'custom_order_refund',?,?)").bind(String(draft.telegram_id),balanceUsed,"Возврат баланса при ошибке счёта "+orderId,"ai-order-refund:"+orderId)
        ]);
      }
      await aiNotifyOwner(env,"⚠️ Заказ "+orderId+" не отправлен: счёт не удалось сформировать. Запрос возвращён в ИИ-заказы. "+String(error).slice(0,250));
      if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Не удалось сформировать счёт. Запрос возвращён в ИИ-заказы.",show_alert:true});
      return false;
    }
    try{
      await aiTelegram(env,"sendMessage",{chat_id:String(draft.telegram_id),text:"✅ Владелец подтвердил Ваш индивидуальный заказ!\n\n"+title+"\nИтого: "+amount+" ⭐"+discountLine+"\nСписано с баланса: "+balanceUsed+" ⭐\nОсталось оплатить: "+due+" ⭐\nДля оплаты нажмите кнопку ниже.",reply_markup:{inline_keyboard:[[{text:"Оплатить заказ · "+due+" ⭐",url:invoiceUrl}]]}});
    }catch(error){return await aiRollbackOrderDelivery(env,{draft,id,orderId,balanceUsed,error,realCallback,callback,isGroupOrder});}
    await aiNotifyOwner(env,"⭐ ИИ-заказ подтверждён\nID: "+orderId+"\nКлиент: "+draft.telegram_id+"\nЦена: "+amount+" ⭐\nСписано с баланса: "+balanceUsed+" ⭐\nСчёт: "+due+" ⭐");
  }else{
    try{
      await aiTelegram(env,"sendMessage",{chat_id:String(draft.telegram_id),text:"✅ Владелец подтвердил Ваш индивидуальный заказ!\n\n"+title+"\nИтого: "+amount+" ⭐"+discountLine+"\nЗаказ полностью оплачен с внутреннего баланса. Счёт отправлять не нужно."});
    }catch(error){return await aiRollbackOrderDelivery(env,{draft,id,orderId,balanceUsed,error,realCallback,callback,isGroupOrder});}
    await aiNotifyOwner(env,"💰 ИИ-заказ полностью оплачен с баланса\nID: "+orderId+"\nКлиент: "+draft.telegram_id+"\nСписано: "+balanceUsed+" ⭐");
  }
  if(due===0&&promo){
     await env.DB.batch([
       env.DB.prepare("UPDATE promo_codes SET reserved_count=MAX(0,reserved_count-1),redeemed_count=redeemed_count+1,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(promoCode),
       env.DB.prepare("UPDATE promo_redemptions SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='reserved'").bind(orderId)
     ]);
   }
   await aiLog(env,{chat_id:draft.chat_id,actor:owner,target:draft.telegram_id,type:"ai_order_approved",details:{draft_id:id,order_id:orderId,amount_stars:amount}});
  return true;
}
function aiBase64(buffer){
  const bytes=new Uint8Array(buffer);let binary="";
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  return btoa(binary);
}
async function aiTranscribeAudio(env,message){
  const media=message.voice||message.audio;
  if(!media?.file_id)return null;
  if(!env.AI)throw new Error("Workers AI binding AI is not configured for audio review");
  const file=await aiTelegram(env,"getFile",{file_id:media.file_id});
  if(!file?.file_path||Number(file.file_size||0)>10*1024*1024)throw new Error("Audio exceeds the automatic review limit");
  const response=await fetch("https://api.telegram.org/file/bot"+env.BOT_TOKEN+"/"+file.file_path);
  if(!response.ok)throw new Error("Telegram audio download failed");
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>10*1024*1024)throw new Error("Audio exceeds the automatic review limit");
  const ext=String(file.file_path).split(".").pop().toLowerCase();
  const supported=["ogg","oga","mp3","mp4","mpeg","mpga","m4a","wav","webm"];
  if(!supported.includes(ext))throw new Error("Unsupported audio format");
  const text=await workersAiTranscribe(env,buffer);
  return String(text||"").trim().slice(0,3500);
}
async function aiInspectImage(env,message,settings={}){
  if(!env.AI)return {decision:"review",reason:"ИИ-проверка изображения не настроена",confidence:0};
  const doc=message.document&&/^image\/(jpeg|png|webp)$/i.test(message.document.mime_type||"")?message.document:null;
  const photo=Array.isArray(message.photo)&&message.photo.length?message.photo[message.photo.length-1]:null;
  const sticker=message.sticker&&!message.sticker.is_animated&&!message.sticker.is_video?message.sticker:null;
  const media=photo||doc||sticker||message.sticker?.thumbnail||message.video?.thumbnail||message.video_note?.thumbnail||message.audio?.thumbnail||message.animation?.thumbnail||null;
  if(!media?.file_id)return null;
  const file=await aiTelegram(env,"getFile",{file_id:media.file_id});
  if(!file?.file_path||Number(file.file_size||0)>5*1024*1024)return {decision:"review",reason:"Файл слишком большой для автоматической проверки",confidence:0};
  const response=await fetch("https://api.telegram.org/file/bot"+env.BOT_TOKEN+"/"+file.file_path);
  if(!response.ok)return {decision:"review",reason:"Не удалось получить вложение для проверки",confidence:0};
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>5*1024*1024)return {decision:"review",reason:"Файл превышает лимит автоматической проверки",confidence:0};
  const ext=String(file.file_path).split(".").pop().toLowerCase();
  if(!["png","jpg","jpeg","webp"].includes(ext))return {decision:"review",reason:"Формат изображения не поддерживается для автоматической проверки",confidence:0};
  const mime=ext==="png"?"image/png":ext==="webp"?"image/webp":"image/jpeg";
  const dataUrl="data:"+mime+";base64,"+aiBase64(buffer);
  const ai=await workersAiFetch(env,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:AGENCY_VISION_MODEL,instructions:"Вы — классификатор безопасности Telegram-группы. Оцените только очевидные нарушения правил: рекламная рассылка, азартные/мошеннические предложения, фишинговые материалы, оскорбительные изображения, явно сексуальный контент или явно жестокие графические изображения. Не описывайте содержимое подробно. Не считайте обычные фотографии, рисунки, поделки и мемы нарушениями. При сомнении выбирайте review. Верните JSON с ключами decision, reason и confidence. Автоматическое нарушение ставьте только при очевидном случае и высокой уверенности.\n\nДополнительные инструкции владельца:\n"+String(settings.moderation_instructions||"").slice(0,5000)+"\n\nДополнительные правила медиа:\n"+String(settings.media_rules||"").slice(0,2500),
    input:[{role:"user",content:[{type:"input_text",text:"Проверьте вложение на очевидное нарушение правил группы. Подпись: "+aiText(message).slice(0,500)},{type:"input_image",image_url:dataUrl,detail:"low"}]}],max_output_tokens:120})});
  const result=await ai.json().catch(()=>({}));
  if(!ai.ok)throw new Error("Vision API HTTP "+ai.status);
  let output=typeof result.output_text==="string"?result.output_text:"";
  if(!output&&Array.isArray(result.output))output=result.output.flatMap(x=>Array.isArray(x.content)?x.content:[]).filter(x=>x.type==="output_text").map(x=>x.text||"").join("\n");
  const match=output.match(/\{[\s\S]*\}/);
  if(!match)throw new Error("Vision classifier returned no JSON");
  const parsed=JSON.parse(match[0]);
  return {decision:["ok","review","violation"].includes(parsed.decision)?parsed.decision:"review",reason:String(parsed.reason||"Неоднозначное вложение").slice(0,250),confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0))};
}
async function aiAwardGroupMessageReputation(env,chatId,message,user){
  const messageId=Number(message?.message_id)||0;
  if(messageId<1||!user?.id||user.is_bot)return false;
  const telegramDate=Number(message.date)||Math.floor(Date.now()/1000);
  const createdAt=new Date(telegramDate*1000).toISOString().slice(0,19).replace("T"," ");
  await env.DB.prepare("DELETE FROM reputation_group_message_activity WHERE created_at < datetime('now','-48 hours')").run();
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO reputation_group_message_activity(chat_id,message_id,telegram_id,created_at) VALUES(?,?,?,?)")
    .bind(String(chatId),messageId,String(user.id),createdAt).run();
  if(Number(inserted.meta?.changes||0)!==1)return false;
  const activity=await env.DB.prepare("SELECT COUNT(*) AS total FROM reputation_group_message_activity WHERE chat_id=? AND telegram_id=? AND created_at>=datetime('now','-24 hours')")
    .bind(String(chatId),String(user.id)).first();
  if(Number(activity?.total||0)<=2)return false;
  await env.DB.prepare("INSERT OR IGNORE INTO users(telegram_id,username,first_name) VALUES(?,?,?)")
    .bind(String(user.id),user.username||null,user.first_name||null).run();
  await env.DB.prepare("INSERT OR IGNORE INTO reputation_profiles(telegram_id) VALUES(?)").bind(String(user.id)).run();
  const reward=await env.DB.prepare("INSERT OR IGNORE INTO reputation_transactions(telegram_id,actor_telegram_id,amount,source,description,leaderboard_eligible,idempotency_key,created_at) VALUES(?,?,5,'group_message','Активность в группе: сообщение без нарушений',1,?,?)")
    .bind(String(user.id),null,"group-message:"+String(chatId)+":"+messageId,createdAt).run();
  return Number(reward.meta?.changes||0)===1;
}
async function aiHandleTelegramUpdateInner(update, env) {
  if (update.callback_query?.data?.startsWith("ai_order_approve:")) {
    await aiApproveOrder(env,update.callback_query);return true;
  }
  const isEdited=!!update.edited_message;
  const message=update.message||update.edited_message;
  if(!message || message.successful_payment || !aiIsGroup(message.chat)) return false;
  const chatId=String(message.chat.id),user=message.from;
  if(!user?.id || user.is_bot) return false;
  await env.DB.prepare("UPDATE ai_moderator_settings SET group_chat_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(chatId).run();
  const noticeKey="group_notice:"+chatId;
  const notice=await env.DB.prepare("INSERT OR IGNORE INTO ai_runtime_state(key,value) VALUES(?,'sending')").bind(noticeKey).run();
  if(notice.meta?.changes===1){
    try{
      await aiTelegram(env,"sendMessage",{chat_id:chatId,text:"ℹ️ В этой группе работает ИИ-модератор «Агентства подарков». Он проверяет доступные сообщения, ссылки и вложения, помогает по вопросам Агентства и обрабатывает жалобы. Для ответов и проверки отдельных сообщений и поддерживаемых изображений текст, поддерживаемые изображения и аудиосообщения могут передаваться в Cloudflare Workers AI для проверки и расшифровки. Система сохраняет текстовый контекст и журнал событий на ограниченный срок. Не отправляйте в группу пароли, коды и другие конфиденциальные данные. Обработка зависит от доступных боту данных и его прав в Telegram."});
      await env.DB.prepare("UPDATE ai_runtime_state SET value='sent',updated_at=CURRENT_TIMESTAMP WHERE key=?").bind(noticeKey).run();
    }catch(error){
      await env.DB.prepare("DELETE FROM ai_runtime_state WHERE key=? AND value='sending'").bind(noticeKey).run();
      await aiNotifyOwner(env,"Не удалось отправить группе уведомление о работе ИИ-модератора: "+String(error).slice(0,250));
    }
  }
  await aiLog(env,{chat_id:chatId,actor:user.id,type:update.edited_message?"edited_message_checked":"message_checked",details:{message_id:message.message_id,has_text:!!aiText(message),media_types:["photo","video","document","audio","voice","animation","sticker","video_note"].filter(key=>!!message[key])}});
  if(message.left_chat_member){await aiLog(env,{chat_id:chatId,actor:user.id,target:message.left_chat_member.id,type:"member_left"});return true;}
  if(message.new_chat_title){await aiLog(env,{chat_id:chatId,actor:user.id,type:"group_title_changed",details:{title:String(message.new_chat_title).slice(0,100)}});return true;}
  if(message.pinned_message){await aiLog(env,{chat_id:chatId,actor:user.id,type:"message_pinned",details:{message_id:message.pinned_message.message_id}});return true;}
  await aiRememberMember(env,chatId,user);
  const settings=await aiSettings(env);
  const isOwner=!!env.ADMIN_TELEGRAM_ID && String(user.id)===String(env.ADMIN_TELEGRAM_ID);
  if(isOwner) await aiLog(env,{chat_id:chatId,actor:user.id,type:"owner_message_received",details:{message_id:message.message_id}});
  if(!settings.enabled)return true;
  // Владелец может пользоваться групповым ИИ-помощником, но никогда не попадает под автоматические наказания.
  const moderationActive=!isOwner && settings.moderation_enabled && !settings.moderation_temporarily_disabled;
  if(Array.isArray(message.new_chat_members)&&message.new_chat_members.length) {
    for(const member of message.new_chat_members) {
      await aiRememberMember(env,chatId,member);
      if(settings.greeting_enabled) {
        const greeting=String(settings.greeting_text||"Добро пожаловать в «Агентство подарков», {name}!").replace(/\{name\}/g,aiSafeName(member)).slice(0,3000);
        await aiTelegram(env,"sendMessage",{chat_id:chatId,text:greeting});
      }
      if(settings.rules_enabled) await aiTelegram(env,"sendMessage",{chat_id:chatId,text:"📌 Правила группы\n"+settings.rules_text});
    }
    await aiLog(env,{chat_id:chatId,actor:user.id,type:"members_joined",details:{count:message.new_chat_members.length}});
    return true;
  }
  let text=aiText(message);
  if(settings.media_checks && (message.voice||message.audio)){
    try{
      const transcript=await aiTranscribeAudio(env,message);
      if(transcript){text=transcript;await aiLog(env,{chat_id:chatId,actor:user.id,type:"audio_transcribed",details:{message_id:message.message_id,characters:transcript.length}});}
    }catch(error){
      if(moderationActive){
        await aiWatch(env,chatId,user.id,"Не удалось автоматически проверить аудиосообщение","audio_review");
        await aiNotifyOwner(env,"⚠️ Не удалось проверить аудиосообщение участника "+user.id+". Участник помещён в скрытое наблюдение на 24 часа. Ошибка: "+String(error).slice(0,200));
      }else await aiLog(env,{chat_id:chatId,actor:user.id,type:"audio_review_skipped",details:{message_id:message.message_id}});
    }
  }
  const file=message.document||message.video||message.audio||message.voice||message.animation||message.sticker||message.photo||message.video_note;
  if(file && settings.media_checks && moderationActive) {
    const suspicious=message.document && /(apk|exe|scr|bat|cmd|js|vbs|ps1|jar|dmg|pkg)$/i.test(String(message.document.file_name||""));
    if(suspicious) {
      await aiWatch(env,chatId,user.id,"Подозрительное вложение: "+String(message.document.file_name||"неизвестный файл"),"suspicious_file");
      await aiNotifyOwner(env,"⚠️ Подозрительный файл в группе\nУчастник: "+aiSafeName(user)+" ("+user.id+")\nФайл: "+String(message.document.file_name||"неизвестный файл")+"\nУстановлен скрытый статус повышенного внимания на 24 часа.");
    } else {
      const hasImage=!!(message.photo||message.sticker||message.video?.thumbnail||message.animation?.thumbnail||(message.document&&/^image\//i.test(message.document.mime_type||"")));
      if(hasImage){
        try{
          const scan=await aiInspectImage(env,message,settings);
          if(!scan){
            await aiWatch(env,chatId,user.id,"Вложение не удалось полностью проверить автоматически","media_review");
            await aiNotifyOwner(env,"🔎 Вложение не удалось полностью проверить автоматически. Участник: "+user.id+". Проверьте сообщение вручную; автоматическое наказание не применено.");
          }
          if(scan?.decision==="violation" && scan.confidence>=0.85){await aiWarn(env,chatId,message,scan.reason||"Обнаружено очевидное нарушение в изображении","media");return true;}
          if(scan?.decision==="review" || (scan?.decision==="violation"&&scan.confidence<0.85)){
            await aiWatch(env,chatId,user.id,"Вложение требует дополнительной проверки: "+scan.reason,"media_review");
            await aiNotifyOwner(env,"🔎 Требуется проверка вложения\nУчастник: "+aiSafeName(user)+" ("+user.id+")\nПричина: "+scan.reason+"\nУверенность ИИ: "+Math.round(scan.confidence*100)+"%. Участнику статус не раскрывается.");
          }
        }catch(error){
          await aiWatch(env,chatId,user.id,"Не удалось автоматически проверить изображение","media_review");
          await aiNotifyOwner(env,"⚠️ Не удалось проверить изображение в группе. Участник: "+user.id+". Проверьте вручную. Ошибка: "+String(error).slice(0,200));
        }
      } else if(message.video||message.audio||message.voice||message.video_note||message.animation){
        await aiLog(env,{chat_id:chatId,actor:user.id,type:"media_metadata_checked",details:{message_id:message.message_id,media_type:message.video?"video":message.audio?"audio":message.voice?"voice":message.video_note?"video_note":"animation",caption_present:!!text}});
      }
    }
  }
  if(text) {
    let violation=moderationActive ? aiClassifyLocal(message,settings) : null;
    const hasLink=/(https?:\/\/|t\.me\/|www\.)/i.test(text);
    const hasSpamSignal=/(реклама|продам|куплю|подписывай|промокод|заработок|розыгрыш|фишинг|мошен)/i.test(text);
    if(moderationActive && !violation && ((settings.suspicious_links&&hasLink)||((settings.spam||settings.advertising)&&hasSpamSignal))){
      try{
        const aiCheck=await aiInspectText(env,text,settings);
        if(aiCheck.decision==="violation" && aiCheck.confidence>=0.9)violation=aiCheck.reason;
        else if(aiCheck.decision==="review" || (aiCheck.decision==="violation"&&aiCheck.confidence<0.9)){
          await aiWatch(env,chatId,user.id,"Сообщение требует проверки: "+aiCheck.reason,"text_review");
          await aiNotifyOwner(env,"🔎 ИИ-модератор просит проверить сообщение\nУчастник: "+user.id+"\nПричина: "+aiCheck.reason+"\nУверенность: "+Math.round(aiCheck.confidence*100)+"%. Автоматическое наказание не применено.");
        }
      }catch(error){
        await aiNotifyOwner(env,"⚠️ Не удалось выполнить дополнительную проверку сообщения участника "+user.id+". Автоматическое наказание не применено. "+String(error).slice(0,200));
      }
    }
    if(violation){
      const watched=await env.DB.prepare("SELECT id FROM ai_watchlist WHERE chat_id=? AND telegram_id=? AND status='active' AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(chatId,String(user.id)).first();
      if(watched)await aiWatch(env,chatId,user.id,violation,"continued_suspicion");
      await aiWarn(env,chatId,message,violation,aiCategoryFromReason(violation));return true;
    }
    // Edited messages are checked for violations above, but are not new chat activity.
    if(isEdited) return true;
    if(moderationActive && settings.spam && await aiIsFlood(env,chatId,user.id,settings)) {await aiWarn(env,chatId,message,"Слишком частая отправка сообщений (флуд)","spam");return true;}
    if(moderationActive && settings.repeated_messages && await aiIsRepeated(env,chatId,user.id,text)) {
      await aiWarn(env,chatId,message,"Повторяющиеся сообщения (флуд)","repeated_messages");return true;
    }
    const telegramMessageDate=Number.isFinite(Number(message.date))&&Number(message.date)>0
      ? Number(message.date)
      : Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO ai_group_messages(chat_id,message_id,telegram_id,role,content,created_at) VALUES(?,?,?, 'user', ?, datetime(?,'unixepoch'))")
      .bind(chatId,Number(message.message_id)||null,String(user.id),text.slice(0,3500),telegramMessageDate).run();
    const suggestionPattern=/(предлагаю|предложение|советую|было бы лучше|можно добавить|не хватает|улучшить|улучшение|(?:отличн|хорош|интересн).{0,30}иде[яи]|иде[яи].{0,50}(?:мастер.?класс|показ|каталог|приложени|поддержк|функци)|жд[её]м.{0,20}иде[яи])/i;
    if(!isOwner && settings.owner_suggestions && suggestionPattern.test(text)){
      await aiNotifyOwner(env,"💡 Предложение участника по улучшению Агентства\nУчастник: "+aiSafeName(user)+" ("+user.id+")\nСообщение: "+text.slice(0,900));
      await aiLog(env,{chat_id:chatId,actor:user.id,target:env.ADMIN_TELEGRAM_ID,type:"owner_suggestion",details:{message_id:Number(message.message_id)||null,message:text.slice(0,1000)}});
    }
    if(moderationActive && settings.complaints_enabled && /(хочу пожаловаться|жалуюсь на|жалоба на|пожаловаться на)/i.test(text)) {
      const match=text.match(/(?:пожаловаться на|жалоба на|жалуюсь на)\s+(.{2,100})/i);
      const label=String(message.reply_to_message?.from ? aiSafeName(message.reply_to_message.from) : (match?.[1]||"участника")).replace(/[.!?,]+$/,"").trim();
      const members=await env.DB.prepare("SELECT telegram_id,username,first_name,last_name FROM ai_group_members WHERE chat_id=? ORDER BY last_seen_at DESC LIMIT 500").bind(chatId).all();
      const normalized=label.replace(/^@/,"").toLowerCase();
      const target=message.reply_to_message?.from?.id ? {telegram_id:String(message.reply_to_message.from.id)} : (members.results||[]).find(m=>String(m.username||"").toLowerCase()===normalized || (String((m.first_name||"")+" "+(m.last_name||"")).toLowerCase()).includes(normalized));
      await env.DB.prepare("INSERT INTO ai_complaints(chat_id,reporter_telegram_id,target_telegram_id,target_label,reason,source_message_id) VALUES(?,?,?,?,?,?)")
        .bind(chatId,String(user.id),target?.telegram_id||null,label,text.slice(0,1000),message.message_id||null).run();
      if(target) await aiWatch(env,chatId,target.telegram_id,"На участника поступила жалоба. Требуется проверка контекста.","complaint");
      await aiNotifyOwner(env,"📣 Жалоба в группе\nОтправитель: "+aiSafeName(user)+" ("+user.id+")\nНа кого: "+label+(target?" ("+target.telegram_id+")":"\nУчастник пока не идентифицирован")+"\nТекст: "+text.slice(0,700));
      await aiGroupReply(env,chatId,user.id,target?"Благодарю за обращение. Жалоба передана владельцу для проверки. Само обращение не означает, что участник признан виновным.":"Благодарю за обращение. Уточните, пожалуйста, username участника или ответьте на его сообщение, чтобы мы могли правильно определить адресата.");
      await aiLog(env,{chat_id:chatId,actor:user.id,target:target?.telegram_id||null,type:"complaint_created",severity:"warning",details:{target_label:label}});
      if(moderationActive&&!isEdited)await aiAwardGroupMessageReputation(env,chatId,message,user);
      return true;
    }
    const existingWatch=moderationActive ? await env.DB.prepare("SELECT id FROM ai_watchlist WHERE chat_id=? AND telegram_id=? AND status='active' AND expires_at>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1").bind(chatId,String(user.id)).first() : null;
    if(existingWatch) await aiLog(env,{chat_id:chatId,actor:user.id,target:user.id,type:"watched_message",details:{message_id:message.message_id}});
    const replied=message.reply_to_message?.from?.is_bot===true;
    const mentionedBot=(message.entities||[]).some(entity=>entity.type==="text_mention"&&entity.user?.is_bot) || (!!env.BOT_USERNAME&&new RegExp("@"+String(env.BOT_USERNAME).replace(/^@/,""),"i").test(text));
    const activeGroupOrder=await env.DB.prepare("SELECT id FROM ai_order_drafts WHERE chat_id=? AND telegram_id=? AND status='collecting' ORDER BY created_at DESC LIMIT 1").bind(String(chatId),String(user.id)).first();
    const recentOrderMessages=await env.DB.prepare("SELECT role,content FROM ai_group_messages WHERE chat_id=? AND telegram_id=? ORDER BY id DESC LIMIT 24").bind(chatId,String(user.id)).all();
    const orderHistory=(recentOrderMessages.results||[]).reverse();
    const orderTopicsAsked=new Set();
    for(const item of orderHistory){
      if(item.role!=="assistant")continue;
      const question=String(item.content||"").toLowerCase();
      if(/бюджет|стоимост|цен[уы]|рубл/.test(question))orderTopicsAsked.add("budget");
      if(/для кого|получател|повод/.test(question))orderTopicsAsked.add("recipient");
      if(/размер|формат|стил|цвет|гамм/.test(question))orderTopicsAsked.add("appearance");
      if(/материал|техник|детализац|подробн|сложност/.test(question))orderTopicsAsked.add("craft");
      if(/срок|к какому числу|когда необходим/.test(question))orderTopicsAsked.add("deadline");
    }
    const orderIntentAlreadyExpressed=orderHistory.some(item=>item.role==="user"&&/(хочу|нужн|надо|заказать|закаж|сделать|сделайте|создать|изготовить|нарисовать|нарисуйте|мне бы|можно ли сделать)/i.test(String(item.content||""))&&/(картин|подар|открытк|поделк|издел|авторск|работ|рисунок|портрет|макет)/i.test(String(item.content||"")));
    const pendingGroupOrderConsultation=orderTopicsAsked.size>=2&&orderIntentAlreadyExpressed;
    const relevant=aiAgencyIntent(text) || replied || mentionedBot || !!activeGroupOrder || pendingGroupOrderConsultation || (isOwner && /\\b(?:ии|бот|помощник)\\b/i.test(text));
    // В группе ИИ только консультирует. Черновики заказов создаются исключительно
    // через Mini App: «Магазин» для готовых работ и «Создать своё» для индивидуального запроса.
    if(settings.ai_answers && relevant && (!settings.night_mode || !aiNightNow(settings) || aiAgencyIntent(text))) {
      try { await aiReplyToGroup(env,chatId,user,text,settings,message.message_id,message.reply_to_message?.message_id||null); }
      catch(error) {
          await aiGroupReply(env,chatId,user.id,"Извините, сейчас я не могу достоверно ответить на этот вопрос. Я передал его владельцу для уточнения.",message.message_id);
          let questionId=null;
          try{const saved=await env.DB.prepare("INSERT INTO ai_owner_questions(chat_id,telegram_id,question) VALUES(?,?,?)").bind(chatId,String(user.id),text.slice(0,2000)).run();questionId=saved.meta?.last_row_id||null;}catch{}
          await aiNotifyOwner(env,"❔ ИИ-модератор не смог ответить на вопрос"+(questionId?" №"+questionId:"")+"\nУчастник: "+user.id+"\nВопрос: "+text.slice(0,700)+"\nОтвет можно добавить в Mini App → ИИ-бот → Вопросы владельцу.\nОшибка: "+String(error).slice(0,250));
          await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:"ai_answer_unknown",severity:"warning",details:{question_id:questionId,question:text.slice(0,700)}});
        }
    }
  }
  if(!isEdited&&!isOwner)await aiAwardGroupMessageReputation(env,chatId,message,user);
  return true;
}
async function handleAiTelegramUpdate(update,env){
  const message=update?.message||update?.edited_message;
  const callback=update?.callback_query;
  const identity=update?.update_id!==undefined
    ? "telegram_update:"+String(update.update_id)
    : callback?.id ? "telegram_callback:"+String(callback.id)
    : message?.chat?.id&&message?.message_id
      ? "telegram_message:"+String(message.chat.id)+":"+String(message.message_id)+":"+(update?.edited_message?"edit:"+String(message.edit_date||"0"):"new")
      : null;
  try{
    if(!identity)return await aiHandleTelegramUpdateInner(update,env);
    const claim=await env.DB.prepare("INSERT INTO ai_runtime_state(key,value,updated_at) VALUES(?,'processing',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='processing',updated_at=CURRENT_TIMESTAMP WHERE ai_runtime_state.value='failed' OR (ai_runtime_state.value='processing' AND ai_runtime_state.updated_at<datetime('now','-2 minutes'))").bind(identity).run();
    if(Number(claim.meta?.changes||0)!==1)return true;
    const result=await aiHandleTelegramUpdateInner(update,env);
    await env.DB.prepare("UPDATE ai_runtime_state SET value='done',updated_at=CURRENT_TIMESTAMP WHERE key=?").bind(identity).run();
    return result;
  }catch(error){
    const messageId=message?.message_id||null;
    if(identity)try{
      await env.DB.prepare("UPDATE ai_runtime_state SET value='failed',updated_at=CURRENT_TIMESTAMP WHERE key=?").bind(identity).run();
    }catch(stateError){console.error("Could not mark Telegram update failed:",String(stateError).slice(0,250));}
    await aiLog(env,{chat_id:message?.chat?.id||null,actor:"ai_moderator",target:message?.from?.id||null,type:"telegram_update_failed",severity:"error",details:{update_id:update?.update_id||null,message_id:messageId,error:String(error).slice(0,700)}});
    await aiNotifyOwner(env,"⚠️ Не удалось полностью обработать обновление группы"+(messageId?" · сообщение №"+messageId:"")+". Повтор Telegram остановлен, чтобы не запускать повторную модерацию одного сообщения. Ошибка: "+String(error).slice(0,300));
    return true;
  }
}
async function aiBuildWeeklyReport(env) {
  const end = new Date();
  const start = new Date(end.getTime()-7*86400000);
  const previousStart = new Date(end.getTime()-14*86400000);
  const iso = d=>d.toISOString().slice(0,10);
  const periodStart=iso(start),periodEnd=iso(end);
  const existing=await env.DB.prepare("SELECT id FROM ai_weekly_reports WHERE period_start=? AND period_end=?").bind(periodStart,periodEnd).first();
  if(existing)return;
  const [events,warnings,complaints,orders,paid,topics,prevWarnings,prevComplaints,prevOrders,messageCount,prevMessageCount] = await Promise.all([
    env.DB.prepare("SELECT event_type,COUNT(*) AS total FROM ai_moderation_events WHERE created_at>=datetime('now','-7 days') GROUP BY event_type").all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_warnings WHERE issued_at>=datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_complaints WHERE created_at>=datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_order_drafts WHERE created_at>=datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_order_drafts WHERE status='paid' AND updated_at>=datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT content FROM ai_group_messages WHERE role='user' AND created_at>=datetime('now','-7 days') ORDER BY id DESC LIMIT 200").all(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_warnings WHERE issued_at>=datetime('now','-14 days') AND issued_at<datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_complaints WHERE created_at>=datetime('now','-14 days') AND created_at<datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_order_drafts WHERE created_at>=datetime('now','-14 days') AND created_at<datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_group_messages WHERE role='user' AND created_at>=datetime('now','-7 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM ai_group_messages WHERE role='user' AND created_at>=datetime('now','-14 days') AND created_at<datetime('now','-7 days')").first()
  ]);
  const eventText=(events.results||[]).map(x=>x.event_type+": "+x.total).join(", ")||"нет";
  const topicText=(topics.results||[]).map(x=>x.content).join("\n").slice(0,10000);
  let popular="Основные темы собраны из сообщений группы.";
  try { popular=await aiGenerateText(env,Number(messageCount?.total||0)>100?"Выделите 8–12 популярных тем, кратко опишите главные обсуждения и повторяющиеся вопросы. Не называйте участников и не раскрывайте персональные данные. Верните структурированный список.":"Кратко выделите 5–8 популярных тем из переписки. Не называйте участников и не раскрывайте персональные данные. Верните только список тем.",topicText,Number(messageCount?.total||0)>100?500:250); } catch {}
  const restrictions=Number((events.results||[]).find(x=>x.event_type==="restriction")?.total||0);
  const metrics={events:events.results||[],messages:Number(messageCount?.total||0),warnings:Number(warnings?.total||0),restrictions,complaints:Number(complaints?.total||0),orders:Number(orders?.total||0),paid_orders:Number(paid?.total||0)};
  const delta=(current,previous)=>{const d=Number(current||0)-Number(previous||0);return (d>0?"+":"")+d;};
  const comparison="Предыдущая неделя → текущая:\nСообщения: "+Number(prevMessageCount?.total||0)+" → "+metrics.messages+" ("+delta(metrics.messages,prevMessageCount?.total)+")\nПредупреждения: "+Number(prevWarnings?.total||0)+" → "+metrics.warnings+" ("+delta(metrics.warnings,prevWarnings?.total)+")\nЖалобы: "+Number(prevComplaints?.total||0)+" → "+metrics.complaints+" ("+delta(metrics.complaints,prevComplaints?.total)+")\nЗапросы заказов: "+Number(prevOrders?.total||0)+" → "+metrics.orders+" ("+delta(metrics.orders,prevOrders?.total)+")";
  let suggestions="";
  const settings=await aiSettings(env);
  if(settings.owner_suggestions){
    try{suggestions=await aiGenerateText(env,"Предложите 3–5 практических улучшений для Агентства подарков, его группы, каталога, поддержки и оформления заказов. Используйте только наблюдаемые темы переписки; не выдумывайте проблемы. Кратко объясняйте пользу каждого предложения.",topicText,300);}catch{}
  }
  const report="📊 ЕЖЕНЕДЕЛЬНЫЙ ОТЧЁТ «АГЕНТСТВА ПОДАРКОВ»\nПериод: "+periodStart+" — "+periodEnd+"\n\nСообщения в группе: "+metrics.messages+"\nАктивность модерации: "+eventText+"\nПредупреждения: "+metrics.warnings+"\nОграничения: "+metrics.restrictions+"\nЖалобы: "+metrics.complaints+"\nЗапросы на заказы через группу: "+metrics.orders+"\nОплаченные ИИ-заказы: "+metrics.paid_orders+"\n\nДинамика:\n"+comparison+"\n\nПопулярные темы:\n"+popular+(suggestions?"\n\nИдеи по улучшению Агентства:\n"+suggestions:"");
  await env.DB.prepare("INSERT OR IGNORE INTO ai_weekly_reports(period_start,period_end,report_text,metrics_json) VALUES(?,?,?,?)").bind(periodStart,periodEnd,report,JSON.stringify({...metrics,comparison})).run();
  await aiNotifyOwner(env,report);
  await aiLog(env,{actor:"ai_moderator",type:"weekly_report_created",details:{period_start:periodStart,period_end:periodEnd}});
}
async function aiApplyNightMode(env, settings) {
  const chatId=String(settings.group_chat_id || "");
  if(!chatId) return;
  const stateKey="night_mode_permissions:"+chatId;
  const saved=await env.DB.prepare("SELECT value FROM ai_runtime_state WHERE key=?").bind(stateKey).first();
  const nightEnabled=settings.night_mode===true && aiNightNow(settings);
  if(nightEnabled && !saved) {
    const ownerId=String(env.ADMIN_TELEGRAM_ID || "");
    if(!ownerId) throw new Error("ADMIN_TELEGRAM_ID не настроен: ночной белый список пуст.");
    const owner=await aiTelegram(env,"getChatMember",{chat_id:chatId,user_id:Number(ownerId)});
    if(!["creator","administrator"].includes(owner?.status)) {
      throw new Error("Владелец из ночного белого списка должен быть администратором группы, иначе Telegram ограничит и его.");
    }
    const chat=await aiTelegram(env,"getChat",{chat_id:chatId});
    if(!chat?.permissions || typeof chat.permissions!=="object") {
      throw new Error("Telegram не вернул исходные права группы; ночной режим не применён, чтобы не потерять настройки.");
    }
    const original=JSON.stringify(chat.permissions);
    const locked={can_send_messages:false,can_send_audios:false,can_send_documents:false,can_send_photos:false,can_send_videos:false,can_send_video_notes:false,can_send_voice_notes:false,can_send_polls:false,can_send_other_messages:false,can_add_web_page_previews:false};
    await aiTelegram(env,"setChatPermissions",{chat_id:chatId,permissions:locked,use_independent_chat_permissions:true});
    await env.DB.prepare("INSERT INTO ai_runtime_state(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(stateKey,original).run();
    await aiLog(env,{chat_id:chatId,actor:"ai_moderator",type:"night_mode_started",details:{whitelist:ownerId,admins_exempt:true}});
    await aiNotifyOwner(env,"🌙 Ночной режим включён. Отправка сообщений закрыта для обычных участников. Вы и все администраторы остаётесь в белом списке.");
  } else if(!nightEnabled && saved) {
    let permissions;
    try { permissions=JSON.parse(saved.value); } catch { throw new Error("Не удалось прочитать сохранённые права группы; восстановление остановлено для безопасности."); }
    await aiTelegram(env,"setChatPermissions",{chat_id:chatId,permissions,use_independent_chat_permissions:true});
    await env.DB.prepare("DELETE FROM ai_runtime_state WHERE key=?").bind(stateKey).run();
    await aiLog(env,{chat_id:chatId,actor:"ai_moderator",type:"night_mode_ended"});
    await aiNotifyOwner(env,"☀️ Ночной режим завершён. Исходные права участников восстановлены.");
  }
}
async function handleAiScheduled(env) {
  const nowParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Yekaterinburg",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const weekday=nowParts.find(p=>p.type==="weekday")?.value;
  const hour=Number(nowParts.find(p=>p.type==="hour")?.value||0),minute=Number(nowParts.find(p=>p.type==="minute")?.value||0);
  if(weekday==="Sat" && hour===8) await aiBuildWeeklyReport(env);
  const moderationSettings=await aiSettings(env);
  try { await aiApplyNightMode(env,moderationSettings); }
  catch(error) { console.error("AI night mode failed:",String(error).slice(0,400)); await aiNotifyOwner(env,"⚠️ Не удалось переключить ночной режим группы: "+String(error).slice(0,300)); }
  await env.DB.prepare("DELETE FROM ai_warnings WHERE issued_at<datetime('now',?) AND active_until<=CURRENT_TIMESTAMP").bind("-"+Number(moderationSettings.warning_history_days||60)+" days").run();
  await env.DB.prepare("UPDATE ai_watchlist SET status='ended' WHERE status='active' AND expires_at<=CURRENT_TIMESTAMP").run();
  await env.DB.prepare("UPDATE ai_group_messages SET content='[удалено по сроку хранения]' WHERE created_at<datetime('now','-90 days') AND content<>'[удалено по сроку хранения]'").run();
  await env.DB.prepare("DELETE FROM ai_moderation_events WHERE created_at<datetime('now','-180 days')").run();
  await env.DB.prepare("DELETE FROM ai_runtime_state WHERE (key LIKE 'telegram_update:%' OR key LIKE 'telegram_message:%' OR key LIKE 'telegram_callback:%') AND updated_at<datetime('now','-7 days')").run();
  await env.DB.prepare("DELETE FROM ai_complaints WHERE created_at<datetime('now','-180 days') AND status<>'review'").run();
  await env.DB.prepare("DELETE FROM ai_group_members WHERE last_seen_at<datetime('now','-180 days')").run();
  await env.DB.prepare("DELETE FROM ai_owner_questions WHERE status='answered' AND answered_at<datetime('now','-180 days')").run();
  const reminders=await env.DB.prepare("SELECT d.id,d.chat_id,d.telegram_id,d.subject,o.id AS order_id FROM ai_order_drafts d JOIN orders o ON o.id=d.order_id WHERE d.status='approved' AND o.payment_status='pending' AND d.reminder_sent_at IS NULL AND d.updated_at<=datetime('now','-24 hours') LIMIT 25").all();
  for(const row of reminders.results||[]){
    try{await aiTelegram(env,"sendMessage",{chat_id:row.chat_id,text:"Напоминание: счёт за Ваш индивидуальный заказ «"+row.subject+"» ожидает оплаты."});await env.DB.prepare("UPDATE ai_order_drafts SET reminder_sent_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();}catch(error){await aiNotifyOwner(env,"Не удалось отправить напоминание по ИИ-заказу "+row.id+": "+String(error).slice(0,200));}
  }
  // Не отправляем клиентам инициативные напоминания о продолжении оформления заказа.
  await env.DB.prepare("UPDATE ai_order_drafts SET reminder_sent_at=CURRENT_TIMESTAMP WHERE status='collecting' AND reminder_sent_at IS NULL AND last_activity_at<=datetime('now','-24 hours')").run();
}
async function handleAiAdminRoute(path,method,request,env,telegramId,rootOwner,permissions) {
  const ownerOnly = () => rootOwner === true;
  const has = key => rootOwner || permissions?.[key] === true;
  if(path==="/api/admin/ai-moderation-test" && method==="POST") {
    if(!ownerOnly())return aiJson({error:"Тест правил доступен только владельцу."},403);
    const body=await aiReadJson(request);
    const text=String(body.text||"").trim().slice(0,2000);
    if(!text)return aiJson({error:"Введите пример сообщения для проверки."},400);
    const settings=await aiSettings(env);
    const enabled=settings.enabled===true && settings.moderation_enabled===true && !settings.moderation_temporarily_disabled;
    if(!enabled)return aiJson({ok:true,decision:"paused",reason:"Модерация сейчас отключена. Проверка не выполнялась.",action:"none",settings_snapshot:{enabled:settings.enabled,moderation_enabled:settings.moderation_enabled,temporarily_disabled:settings.moderation_temporarily_disabled}});
    const localReason=aiClassifyLocal({text},settings);
    const hasActiveRules=!!(settings.profanity||settings.spam||settings.advertising||settings.suspicious_links||settings.repeated_messages||settings.media_checks);
    let inspected={decision:"ok",reason:"Включённых категорий для проверки нет.",confidence:1};
    if(hasActiveRules){
      try{inspected=await aiInspectText(env,text,settings);}
      catch(error){
        const upstreamStatus=Number(error.status)||0;
        const providerCode=String(error.code||"");
        let message="Не удалось выполнить ИИ-проверку. Попробуйте позже.";
        if(upstreamStatus===429 || providerCode==="workers_ai_limit"){
          message="Cloudflare Workers AI временно ограничил запрос. Возможно, достигнут бесплатный дневной лимит или лимит запросов. Попробуйте позже.";
        }else if(upstreamStatus>=500){
          message="Cloudflare Workers AI временно недоступен (HTTP "+upstreamStatus+"). Попробуйте позже.";
        }
        return aiJson({
          error:message,
          provider:"Cloudflare Workers AI",
          upstream_status:upstreamStatus||null,
          provider_code:providerCode||null,
          provider_type:String(error.type||"")||null,
          provider_message:String(error.providerMessage||"").slice(0,240)||null,
          retry_after:error.retryAfter||null,
          request_id:error.requestId||null
        },upstreamStatus===429?429:502);
      }
    }
    let decision=inspected.decision,reason=inspected.reason,confidence=inspected.confidence;
    if(localReason){decision="violation";reason=localReason;confidence=Math.max(confidence,0.9);}
    const category=aiCategoryFromReason(reason);
    const configuredAction=decision==="violation"?(settings["punishment_"+category]||settings.punishment_default||"warning"):"none";
    const escalation=decision==="violation"&&configuredAction==="warning"
      ? "Если у участника уже накоплено "+Number(settings.warnings_before_restriction||2)+" активных предупреждений, сработает дополнительное правило эскалации («"+String(settings.warning_escalation_action||"restriction")+"»). Историю конкретного участника тест не проверяет."
      : "История предупреждений конкретного участника не проверялась.";
    return aiJson({ok:true,decision,reason,confidence,category,configured_action:configuredAction,
      action_label:configuredAction==="warning"?"Предупреждение":configuredAction==="mute"?"Мут":"Ограничение",
      escalation,read_only:true,settings_snapshot:{profanity:!!settings.profanity,spam:!!settings.spam,advertising:!!settings.advertising,suspicious_links:!!settings.suspicious_links,repeated_messages:!!settings.repeated_messages,media_checks:!!settings.media_checks,night_mode:!!settings.night_mode,moderation_enabled:!!settings.moderation_enabled}});
  }
  if(path==="/api/admin/ai-bot/settings" && method==="GET") {
    const settings=await aiSettings(env);
    return aiJson({ok:true,settings});
  }
  if(path==="/api/admin/ai-bot/settings" && method==="POST") {
    if(!has("ai_bot_manage"))return aiJson({error:"Недостаточно прав."},403);
    const body=await aiReadJson(request);const settings=await aiSaveSettings(env,body.settings||{},telegramId);
    if(body.settings?.send_rules===true){
      if(!settings.group_chat_id)return aiJson({error:"Сначала отправьте любое сообщение в группу, чтобы бот определил её."},409);
      await aiTelegram(env,"sendMessage",{chat_id:settings.group_chat_id,text:"📌 Правила группы\n\n"+settings.rules_text.slice(0,3000)});
    }
    await aiLog(env,{actor:telegramId,type:"settings_changed",details:{keys:Object.keys(body.settings||{})}});
    return aiJson({ok:true,settings});
  }
  if(path==="/api/admin/ai-warning" && method==="POST") {
    if(!ownerOnly())return aiJson({error:"Выдавать предупреждения вручную может только владелец."},403);
    const body=await aiReadJson(request),target=String(body.telegram_id||"").trim(),reason=String(body.reason||"").trim().slice(0,500);
    if(!/^\\d{5,20}$/.test(target))return aiJson({error:"Введите корректный Telegram ID участника."},400);
    if(reason.length<3)return aiJson({error:"Укажите понятную причину предупреждения."},400);
    const settings=await aiSettings(env);
    if(!settings.group_chat_id)return aiJson({error:"Бот ещё не определил группу. Напишите любое сообщение в группе."},409);
    let memberInfo;
    try{memberInfo=await aiTelegram(env,"getChatMember",{chat_id:settings.group_chat_id,user_id:Number(target)});}
    catch{return aiJson({error:"Не удалось найти этого участника в группе. Проверьте Telegram ID и права бота."},404);}
    if(["left","kicked"].includes(memberInfo?.status))return aiJson({error:"Этот пользователь больше не состоит в группе."},404);
    if(["creator","administrator"].includes(memberInfo?.status))return aiJson({error:"Нельзя выдать предупреждение администратору группы."},403);
    const member=await env.DB.prepare("SELECT first_name,last_name,username FROM ai_group_members WHERE chat_id=? AND telegram_id=?").bind(String(settings.group_chat_id),target).first();
    const pseudo={from:{id:Number(target),first_name:member?.first_name||memberInfo?.user?.first_name||"Участник",last_name:member?.last_name||memberInfo?.user?.last_name||"",username:member?.username||memberInfo?.user?.username||""}};
    await aiWarn(env,settings.group_chat_id,pseudo,reason,"manual");
    await aiLog(env,{chat_id:settings.group_chat_id,actor:telegramId,target,type:"manual_warning",severity:"warning",details:{reason}});
    return aiJson({ok:true});
  }
  if(path==="/api/admin/ai-group-invoice" && method==="POST") {
    if(!ownerOnly())return aiJson({error:"Создавать групповые счета может только владелец."},403);
    const body=await aiReadJson(request),amount=Number(body.amount_stars),title=String(body.title||"Счёт Агентства подарков").trim().slice(0,32),description=String(body.description||"Оплата в Агентстве подарков").trim().slice(0,255);
    if(!Number.isSafeInteger(amount)||amount<1||amount>100000)return aiJson({error:"Укажите сумму от 1 до 100000 Stars."},400);
    const settings=await aiSettings(env);
    if(!settings.group_chat_id)return aiJson({error:"Бот ещё не определил группу. Напишите любое сообщение в группе."},409);
    const payload="group_invoice_"+crypto.randomUUID();
    await env.DB.prepare("INSERT INTO payment_intents(payload,telegram_id,kind,reference_id,amount_stars,bonus_points,plan_type,status) VALUES(?,?,'topup',?,?,0,?,'pending')")
      .bind(payload,String(telegramId),String(settings.group_chat_id),amount,"group_invoice:"+title).run();
    try {
      const invoiceUrl=await aiTelegram(env,"createInvoiceLink",{title,description,payload,provider_token:"",currency:"XTR",prices:[{label:title,amount}]});
      await aiTelegram(env,"sendMessage",{chat_id:settings.group_chat_id,text:"⭐ Счёт от «Агентства подарков»\n"+title+"\n"+description+"\nСумма: "+amount+" Stars\n\nНажмите кнопку ниже, чтобы оплатить.",reply_markup:{inline_keyboard:[[{text:"Оплатить · "+amount+" ⭐",url:invoiceUrl}]]}});
      await aiLog(env,{chat_id:settings.group_chat_id,actor:telegramId,type:"group_invoice_created",details:{amount_stars:amount,title,payload}});
      await aiNotifyOwner(env,"⭐ В группу отправлен счёт: "+title+" · "+amount+" Stars.");
      return aiJson({ok:true,amount_stars:amount});
    } catch(error) {
      await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=? AND status='pending'").bind(payload).run();
      return aiJson({error:"Не удалось отправить счёт в группу: "+String(error.message||error).slice(0,250)},502);
    }
  }
  if(path==="/api/admin/ai-questions" && method==="GET") {
    if(!has("ai_bot_logs"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT * FROM ai_owner_questions ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,id DESC LIMIT 100").all();
    return aiJson({ok:true,questions:rows.results||[]});
  }
  if(path==="/api/admin/ai-questions" && method==="POST") {
    if(!ownerOnly())return aiJson({error:"Отвечать на вопросы может только владелец."},403);
    const body=await aiReadJson(request);
    const row=await env.DB.prepare("SELECT * FROM ai_owner_questions WHERE id=? AND status='open'").bind(Number(body.id)).first();
    if(!row)return aiJson({error:"Вопрос не найден или уже закрыт."},404);
    const answer=String(body.answer||"").trim().slice(0,2000);
    if(!answer)return aiJson({error:"Введите ответ."},400);
    const sent=await aiGroupReply(env,row.chat_id,row.telegram_id,"Ответ владельца Агентства подарков: "+answer);
    if(!sent)return aiJson({error:"Подождите 5 секунд перед следующим ответом ИИ."},429);
    await env.DB.prepare("UPDATE ai_owner_questions SET status='answered',answer=?,answered_at=CURRENT_TIMESTAMP,answered_by=? WHERE id=? AND status='open'").bind(answer,String(telegramId),row.id).run();
    await aiLog(env,{actor:telegramId,target:row.telegram_id,type:"owner_question_answered",details:{question_id:row.id}});
    return aiJson({ok:true});
  }
  if(path==="/api/admin/ai-logs" && method==="GET") {
    if(!has("ai_bot_logs"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT * FROM ai_moderation_events ORDER BY id DESC LIMIT 100").all();
    return aiJson({ok:true,events:rows.results||[]});
  }
  if(path==="/api/admin/ai-warnings" && method==="GET") {
    if(!has("ai_bot_logs"))return aiJson({error:"Недостаточно прав."},403);
    const retention=await aiSettings(env);
    const rows=await env.DB.prepare("SELECT * FROM ai_warnings WHERE issued_at>=datetime('now',?) ORDER BY id DESC LIMIT 100").bind("-"+Number(retention.warning_history_days||60)+" days").all();
    return aiJson({ok:true,warnings:rows.results||[]});
  }
  if(path==="/api/admin/ai-watchlist" && method==="GET") {
    if(!has("ai_bot_logs")&&!has("ai_watch_end"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT * FROM ai_watchlist WHERE status='active' ORDER BY expires_at").all();
    return aiJson({ok:true,watchlist:rows.results||[]});
  }
  if(path==="/api/admin/ai-action" && method==="POST") {
    if(!has("ai_bot_logs")&&!has("ai_watch_end"))return aiJson({error:"Недостаточно прав."},403);
    const body=await aiReadJson(request);
    if(body.action==="cancel_warning" && ownerOnly()) {
      await env.DB.prepare("UPDATE ai_warnings SET cancelled_at=CURRENT_TIMESTAMP,cancelled_by=? WHERE id=? AND cancelled_at IS NULL").bind(String(telegramId),Number(body.id)).run();
    } else if(body.action==="end_watch" && has("ai_watch_end")) {
      await env.DB.prepare("UPDATE ai_watchlist SET status='ended',expires_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(Number(body.id)).run();
    } else if(body.action==="warn_reporter" && ownerOnly()) {
      const complaint=await env.DB.prepare("SELECT * FROM ai_complaints WHERE id=? AND status='review'").bind(Number(body.id)).first();
      if(!complaint)return aiJson({error:"Жалоба не найдена."},404);
      const pseudo={from:{id:Number(complaint.reporter_telegram_id),first_name:"Участник"},message_id:complaint.source_message_id};
      await aiWarn(env,complaint.chat_id,pseudo,"Намеренное злоупотребление системой жалоб","manual");
      await env.DB.prepare("UPDATE ai_complaints SET status='dismissed',resolved_at=CURRENT_TIMESTAMP,resolved_by=? WHERE id=?").bind(String(telegramId),Number(body.id)).run();
    } else if(body.action==="resolve_complaint" && ownerOnly()) {
      await env.DB.prepare("UPDATE ai_complaints SET status='resolved',resolved_at=CURRENT_TIMESTAMP,resolved_by=? WHERE id=? AND status='review'").bind(String(telegramId),Number(body.id)).run();
    } else if(body.action==="dismiss_complaint" && ownerOnly()) {
      await env.DB.prepare("UPDATE ai_complaints SET status='dismissed',resolved_at=CURRENT_TIMESTAMP,resolved_by=? WHERE id=? AND status='review'").bind(String(telegramId),Number(body.id)).run();
    } else return aiJson({error:"Действие не разрешено или неизвестно."},403);
    await aiLog(env,{actor:telegramId,type:"admin_action",details:{action:body.action,id:body.id}});
    return aiJson({ok:true});
  }
  if(path==="/api/admin/notifications" && method==="GET") {
    if(!ownerOnly())return aiJson({error:"Уведомления владельца доступны только владельцу."},403);
    await env.DB.prepare("DELETE FROM admin_notifications WHERE created_at < datetime('now','-7 days')").run();
    const rows=await env.DB.prepare("SELECT id,type,title,body,reference_id,created_at,read_at FROM admin_notifications WHERE created_at>=datetime('now','-7 days') ORDER BY id DESC LIMIT 100").all();
    return aiJson({ok:true,notifications:rows.results||[],retention_days:7});
  }
  if(path==="/api/admin/notifications" && method==="POST") {
    if(!ownerOnly())return aiJson({error:"Управлять уведомлениями может только владелец."},403);
    const body=await aiReadJson(request),id=Number(body.id);
    if(body.action==="read_all")await env.DB.prepare("UPDATE admin_notifications SET read_at=CURRENT_TIMESTAMP WHERE read_at IS NULL").run();
    else if(body.action==="delete_all")await env.DB.prepare("DELETE FROM admin_notifications").run();
    else if(Number.isSafeInteger(id)&&id>0)await env.DB.prepare("UPDATE admin_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND read_at IS NULL").bind(id).run();
    else return aiJson({error:"Укажите уведомление или действие."},400);
    return aiJson({ok:true});
  }
  if(path==="/api/admin/ai-complaints" && method==="GET") {
    if(!has("ai_bot_logs"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT * FROM ai_complaints ORDER BY id DESC LIMIT 100").all();
    return aiJson({ok:true,complaints:rows.results||[]});
  }
  if(path==="/api/admin/ai-orders" && method==="GET") {
    if(!has("ai_orders_view"))return aiJson({error:"Недостаточно прав."},403);
    const [draftRows,bundleRows]=await Promise.all([
      env.DB.prepare("SELECT d.*,o.payment_status,o.paid_at,o.total_stars AS final_total_stars,o.discount_stars AS order_discount_stars,o.promo_code AS order_promo_code,CASE WHEN (d.status='paid' AND datetime(COALESCE(o.paid_at,d.updated_at))<=datetime('now','-3 days')) OR (d.status='cancelled' AND datetime(CASE WHEN json_valid(d.details_json) THEN COALESCE(json_extract(d.details_json,'$.terminal_at'),d.updated_at) ELSE d.updated_at END)<=datetime('now','-3 days')) OR (d.status IN ('collecting','review','approved') AND datetime(COALESCE(d.last_activity_at,d.updated_at))<=datetime('now','-3 days')) THEN 1 ELSE 0 END AS chat_closed,'ai_draft' AS record_type FROM ai_order_drafts d LEFT JOIN orders o ON o.id=d.order_id WHERE d.status IN ('collecting','review','approved','paid','cancelled') ORDER BY d.created_at DESC LIMIT 100").all(),
      env.DB.prepare("SELECT COALESCE(o.id,b.order_id,b.id) AS id,o.id AS order_id,b.telegram_id,u.first_name,u.username,COALESCE(o.product_title,b.title,'Подарочный набор') AS subject,COALESCE(o.total_stars,0) AS approved_stars,COALESCE(o.total_stars,0) AS estimated_stars,o.payment_status,o.paid_at,COALESCE(o.created_at,b.updated_at,b.created_at) AS created_at,CASE WHEN b.status='cancelled' OR o.payment_status IN ('cancelled','refunded') THEN 'cancelled' WHEN o.payment_status='paid' THEN 'paid' ELSE 'ordered' END AS status,b.bundle_json AS details_json,'gift_bundle' AS record_type FROM gift_bundles b LEFT JOIN orders o ON o.id=b.order_id AND o.telegram_id=b.telegram_id LEFT JOIN users u ON u.telegram_id=b.telegram_id WHERE b.status IN ('ordered','cancelled') ORDER BY COALESCE(o.created_at,b.updated_at,b.created_at) DESC LIMIT 100").all()
    ]);
    const orders=[...(draftRows.results||[]),...(bundleRows.results||[])].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,150);
    return aiJson({ok:true,orders});
  }
  if(path==="/api/admin/ai-orders" && method==="POST") {
    if(!has("ai_orders_manage"))return aiJson({error:"Недостаточно прав."},403);
    const body=await aiReadJson(request);
    if(body.action==="set_bundle_ai") {
      const orderId=String(body.order_id||"").slice(0,100),enabled=body.enabled===true;
      const bundle=await env.DB.prepare("SELECT id,bundle_json FROM gift_bundles WHERE order_id=? AND status='ordered' ORDER BY created_at DESC LIMIT 1").bind(orderId).first();
      if(!bundle)return aiJson({error:"Заказ конструктора не найден или уже закрыт."},404);
      let data={};try{data=JSON.parse(bundle.bundle_json||"{}");}catch{}
      data.ai_enabled=enabled;
      await env.DB.prepare("UPDATE gift_bundles SET bundle_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='ordered'").bind(JSON.stringify(data).slice(0,20000),bundle.id).run();
      await aiLog(env,{actor:telegramId,type:"gift_bundle_ai_toggled",details:{order_id:orderId,enabled}});
      return aiJson({ok:true,ai_enabled:enabled});
    }
    if(body.action==="delete_chat") {
      const id=String(body.id||"").slice(0,80);
      if(!id)return aiJson({error:"Не указан диалог."},400);
      const draft=await env.DB.prepare("SELECT id,telegram_id,details_json,status FROM ai_order_drafts WHERE id=? AND status IN ('collecting','review','approved','paid','cancelled')").bind(id).first();
      if(!draft)return aiJson({error:"Диалог не найден или уже удалён."},404);
      let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
      if(details.chat_deleted===true)return aiJson({ok:true,deleted:true});
      details.chat_deleted=true;details.ai_enabled=false;details.conversation=[];details.owner_messages=[];details.chat_deleted_at=new Date().toISOString();
      await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,status=CASE WHEN status='collecting' THEN 'cancelled' ELSE status END,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(details).slice(0,16000),id).run();
      await aiLog(env,{actor:telegramId,target:draft.telegram_id,type:"ai_order_chat_deleted",details:{draft_id:id,status:draft.status}});
      try{await env.DB.prepare("INSERT INTO admin_action_log (actor_telegram_id,target_telegram_id,action_type,details) VALUES (?,?,?,?)").bind(telegramId,draft.telegram_id,"ai_order_chat_deleted",JSON.stringify({draft_id:id,status:draft.status})).run();}catch(error){console.error("AI chat deletion audit failed:",String(error).slice(0,220));}
      return aiJson({ok:true,deleted:true});
    }
    if(body.action==="set_ai") {
      const id=String(body.id||"").slice(0,80),enabled=body.enabled===true;
      const draft=await env.DB.prepare("SELECT id,details_json,status FROM ai_order_drafts WHERE id=? AND status IN ('collecting','review','approved','paid')").bind(id).first();
      if(!draft)return aiJson({error:"Заказ или диалог не найден."},404);
      let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
      details.ai_enabled=enabled;
      await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(details).slice(0,16000),id).run();
      await aiLog(env,{actor:telegramId,type:"ai_order_auto_reply_toggled",details:{draft_id:id,enabled}});
      return aiJson({ok:true,ai_enabled:enabled});
    }
    if(body.action==="reply_order") {
      const id=String(body.id||"").slice(0,80),reply=String(body.reply||"").trim().slice(0,2000);
      if(!reply)return aiJson({error:"Введите сообщение покупателю."},400);
      const draft=await env.DB.prepare("SELECT d.id,d.chat_id,d.telegram_id,d.group_message_id,d.details_json,d.status,d.updated_at,d.last_activity_at,o.paid_at FROM ai_order_drafts d LEFT JOIN orders o ON o.id=d.order_id WHERE d.id=? AND d.status IN ('collecting','review','approved','paid','cancelled')").bind(id).first();
      if(!draft)return aiJson({error:"Диалог заказа не найден."},404);
      let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
      if(details.chat_deleted===true)return aiJson({error:"Этот чат удалён. Отправка сообщений заблокирована."},410);
      const expiryBase=draft.status==="paid"?(draft.paid_at||draft.updated_at):draft.status==="cancelled"?(details.terminal_at||draft.updated_at):(draft.last_activity_at||draft.updated_at);
      if(await env.DB.prepare("SELECT 1 AS expired WHERE datetime(?)<=datetime('now','-3 days')").bind(expiryBase).first())return aiJson({error:"Чат заказа закрыт: прошло более трёх дней без активности или после завершения заказа."},410);
      if(draft.status==="cancelled"&&!details.terminal_at)details.terminal_at=draft.updated_at;
      if(!Array.isArray(details.conversation)||!details.conversation.some(m=>m&&m.role==="user"))return aiJson({error:"В этом заказе ещё нет переписки. Ответ не отправлен."},409);
      details.owner_messages=Array.isArray(details.owner_messages)?details.owner_messages:[];
      details.owner_messages.push({content:reply,created_at:new Date().toISOString(),sender:"owner",via:"ai"});details.owner_messages=details.owner_messages.slice(-20);
      details.conversation=Array.isArray(details.conversation)?details.conversation:[];details.conversation.push({role:"owner",content:reply,via:"ai"});details.conversation=details.conversation.slice(-24);
      await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP,last_activity_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(details).slice(0,16000),id).run();
      // Личные сообщения покупателю отключены. Для заказов из группы сохраняем ответ в связанном групповом треде.
      let groupDelivered=false;
      if(details.source==="group"){
        try{
          const sent=await aiTelegram(env,"sendMessage",{chat_id:draft.chat_id,text:"💬 Ответ владельца Агентства по Вашему заказу\\n\\n"+reply,reply_to_message_id:draft.group_message_id||undefined,allow_sending_without_reply:true});
          groupDelivered=!!sent;
          if(typeof sent?.message_id==="number"){
            details.thread_message_ids=Array.isArray(details.thread_message_ids)?details.thread_message_ids:[];
            details.thread_message_ids.push(sent.message_id);details.thread_message_ids=details.thread_message_ids.slice(-30);
            await env.DB.prepare("UPDATE ai_order_drafts SET details_json=? WHERE id=?").bind(JSON.stringify(details).slice(0,16000),id).run();
          }
        }catch(error){console.error("AI group owner reply failed:",String(error).slice(0,220));}
      }
      await aiLog(env,{actor:telegramId,target:draft.telegram_id,type:"ai_order_owner_reply",details:{draft_id:id,delivered:groupDelivered,stored_in_app:true,private_dm:false}});
      return aiJson({ok:true,saved:true,delivered:groupDelivered,delivery:details.source==="group"?"group_thread":"in_app_only"});
    }
    if(body.action==="reply_workshop") {
      const id=String(body.id||"").slice(0,80),reply=String(body.reply||"").trim().slice(0,3000);
      if(!reply)return aiJson({error:"Введите сообщение покупателю."},400);
      const draft=await env.DB.prepare("SELECT d.id,d.telegram_id,d.details_json,d.status,d.updated_at,d.last_activity_at,o.paid_at FROM ai_order_drafts d LEFT JOIN orders o ON o.id=d.order_id WHERE d.id=? AND d.status IN ('review','approved','paid')").bind(id).first();
      if(!draft)return aiJson({error:"Диалог мастерской не найден."},404);
      let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
      if(details.source!=="miniapp_workshop")return aiJson({error:"Ответы через мастерскую доступны только для заказов из ИИ-мастерской."},400);
      if(details.chat_deleted===true)return aiJson({error:"Этот чат удалён. Ответ не отправлен."},410);
      if(await env.DB.prepare("SELECT 1 AS expired WHERE datetime(COALESCE(?,?))<=datetime('now','-3 days')").bind(draft.paid_at,draft.last_activity_at||draft.updated_at).first())return aiJson({error:"Чат заказа закрыт: прошло более трёх дней после оплаты или активности."},410);
      if(!Array.isArray(details.conversation)||!details.conversation.some(m=>m&&m.role==="user"))return aiJson({error:"В этом заказе ещё нет переписки. Ответ не отправлен."},409);
      details.owner_messages=Array.isArray(details.owner_messages)?details.owner_messages:[];
      const ownerMessage={content:reply.slice(0,350),created_at:new Date().toISOString(),sender:"owner"};
      details.owner_messages.push(ownerMessage);
      details.owner_messages=details.owner_messages.slice(-8);
      details.conversation=Array.isArray(details.conversation)?details.conversation:[];
      details.conversation.push({role:"owner",content:ownerMessage.content});
      details.conversation=details.conversation.slice(-16);
      details.summary=String(details.summary||"").slice(0,2000);
      await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(details),id).run();
      await aiLog(env,{actor:telegramId,target:draft.telegram_id,type:"ai_workshop_owner_reply",details:{draft_id:id,characters:reply.length}});
      return aiJson({ok:true});
    }
    if(body.action==="update_after_approval") {
      const id=String(body.id||"");
      const draft=await env.DB.prepare("SELECT d.*,o.payment_status,o.paid_at FROM ai_order_drafts d LEFT JOIN orders o ON o.id=d.order_id WHERE d.id=? AND d.status IN ('approved','paid')").bind(id).first();
      if(!draft)return aiJson({error:"Согласованный заказ не найден."},404);
      if(draft.payment_status==="paid" && (!draft.paid_at || !await env.DB.prepare("SELECT 1 AS ok WHERE datetime(?)>=datetime('now','-24 hours')").bind(draft.paid_at).first()))return aiJson({error:"Срок редактирования после оплаты — 24 часа — завершён."},403);
      let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
      if(body.summary!==undefined)details.summary=String(body.summary).slice(0,3000);
      const subject=String(body.subject||draft.subject).trim().slice(0,120);
      await env.DB.prepare("UPDATE ai_order_drafts SET subject=?,details_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(subject,JSON.stringify(details).slice(0,12000),id).run();
      if(draft.order_id){
        await env.DB.prepare("UPDATE custom_orders SET subject=?,answers_json=? WHERE id=?").bind(subject,JSON.stringify(details).slice(0,12000),draft.order_id).run();
        await env.DB.prepare("UPDATE orders SET product_title=? WHERE id=? AND payment_status IN ('pending','paid')").bind(subject,draft.order_id).run();
      }
      await aiLog(env,{actor:telegramId,target:draft.telegram_id,type:"ai_order_changed_after_approval",details:{draft_id:id,order_id:draft.order_id}});
      return aiJson({ok:true});
    }
    if(body.action==="update") {
      const id=String(body.id||"");
      const draft=await env.DB.prepare("SELECT * FROM ai_order_drafts WHERE id=? AND status='review'").bind(id).first();
      if(!draft)return aiJson({error:"Заказ не найден или уже подтверждён."},404);
      const price=Number(body.approved_stars);
      if(!Number.isSafeInteger(price)||price<280||price>800)return aiJson({error:"Итоговая цена индивидуального заказа должна быть от 280 до 800 Stars."},400);
      const subject=String(body.subject||draft.subject).trim().slice(0,120);
      let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
      if(body.summary!==undefined)details.summary=String(body.summary).slice(0,3000);
      await env.DB.prepare("UPDATE ai_order_drafts SET subject=?,details_json=?,approved_stars=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='review'")
        .bind(subject,JSON.stringify(details),price,id).run();
      await aiLog(env,{actor:telegramId,target:draft.telegram_id,type:"ai_order_edited",details:{draft_id:id,price}});
      return aiJson({ok:true});
    }
    if(body.action==="approve") {
      if(!ownerOnly())return aiJson({error:"Подтверждать ИИ-заказы может только владелец."},403);
      const draft=await env.DB.prepare("SELECT * FROM ai_order_drafts WHERE id=? AND status='review'").bind(String(body.id||"")).first();
      if(!draft || !draft.approved_stars)return aiJson({error:"Сначала сохраните заказ и его итоговую цену."},400);
      await env.DB.prepare("UPDATE ai_order_drafts SET status='review' WHERE id=?").bind(draft.id).run();
      const callback={id:"admin_"+crypto.randomUUID(),from:{id:Number(telegramId)},data:"ai_order_approve:"+draft.id};
      const approved=await aiApproveOrder(env,callback);
      return aiJson({ok:approved===true,error:approved===true?undefined:"Не удалось подтвердить заказ. Проверьте уведомление владельца."},approved===true?200:409);
    }
    if(body.action==="cancel") {
      await env.DB.prepare("UPDATE ai_order_drafts SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('collecting','review')").bind(String(body.id||"")).run();
      await aiLog(env,{actor:telegramId,type:"ai_order_cancelled",details:{id:body.id}});
      return aiJson({ok:true});
    }
    return aiJson({error:"Неизвестное действие."},400);
  }
  if(path==="/api/admin/ai-reports" && method==="GET") {
    if(!has("reports_view"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT * FROM ai_weekly_reports ORDER BY id DESC LIMIT 52").all();
    return aiJson({ok:true,reports:rows.results||[]});
  }
  return null;
}
export { handleAiTelegramUpdate, handleAiScheduled, handleAiAdminRoute, aiApplyPromoToDraft };