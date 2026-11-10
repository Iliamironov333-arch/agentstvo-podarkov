const DEFAULT_AI_SETTINGS = {
  enabled: true,
  moderation_enabled: true,
  complaints_enabled: true,
  night_mode: true,
  night_start: "23:00",
  night_end: "07:00",
  greeting_enabled: true,
  greeting_text: "🎁 Добро пожаловать в «Агентство подарков», {name}! Рады видеть Вас в нашей группе. Здесь можно обсудить подарки, задать вопросы и оформить индивидуальный заказ.",
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
  ai_orders_rules: "Собирайте пожелания по одному вопросу за раз. Не обещайте цену и оформление до согласования владельцем. Если подходящего товара нет, предложите индивидуальный заказ.",
  profanity: true,
  spam: true,
  advertising: true,
  suspicious_links: true,
  repeated_messages: true,
  media_checks: true,
  ai_answers: true,
  ai_orders: true,
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
async function aiNotifyOwner(env, text) {
  if (!env.ADMIN_TELEGRAM_ID) return;
  try { await aiTelegram(env, "sendMessage", { chat_id: String(env.ADMIN_TELEGRAM_ID), text: String(text).slice(0,3900) }); }
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
    complaints_enabled: row ? row.complaints_enabled === 1 : true, group_chat_id: row?.group_chat_id || null };
}
async function aiSaveSettings(env, settings, actor) {
  const allowed = Object.keys(DEFAULT_AI_SETTINGS);
  const current = await aiSettings(env);
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(settings || {}, key)) {
    const value = settings[key];
    if (typeof DEFAULT_AI_SETTINGS[key] === "boolean") current[key] = value === true;
    else if (key === "answer_interval_seconds") current[key] = Math.max(5, Math.min(60, Number(value) || 5));
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
async function aiOpenAi(env, instructions, input, tokens = 350) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/responses",{method:"POST",
    headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({model:env.OPENAI_MODEL || "gpt-4o-mini",instructions,input,max_output_tokens:tokens})});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error("OpenAI HTTP "+response.status);
  let output = typeof data.output_text==="string" ? data.output_text : "";
  if (!output && Array.isArray(data.output)) output=data.output.flatMap(item=>Array.isArray(item.content)?item.content:[]).filter(item=>item.type==="output_text").map(item=>item.text||"").join("\n");
  if (!output.trim()) throw new Error("Empty OpenAI response");
  return output.trim().slice(0,3500);
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
  const raw=await aiOpenAi(env,prompt,String(text).slice(0,2500),150);
  const match=raw.match(/\{[\s\S]*\}/);if(!match)throw new Error("Text classifier returned no JSON");
  const parsed=JSON.parse(match[0]);
  return {decision:["ok","review","violation"].includes(parsed.decision)?parsed.decision:"review",reason:String(parsed.reason||"Неоднозначное сообщение").slice(0,250),confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0))};
}
function aiAgencyIntent(text) {
  return /(агентств|подар|товар|каталог|заказ|заказать|купить|покуп|стоим|цен[аыу]|оплат|stars|старс|баланс|достав|поддержк|акци|скидк|индивидуальн|сделать для меня)/i.test(text);
}
function aiOrderIntent(text) { return /(хочу|можно|могу|можете|нужно|надо|закаж|куп|оформ).{0,70}(заказ|подар|работ|товар|открытк|рисунок|поделк)|заказать|оформить заказ|хочу приобрести|хочу купить|купить товар|купить работу/i.test(text); }
async function aiGroupReply(env,chatId,userId,text){
  const settings=await aiSettings(env);
  const last=await env.DB.prepare("SELECT created_at FROM ai_group_messages WHERE chat_id=? AND role='assistant' ORDER BY id DESC LIMIT 1").bind(String(chatId)).first();
  if(last && (Date.now()-Date.parse(last.created_at.replace(" ","T")+"Z"))/1000<Number(settings.answer_interval_seconds||5))return false;
  await aiTelegram(env,"sendMessage",{chat_id:chatId,text:String(text).slice(0,3500),allow_sending_without_reply:true});
  await env.DB.prepare("INSERT INTO ai_group_messages(chat_id,telegram_id,role,content) VALUES(?,?,?,?)").bind(String(chatId),String(userId||""),"assistant",String(text).slice(0,3500)).run();
  return true;
}
async function aiReplyToGroup(env, chatId, user, text, settings) {
  const recent = await env.DB.prepare("SELECT role,content FROM ai_group_messages WHERE chat_id=? AND telegram_id=? ORDER BY id DESC LIMIT 50")
    .bind(String(chatId),String(user.id)).all();
  const context = (recent.results || []).reverse();
  const products = await env.DB.prepare("SELECT title,description,category,price_stars FROM products WHERE is_active=1 ORDER BY title LIMIT 100").all();
  const catalog = (products.results || []).map(p=>({title:p.title,description:p.description,category:p.category,price_stars:p.price_stars}));
  const instructions = [
    "Вы — официальный ИИ-помощник «Агентства подарков». Отвечайте исключительно по вопросам этого Агентства.",
    "Всегда обращайтесь к человеку на «Вы». Никогда не используйте «ты», фамильярность или сленг.",
    "Используйте только переданные сведения каталога и переписки. Не придумывайте цены, наличие, сроки, статус заказа, оплату и условия.",
    "Если точного ответа нет в каталоге или данных недостаточно, не угадывайте: needs_owner=true и сообщите, что уточните информацию у владельца.",
    "Предлагайте только действительно подходящие товары. Не называйте товары похожими, если они отличаются по ключевым пожеланиям клиента.",
    "Если человек хочет индивидуальный заказ, задайте один самый полезный уточняющий вопрос. Не утверждайте, что заказ уже оформлен.",
    "Не отвечайте на вопросы, не относящиеся к Агентству. Если сообщение не связано с Агентством, верните ignore=true; бот должен промолчать.",
    "Верните только JSON вида {\"answer\":\"готовый ответ клиенту на русском языке\",\"needs_owner\":true или false,\"ignore\":true или false}."
  ];
  if(settings.ai_instructions)instructions.push("Дополнительные инструкции владельца:\n"+String(settings.ai_instructions).slice(0,6000));
  const instructionText=instructions.join("\n");
  const input = [{role:"user",content:"Каталог (источник истины): "+JSON.stringify(catalog).slice(0,12000)},
    ...context.map(m=>({role:m.role,content:m.content}))];
  const raw = await aiOpenAi(env,instructionText,input,550);
  let answer=raw,needsOwner=false,ignore=false;
  try{
    const match=raw.match(/\{[\s\S]*\}/);
    if(match){const parsed=JSON.parse(match[0]);answer=String(parsed.answer||"").trim()||"Я пока не могу достоверно подтвердить эту информацию.";needsOwner=parsed.needs_owner===true;ignore=parsed.ignore===true;}
  }catch{}
  if(ignore){await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:"ai_unrelated_ignored"});return;}
  if(/не знаю|не могу достоверно подтвердить|нужно уточнить у владельца|не хватает данных/i.test(answer))needsOwner=true;
  let questionId=null;
  if(needsOwner){
    answer="Я пока не могу достоверно подтвердить эту информацию. Передал Ваш вопрос владельцу и сообщу Вам, когда получу ответ.";
    try{const saved=await env.DB.prepare("INSERT INTO ai_owner_questions(chat_id,telegram_id,question) VALUES(?,?,?)").bind(String(chatId),String(user.id),text.slice(0,2000)).run();questionId=saved.meta?.last_row_id||null;}catch{}
    await aiNotifyOwner(env,"❔ ИИ-помощнику нужна помощь владельца"+(questionId?" · вопрос №"+questionId:"")+"\nУчастник: "+user.id+"\nВопрос: "+text.slice(0,700)+"\nОтветьте в Mini App → ИИ-бот → Вопросы владельцу.");
    await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:"ai_answer_unknown",severity:"warning",details:{question_id:questionId,question:text.slice(0,700)}});
  }
  await aiGroupReply(env,chatId,user.id,answer);
  await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:needsOwner?"ai_answer_referred":"ai_answer",details:{characters:answer.length,question_id:questionId}});
}
async function aiFindCatalogMatches(env, requestText) {
  const rows=await env.DB.prepare("SELECT title,description,category,price_stars FROM products WHERE is_active=1 ORDER BY title LIMIT 150").all();
  const catalog=rows.results||[];
  if(!catalog.length)return [];
  try{
    const raw=await aiOpenAi(env,
      "Подберите товары каталога только при реальном совпадении с пожеланиями покупателя. Сначала учитывайте обязательные признаки: сезон, место, сюжет, предмет, стиль и назначение. Не предлагайте городскую зиму, если просят зимний лес; не считайте просто похожую тему достаточной. Если точного или действительно подходящего варианта нет, верните пустой массив. Не придумывайте товары. Верните только JSON {\"matches\":[{\"title\":\"точное название из каталога\",\"why\":\"коротко почему подходит\"}]}. Максимум 3 результата.",
      "Запрос покупателя: "+String(requestText).slice(0,1200)+"\nКаталог: "+JSON.stringify(catalog).slice(0,14000),220);
    const match=raw.match(/\{[\s\S]*\}/);
    if(!match)return [];
    const parsed=JSON.parse(match[0]);
    return (Array.isArray(parsed.matches)?parsed.matches:[]).slice(0,3).map(item=>{
      const product=catalog.find(p=>String(p.title).trim().toLowerCase()===String(item.title||"").trim().toLowerCase());
      return product?{...product,why:String(item.why||"Подходит по описанию").slice(0,180)}:null;
    }).filter(Boolean);
  }catch(error){
    console.error("AI catalog matching failed:",String(error).slice(0,250));
    return [];
  }
}
async function aiHandleOrderConversation(env, message, text, settings={}) {
  const chatId=String(message.chat.id),user=message.from;
  let draft=await env.DB.prepare("SELECT * FROM ai_order_drafts WHERE chat_id=? AND telegram_id=? AND status IN ('collecting','review') ORDER BY created_at DESC LIMIT 1")
    .bind(chatId,String(user.id)).first();
  if(!draft){
    const approved=await env.DB.prepare("SELECT * FROM ai_order_drafts WHERE chat_id=? AND telegram_id=? AND status IN ('approved','paid') ORDER BY created_at DESC LIMIT 1").bind(chatId,String(user.id)).first();
    if(approved && /(изменить|поменять|исправить|добавить|забыл сказать|ещё пожелани|другой цвет|другой размер|другой стиль)/i.test(text)){
      if(approved.status==="paid"){
        const paid=await env.DB.prepare("SELECT paid_at FROM orders WHERE id=?").bind(approved.order_id).first();
        if(!paid?.paid_at || !await env.DB.prepare("SELECT 1 AS ok WHERE datetime(?)>=datetime('now','-24 hours')").bind(paid.paid_at).first()){
          await aiGroupReply(env,chatId,user.id,"Срок внесения изменений в оплаченный заказ (24 часа после оплаты) завершён. Пожалуйста, обратитесь к владельцу, чтобы уточнить, возможны ли дополнительные изменения.");
          return true;
        }
      }
      let prior={};try{prior=JSON.parse(approved.details_json||"{}");}catch{}
      prior.change_requests=Array.isArray(prior.change_requests)?prior.change_requests:[];
      prior.change_requests.push({text:text.slice(0,1500),created_at:new Date().toISOString()});
      await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,last_activity_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(prior).slice(0,12000),approved.id).run();
      await aiNotifyOwner(env,"✏️ Клиент просит изменить уже согласованный заказ\nЗаказ: "+approved.id+"\nКлиент: "+user.id+"\nПожелание: "+text.slice(0,900)+"\nПроверьте карточку в Mini App → ИИ-заказы.");
      await aiGroupReply(env,chatId,user.id,"Благодарю, я передал Ваши новые пожелания владельцу. Он проверит возможность изменения заказа.");
      return true;
    }
  }
  if (!draft && !aiOrderIntent(text)) return false;
  if (!draft) {
    const exact=await env.DB.prepare("SELECT title,price_stars FROM products WHERE is_active=1").all();
    const exactMatch=(exact.results||[]).find(p=>String(p.title||"").length>0&&text.toLowerCase().includes(String(p.title).toLowerCase()));
    if(exactMatch){
      await aiGroupReply(env,chatId,user.id,"В каталоге есть работа «"+exactMatch.title+"» стоимостью "+exactMatch.price_stars+" ⭐. Вы можете открыть Mini App, найти её в каталоге и оформить покупку. Если Вам нужна другая работа, я помогу обсудить индивидуальный заказ.");
      await aiLog(env,{chat_id:chatId,actor:user.id,type:"catalog_match_for_order",details:{product:exactMatch.title,price_stars:exactMatch.price_stars}});
      return true;
    }
    const matches=await aiFindCatalogMatches(env,text);
    if(matches.length){
      const options=matches.map(p=>"• «"+p.title+"» — "+p.price_stars+" ⭐. "+p.why).join("\\n");
      await aiGroupReply(env,chatId,user.id,"Я проверил каталог. Возможно, Вам подойдут эти работы:\\n"+options+"\\n\\nПодскажите, пожалуйста, подходит ли один из вариантов? Если нет, обсудим индивидуальный заказ.");
      await aiLog(env,{chat_id:chatId,actor:user.id,type:"catalog_semantic_matches",details:{products:matches.map(p=>p.title)}});
      return true;
    }
    const id=crypto.randomUUID();
    const subject=text.slice(0,120) || "Индивидуальный заказ";
    await env.DB.prepare("INSERT INTO ai_order_drafts(id,chat_id,telegram_id,username,first_name,subject,details_json,status) VALUES(?,?,?,?,?,?,?,'collecting')")
      .bind(id,chatId,String(user.id),user.username||null,aiSafeName(user),subject,JSON.stringify({messages:[text]})).run();
    await aiNotifyOwner(env,"📝 Новый запрос на индивидуальный заказ\nКлиент: "+aiSafeName(user)+" ("+user.id+")\nОписание: "+text.slice(0,800));
    await aiGroupReply(env,chatId,user.id,"С удовольствием помогу Вам оформить индивидуальный заказ. Расскажите, пожалуйста, какую работу Вы хотите получить и какие особенности для Вас важны?");
    return true;
  }
  let details={};try{details=JSON.parse(draft.details_json||"{}");}catch{}
  details.messages=Array.isArray(details.messages)?details.messages:[];details.messages.push(text.slice(0,2000));
  await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,last_activity_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(JSON.stringify(details).slice(0,12000),draft.id).run();
  if(draft.status==="review"){
    await env.DB.prepare("UPDATE ai_order_drafts SET details_json=?,last_activity_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='review'").bind(JSON.stringify(details).slice(0,12000),draft.id).run();
    await aiNotifyOwner(env,"➕ Клиент дополнил запрос на индивидуальный заказ\nЗаказ: "+draft.id+"\nTelegram ID: "+user.id+"\nДополнение: "+text.slice(0,800));
    await aiGroupReply(env,chatId,user.id,"Благодарю, я добавил Ваши пожелания к запросу и сообщил владельцу.");
    return true;
  }
  if(details.messages.length>=2 && details.messages.join(" ").length>=60) {
    let estimate=0, summary=details.messages.join("\n");
    try {
      const orderInstructions="Составьте краткое резюме индивидуального заказа и предложите предварительную цену в целых Telegram Stars. Верните JSON с полями subject, summary и price_stars. Цена ориентировочная, окончательно утверждает владелец. Не конвертируйте бюджет в рублях.\nДополнительные правила владельца:\n"+String(settings.ai_orders_rules||"").slice(0,3000);const raw=await aiOpenAi(env,orderInstructions,summary,180)
      const match=raw.match(/\{[\s\S]*\}/);if(match){const obj=JSON.parse(match[0]);if(Number.isSafeInteger(Number(obj.price_stars))&&Number(obj.price_stars)>=250&&Number(obj.price_stars)<=100000)estimate=Number(obj.price_stars);draft.subject=String(obj.subject||draft.subject).slice(0,120);details.summary=String(obj.summary||summary).slice(0,1500);}
    } catch {}
    await env.DB.prepare("UPDATE ai_order_drafts SET subject=?,details_json=?,estimated_stars=?,status='review',last_activity_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(draft.subject,JSON.stringify(details).slice(0,12000),estimate,draft.id).run();
    const card="🎁 ЗАПРОС НА ИНДИВИДУАЛЬНЫЙ ЗАКАЗ\nID: "+draft.id+"\nКлиент: "+aiSafeName(user)+" (@"+(user.username||"нет username")+")\nTelegram ID: "+user.id+"\nОписание: "+(details.summary||summary).slice(0,1600)+"\nПредварительная оценка ИИ: "+estimate+" ⭐\n\nПроверьте и при необходимости измените заказ в Mini App → ИИ-заказы.";
    const sent=await aiTelegram(env,"sendMessage",{chat_id:env.ADMIN_TELEGRAM_ID,text:card,reply_markup:{inline_keyboard:[[{text:"Подтвердить заказ",callback_data:"ai_order_approve:"+draft.id}]]}});
    await env.DB.prepare("UPDATE ai_order_drafts SET group_message_id=? WHERE id=?").bind(sent.message_id,draft.id).run();
    await aiGroupReply(env,chatId,user.id,"Благодарю за подробности! Я подготовил запрос на индивидуальный заказ и передал его владельцу на согласование. "+(estimate>0?"Предварительная стоимость — "+estimate+" ⭐. ":"")+"Окончательную цену подтвердит владелец.");
    return true;
  }
  await aiGroupReply(env,chatId,user.id,"Благодарю! Уточните, пожалуйста, ещё одну деталь: какой результат или особенности работы для Вас наиболее важны?");
  return true;
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
  if(!draft.approved_stars || Number(draft.approved_stars)<1) {
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Сначала укажите итоговую цену в Mini App → ИИ-заказы.",show_alert:true});return;
  }
  const orderId=crypto.randomUUID();
  const title=String(draft.subject||"Индивидуальный заказ").slice(0,120);
  const amount=Number(draft.approved_stars);
  const created=await env.DB.batch([
    env.DB.prepare("UPDATE ai_order_drafts SET status='approved',order_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='review' AND approved_stars>0")
      .bind(orderId,id),
    env.DB.prepare("INSERT INTO orders(id,telegram_id,product_id,product_title,quantity,price_stars,discount_percent,total_stars,payment_status,fulfillment_status) SELECT ?,?,NULL,?,1,?,0,?,'pending','awaiting_payment' WHERE changes()=1")
      .bind(orderId,String(draft.telegram_id),title,amount,amount),
    env.DB.prepare("INSERT INTO custom_orders(id,telegram_id,username,first_name,subject,answers_json,total_stars,status) SELECT ?,?,?,?,?,?, ?,'pending' WHERE changes()=1")
      .bind(orderId,String(draft.telegram_id),draft.username,draft.first_name,title,draft.details_json,amount)
  ]);
  if(!created[0]?.meta?.changes || created[0].meta.changes!==1 || !created[1]?.meta?.changes || created[1].meta.changes!==1 || !created[2]?.meta?.changes || created[2].meta.changes!==1){
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Заказ уже подтверждён или изменён. Обновите раздел ИИ-заказов.",show_alert:true});
    return false;
  }
  const payload="ai_order_"+crypto.randomUUID();
  await env.DB.prepare("INSERT INTO payment_intents(payload,telegram_id,kind,reference_id,amount_stars,bonus_points,plan_type,status) VALUES(?,?,'order',?,?,0,NULL,'pending')")
    .bind(payload,String(draft.telegram_id),orderId,amount).run();
  let invoiceUrl="";
  try {
    invoiceUrl=await aiTelegram(env,"createInvoiceLink",{title:title.slice(0,32),description:"Индивидуальный заказ Агентства подарков",payload,provider_token:"",currency:"XTR",prices:[{label:title.slice(0,32),amount}]});
  } catch(error) {
    await env.DB.prepare("UPDATE payment_intents SET status='failed' WHERE payload=?").bind(payload).run();
    await env.DB.batch([
      env.DB.prepare("UPDATE ai_order_drafts SET status='review',order_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=?").bind(id,orderId),
      env.DB.prepare("DELETE FROM custom_orders WHERE id=? AND status='pending'").bind(orderId),
      env.DB.prepare("DELETE FROM orders WHERE id=? AND payment_status='pending'").bind(orderId)
    ]);
    await aiNotifyOwner(env,"⚠️ Заказ "+orderId+" не отправлен: счёт не удалось сформировать. Запрос возвращён в ИИ-заказы для повторного подтверждения. "+String(error).slice(0,300));
    if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Заказ создан, но счёт не сформирован. Проверьте уведомление.",show_alert:true});
    return;
  }
  await aiTelegram(env,"sendMessage",{chat_id:draft.chat_id,text:"✅ Владелец подтвердил Ваш индивидуальный заказ!\n\n"+title+"\nИтого: "+amount+" ⭐\nДля оплаты используйте кнопку ниже.",reply_markup:{inline_keyboard:[[{text:"Оплатить заказ · "+amount+" ⭐",url:invoiceUrl}]]}});
  if(realCallback)await aiTelegram(env,"answerCallbackQuery",{callback_query_id:callback.id,text:"Заказ подтверждён, счёт отправлен в группу."});
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
  if(!env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY is not configured for audio review");
  const file=await aiTelegram(env,"getFile",{file_id:media.file_id});
  if(!file?.file_path||Number(file.file_size||0)>10*1024*1024)throw new Error("Audio exceeds the automatic review limit");
  const response=await fetch("https://api.telegram.org/file/bot"+env.BOT_TOKEN+"/"+file.file_path);
  if(!response.ok)throw new Error("Telegram audio download failed");
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>10*1024*1024)throw new Error("Audio exceeds the automatic review limit");
  const ext=String(file.file_path).split(".").pop().toLowerCase();
  const supported=["ogg","oga","mp3","mp4","mpeg","mpga","m4a","wav","webm"];
  if(!supported.includes(ext))throw new Error("Unsupported audio format");
  const mime=ext==="ogg"||ext==="oga"?"audio/ogg":ext==="mp3"?"audio/mpeg":ext==="m4a"?"audio/mp4":ext==="wav"?"audio/wav":ext==="webm"?"audio/webm":"audio/mp4";
  const form=new FormData();
  form.append("file",new Blob([buffer],{type:mime}),ext==="oga"?"voice.ogg":"voice."+ext);
  form.append("model",env.OPENAI_TRANSCRIPTION_MODEL||"gpt-transcribe");
  form.append("languages[]","ru");
  form.append("prompt","Русская речь в группе Агентства подарков. Сохраняйте произнесённые слова без добавления новых.");
  const result=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY},body:form});
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw new Error("Audio transcription API HTTP "+result.status);
  return String(data.text||"").trim().slice(0,3500);
}
async function aiInspectImage(env,message,settings={}){
  if(!env.OPENAI_API_KEY)return {decision:"review",reason:"ИИ-проверка изображения не настроена",confidence:0};
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
  const ai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({model:env.OPENAI_VISION_MODEL||env.OPENAI_MODEL||"gpt-4o-mini",instructions:"Вы — классификатор безопасности Telegram-группы. Оцените только очевидные нарушения правил: рекламная рассылка, азартные/мошеннические предложения, фишинговые материалы, оскорбительные изображения, явно сексуальный контент или явно жестокие графические изображения. Не описывайте содержимое подробно. Не считайте обычные фотографии, рисунки, поделки и мемы нарушениями. При сомнении выбирайте review. Верните JSON с ключами decision, reason и confidence. Автоматическое нарушение ставьте только при очевидном случае и высокой уверенности.\n\nДополнительные инструкции владельца:\n"+String(settings.moderation_instructions||"").slice(0,5000)+"\n\nДополнительные правила медиа:\n"+String(settings.media_rules||"").slice(0,2500),
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
async function handleAiTelegramUpdate(update, env) {
  if (update.callback_query?.data?.startsWith("ai_order_approve:")) {
    await aiApproveOrder(env,update.callback_query);return true;
  }
  const message=update.message||update.edited_message;
  if(!message || message.successful_payment || !aiIsGroup(message.chat)) return false;
  const chatId=String(message.chat.id),user=message.from;
  if(!user?.id || user.is_bot) return false;
  await env.DB.prepare("UPDATE ai_moderator_settings SET group_chat_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(chatId).run();
  const noticeKey="group_notice:"+chatId;
  const notice=await env.DB.prepare("INSERT OR IGNORE INTO ai_runtime_state(key,value) VALUES(?,'sending')").bind(noticeKey).run();
  if(notice.meta?.changes===1){
    try{
      await aiTelegram(env,"sendMessage",{chat_id:chatId,text:"ℹ️ В этой группе работает ИИ-модератор «Агентства подарков». Он проверяет доступные сообщения, ссылки и вложения, помогает по вопросам Агентства и обрабатывает жалобы. Для ответов и проверки отдельных сообщений и поддерживаемых изображений текст, поддерживаемые изображения и аудиосообщения могут передаваться в ИИ-сервис OpenAI для проверки и расшифровки. Система сохраняет текстовый контекст и журнал событий на ограниченный срок. Не отправляйте в группу пароли, коды и другие конфиденциальные данные. Обработка зависит от доступных боту данных и его прав в Telegram."});
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
  if(!settings.enabled)return true;
  const moderationActive=settings.moderation_enabled && !settings.moderation_temporarily_disabled;
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
    if(moderationActive && settings.spam && await aiIsFlood(env,chatId,user.id,settings)) {await aiWarn(env,chatId,message,"Слишком частая отправка сообщений (флуд)","spam");return true;}
    if(moderationActive && settings.repeated_messages && await aiIsRepeated(env,chatId,user.id,text)) {
      await aiWarn(env,chatId,message,"Повторяющиеся сообщения (флуд)","repeated_messages");return true;
    }
    await env.DB.prepare("INSERT INTO ai_group_messages(chat_id,telegram_id,role,content) VALUES(?,?, 'user', ?)")
      .bind(chatId,String(user.id),text.slice(0,3500)).run();
    if(settings.owner_suggestions && /(предлагаю|предложение|советую|было бы лучше|можно добавить|не хватает|улучшить|улучшение)/i.test(text)){
      await aiNotifyOwner(env,"💡 Предложение участника по улучшению Агентства\nУчастник: "+aiSafeName(user)+" ("+user.id+")\nСообщение: "+text.slice(0,900));
      await aiLog(env,{chat_id:chatId,actor:user.id,target:env.ADMIN_TELEGRAM_ID,type:"owner_suggestion",details:{message:text.slice(0,1000)}});
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
      return true;
    }
    const existingWatch=moderationActive ? await env.DB.prepare("SELECT id FROM ai_watchlist WHERE chat_id=? AND telegram_id=? AND status='active' AND expires_at>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1").bind(chatId,String(user.id)).first() : null;
    if(existingWatch) await aiLog(env,{chat_id:chatId,actor:user.id,target:user.id,type:"watched_message",details:{message_id:message.message_id}});
    const replied=message.reply_to_message?.from?.is_bot===true;
    const relevant=aiAgencyIntent(text) || replied;
    const orderHandled = settings.ai_orders ? await aiHandleOrderConversation(env,message,text,settings) : false;
    if(orderHandled) return true;
    if(settings.ai_answers && relevant && (!settings.night_mode || !aiNightNow(settings) || aiAgencyIntent(text))) {
      try { await aiReplyToGroup(env,chatId,user,text,settings); }
      catch(error) {
          await aiGroupReply(env,chatId,user.id,"Извините, сейчас я не могу достоверно ответить на этот вопрос. Я передал его владельцу для уточнения.");
          let questionId=null;
          try{const saved=await env.DB.prepare("INSERT INTO ai_owner_questions(chat_id,telegram_id,question) VALUES(?,?,?)").bind(chatId,String(user.id),text.slice(0,2000)).run();questionId=saved.meta?.last_row_id||null;}catch{}
          await aiNotifyOwner(env,"❔ ИИ-модератор не смог ответить на вопрос"+(questionId?" №"+questionId:"")+"\nУчастник: "+user.id+"\nВопрос: "+text.slice(0,700)+"\nОтвет можно добавить в Mini App → ИИ-бот → Вопросы владельцу.\nОшибка: "+String(error).slice(0,250));
          await aiLog(env,{chat_id:chatId,actor:"ai_moderator",target:user.id,type:"ai_answer_unknown",severity:"warning",details:{question_id:questionId,question:text.slice(0,700)}});
        }
    }
  }
  return true;
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
  try { popular=await aiOpenAi(env,Number(messageCount?.total||0)>100?"Выделите 8–12 популярных тем, кратко опишите главные обсуждения и повторяющиеся вопросы. Не называйте участников и не раскрывайте персональные данные. Верните структурированный список.":"Кратко выделите 5–8 популярных тем из переписки. Не называйте участников и не раскрывайте персональные данные. Верните только список тем.",topicText,Number(messageCount?.total||0)>100?500:250); } catch {}
  const restrictions=Number((events.results||[]).find(x=>x.event_type==="restriction")?.total||0);
  const metrics={events:events.results||[],messages:Number(messageCount?.total||0),warnings:Number(warnings?.total||0),restrictions,complaints:Number(complaints?.total||0),orders:Number(orders?.total||0),paid_orders:Number(paid?.total||0)};
  const delta=(current,previous)=>{const d=Number(current||0)-Number(previous||0);return (d>0?"+":"")+d;};
  const comparison="Предыдущая неделя → текущая:\nСообщения: "+Number(prevMessageCount?.total||0)+" → "+metrics.messages+" ("+delta(metrics.messages,prevMessageCount?.total)+")\nПредупреждения: "+Number(prevWarnings?.total||0)+" → "+metrics.warnings+" ("+delta(metrics.warnings,prevWarnings?.total)+")\nЖалобы: "+Number(prevComplaints?.total||0)+" → "+metrics.complaints+" ("+delta(metrics.complaints,prevComplaints?.total)+")\nЗапросы заказов: "+Number(prevOrders?.total||0)+" → "+metrics.orders+" ("+delta(metrics.orders,prevOrders?.total)+")";
  let suggestions="";
  const settings=await aiSettings(env);
  if(settings.owner_suggestions){
    try{suggestions=await aiOpenAi(env,"Предложите 3–5 практических улучшений для Агентства подарков, его группы, каталога, поддержки и оформления заказов. Используйте только наблюдаемые темы переписки; не выдумывайте проблемы. Кратко объясняйте пользу каждого предложения.",topicText,300);}catch{}
  }
  const report="📊 ЕЖЕНЕДЕЛЬНЫЙ ОТЧЁТ «АГЕНТСТВА ПОДАРКОВ»\nПериод: "+periodStart+" — "+periodEnd+"\n\nСообщения в группе: "+metrics.messages+"\nАктивность модерации: "+eventText+"\nПредупреждения: "+metrics.warnings+"\nОграничения: "+metrics.restrictions+"\nЖалобы: "+metrics.complaints+"\nЗапросы на заказы через группу: "+metrics.orders+"\nОплаченные ИИ-заказы: "+metrics.paid_orders+"\n\nДинамика:\n"+comparison+"\n\nПопулярные темы:\n"+popular+(suggestions?"\n\nИдеи по улучшению Агентства:\n"+suggestions:"");
  await env.DB.prepare("INSERT OR IGNORE INTO ai_weekly_reports(period_start,period_end,report_text,metrics_json) VALUES(?,?,?,?)").bind(periodStart,periodEnd,report,JSON.stringify({...metrics,comparison})).run();
  await aiNotifyOwner(env,report);
  await aiLog(env,{actor:"ai_moderator",type:"weekly_report_created",details:{period_start:periodStart,period_end:periodEnd}});
}
async function handleAiScheduled(env) {
  const nowParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Yekaterinburg",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const weekday=nowParts.find(p=>p.type==="weekday")?.value;
  const hour=Number(nowParts.find(p=>p.type==="hour")?.value||0),minute=Number(nowParts.find(p=>p.type==="minute")?.value||0);
  if(weekday==="Sat" && hour===8) await aiBuildWeeklyReport(env);
  await env.DB.prepare("DELETE FROM ai_warnings WHERE issued_at<datetime('now','-60 days')").run();
  await env.DB.prepare("UPDATE ai_watchlist SET status='ended' WHERE status='active' AND expires_at<=CURRENT_TIMESTAMP").run();
  await env.DB.prepare("UPDATE ai_group_messages SET content='[удалено по сроку хранения]' WHERE created_at<datetime('now','-90 days') AND content<>'[удалено по сроку хранения]'").run();
  await env.DB.prepare("DELETE FROM ai_moderation_events WHERE created_at<datetime('now','-180 days')").run();
  await env.DB.prepare("DELETE FROM ai_complaints WHERE created_at<datetime('now','-180 days') AND status<>'review'").run();
  await env.DB.prepare("DELETE FROM ai_group_members WHERE last_seen_at<datetime('now','-180 days')").run();
  await env.DB.prepare("DELETE FROM ai_owner_questions WHERE status='answered' AND answered_at<datetime('now','-180 days')").run();
  const reminders=await env.DB.prepare("SELECT d.id,d.chat_id,d.telegram_id,d.subject,o.id AS order_id FROM ai_order_drafts d JOIN orders o ON o.id=d.order_id WHERE d.status='approved' AND o.payment_status='pending' AND d.reminder_sent_at IS NULL AND d.updated_at<=datetime('now','-24 hours') LIMIT 25").all();
  for(const row of reminders.results||[]){
    try{await aiTelegram(env,"sendMessage",{chat_id:row.chat_id,text:"Напоминание: счёт за Ваш индивидуальный заказ «"+row.subject+"» ожидает оплаты."});await env.DB.prepare("UPDATE ai_order_drafts SET reminder_sent_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();}catch(error){await aiNotifyOwner(env,"Не удалось отправить напоминание по ИИ-заказу "+row.id+": "+String(error).slice(0,200));}
  }
  const inactive=await env.DB.prepare("SELECT id,chat_id,telegram_id,subject FROM ai_order_drafts WHERE status='collecting' AND reminder_sent_at IS NULL AND last_activity_at<=datetime('now','-24 hours') LIMIT 25").all();
  for(const row of inactive.results||[]){
    try{await aiTelegram(env,"sendMessage",{chat_id:row.chat_id,text:"Здравствуйте! Хотите продолжить обсуждение Вашего индивидуального заказа «"+row.subject+"»? Я могу помочь уточнить детали."});await env.DB.prepare("UPDATE ai_order_drafts SET reminder_sent_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();}catch{}
  }
}
async function handleAiAdminRoute(path,method,request,env,telegramId,rootOwner,permissions) {
  const ownerOnly = () => rootOwner === true;
  const has = key => rootOwner || permissions?.[key] === true;
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
    const rows=await env.DB.prepare("SELECT * FROM ai_warnings WHERE issued_at>=datetime('now','-60 days') ORDER BY id DESC LIMIT 100").all();
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
  if(path==="/api/admin/ai-complaints" && method==="GET") {
    if(!has("ai_bot_logs"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT * FROM ai_complaints ORDER BY id DESC LIMIT 100").all();
    return aiJson({ok:true,complaints:rows.results||[]});
  }
  if(path==="/api/admin/ai-orders" && method==="GET") {
    if(!has("ai_orders_view"))return aiJson({error:"Недостаточно прав."},403);
    const rows=await env.DB.prepare("SELECT d.*,o.payment_status,o.paid_at FROM ai_order_drafts d LEFT JOIN orders o ON o.id=d.order_id ORDER BY d.created_at DESC LIMIT 100").all();
    return aiJson({ok:true,orders:rows.results||[]});
  }
  if(path==="/api/admin/ai-orders" && method==="POST") {
    if(!has("ai_orders_manage"))return aiJson({error:"Недостаточно прав."},403);
    const body=await aiReadJson(request);
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
      if(!Number.isSafeInteger(price)||price<1||price>100000)return aiJson({error:"Укажите цену от 1 до 100000 Stars."},400);
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
export { handleAiTelegramUpdate, handleAiScheduled, handleAiAdminRoute };
