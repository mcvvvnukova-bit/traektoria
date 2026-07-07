const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createChatCompletionText,
  isLlmEnabled,
  resolveLlmConfig,
} = require("../src/llm-client");

test("resolves step-specific provider and model", () => {
  const config = resolveLlmConfig("description_selection", {
    env: {
      LLM_PROVIDER: "openrouter",
      LLM_DEFAULT_MODEL: "openai/gpt-5.2",
      LLM_PROVIDER_DESCRIPTION_SELECTION: "local",
      LLM_MODEL_DESCRIPTION_SELECTION: "qwen-local",
      LOCAL_LLM_API_URL: "http://127.0.0.1:9000/v1/chat/completions",
    },
    fetchImpl: async () => ({}),
  });

  assert.equal(config.provider, "local");
  assert.equal(config.model, "qwen-local");
  assert.equal(config.apiUrl, "http://127.0.0.1:9000/v1/chat/completions");
});

test("uses OpenRouter key and attribution headers", async () => {
  let capturedUrl = "";
  let capturedRequest = null;

  const text = await createChatCompletionText({
    step: "trajectory_deep",
    provider: "openrouter",
    model: "google/gemini-test",
    apiKey: "test-openrouter-key",
    httpReferer: "https://bot.example.test",
    appTitle: "Traektoria Test",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: async (url, request) => {
      capturedUrl = url;
      capturedRequest = request;
      return {
        ok: true,
        text: async () => JSON.stringify({
          choices: [{ message: { content: "ok" } }],
        }),
      };
    },
  });

  const body = JSON.parse(capturedRequest.body);
  assert.equal(text, "ok");
  assert.equal(capturedUrl, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(capturedRequest.headers.Authorization, "Bearer test-openrouter-key");
  assert.equal(capturedRequest.headers["HTTP-Referer"], "https://bot.example.test");
  assert.equal(capturedRequest.headers["X-OpenRouter-Title"], "Traektoria Test");
  assert.equal(body.model, "google/gemini-test");
});

test("local provider does not require an API key", async () => {
  const text = await createChatCompletionText({
    step: "description_selection",
    provider: "local",
    model: "local-model",
    apiUrl: "http://localhost:8012/v1/chat/completions",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: async (_url, request) => {
      assert.equal(request.headers.Authorization, undefined);
      return {
        ok: true,
        text: async () => JSON.stringify({
          choices: [{ message: { content: "local ok" } }],
        }),
      };
    },
  });

  assert.equal(text, "local ok");
});

test("LLM_ENABLED overrides legacy local enable flag", () => {
  assert.equal(isLlmEnabled("description_selection", {
    LLM_ENABLED: "false",
    LOCAL_LLM_ENABLED: "true",
  }), false);
  assert.equal(isLlmEnabled("description_selection", {
    LLM_ENABLED: "false",
    LLM_ENABLED_DESCRIPTION_SELECTION: "true",
  }), true);
});
