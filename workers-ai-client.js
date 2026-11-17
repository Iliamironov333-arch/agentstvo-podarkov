export const AGENCY_TEXT_MODEL = "@cf/openai/gpt-oss-120b";
export const AGENCY_VISION_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const AGENCY_TRANSCRIPTION_MODEL = "@cf/openai/whisper";

function getTextFromResult(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  if (Array.isArray(data?.output)) {
    const text = data.output.flatMap(item => Array.isArray(item.content) ? item.content : [])
      .filter(part => (part.type === "output_text" || part.type === "text") && typeof part.text === "string")
      .map(part => part.text).join("\n");
    if (text) return text;
  }
  if (typeof data?.response === "string") return data.response;
  const choice = data?.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice;
  if (Array.isArray(choice)) return choice.filter(part => typeof part?.text === "string").map(part => part.text).join("\n");
  return "";
}

function hasImageInput(input) {
  if (!Array.isArray(input)) return false;
  return input.some(item => Array.isArray(item?.content) && item.content.some(part => part?.type === "input_image" || part?.type === "image_url"));
}

function toMessages(payload) {
  const messages = [];
  if (typeof payload.instructions === "string" && payload.instructions.trim()) {
    messages.push({ role: "system", content: payload.instructions });
  }
  const input = typeof payload.input === "string"
    ? [{ role: "user", content: payload.input }]
    : Array.isArray(payload.input) ? payload.input : [];
  for (const item of input) {
    const role = ["system", "user", "assistant"].includes(item?.role) ? item.role : "user";
    if (!Array.isArray(item?.content)) {
      messages.push({ role, content: String(item?.content ?? "") });
      continue;
    }
    const content = item.content.flatMap(part => {
      if (part?.type === "input_text" || part?.type === "text") {
        return [{ type: "text", text: String(part.text || "") }];
      }
      if (part?.type === "input_image" || part?.type === "image_url") {
        const url = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
        return url ? [{ type: "image_url", image_url: { url } }] : [];
      }
      return [];
    });
    messages.push({ role, content });
  }
  return messages;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function toResponsesShape(result) {
  const outputText = getTextFromResult(result);
  return {
    ...result,
    output_text: outputText,
    output: [{ type: "message", content: [{ type: "output_text", text: outputText }] }]
  };
}

// Translate the old Responses-shaped internal requests to the documented
// Workers AI chat-completions input shape.
export async function workersAiFetch(env, requestInit = {}) {
  if (typeof env?.AI?.run !== "function") {
    return jsonResponse({ error: { message: "Workers AI binding AI is not configured" } }, 503);
  }
  let payload = {};
  try {
    payload = typeof requestInit.body === "string" ? JSON.parse(requestInit.body) : (requestInit.body || {});
  } catch {
    return jsonResponse({ error: { message: "Invalid Workers AI request payload" } }, 400);
  }
  const vision = hasImageInput(payload.input);
  const model = vision ? AGENCY_VISION_MODEL : AGENCY_TEXT_MODEL;
  const aiInput = {
    messages: toMessages(payload),
    max_tokens: Math.max(1, Math.min(4096, Number(payload.max_output_tokens) || 512))
  };
  for (const key of ["temperature", "top_p", "top_k", "repetition_penalty", "frequency_penalty", "presence_penalty", "seed", "response_format"]) {
    if (payload[key] !== undefined) aiInput[key] = payload[key];
  }
  if (vision) {
    aiInput.max_tokens = Math.min(aiInput.max_tokens, 256);
    aiInput.temperature = 0.1;
    aiInput.chat_template_kwargs = { enable_thinking: false };
  }
  try {
    const result = await env.AI.run(model, aiInput);
    return jsonResponse(toResponsesShape(result));
  } catch (error) {
    const message = String(error?.message || error || "Workers AI request failed").slice(0, 500);
    const isLimit = /rate|limit|quota|neuron|capacity/i.test(message);
    return jsonResponse({
      error: {
        message,
        code: isLimit ? "workers_ai_limit" : "workers_ai_error",
        type: isLimit ? "rate_limit_error" : "workers_ai_error"
      }
    }, isLimit ? 429 : 503);
  }
}

export async function workersAiTranscribe(env, buffer) {
  if (typeof env?.AI?.run !== "function") throw new Error("Workers AI binding AI is not configured");
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset || 0, buffer.byteLength);
  const result = await env.AI.run(AGENCY_TRANSCRIPTION_MODEL, { audio: Array.from(bytes) });
  return String(result?.text || "").trim();
}
