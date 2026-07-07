const DEFAULT_OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5.2";
const DEFAULT_LOCAL_API_URL = "http://127.0.0.1:8012/v1/chat/completions";
const DEFAULT_LOCAL_MODEL = "qwen2.5-3b-instruct-q4_k_m";
const DEFAULT_TIMEOUT_MS = 20000;

function isLlmEnabled(step, env = process.env) {
  const stepName = normalizeStepName(step);
  const stepValue = env[`LLM_ENABLED_${stepName}`];
  if (stepValue != null) return parseBoolean(stepValue);
  if (env.LLM_ENABLED != null) return parseBoolean(env.LLM_ENABLED);
  if (env.LOCAL_LLM_ENABLED != null) return parseBoolean(env.LOCAL_LLM_ENABLED);
  return false;
}

function resolveLlmConfig(step, options = {}) {
  const env = options.env || process.env;
  const stepName = normalizeStepName(step);
  const provider = normalizeProvider(firstDefined(
    options.provider,
    env[`LLM_PROVIDER_${stepName}`],
    env.LLM_PROVIDER,
    options.defaultProvider,
    env.LOCAL_LLM_ENABLED != null ? "local" : null,
    "local",
  ));
  const model = firstNonEmpty(
    options.model,
    env[`LLM_MODEL_${stepName}`],
    provider === "local" ? env[`LOCAL_LLM_MODEL_${stepName}`] : null,
    provider === "local" ? env.LOCAL_LLM_MODEL : null,
    env.LLM_DEFAULT_MODEL,
    env.LLM_MODEL,
    provider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : DEFAULT_LOCAL_MODEL,
  );
  const apiUrl = firstNonEmpty(
    options.apiUrl,
    env[`LLM_API_URL_${stepName}`],
    env.LLM_API_URL,
    provider === "openrouter" ? env.OPENROUTER_API_URL : null,
    provider === "local" ? env.LOCAL_LLM_API_URL : null,
    provider === "openrouter" ? DEFAULT_OPENROUTER_API_URL : DEFAULT_LOCAL_API_URL,
  );
  const apiKey = firstDefined(
    options.apiKey,
    env[`LLM_API_KEY_${stepName}`],
    env.LLM_API_KEY,
    provider === "openrouter" ? env.OPENROUTER_API_KEY : null,
    provider === "local" ? env.LOCAL_LLM_API_KEY : null,
    "",
  );
  const timeoutMs = parsePositiveInteger(firstDefined(
    options.timeoutMs,
    env[`LLM_TIMEOUT_MS_${stepName}`],
    env.LLM_TIMEOUT_MS,
    provider === "local" ? env.LOCAL_LLM_TIMEOUT_MS : null,
    DEFAULT_TIMEOUT_MS,
  ), DEFAULT_TIMEOUT_MS);

  return {
    provider,
    model,
    apiUrl,
    apiKey,
    timeoutMs,
    step: stepName.toLowerCase(),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    appTitle: firstNonEmpty(options.appTitle, env.OPENROUTER_APP_TITLE, env.LLM_APP_TITLE, "Traektoria51 Bot"),
    httpReferer: firstNonEmpty(options.httpReferer, env.OPENROUTER_HTTP_REFERER, env.LLM_HTTP_REFERER, ""),
  };
}

async function createChatCompletion(options) {
  const config = resolveLlmConfig(options.step, options);
  if (!config.fetchImpl) {
    throw new Error("Global fetch is unavailable. Use Node.js 18+ or inject fetchImpl.");
  }
  if (!config.apiUrl) {
    throw new Error(`Missing LLM API URL for provider ${config.provider}`);
  }
  if (config.provider === "openrouter" && !config.apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const controller = new AbortController();
  const timeoutMs = parsePositiveInteger(options.timeoutMs ?? config.timeoutMs, DEFAULT_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal || controller.signal;

  try {
    const body = {
      model: config.model,
      messages: options.messages || [],
    };
    if (options.temperature != null) body.temperature = options.temperature;
    if (options.maxTokens != null) body.max_tokens = options.maxTokens;
    if (options.responseFormat) body.response_format = options.responseFormat;
    Object.assign(body, options.extraBody || {});

    const response = await config.fetchImpl(config.apiUrl, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(body),
      signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`LLM API returned non-JSON response: ${String(text).slice(0, 300)}`);
    }

    if (!response.ok) {
      throw llmApiError(response, payload, text);
    }

    return {
      ...payload,
      _request: {
        provider: config.provider,
        apiUrl: config.apiUrl,
        model: config.model,
        body,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function createChatCompletionText(options) {
  const payload = await createChatCompletion(options);
  return extractChatCompletionText(payload);
}

function buildHeaders(config) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter") {
    if (config.httpReferer) headers["HTTP-Referer"] = config.httpReferer;
    if (config.appTitle) headers["X-OpenRouter-Title"] = config.appTitle;
  }
  return headers;
}

function extractChatCompletionText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const messageContent = payload?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (Array.isArray(messageContent)) {
    return messageContent.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.content === "string") return item.content;
      return "";
    }).join("");
  }

  const chunks = [];
  for (const outputItem of payload.output || []) {
    for (const contentItem of outputItem.content || []) {
      if (typeof contentItem.text === "string") {
        chunks.push(contentItem.text);
      } else if (typeof contentItem.output_text === "string") {
        chunks.push(contentItem.output_text);
      }
    }
  }
  if (chunks.length) return chunks.join("");

  throw new Error("LLM response did not include text content");
}

function llmApiError(response, payload, fallbackText) {
  const message = payload.error && payload.error.message ? payload.error.message : fallbackText;
  const error = new Error(`LLM API request failed: ${message}`);
  error.status = response.status;
  error.code = payload.error && payload.error.code ? payload.error.code : "";
  error.type = payload.error && payload.error.type ? payload.error.type : "";
  return error;
}

function normalizeStepName(step) {
  return String(step || "default")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "DEFAULT";
}

function normalizeProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "openrouter" || normalized === "local") return normalized;
  throw new Error(`Unsupported LLM provider: ${value}`);
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

module.exports = {
  DEFAULT_LOCAL_API_URL,
  DEFAULT_LOCAL_MODEL,
  DEFAULT_OPENROUTER_API_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_TIMEOUT_MS,
  isLlmEnabled,
  resolveLlmConfig,
  createChatCompletion,
  createChatCompletionText,
  extractChatCompletionText,
  normalizeStepName,
};
