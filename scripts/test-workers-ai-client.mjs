import assert from "node:assert/strict";
import {
  AGENCY_TEXT_MODEL,
  AGENCY_VISION_MODEL,
  AGENCY_TRANSCRIPTION_MODEL,
  workersAiFetch,
  workersAiTranscribe
} from "../workers-ai-client.js";

const calls = [];
const env = {
  AI: {
    async run(model, input) {
      calls.push({ model, input });
      if (model === AGENCY_TEXT_MODEL) return { output_text: "Тестовый ответ GPT-OSS" };
      if (model === AGENCY_VISION_MODEL) return { response: '{"decision":"ok","reason":"Обычное изображение","confidence":0.99}' };
      if (model === AGENCY_TRANSCRIPTION_MODEL) return { text: "Тестовая расшифровка" };
      throw new Error("Unexpected model: " + model);
    }
  }
};

const textResponse = await workersAiFetch(env, {
  method: "POST",
  body: JSON.stringify({ model: "old-provider-model", instructions: "Правила", input: "Привет", max_output_tokens: 64 })
});
assert.equal(textResponse.status, 200);
assert.equal((await textResponse.json()).output_text, "Тестовый ответ GPT-OSS");
assert.equal(calls[0].model, AGENCY_TEXT_MODEL);
assert.equal(calls[0].input.model, undefined);

const visionResponse = await workersAiFetch(env, {
  method: "POST",
  body: JSON.stringify({
    model: "old-vision-model",
    instructions: "Проверяй только явные нарушения",
    input: [{ role: "user", content: [
      { type: "input_text", text: "Проверь изображение" },
      { type: "input_image", image_url: "data:image/png;base64,AA==" }
    ] }],
    max_output_tokens: 120
  })
});
assert.equal(visionResponse.status, 200);
assert.match((await visionResponse.json()).output_text, /decision/);
assert.equal(calls[1].model, AGENCY_VISION_MODEL);
assert.equal(calls[1].input.messages[1].content[1].image_url.url, "data:image/png;base64,AA==");

const transcript = await workersAiTranscribe(env, new Uint8Array([1, 2, 3]).buffer);
assert.equal(transcript, "Тестовая расшифровка");
assert.equal(calls[2].model, AGENCY_TRANSCRIPTION_MODEL);
assert.deepEqual(calls[2].input.audio, [1, 2, 3]);

const missingBinding = await workersAiFetch({}, { body: "{}" });
assert.equal(missingBinding.status, 503);

console.log("Workers AI adapter tests passed.");
