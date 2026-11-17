const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const COOLDOWN_PREFIX = "openai_tpm_cooldown:";

function parseDelaySeconds(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.max(0, Number(text));
  const date = Date.parse(text);
  if (Number.isFinite(date) && date > Date.now()) return (date - Date.now()) / 1000;
  const match = text.match(/(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?/i);
  if (!match || !(match[1] || match[2] || match[3])) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function isTpmLimit(status, error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  return (Number(status) === 429 || Number(status) === 503)
    && /tokens?\s+per\s+min|\bTPM\b/i.test(message)
    && (code === "rate_limit_exceeded" || /rate limit/i.test(message));
}

export function getOpenAiRetryDelaySeconds(response, data = {}) {
  const message = String(data?.error?.message || "");
  const bodyHint = message.match(/(?:try again in|retry in|retry after)\s+((?:\d+(?:\.\d+)?\s*h)?\s*(?:\d+(?:\.\d+)?\s*m)?\s*(?:\d+(?:\.\d+)?\s*s)?)/i)?.[1];
  const hints = [
    response?.headers?.get("retry-after"),
    response?.headers?.get("x-ratelimit-reset-tokens"),
    response?.headers?.get("x-ratelimit-reset-requests"),
    bodyHint
  ].map(parseDelaySeconds).filter(value => value > 0);
  return hints.length ? Math.ceil(Math.max(...hints)) : 0;
}

export function formatOpenAiWait(seconds) {
  const total = Math.max(1, Math.ceil(Number(seconds) || 60));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) return hours + " ч " + minutes + " мин";
  if (minutes) return minutes + " мин";
  return remainder + " сек";
}

async function readCooldown(env, key) {
  if (!env?.DB) return null;
  try {
    const row = await env.DB.prepare("SELECT value FROM ai_runtime_state WHERE key=?").bind(key).first();
    if (!row?.value) return null;
    const state = JSON.parse(row.value);
    if (Number(state.until_ms) > Date.now()) return state;
    await env.DB.prepare("DELETE FROM ai_runtime_state WHERE key=?").bind(key).run();
  } catch (error) {
    console.warn("OpenAI TPM cooldown read failed:", String(error).slice(0, 180));
  }
  return null;
}

async function saveCooldown(env, key, state) {
  if (!env?.DB) return;
  try {
    const current = await readCooldown(env, key);
    const next = current && Number(current.until_ms) > Number(state.until_ms) ? current : state;
    await env.DB.prepare(
      "INSERT INTO ai_runtime_state(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) " +
      "ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP"
    ).bind(key, JSON.stringify(next)).run();
  } catch (error) {
    console.warn("OpenAI TPM cooldown save failed:", String(error).slice(0, 180));
  }
}

function cooldownResponse(model, state) {
  const seconds = Math.max(1, Math.ceil((Number(state.until_ms) - Date.now()) / 1000));
  const message = "Rate limit reached for " + model +
    " on tokens per min (TPM). Please try again in " + formatOpenAiWait(seconds) + ".";
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": String(seconds),
    "Cache-Control": "no-store"
  };
  if (state.request_id) headers["x-request-id"] = String(state.request_id);
  return new Response(JSON.stringify({
    error: { message, type: "rate_limit_error", code: "rate_limit_exceeded", param: null }
  }), { status: 429, headers });
}

export async function openAiFetch(env, requestInit) {
  if (!env?.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const init = { ...(requestInit || {}) };
  let payload = {};
  try {
    payload = typeof init.body === "string" ? JSON.parse(init.body) : (init.body || {});
  } catch {}
  const model = String(payload.model || env.OPENAI_MODEL || "unknown").slice(0, 120);
  const cooldownKey = COOLDOWN_PREFIX + model;
  const activeCooldown = await readCooldown(env, cooldownKey);
  if (activeCooldown) return cooldownResponse(model, activeCooldown);

  const headers = new Headers(init.headers || {});
  if (!headers.has("Authorization")) headers.set("Authorization", "Bearer " + env.OPENAI_API_KEY);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  init.method = init.method || "POST";
  init.headers = headers;
  const response = await fetch(OPENAI_RESPONSES_URL, init);

  if (!response.ok) {
    const data = await response.clone().json().catch(() => ({}));
    const providerError = data?.error || {};
    if (isTpmLimit(response.status, providerError)) {
      const delay = Math.min(604800, Math.max(60, getOpenAiRetryDelaySeconds(response, data) || 60));
      const state = {
        model,
        until_ms: Date.now() + delay * 1000,
        retry_after_seconds: delay,
        request_id: response.headers.get("x-request-id") || null,
        provider_message: String(providerError.message || "").slice(0, 300),
        recorded_at: new Date().toISOString()
      };
      await saveCooldown(env, cooldownKey, state);
    }
  }
  return response;
}
