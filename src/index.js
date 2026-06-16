const { loadEnvFile } = require("./load-env");
loadEnvFile();
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { FLOW, SCENARIO_1, SCENARIO_2, SCENARIO_3 } = require("./flow");
const { getRecommendations } = require("./recommendations");
const { createSelectionPdf } = require("./pdf-selection");
const { analyzeFreeText } = require("./llm-router");
const {
  createDescriptionSelectionState,
  ensureDescriptionSelectionState,
  applyDescriptionText,
  applyLlmAnalysis,
  recordLlmError,
} = require("./description-selection");
const {
  isDescriptionStep,
  isDescriptionCallback,
  startDescriptionFlow,
  handleDescriptionText,
  handleDescriptionCallback,
} = require("./description-flow");
const {
  createScenario3State,
  analyzeCompletedProgramsFromIds,
  mergeScenario3Links,
  getDeepTrajectoryRecommendations,
  buildCompletedProgramsReviewMessage,
  buildCompletedProgramsTopicsMessage,
  buildDeepTrajectoryResultMessage,
  buildScenario3PdfAnswers,
  buildScenario3PdfResult,
  buildMunicipalityKeyboard,
} = require("./deep-trajectory");
const {
  loadSession,
  saveSession,
  deleteSession,
  saveRuntimeState,
  loadRuntimeState,
  logRecommendation,
} = require("./session-store");
const { initializeDatabase } = require("./database-init");
const { makeTarget, normalizeTarget, targetKey, targetFilePart } = require("./target");
const { createMattermostTransport, replyMarkupOptions } = require("./mattermost-transport");
const { TELEGRAM_BOT_COMMANDS, parseBotCommand, buildHelpText } = require("./telegram-menu");

const TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED !== "false";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
const TELEGRAM_TRANSPORT = (process.env.TELEGRAM_TRANSPORT || "polling").toLowerCase();
const WEBHOOK_HOST = process.env.TELEGRAM_WEBHOOK_HOST || "0.0.0.0";
const WEBHOOK_PORT = Number(process.env.TELEGRAM_WEBHOOK_PORT || 3000);
const WEBHOOK_PUBLIC_URL = process.env.TELEGRAM_WEBHOOK_URL || "";
const WEBHOOK_PATH =
  process.env.TELEGRAM_WEBHOOK_PATH ||
  (TOKEN
    ? `/telegram/webhook/${crypto.createHash("sha256").update(TOKEN).digest("hex").slice(0, 24)}`
    : "/telegram/webhook/disabled");
const WEBHOOK_SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN || "";
const WEBHOOK_REGISTER = process.env.TELEGRAM_WEBHOOK_REGISTER !== "false";

const MAX_ENABLED = process.env.MAX_ENABLED === "true";
const MAX_TOKEN = process.env.MAX_BOT_TOKEN || "";
const MAX_API_BASE = process.env.MAX_API_BASE || "https://platform-api.max.ru";
const MAX_WEBHOOK_PUBLIC_URL = process.env.MAX_WEBHOOK_URL || WEBHOOK_PUBLIC_URL;
const MAX_WEBHOOK_PATH =
  process.env.MAX_WEBHOOK_PATH ||
  (MAX_TOKEN
    ? `/max/webhook/${crypto.createHash("sha256").update(MAX_TOKEN).digest("hex").slice(0, 24)}`
    : "/max/webhook/disabled");
const MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || "";
const MAX_WEBHOOK_REGISTER = process.env.MAX_WEBHOOK_REGISTER !== "false";
const MAX_UPDATE_TYPES = (process.env.MAX_UPDATE_TYPES || "message_created,message_callback,bot_started")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const MAX_ATTACHMENT_SEND_DELAYS_MS = [1500, 3000, 5000, 8000, 12000];
const ALICE_ENABLED = process.env.ALICE_ENABLED === "true";
const ALICE_WEBHOOK_PATH = process.env.ALICE_WEBHOOK_PATH || "/alice/webhook/disabled";
const WEB_CHAT_ENABLED = process.env.WEB_CHAT_ENABLED !== "false";
const WEB_CHAT_PATH_PREFIX = process.env.WEB_CHAT_PATH_PREFIX || "/web-chat";
const WEB_CHAT_ALLOWED_ORIGINS = (
  process.env.WEB_CHAT_ALLOWED_ORIGINS ||
  "https://traektoria51.ru,https://www.traektoria51.ru,http://traektoria51.ru,http://www.traektoria51.ru,http://localhost:8080,http://127.0.0.1:8080,http://localhost:4173,http://127.0.0.1:4173"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const WEB_CHAT_BODY_LIMIT_BYTES = Number(process.env.WEB_CHAT_BODY_LIMIT_BYTES || 16 * 1024);
const WEB_CHAT_MESSAGE_MAX_LENGTH = Number(process.env.WEB_CHAT_MESSAGE_MAX_LENGTH || 2000);
const WEB_CHAT_RATE_LIMIT_PER_MINUTE = Number(process.env.WEB_CHAT_RATE_LIMIT_PER_MINUTE || 30);
const WEB_CHAT_DOCUMENT_TTL_MS = Number(process.env.WEB_CHAT_DOCUMENT_TTL_MS || 60 * 60 * 1000);
const MATTERMOST_ENABLED = process.env.MATTERMOST_ENABLED === "true";
const MATTERMOST_URL = process.env.MATTERMOST_URL || "";
const MATTERMOST_TOKEN = process.env.MATTERMOST_TOKEN || "";
const MATTERMOST_USERNAME = process.env.MATTERMOST_USERNAME || "";
const MATTERMOST_PASSWORD = process.env.MATTERMOST_PASSWORD || "";
const MATTERMOST_MODE = process.env.MATTERMOST_MODE || "mentions";
const MATTERMOST_REPLY_MODE = process.env.MATTERMOST_REPLY_MODE || "thread";

if (TELEGRAM_ENABLED && !TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

if (MAX_ENABLED && !MAX_TOKEN) {
  console.error("Missing MAX_BOT_TOKEN");
  process.exit(1);
}

if (MATTERMOST_ENABLED && (!MATTERMOST_URL || (!MATTERMOST_TOKEN && (!MATTERMOST_USERNAME || !MATTERMOST_PASSWORD)))) {
  console.error("Missing Mattermost configuration");
  process.exit(1);
}

if (!TELEGRAM_ENABLED && !MAX_ENABLED && !ALICE_ENABLED && !WEB_CHAT_ENABLED && !MATTERMOST_ENABLED) {
  console.error("At least one transport must be enabled");
  process.exit(1);
}

const sessions = new Map();
const webResponseBuffers = new Map();
const webDocuments = new Map();
const webRateLimits = new Map();
let updateOffset = 0;
let mattermostTransport = null;
const RESTART_BUTTON_TEXT = "Начать заново";

function createSession() {
  return {
    step: "entry",
    scenario: null,
    descriptionSelection: createDescriptionSelectionState(),
    scenario2: createScenario2State(),
    scenario3: createScenario3State(),
  };
}

function createScenario2State() {
  return {
    ageText: "",
    age: null,
    interestsText: "",
    interests: [],
    goals: [],
    goalLabels: [],
    goal: null,
    goalLabel: "",
    specialNeeds: [],
    specialNeedLabels: [],
    specialNeedsLabel: "",
    specialNeedsOther: "",
    schedule: [],
    format: null,
    formatLabel: "",
    place: "",
    cost: "",
    wantsRefinement: null,
    groupSize: null,
    groupSizeLabel: "",
    avoidances: [],
    avoidanceLabels: [],
    avoidanceCustom: "",
    direction: null,
    directionLabel: "",
    pdfRequested: null,
  };
}

async function getSession(target) {
  const normalized = normalizeTarget(target);
  const key = targetKey(normalized);
  if (sessions.has(key)) return sessions.get(key);

  const stored = await loadSession(normalized.platform, normalized.id);
  const session = stored || createSession();
  ensureDescriptionSelectionState(session);
  if (!session.scenario2) session.scenario2 = createScenario2State();
  if (!session.scenario3) session.scenario3 = createScenario3State();
  sessions.set(key, session);
  return session;
}

async function persistSession(target, session) {
  const normalized = normalizeTarget(target);
  sessions.set(targetKey(normalized), session);
  await saveSession(normalized.platform, normalized.id, session);
}

async function resetSession(target) {
  const normalized = normalizeTarget(target);
  const session = createSession();
  sessions.set(targetKey(normalized), session);
  await deleteSession(normalized.platform, normalized.id);
  await saveSession(normalized.platform, normalized.id, session);
  return session;
}

async function telegramApi(method, payload) {
  const response = await fetch(`${API_BASE}/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function maxApi(pathname, options = {}) {
  const url = new URL(`${MAX_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: MAX_TOKEN,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.success === false) {
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${text || response.status}`);
  }
  return data;
}

async function sendMessage(target, text, replyMarkup, options = {}) {
  const normalized = normalizeTarget(target);
  if (normalized.platform === "web") {
    return enqueueWebMessage(normalized, toWebMessage(text, replyMarkup));
  }

  if (normalized.platform === "max") {
    return sendMaxMessage(normalized.id, text, replyMarkup);
  }

  if (normalized.platform === "mattermost") {
    return mattermostTransport.sendMessage(normalized, text, replyMarkup);
  }

  const payload = {
    chat_id: normalized.id,
    text,
    disable_web_page_preview: true,
  };
  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  return telegramApi("sendMessage", payload);
}

async function sendDocument(target, filePath, caption) {
  const normalized = normalizeTarget(target);
  if (normalized.platform === "web") {
    return sendWebDocument(normalized, filePath, caption);
  }

  if (normalized.platform === "max") {
    return sendMaxDocument(normalized.id, filePath, caption);
  }

  if (normalized.platform === "mattermost") {
    return mattermostTransport.sendDocument(normalized, filePath, caption);
  }

  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append("chat_id", String(normalized.id));
  if (caption) form.append("caption", caption);
  form.append("document", new Blob([buffer], { type: "application/pdf" }), path.basename(filePath));

  const response = await fetch(`${API_BASE}/bot${TOKEN}/sendDocument`, {
    method: "POST",
    body: form,
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`sendDocument failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function editMessage(target, messageId, text, replyMarkup, options = {}) {
  const normalized = normalizeTarget(target);
  if (normalized.platform === "web") {
    return sendMessage(normalized, text, replyMarkup);
  }

  if (normalized.platform === "max") {
    return editMaxMessage(messageId, text, replyMarkup);
  }

  if (normalized.platform === "mattermost") {
    return sendMessage(normalized, text, replyMarkup);
  }

  const payload = {
    chat_id: normalized.id,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
  };
  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  return telegramApi("editMessageText", payload);
}

async function answerCallbackQuery(platform, callbackQueryId) {
  if (!callbackQueryId) return null;
  if (platform === "web") return null;
  if (platform === "mattermost") return null;
  if (platform === "max") {
    return maxApi("/answers", {
      method: "POST",
      query: { callback_id: callbackQueryId },
      body: { notification: null },
    });
  }
  return telegramApi("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

async function sendMaxMessage(chatId, text, replyMarkup) {
  return maxApi("/messages", {
    method: "POST",
    query: {
      chat_id: chatId,
      disable_link_preview: true,
    },
    body: toMaxMessageBody(text, replyMarkup),
  });
}

async function editMaxMessage(messageId, text, replyMarkup) {
  if (!messageId) return null;
  return maxApi("/messages", {
    method: "PUT",
    query: { message_id: messageId },
    body: toMaxMessageBody(text, replyMarkup),
  });
}

async function sendMaxDocument(chatId, filePath, caption) {
  const upload = await maxApi("/uploads", {
    method: "POST",
    query: { type: "file" },
  });
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append("data", new Blob([buffer], { type: "application/pdf" }), path.basename(filePath));

  const uploadResponse = await fetch(upload.url, {
    method: "POST",
    body: form,
  });
  const uploadText = await uploadResponse.text();
  const uploadData = uploadText ? JSON.parse(uploadText) : {};
  if (!uploadResponse.ok) {
    throw new Error(`MAX file upload failed: ${uploadText || uploadResponse.status}`);
  }

  const body = {
    text: caption || "",
    attachments: [{ type: "file", payload: uploadData }],
  };

  for (let attempt = 0; attempt < MAX_ATTACHMENT_SEND_DELAYS_MS.length; attempt += 1) {
    await sleep(MAX_ATTACHMENT_SEND_DELAYS_MS[attempt]);
    try {
      return await maxApi("/messages", {
        method: "POST",
        query: { chat_id: chatId },
        body,
      });
    } catch (error) {
      if (!isMaxAttachmentNotReadyError(error) || attempt === MAX_ATTACHMENT_SEND_DELAYS_MS.length - 1) {
        throw error;
      }
    }
  }

  return null;
}

function isMaxAttachmentNotReadyError(error) {
  return String(error?.message || error).includes("attachment.not.ready");
}

function toWebMessage(text, replyMarkup) {
  const buttons = toWebButtons(replyMarkup);
  return {
    id: crypto.randomUUID(),
    type: "message",
    role: "bot",
    text: String(text || ""),
    ...(buttons.length ? { buttons } : {}),
  };
}

function toWebButtons(replyMarkup) {
  if (!replyMarkup?.inline_keyboard?.length) return [];
  return replyMarkup.inline_keyboard
    .map((row) =>
      row
        .map((button) => ({
          label: String(button.text || ""),
          data: String(button.callback_data || ""),
        }))
        .filter((button) => button.label && button.data),
    )
    .filter((row) => row.length);
}

function enqueueWebMessage(target, message) {
  const key = targetKey(target);
  const stack = webResponseBuffers.get(key);
  if (stack?.length) {
    stack[stack.length - 1].push(message);
  }
  return message;
}

async function collectWebMessages(target, handler) {
  const normalized = normalizeTarget(target);
  const key = targetKey(normalized);
  const stack = webResponseBuffers.get(key) || [];
  const messages = [];
  stack.push(messages);
  webResponseBuffers.set(key, stack);

  try {
    await handler();
    return messages;
  } finally {
    stack.pop();
    if (stack.length) webResponseBuffers.set(key, stack);
    else webResponseBuffers.delete(key);
  }
}

async function sendWebDocument(target, filePath, caption) {
  cleanupWebDocuments();
  const token = crypto.randomBytes(24).toString("hex");
  const fileName = path.basename(filePath);
  webDocuments.set(token, {
    filePath,
    fileName,
    caption: caption || "Подборка программ",
    expiresAt: Date.now() + WEB_CHAT_DOCUMENT_TTL_MS,
  });

  return enqueueWebMessage(target, {
    id: crypto.randomUUID(),
    type: "document",
    role: "bot",
    text: caption || "PDF-файл готов.",
    fileName,
    url: `${WEB_CHAT_PATH_PREFIX}/document/${token}`,
  });
}

function cleanupWebDocuments() {
  const now = Date.now();
  for (const [token, document] of webDocuments.entries()) {
    if (document.expiresAt <= now) {
      webDocuments.delete(token);
    }
  }
}

function toMaxMessageBody(text, replyMarkup) {
  const body = {
    text,
    format: "markdown",
  };
  const attachments = toMaxAttachments(replyMarkup);
  if (attachments.length) body.attachments = attachments;
  return body;
}

function toMaxAttachments(replyMarkup) {
  if (!replyMarkup?.inline_keyboard?.length) return [];
  return [
    {
      type: "inline_keyboard",
      payload: {
        buttons: replyMarkup.inline_keyboard.map((row) =>
          row.map((button) => ({
            type: "callback",
            text: button.text,
            payload: button.callback_data,
          })),
        ),
      },
    },
  ];
}

async function showEntry(chatId) {
  const session = await resetSession(chatId);
  session.step = "entry";
  await persistSession(chatId, session);
  await sendMessage(chatId, FLOW.entry.greetingText);
  await sendMessage(chatId, FLOW.entry.text, FLOW.entry.keyboard);
}

async function selectScenario(chatId, scenario) {
  const session = await getSession(chatId);
  session.step = "scenarioSelected";
  session.scenario = scenario;
  await persistSession(chatId, session);
  return sendMessage(chatId, `Вы выбрали сценарий: ${scenario.label}.`);
}

async function startScenario2(chatId) {
  const session = await getSession(chatId);
  session.step = "s2_age";
  session.scenario = {
    id: "agent_selection",
    label: "Подобрать с AI агентом",
  };
  session.scenario2 = createScenario2State();
  await persistSession(chatId, session);
  await sendMessage(chatId, SCENARIO_2.intro);
  return sendMessage(chatId, SCENARIO_2.age.text);
}

async function startScenario3(chatId) {
  const session = await getSession(chatId);
  session.step = "s3_collect_links";
  session.scenario = {
    id: "trajectory_deep",
    label: "Составить углубленную траекторию",
  };
  session.scenario3 = createScenario3State();
  session.scenario3.criteria = createDescriptionSelectionState();
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_3.intro);
}

async function startScenarioFromCommand(chatId, command) {
  if (command === "start") {
    return showEntry(chatId);
  }

  if (command === "help") {
    const session = await resetSession(chatId);
    session.step = "entry";
    await persistSession(chatId, session);
    await sendMessage(chatId, buildHelpText());
    return sendMessage(chatId, FLOW.entry.text, FLOW.entry.keyboard);
  }

  const session = await resetSession(chatId);
  if (command === "description") {
    return startDescriptionFlow({
      target: chatId,
      session,
      persistSession,
      sendMessage,
    });
  }

  if (command === "agent") {
    return startScenario2(chatId);
  }

  if (command === "deep") {
    return startScenario3(chatId);
  }

  if (command === "new_interests") {
    return selectScenario(chatId, {
      id: "trajectory_new_interests",
      label: "Траектория новых интересов",
    });
  }

  return null;
}

async function handleScenario3Links(chatId, text, session) {
  const merge = mergeScenario3Links(session.scenario3, text);
  if (!merge.added.length && !session.scenario3.submittedProgramIds.length) {
    await persistSession(chatId, session);
    return sendMessage(chatId, SCENARIO_3.noLinks);
  }

  await persistSession(chatId, session);
  if (merge.maxReached) {
    return finalizeScenario3Links(chatId, session);
  }

  const lines = [];
  if (merge.added.length) {
    lines.push(`Добавил ссылок: ${merge.added.length}. Всего собрано: ${merge.total} из 5.`);
  } else {
    lines.push(`Новых ссылок не нашел. Сейчас собрано: ${merge.total} из 5.`);
  }
  if (merge.duplicates.length) lines.push("Повторяющиеся ссылки я не добавлял.");
  if (merge.ignoredBecauseLimit) lines.push("Лишние ссылки сверх 5 не добавляю.");
  if (merge.parsed.invalidLinks.length) lines.push("Сейчас поддерживаются только ссылки на программы 51.pfdo.ru.");
  lines.push("", "Можете прислать еще ссылки или продолжить.");
  return sendMessage(chatId, lines.join("\n"), SCENARIO_3.linkCollection.keyboard);
}

async function finalizeScenario3Links(chatId, session) {
  if (!session.scenario3.submittedProgramIds?.length) {
    return sendMessage(chatId, SCENARIO_3.noLinks);
  }

  let analysis;
  try {
    analysis = await analyzeCompletedProgramsFromIds(session.scenario3.submittedProgramIds, {
      links: session.scenario3.links,
      invalidLinks: session.scenario3.invalidLinks,
      programLinks: session.scenario3.programLinks,
    });
  } catch (error) {
    console.error("Scenario 3 link analysis failed:", error);
    return sendMessage(chatId, "Не удалось проверить ссылки в базе PFDO. Попробуйте отправить ссылки еще раз.");
  }

  if (!analysis.programIds.length) {
    return sendMessage(chatId, SCENARIO_3.noLinks);
  }

  if (!analysis.programs.length) {
    return sendMessage(chatId, "Не нашел эти программы в локальном каталоге PFDO. Проверьте ссылки и отправьте их еще раз.");
  }

  if (!analysis.municipalities.length) {
    return sendMessage(chatId, "Нашел программы, но не смог определить населенный пункт. Попробуйте другие ссылки или начните заново через /start.");
  }

  applyScenario3Analysis(session.scenario3, analysis);
  if (analysis.municipalities.length > 1) {
    session.step = "s3_choose_municipality";
    await persistSession(chatId, session);
    return sendMessage(
      chatId,
      "Нашел программы из разных населенных пунктов. В каком населенном пункте искать продолжение?",
      buildMunicipalityKeyboard(analysis.municipalities),
    );
  }

  const municipality = analysis.municipalities[0];
  if (municipality) {
    session.scenario3.municipalityId = municipality.id;
    session.scenario3.municipalityName = municipality.name;
  }

  return showScenario3CompletedReview(chatId, session, analysis);
}

async function showScenario3CompletedReview(chatId, session, analysis = null) {
  session.step = "s3_review_completed";
  await persistSession(chatId, session);
  const linkFormat = scenario3LinkFormat(chatId);
  const messageOptions = scenario3MessageOptions(linkFormat);
  const text = buildCompletedProgramsReviewMessage(session.scenario3, analysis, { linkFormat });
  const chunks = splitMessage(text);
  for (let index = 0; index < chunks.length; index += 1) {
    await sendMessage(
      chatId,
      chunks[index],
      index === chunks.length - 1 ? SCENARIO_3.completedTopics.keyboard : undefined,
      messageOptions,
    );
  }
  session.step = "s3_criteria_choice";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_3.criteria.text, SCENARIO_3.criteria.keyboard);
}

async function handleScenario3CriteriaText(chatId, text, session) {
  if (!session.scenario3.criteria) {
    session.scenario3.criteria = createDescriptionSelectionState();
  }
  applyDescriptionText(session.scenario3.criteria, text, { mode: "edit" });
  await enrichScenario3CriteriaWithLlm(session, text);
  await persistSession(chatId, session);
  return showScenario3Results(chatId, session);
}

async function enrichScenario3CriteriaWithLlm(session, text) {
  if (!analyzeFreeText) return;
  try {
    const analysis = await analyzeFreeText({
      scenario: "trajectory_deep",
      mode: "edit",
      current: session.scenario3.criteria,
    }, text);
    if (analysis) {
      applyLlmAnalysis(session.scenario3.criteria, analysis, { mode: "edit" });
    }
  } catch (error) {
    recordLlmError(session.scenario3.criteria, error);
    console.warn("Scenario 3 criteria LLM analysis skipped:", error.message);
  }
}

async function showScenario3Results(chatId, session) {
  const criteriaFields = session.scenario3.criteria?.fields || {};
  const criteriaAge = Number(criteriaFields.ageYears);
  if (!session.scenario3.ageYears && !Number.isFinite(criteriaAge) && !criteriaFields.age) {
    session.step = "s3_wait_criteria_text";
    await persistSession(chatId, session);
    return sendMessage(chatId, "Не удалось надежно определить возраст по пройденным программам. Напишите возраст ребенка и при желании другие критерии поиска.");
  }

  session.step = "s3_results";
  await persistSession(chatId, session);
  await sendMessage(chatId, "Ищу программы, которые могут быть углубленным продолжением...");

  let result;
  try {
    result = await getDeepTrajectoryRecommendations(session.scenario3, { limit: 10 });
  } catch (error) {
    console.error("Scenario 3 recommendations failed:", error);
    return sendMessage(chatId, "Не удалось подобрать продолжение по этим данным. Попробуйте начать заново через /start.");
  }

  session.scenario3.lastResult = result;
  await persistSession(chatId, session);
  const target = normalizeTarget(chatId);
  await logRecommendation(target.platform, target.id, {
    ...result,
    scenario: "deep_continuation",
    answers: session.scenario3,
  });

  const linkFormat = scenario3LinkFormat(chatId);
  const messageOptions = scenario3MessageOptions(linkFormat);
  const text = buildDeepTrajectoryResultMessage(null, session.scenario3, result, { linkFormat });
  for (const chunk of splitMessage(text)) {
    await sendMessage(chatId, chunk, undefined, messageOptions);
  }
  if (!result.items.length) {
    return sendMessage(chatId, "Чтобы построить новую траекторию, нажмите /start.");
  }
  session.step = "s3_pdf";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_3.pdfDownload.text, SCENARIO_3.pdfDownload.keyboard);
}

async function askScenario2Interests(chatId, session) {
  session.step = "s2_interests";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.interests.text);
}

async function askScenario2Goal(chatId, session) {
  session.step = "s2_goal";
  await persistSession(chatId, session);
  return sendMessage(
    chatId,
    SCENARIO_2.goal.text,
    multiSelectKeyboard("goal", SCENARIO_2.goal.options, session.scenario2.goals || []),
  );
}

async function askScenario2SpecialNeeds(chatId, session) {
  session.step = "s2_special";
  await persistSession(chatId, session);
  return sendMessage(
    chatId,
    SCENARIO_2.specialNeeds.text,
    multiSelectKeyboard("special", SCENARIO_2.specialNeeds.options, selectedSpecialNeeds(session.scenario2)),
  );
}

async function askScenario2SpecialNeedsOther(chatId, session) {
  session.step = "s2_special_other";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.specialNeedsOther.text);
}

async function askScenario2Schedule(chatId, session) {
  session.step = "s2_schedule";
  await persistSession(chatId, session);
  return sendMessage(
    chatId,
    SCENARIO_2.schedule.text,
    multiSelectKeyboard("schedule", SCENARIO_2.schedule.options, session.scenario2.schedule),
  );
}

async function askScenario2Format(chatId, session) {
  session.step = "s2_format";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.format.text, inlineKeyboard(SCENARIO_2.format.options));
}

async function askScenario2Place(chatId, session) {
  session.step = "s2_place";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.place.text);
}

async function askScenario2Cost(chatId, session) {
  session.step = "s2_cost";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.cost.text);
}

async function askScenario2Refinement(chatId, session) {
  session.step = "s2_refinement";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.refinement.text, inlineKeyboard(SCENARIO_2.refinement.options));
}

async function askScenario2GroupSize(chatId, session) {
  session.step = "s2_group_size";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.groupSize.text, inlineKeyboard(SCENARIO_2.groupSize.options));
}

async function askScenario2Avoidances(chatId, session) {
  session.step = "s2_avoidances";
  await persistSession(chatId, session);
  return sendMessage(
    chatId,
    SCENARIO_2.avoidances.text,
    multiSelectKeyboard("avoidance", SCENARIO_2.avoidances.options, session.scenario2.avoidances, true),
  );
}

async function askScenario2AvoidanceCustom(chatId, session) {
  session.step = "s2_avoidance_custom";
  await persistSession(chatId, session);
  return sendMessage(chatId, "Напишите, что ребенку точно не подходит.");
}

async function askScenario2Direction(chatId, session) {
  session.step = "s2_direction";
  await persistSession(chatId, session);
  return sendMessage(chatId, SCENARIO_2.direction.text, inlineKeyboard(SCENARIO_2.direction.options));
}

async function showScenario2Results(chatId, session) {
  session.step = "s2_results";
  await persistSession(chatId, session);
  await sendMessage(chatId, "Подбираю программы по вашим ответам...");

  const profile = buildRecommendationProfile(session.scenario2);
  const result = await getRecommendations(profile, { limit: 10 });
  session.scenario2.lastResult = result;
  await persistSession(chatId, session);
  const target = normalizeTarget(chatId);
  await logRecommendation(target.platform, target.id, {
    ...result,
    scenario: "agent_selection",
    answers: session.scenario2,
  });

  const text = buildScenario2ResultMessage(result);
  for (const chunk of splitMessage(text)) {
    await sendMessage(chatId, chunk);
  }
  return sendMessage(chatId, SCENARIO_2.pdfDownload.text, inlineKeyboard(SCENARIO_2.pdfDownload.options));
}

async function handleText(message) {
  const chatId = incomingMessageTarget(message);
  const text = (message.text || "").trim();
  const botCommand = parseBotCommand(text);
  if (botCommand) {
    return startScenarioFromCommand(chatId, botCommand);
  }

  if (text === "/start" || text === RESTART_BUTTON_TEXT) {
    return showEntry(chatId);
  }

  const session = await getSession(chatId);
  ensureDescriptionSelectionState(session);
  if (!session.scenario2) session.scenario2 = createScenario2State();
  if (!session.scenario3) session.scenario3 = createScenario3State();

  if (isDescriptionStep(session.step)) {
    return handleDescriptionText({
      target: chatId,
      text,
      session,
      persistSession,
      sendMessage,
      getRecommendations,
      analyzeFreeText,
      logRecommendation,
      normalizeTarget,
    });
  }

  if (session.step === "s3_collect_links" || session.step === "s3_wait_links") {
    return handleScenario3Links(chatId, text, session);
  }

  if (session.step === "s3_wait_criteria_text") {
    return handleScenario3CriteriaText(chatId, text, session);
  }

  if (session.step === "s3_wait_age") {
    const ageMatch = text.match(/(\d{1,2})/);
    const age = ageMatch ? Number(ageMatch[1]) : null;
    if (!age || age < 3 || age > 18) {
      return sendMessage(chatId, "Напишите возраст ребенка числом от 3 до 18, например: 10.");
    }
    session.scenario3.age = String(age);
    session.scenario3.ageYears = age;
    return showScenario3Results(chatId, session);
  }

  if (session.step === "s2_age") {
    const age = detectAgeBucket(text);
    if (!age) {
      return sendMessage(chatId, "Напишите возраст ребенка числом, например: 8.");
    }
    session.scenario2.ageText = text;
    session.scenario2.age = age;
    return askScenario2Interests(chatId, session);
  }

  if (session.step === "s2_interests") {
    session.scenario2.interestsText = text;
    session.scenario2.interests = detectInterests(text);
    return askScenario2Goal(chatId, session);
  }

  if (session.step === "s2_special_other") {
    session.scenario2.specialNeedsOther = text;
    return askScenario2Schedule(chatId, session);
  }

  if (session.step === "s2_place") {
    session.scenario2.place = text;
    return askScenario2Cost(chatId, session);
  }

  if (session.step === "s2_cost") {
    session.scenario2.cost = text;
    return askScenario2Refinement(chatId, session);
  }

  if (session.step === "s2_avoidances") {
    session.scenario2.avoidanceCustom = text;
    return askScenario2Direction(chatId, session);
  }

  if (session.step === "s2_avoidance_custom") {
    session.scenario2.avoidanceCustom = text;
    return askScenario2Direction(chatId, session);
  }

  return sendMessage(chatId, "Нажмите /start и выберите один из сценариев кнопкой.");
}

async function handleCallback(callbackQuery) {
  const chatId = incomingCallbackTarget(callbackQuery);
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data;

  try {
    await answerCallbackQuery(chatId.platform, callbackQuery.id);
  } catch (error) {
    console.error("answerCallbackQuery warning:", error.message);
  }

  const session = await getSession(chatId);
  ensureDescriptionSelectionState(session);
  if (!session.scenario2) session.scenario2 = createScenario2State();
  if (!session.scenario3) session.scenario3 = createScenario3State();

  if (data === "scenario:description") {
    return startDescriptionFlow({
      target: chatId,
      session,
      persistSession,
      sendMessage,
    });
  }

  if (isDescriptionCallback(data)) {
    return handleDescriptionCallback({
      target: chatId,
      messageId,
      data,
      session,
      persistSession,
      sendMessage,
      sendDocument,
      createSelectionPdf,
      getRecommendations,
      logRecommendation,
      normalizeTarget,
    });
  }

  if (data === "scenario:agent") {
    return startScenario2(chatId);
  }

  if (data === "scenario:deep") {
    return startScenario3(chatId);
  }

  if (data === "s3:links:add") {
    session.step = "s3_collect_links";
    await persistSession(chatId, session);
    return sendMessage(chatId, "Пришлите еще одну ссылку на программу 51.pfdo.ru.");
  }

  if (data === "s3:links:done") {
    return finalizeScenario3Links(chatId, session);
  }

  if (data === "s3:criteria:edit") {
    if (!session.scenario3.criteria) {
      session.scenario3.criteria = createDescriptionSelectionState();
    }
    session.step = "s3_wait_criteria_text";
    await persistSession(chatId, session);
    return sendMessage(chatId, SCENARIO_3.criteria.editText);
  }

  if (data === "s3:criteria:skip") {
    return showScenario3Results(chatId, session);
  }

  if (data === "s3:topics:all") {
    const programs = session.scenario3.completedPrograms || [];
    if (!programs.length) {
      return sendMessage(chatId, "Не нашел сохраненный список пройденных программ. Начните заново через /start.");
    }
    const linkFormat = scenario3LinkFormat(chatId);
    const messageOptions = scenario3MessageOptions(linkFormat);
    const text = buildCompletedProgramsTopicsMessage(session.scenario3, null, { linkFormat });
    for (const chunk of splitMessage(text)) {
      await sendMessage(chatId, chunk, undefined, messageOptions);
    }
    return sendMessage(chatId, SCENARIO_3.completedTopics.followupText, SCENARIO_3.criteria.keyboard);
  }

  if (data === "s3:pdf:yes") {
    session.scenario3.pdfRequested = true;
    await persistSession(chatId, session);
    return sendScenario3Pdf(chatId, session);
  }

  if (data === "s3:pdf:no") {
    session.scenario3.pdfRequested = false;
    await persistSession(chatId, session);
    return sendMessage(chatId, "Хорошо. Чтобы построить новую траекторию, нажмите /start.");
  }

  const scenarios = {
    "scenario:new_interests": {
      id: "trajectory_new_interests",
      label: "Траектория новых интересов",
    },
  };

  if (scenarios[data]) {
    return selectScenario(chatId, scenarios[data]);
  }

  if (data.startsWith("s3:municipality:")) {
    const municipalityId = Number(data.split(":")[2]);
    const municipality = session.scenario3.municipalityOptions.find((item) => Number(item.id) === municipalityId);
    if (!municipality) {
      return sendMessage(chatId, "Не нашел выбранный населенный пункт в текущем сценарии. Начните заново через /start.");
    }
    session.scenario3.municipalityId = municipality.id;
    session.scenario3.municipalityName = municipality.name;
    return showScenario3CompletedReview(chatId, session);
  }

  if (data.startsWith("s2:goal:")) {
    const value = data.split(":")[2];
    if (!Array.isArray(session.scenario2.goals)) session.scenario2.goals = [];
    toggleSelected(session.scenario2.goals, value, false);
    session.scenario2.goalLabels = labelsForSelected(SCENARIO_2.goal.options, session.scenario2.goals);
    session.scenario2.goal = session.scenario2.goals[0] || null;
    session.scenario2.goalLabel = session.scenario2.goalLabels[0] || "";
    await persistSession(chatId, session);
    return editMessage(
      chatId,
      messageId,
      SCENARIO_2.goal.text,
      multiSelectKeyboard("goal", SCENARIO_2.goal.options, session.scenario2.goals),
    );
  }

  if (data === "s2:goal_continue") {
    if (!Array.isArray(session.scenario2.goals) || !session.scenario2.goals.length) {
      return sendMessage(chatId, "Выберите хотя бы одну цель обучения.");
    }
    return askScenario2SpecialNeeds(chatId, session);
  }

  if (data.startsWith("s2:special:")) {
    const value = data.split(":")[2];
    session.scenario2.specialNeeds = selectedSpecialNeeds(session.scenario2);
    toggleSelected(session.scenario2.specialNeeds, value, value === "none", ["none"]);
    session.scenario2.specialNeedLabels = labelsForSelected(SCENARIO_2.specialNeeds.options, session.scenario2.specialNeeds);
    session.scenario2.specialNeedsLabel = session.scenario2.specialNeedLabels[0] || "";
    if (!session.scenario2.specialNeeds.includes("other")) {
      session.scenario2.specialNeedsOther = "";
    }
    await persistSession(chatId, session);
    return editMessage(
      chatId,
      messageId,
      SCENARIO_2.specialNeeds.text,
      multiSelectKeyboard("special", SCENARIO_2.specialNeeds.options, session.scenario2.specialNeeds),
    );
  }

  if (data === "s2:special_continue") {
    const selected = selectedSpecialNeeds(session.scenario2);
    if (!selected.length) {
      return sendMessage(chatId, "Выберите хотя бы один вариант особенностей.");
    }
    if (selected.includes("other") && !String(session.scenario2.specialNeedsOther || "").trim()) {
      return askScenario2SpecialNeedsOther(chatId, session);
    }
    return askScenario2Schedule(chatId, session);
  }

  if (data.startsWith("s2:schedule:")) {
    const value = data.split(":")[2];
    toggleSelected(session.scenario2.schedule, value, value === "any");
    await persistSession(chatId, session);
    return editMessage(
      chatId,
      messageId,
      SCENARIO_2.schedule.text,
      multiSelectKeyboard("schedule", SCENARIO_2.schedule.options, session.scenario2.schedule),
    );
  }

  if (data === "s2:schedule_continue") {
    if (!session.scenario2.schedule.length) {
      return sendMessage(chatId, "Выберите хотя бы один вариант времени.");
    }
    return askScenario2Format(chatId, session);
  }

  if (data.startsWith("s2:format:")) {
    setSelectedOption(session.scenario2, "format", "formatLabel", data, SCENARIO_2.format.options);
    return askScenario2Place(chatId, session);
  }

  if (data === "s2:refinement:show") {
    session.scenario2.wantsRefinement = false;
    await persistSession(chatId, session);
    return showScenario2Results(chatId, session);
  }

  if (data === "s2:refinement:refine") {
    session.scenario2.wantsRefinement = true;
    return askScenario2GroupSize(chatId, session);
  }

  if (data.startsWith("s2:group_size:")) {
    setSelectedOption(session.scenario2, "groupSize", "groupSizeLabel", data, SCENARIO_2.groupSize.options);
    return askScenario2Avoidances(chatId, session);
  }

  if (data.startsWith("s2:avoidance:")) {
    const value = data.split(":")[2];
    toggleSelected(session.scenario2.avoidances, value, value === "any");
    session.scenario2.avoidanceLabels = labelsForSelected(SCENARIO_2.avoidances.options, session.scenario2.avoidances);
    await persistSession(chatId, session);
    return editMessage(
      chatId,
      messageId,
      SCENARIO_2.avoidances.text,
      multiSelectKeyboard("avoidance", SCENARIO_2.avoidances.options, session.scenario2.avoidances, true),
    );
  }

  if (data === "s2:avoidance_custom") {
    return askScenario2AvoidanceCustom(chatId, session);
  }

  if (data === "s2:avoidance_continue") {
    if (!session.scenario2.avoidances.length && !session.scenario2.avoidanceCustom) {
      return sendMessage(chatId, "Выберите вариант или напишите свой ответ.");
    }
    return askScenario2Direction(chatId, session);
  }

  if (data.startsWith("s2:direction:")) {
    setSelectedOption(session.scenario2, "direction", "directionLabel", data, SCENARIO_2.direction.options);
    await persistSession(chatId, session);
    return showScenario2Results(chatId, session);
  }

  if (data === "s2:pdf:yes") {
    session.scenario2.pdfRequested = true;
    await persistSession(chatId, session);
    return sendScenario2Pdf(chatId, session);
  }

  if (data === "s2:pdf:no") {
    session.scenario2.pdfRequested = false;
    await persistSession(chatId, session);
    return sendMessage(chatId, "Хорошо. Чтобы начать новый подбор, нажмите /start.");
  }

  return sendMessage(chatId, "Этот сценарий больше не активен. Нажмите /start и выберите доступный вариант.");
}

async function sendScenario2Pdf(chatId, session) {
  const result = session.scenario2.lastResult;
  if (!result) {
    return sendMessage(chatId, "Не нашел последнюю подборку. Начните новый подбор через /start.");
  }

  try {
    await sendMessage(chatId, "Готовлю PDF-файл с подборкой...");
    const target = normalizeTarget(chatId);
    const outputPath = path.join(
      process.env.PDF_OUTPUT_DIR || path.join(os.tmpdir(), "telegram-bot-pdfs"),
      `selection-${targetFilePart(target)}-${Date.now()}.pdf`,
    );
    await createSelectionPdf({
      outputPath,
      answers: session.scenario2,
      result,
    });
    session.scenario2.pdfPath = outputPath;
    await persistSession(chatId, session);
    return sendDocument(chatId, outputPath, "Подборка программ");
  } catch (error) {
    console.error("PDF delivery failed:", error);
    return sendMessage(chatId, "Не удалось подготовить PDF-файл. Попробуйте нажать кнопку скачивания еще раз.");
  }
}

async function sendScenario3Pdf(chatId, session) {
  const result = session.scenario3.lastResult;
  if (!result?.items?.length) {
    return sendMessage(chatId, "Не нашел последнюю подборку. Начните новую траекторию через /start.");
  }

  try {
    await sendMessage(chatId, "Готовлю PDF-файл с подборкой...");
    const target = normalizeTarget(chatId);
    const outputPath = path.join(
      process.env.PDF_OUTPUT_DIR || path.join(os.tmpdir(), "telegram-bot-pdfs"),
      `selection-${targetFilePart(target)}-${Date.now()}.pdf`,
    );
    await createSelectionPdf({
      outputPath,
      answers: buildScenario3PdfAnswers(session.scenario3),
      result: buildScenario3PdfResult(result),
    });
    session.scenario3.pdfPath = outputPath;
    await persistSession(chatId, session);
    return sendDocument(chatId, outputPath, "Подборка углубленных программ");
  } catch (error) {
    console.error("Scenario 3 PDF delivery failed:", error);
    return sendMessage(chatId, "Не удалось подготовить PDF-файл. Попробуйте нажать кнопку скачивания еще раз.");
  }
}

function incomingMessageTarget(message) {
  const chat = message.chat || {};
  return makeTarget(message.platform || "telegram", chat.id ?? message.chat_id, chat);
}

function incomingCallbackTarget(callbackQuery) {
  const chat = callbackQuery.message?.chat || {};
  return makeTarget(
    callbackQuery.platform || callbackQuery.message?.platform || "telegram",
    chat.id ?? callbackQuery.chat_id,
    chat,
  );
}

function inlineKeyboard(options, columns = 1) {
  const rows = [];
  for (let i = 0; i < options.length; i += columns) {
    rows.push(options.slice(i, i + columns).map(([text, callback]) => ({ text, callback_data: callback })));
  }
  return { inline_keyboard: rows };
}

function multiSelectKeyboard(kind, options, selected, allowCustom = false) {
  const rows = options.map(([text, value]) => {
    const active = selected.includes(value);
    return [{ text: `${active ? "✓ " : ""}${text}`, callback_data: `s2:${kind}:${value}` }];
  });
  if (allowCustom) {
    rows.push([{ text: "Написать свой вариант", callback_data: `s2:${kind}_custom` }]);
  }
  rows.push([{ text: "Продолжить", callback_data: `s2:${kind}_continue` }]);
  return { inline_keyboard: rows };
}

function setSelectedOption(target, valueKey, labelKey, callbackData, options) {
  const match = options.find(([, callback]) => callback === callbackData);
  target[valueKey] = callbackData.split(":").at(-1);
  target[labelKey] = match ? match[0] : "";
}

function toggleSelected(selected, value, exclusive, exclusiveValues = ["any"]) {
  if (exclusive) {
    selected.splice(0, selected.length, value);
    return;
  }

  for (const exclusiveValue of exclusiveValues) {
    const exclusiveIndex = selected.indexOf(exclusiveValue);
    if (exclusiveIndex >= 0) selected.splice(exclusiveIndex, 1);
  }

  const index = selected.indexOf(value);
  if (index >= 0) selected.splice(index, 1);
  else selected.push(value);
}

function labelsForSelected(options, selected) {
  return selected
    .map((value) => options.find(([, optionValue]) => optionValue === value)?.[0])
    .filter(Boolean);
}

function selectedSpecialNeeds(state) {
  if (Array.isArray(state.specialNeeds)) return state.specialNeeds;
  return state.specialNeeds ? [state.specialNeeds] : [];
}

function applyScenario3Analysis(state, analysis) {
  state.links = analysis.links;
  state.programLinks = analysis.programLinks || state.programLinks || [];
  state.submittedProgramIds = analysis.programIds || state.submittedProgramIds || [];
  state.invalidLinks = analysis.invalidLinks;
  state.completedProgramIds = analysis.programs.map((program) => Number(program.id));
  state.missingProgramIds = analysis.missingProgramIds;
  state.completedPrograms = analysis.programs.map((program) => ({
    id: program.id,
    name: program.name,
    municipalityId: program.municipalityId,
    municipalityName: program.municipalityName,
    directionName: program.directionName,
    ageMinMonths: program.ageMinMonths,
    ageMaxMonths: program.ageMaxMonths,
    ageLabel: program.ageLabel,
    price: program.price,
    schedule: program.schedule,
    period: program.period,
    availableGroups: program.availableGroups,
    availablePlaces: program.availablePlaces,
    enrollment: program.enrollment,
    sourceUrl: program.sourceUrl,
    topics: program.topics || [],
  }));
  state.municipalityOptions = analysis.municipalities;
  state.completedTopicProfile = analysis.topicProfile;
  if (analysis.inferredAge) {
    state.ageYears = analysis.inferredAge;
    state.age = String(analysis.inferredAge);
  }
  state.lastResult = null;
}

function buildRecommendationProfile(state) {
  const interests = new Set(state.interests || []);
  const directionInterests = {
    technical: ["building", "logic"],
    art: ["creative"],
    sport: ["sports"],
    social: ["social"],
    science: ["logic"],
    tourism: ["sports", "social"],
  };
  for (const interest of directionInterests[state.direction] || []) {
    interests.add(interest);
  }

  return {
    age: state.age || "7-9",
    experience: "new",
    interests: [...interests],
    avoidances: state.avoidances.filter((item) => item !== "any"),
    adaptation: null,
    goals: mapGoals(state.goals || (state.goal ? [state.goal] : [])),
    goal: mapGoals(state.goals || (state.goal ? [state.goal] : []))[0] || "discover",
    location: state.place,
    budget: state.cost,
    schedule: scheduleText(state.schedule),
    clarifyGroup: mapGroupSize(state.groupSize),
    clarifyFocus: null,
    directionLabel: state.directionLabel,
  };
}

function mapGoal(value) {
  const map = {
    interest: "interest",
    first_try: "first_try",
    practical_skills: "strengths",
    communication: "social",
    discipline: "discipline",
  };
  return map[value] || "discover";
}

function mapGoals(values) {
  return [...new Set((values || []).map(mapGoal).filter(Boolean))];
}

function mapGroupSize(value) {
  if (value === "small") return "small_calm";
  if (value === "large") return "active_group";
  return null;
}

function scheduleText(values) {
  const labels = {
    weekdays: "будни",
    weekends: "выходные",
    morning: "утром",
    evening: "вечером",
    any: "",
  };
  return values.map((value) => labels[value]).filter(Boolean).join(", ");
}

function buildScenario2ResultMessage(result) {
  if (!result.items.length) {
    return (
      "Сейчас точных совпадений не нашлось.\n\n" +
      "Попробуйте расширить место занятий, бюджет или расписание и начать подбор заново через /start."
    );
  }

  const lines = ["Я нашел подходящие программы:", ""];
  result.items.slice(0, 10).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.program}`,
      `Адрес: ${item.district}`,
      `Расписание: ${item.schedule}`,
      `Стоимость: ${item.price}`,
      `Онлайн-запись: ${item.sourceUrl || "ссылка уточняется"}`,
      "",
    );
  });
  return lines.join("\n");
}

function splitMessage(text, limit = 3500) {
  const chunks = [];
  let current = "";
  for (const block of String(text).split("\n\n")) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > limit && current) {
      chunks.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function scenario3LinkFormat(target) {
  const platform = normalizeTarget(target).platform;
  if (platform === "telegram") return "html";
  if (platform === "max" || platform === "mattermost") return "markdown";
  return "plain";
}

function scenario3MessageOptions(linkFormat) {
  return linkFormat === "html" ? { parseMode: "HTML" } : {};
}

function detectAgeBucket(text) {
  const match = String(text).match(/(\d{1,2})/);
  if (!match) return null;
  const age = Number(match[1]);
  if (age >= 3 && age <= 4) return "3-4";
  if (age >= 5 && age <= 6) return "5-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  if (age >= 13 && age <= 18) return "13+";
  return null;
}

function detectInterests(text) {
  const value = String(text).toLowerCase().replace(/ё/g, "е");
  const matches = [];
  if (/(рис|леп|твор|дизайн|мастер|худож|придум|музык|танц)/i.test(value)) matches.push("creative");
  if (/(робот|констру|собират|инжен|3d|модел|техн)/i.test(value)) matches.push("building");
  if (/(спорт|плав|футбол|хокке|гимнаст|самбо|дзюдо|борьб|бег|волейбол|баскетбол)/i.test(value)) matches.push("sports");
  if (/(обща|друз|команд|театр|сцен|выступ|лидер)/i.test(value)) matches.push("social");
  if (/(логик|математ|программ|шахмат|как все устроено|как устроено|информат)/i.test(value)) matches.push("logic");
  if (/(спокой|усидчив|в своем темпе|не спеша)/i.test(value)) matches.push("calm");
  return [...new Set(matches)];
}

async function processTelegramUpdate(update) {
  if (update.message) {
    await handleText(update.message);
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

async function processMaxUpdate(update) {
  if (Array.isArray(update?.updates)) {
    for (const item of update.updates) {
      await processMaxUpdate(item);
    }
    return;
  }

  const updateType = update.update_type || update.type;
  if (updateType === "bot_started") {
    const chatId = getMaxChatId(update);
    if (chatId != null) {
      await handleText({ platform: "max", chat: { id: chatId }, text: "/start" });
    }
    return;
  }

  if (updateType === "message_created") {
    const chatId = getMaxChatId(update);
    const text = getMaxMessageText(update);
    if (chatId != null && text) {
      await handleText({ platform: "max", chat: { id: chatId }, text });
    }
    return;
  }

  if (updateType === "message_callback") {
    const callback = update.callback || update.message_callback || {};
    const chatId = getMaxChatId(update);
    const data = callback.payload || callback.callback_data || callback.data || update.payload;
    if (chatId != null && data) {
      await handleCallback({
        platform: "max",
        id: callback.callback_id || update.callback_id,
        data,
        message: {
          platform: "max",
          chat: { id: chatId },
          message_id: callback.message?.message_id || callback.message_id || update.message?.message_id,
        },
      });
    }
  }
}

function getMaxChatId(update) {
  return update.chat_id || update.message?.chat_id || update.message?.recipient?.chat_id || update.callback?.chat_id;
}

function getMaxMessageText(update) {
  return (
    update.message?.body?.text ||
    update.message?.text ||
    update.body?.text ||
    update.text ||
    ""
  ).trim();
}

async function processMattermostText(target, text) {
  const trimmed = String(text || "").trim().slice(0, WEB_CHAT_MESSAGE_MAX_LENGTH);
  if (!trimmed) return;

  if (trimmed !== "/start" && trimmed !== RESTART_BUTTON_TEXT) {
    const session = await getSession(target);
    const callbackData = mattermostCallbackForSession(session, trimmed);
    if (callbackData) {
      await handleCallback({
        platform: "mattermost",
        id: null,
        data: callbackData,
        message: {
          platform: "mattermost",
          chat: target,
          message_id: null,
        },
      });
      return;
    }
    if (session.step === "entry") {
      await handleText({
        platform: "mattermost",
        chat: target,
        text: "/start",
      });
      return;
    }
  }

  await handleText({
    platform: "mattermost",
    chat: target,
    text: trimmed,
  });
}

function mattermostCallbackForSession(session, text) {
  const replyMarkup = mattermostReplyMarkupForSession(session);
  return matchReplyMarkupChoice(replyMarkup, text);
}

function mattermostReplyMarkupForSession(session) {
  if (!session || session.step === "entry") return FLOW.entry.keyboard;
  if (session.step === "s1_confirm_summary") return SCENARIO_1.confirmation.keyboard;
  if (session.step === "s1_pdf") return SCENARIO_1.pdfDownload.keyboard;
  if (session.step === "s3_collect_links") return SCENARIO_3.linkCollection.keyboard;
  if (session.step === "s3_choose_municipality") {
    return buildMunicipalityKeyboard(session.scenario3?.municipalityOptions || []);
  }
  if (session.step === "s3_criteria_choice") return SCENARIO_3.criteria.keyboard;
  if (session.step === "s3_pdf") return SCENARIO_3.pdfDownload.keyboard;
  if (session.step === "s2_goal") {
    return multiSelectKeyboard("goal", SCENARIO_2.goal.options, session.scenario2?.goals || []);
  }
  if (session.step === "s2_special") {
    return multiSelectKeyboard("special", SCENARIO_2.specialNeeds.options, selectedSpecialNeeds(session.scenario2 || {}));
  }
  if (session.step === "s2_schedule") {
    return multiSelectKeyboard("schedule", SCENARIO_2.schedule.options, session.scenario2?.schedule || []);
  }
  if (session.step === "s2_format") return inlineKeyboard(SCENARIO_2.format.options);
  if (session.step === "s2_refinement") return inlineKeyboard(SCENARIO_2.refinement.options);
  if (session.step === "s2_group_size") return inlineKeyboard(SCENARIO_2.groupSize.options);
  if (session.step === "s2_avoidances") {
    return multiSelectKeyboard("avoidance", SCENARIO_2.avoidances.options, session.scenario2?.avoidances || [], true);
  }
  if (session.step === "s2_direction") return inlineKeyboard(SCENARIO_2.direction.options);
  if (session.step === "s2_results") return inlineKeyboard(SCENARIO_2.pdfDownload.options);
  return null;
}

function matchReplyMarkupChoice(replyMarkup, text) {
  const options = replyMarkupOptions(replyMarkup);
  if (!options.length) return null;

  const value = normalizeChoiceText(text);
  const number = value.match(/^\d+$/) ? Number(value) : null;
  if (number && number >= 1 && number <= options.length) {
    return options[number - 1].data;
  }

  const exact = options.find((option) => normalizeChoiceText(option.label) === value);
  return exact?.data || null;
}

function normalizeChoiceText(text) {
  return String(text || "")
    .trim()
    .replace(/^✓\s*/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function processWebChatText(target, text) {
  const trimmed = String(text || "").trim().slice(0, WEB_CHAT_MESSAGE_MAX_LENGTH);
  if (!trimmed) return;

  if (trimmed !== "/start" && trimmed !== RESTART_BUTTON_TEXT) {
    const session = await getSession(target);
    if (session.step === "entry") {
      await handleCallback({
        platform: "web",
        data: "scenario:description",
        message: {
          platform: "web",
          chat: { id: target.id },
          message_id: null,
        },
      });
    }
  }

  await handleText({
    platform: "web",
    chat: { id: target.id },
    text: trimmed,
  });
}

async function processWebChatCallback(target, data) {
  await handleCallback({
    platform: "web",
    id: null,
    data,
    message: {
      platform: "web",
      chat: { id: target.id },
      message_id: null,
    },
  });
}

async function handleWebChatRequest(req, res) {
  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;

    if (req.method === "OPTIONS") {
      writeJson(res, 204, null, webChatCorsHeaders(req));
      return;
    }

    if (req.method === "GET" && pathname.startsWith(`${WEB_CHAT_PATH_PREFIX}/document/`)) {
      await handleWebChatDocument(req, res, pathname);
      return;
    }

    if (req.method !== "POST") {
      writeWebChatJson(req, res, 404, { ok: false, error: "not_found" });
      return;
    }

    if (isWebChatRateLimited(req)) {
      writeWebChatJson(req, res, 429, { ok: false, error: "rate_limited" });
      return;
    }

    const payload = await readJsonBody(req, WEB_CHAT_BODY_LIMIT_BYTES);
    const target = makeWebChatTarget(payload.clientId);
    let messages = [];

    if (pathname === `${WEB_CHAT_PATH_PREFIX}/message`) {
      messages = await collectWebMessages(target, () => processWebChatText(target, payload.text));
    } else if (pathname === `${WEB_CHAT_PATH_PREFIX}/callback`) {
      messages = await collectWebMessages(target, () => processWebChatCallback(target, payload.data));
    } else if (pathname === `${WEB_CHAT_PATH_PREFIX}/reset`) {
      messages = await collectWebMessages(target, () => handleText({
        platform: "web",
        chat: { id: target.id },
        text: "/start",
      }));
    } else {
      writeWebChatJson(req, res, 404, { ok: false, error: "not_found" });
      return;
    }

    writeWebChatJson(req, res, 200, {
      ok: true,
      clientId: String(target.id),
      messages,
    });
  } catch (error) {
    const isBodyTooLarge = error?.code === "REQUEST_BODY_TOO_LARGE";
    const isInvalidClient = error?.code === "INVALID_WEB_CHAT_CLIENT_ID";
    console.error("Web chat request failed:", error);
    writeWebChatJson(req, res, isBodyTooLarge ? 413 : isInvalidClient ? 400 : 500, {
      ok: false,
      error: isBodyTooLarge ? "request_body_too_large" : isInvalidClient ? "invalid_client_id" : "internal_error",
    });
  }
}

async function handleWebChatDocument(req, res, pathname) {
  cleanupWebDocuments();
  const token = pathname.slice(`${WEB_CHAT_PATH_PREFIX}/document/`.length);
  const document = webDocuments.get(token);

  if (!document) {
    writeJson(res, 404, { ok: false, error: "not_found" }, webChatCorsHeaders(req));
    return;
  }

  try {
    const buffer = await fs.readFile(document.filePath);
    res.writeHead(200, {
      ...webChatCorsHeaders(req),
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${sanitizeHeaderFileName(document.fileName)}"`,
      "content-length": buffer.length,
      "cache-control": "private, max-age=3600",
    });
    res.end(buffer);
  } catch (error) {
    console.error("Web chat document read failed:", error);
    writeJson(res, 404, { ok: false, error: "not_found" }, webChatCorsHeaders(req));
  }
}

function makeWebChatTarget(clientId) {
  const id = Number(clientId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error("Invalid web chat client id");
    error.code = "INVALID_WEB_CHAT_CLIENT_ID";
    throw error;
  }
  return makeTarget("web", id);
}

function isWebChatPath(url) {
  const pathname = new URL(url || "/", "http://localhost").pathname;
  return pathname === WEB_CHAT_PATH_PREFIX || pathname.startsWith(`${WEB_CHAT_PATH_PREFIX}/`);
}

function webChatCorsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = !origin || WEB_CHAT_ALLOWED_ORIGINS.includes(origin);
  return {
    ...(allowed && origin ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function writeWebChatJson(req, res, status, payload) {
  writeJson(res, status, payload, webChatCorsHeaders(req));
}

function writeJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    ...headers,
    ...(payload == null ? {} : { "content-type": "application/json" }),
  });
  res.end(payload == null ? "" : JSON.stringify(payload));
}

function readJsonBody(req, limitBytes) {
  return readRequestBody(req, limitBytes).then((body) => JSON.parse(body || "{}"));
}

function isWebChatRateLimited(req) {
  if (!WEB_CHAT_RATE_LIMIT_PER_MINUTE) return false;
  const now = Date.now();
  const key = getClientIp(req);
  const windowStart = now - 60 * 1000;
  const hits = (webRateLimits.get(key) || []).filter((timestamp) => timestamp > windowStart);
  hits.push(now);
  webRateLimits.set(key, hits);
  return hits.length > WEB_CHAT_RATE_LIMIT_PER_MINUTE;
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function sanitizeHeaderFileName(fileName) {
  return String(fileName || "selection.pdf").replace(/["\\\r\n]/g, "_");
}

async function poll() {
  while (true) {
    try {
      const updates = await telegramApi("getUpdates", {
        offset: updateOffset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"],
      });

      for (const update of updates) {
        updateOffset = update.update_id + 1;
        await saveRuntimeState("telegram_update_offset", { updateOffset });
        await processTelegramUpdate(update);
      }
    } catch (error) {
      console.error(error);
      await sleep(2000);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function configureTelegramPollingMode() {
  await telegramApi("deleteWebhook", {
    drop_pending_updates: false,
  });
}

async function configureTelegramBotMenu() {
  await telegramApi("setMyCommands", {
    commands: TELEGRAM_BOT_COMMANDS,
  });
  await telegramApi("setChatMenuButton", {
    menu_button: { type: "commands" },
  });
}

async function configureTelegramWebhookMode() {
  if (!WEBHOOK_PUBLIC_URL && WEBHOOK_REGISTER) {
    throw new Error("Missing TELEGRAM_WEBHOOK_URL for webhook mode");
  }

  if (WEBHOOK_REGISTER) {
    const payload = {
      url: `${WEBHOOK_PUBLIC_URL}${WEBHOOK_PATH}`,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    };

    if (WEBHOOK_SECRET_TOKEN) {
      payload.secret_token = WEBHOOK_SECRET_TOKEN;
    }

    await telegramApi("setWebhook", payload);
  }
}

async function configureMaxWebhookMode() {
  if (!MAX_WEBHOOK_PUBLIC_URL && MAX_WEBHOOK_REGISTER) {
    throw new Error("Missing MAX_WEBHOOK_URL or TELEGRAM_WEBHOOK_URL for MAX webhook mode");
  }

  if (MAX_WEBHOOK_REGISTER) {
    const payload = {
      url: `${MAX_WEBHOOK_PUBLIC_URL}${MAX_WEBHOOK_PATH}`,
      update_types: MAX_UPDATE_TYPES,
    };
    if (MAX_WEBHOOK_SECRET) payload.secret = MAX_WEBHOOK_SECRET;

    await maxApi("/subscriptions", {
      method: "POST",
      body: payload,
    });
  }
}

async function startWebhookServer() {
  const server = http.createServer((req, res) => {
    void handleWebhookRequest(req, res);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(WEBHOOK_PORT, WEBHOOK_HOST, resolve);
  });

  const paths = [];
  if (TELEGRAM_ENABLED && TELEGRAM_TRANSPORT === "webhook") paths.push(`telegram=${WEBHOOK_PATH}`);
  if (MAX_ENABLED) paths.push(`max=${MAX_WEBHOOK_PATH}`);
  if (ALICE_ENABLED) paths.push(`alice=${ALICE_WEBHOOK_PATH}`);
  if (WEB_CHAT_ENABLED) paths.push(`web=${WEB_CHAT_PATH_PREFIX}`);
  if (MATTERMOST_ENABLED) paths.push("mattermost=websocket");
  console.log(`Webhook server is running on ${WEBHOOK_HOST}:${WEBHOOK_PORT} (${paths.join(", ")})`);
}

async function handleWebhookRequest(req, res) {
  try {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        transports: {
          telegram: TELEGRAM_ENABLED ? TELEGRAM_TRANSPORT : "disabled",
          max: MAX_ENABLED ? "webhook" : "disabled",
          alice: ALICE_ENABLED ? "webhook" : "disabled",
          web: WEB_CHAT_ENABLED ? "enabled" : "disabled",
          mattermost: MATTERMOST_ENABLED ? mattermostTransport?.getStatus() : "disabled",
        },
      }));
      return;
    }

    if (WEB_CHAT_ENABLED && isWebChatPath(req.url || "")) {
      await handleWebChatRequest(req, res);
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }

    if (MAX_ENABLED && isMaxWebhookPath(req.url || "")) {
      if (MAX_WEBHOOK_SECRET && req.headers["x-max-bot-api-secret"] !== MAX_WEBHOOK_SECRET) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
        return;
      }

      const body = await readRequestBody(req);
      await processMaxUpdate(JSON.parse(body || "{}"));

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (ALICE_ENABLED && isAliceWebhookPath(req.url || "")) {
      const body = await readRequestBody(req, 64 * 1024);
      const payload = JSON.parse(body || "{}");
      const response = buildAliceResponse(payload);

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(response));
      return;
    }

    if (TELEGRAM_ENABLED && TELEGRAM_TRANSPORT === "webhook" && isWebhookPath(req.url || "")) {
      if (
        WEBHOOK_SECRET_TOKEN &&
        req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET_TOKEN
      ) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
        return;
      }

      const body = await readRequestBody(req);
      const update = JSON.parse(body || "{}");
      if (update.update_id != null) {
        updateOffset = Math.max(updateOffset, Number(update.update_id) + 1);
        await saveRuntimeState("telegram_update_offset", { updateOffset });
      }

      await processTelegramUpdate(update);

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "internal_error" }));
  }
}

function isWebhookPath(url) {
  const [pathname] = String(url).split("?");
  return pathname === WEBHOOK_PATH;
}

function isMaxWebhookPath(url) {
  const [pathname] = String(url).split("?");
  return pathname === MAX_WEBHOOK_PATH;
}

function isAliceWebhookPath(url) {
  const [pathname] = String(url).split("?");
  return pathname === ALICE_WEBHOOK_PATH;
}

function buildAliceResponse(payload) {
  const originalUtterance = String(payload?.request?.original_utterance || "");
  const command = String(payload?.request?.command || originalUtterance || "").trim().toLowerCase();
  const isPing = originalUtterance.trim().toLowerCase() === "ping";

  if (isPing) {
    return makeAliceResponse(payload, {
      text: "pong",
      endSession: true,
    });
  }

  if (command.includes("помощ") || command.includes("что ты умеешь")) {
    return makeAliceResponse(payload, {
      text:
        "Я помогу подобрать кружки и программы дополнительного образования для ребенка. " +
        "Напишите возраст, город или район и интересы ребенка, например: 8 лет, Мурманск, робототехника.",
      buttons: [
        { title: "Начать подбор", payload: { action: "start" }, hide: true },
      ],
    });
  }

  const text = payload?.session?.new
    ? "Здравствуйте! Это навык Траектория талантов. Я помогу подобрать кружки для ребенка. Напишите возраст, город или район и интересы ребенка."
    : "Чтобы подобрать варианты, напишите возраст ребенка, город или район и интересы. Например: 8 лет, Мурманск, робототехника.";

  return makeAliceResponse(payload, {
    text,
    buttons: [
      { title: "Помощь", payload: { action: "help" }, hide: true },
    ],
  });
}

function makeAliceResponse(payload, options) {
  return {
    response: {
      text: truncateAliceText(options.text),
      tts: truncateAliceText(options.tts || options.text),
      buttons: options.buttons || [],
      end_session: Boolean(options.endSession),
    },
    session: payload?.session || {},
    version: payload?.version || "1.0",
  };
}

function truncateAliceText(text, limit = 1024) {
  const value = String(text || "");
  return value.length <= limit ? value : value.slice(0, limit - 1).trimEnd();
}

function readRequestBody(req, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        const error = new Error("Request body too large");
        error.code = "REQUEST_BODY_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function bootstrap() {
  await initializeDatabase();

  if (TELEGRAM_ENABLED) {
    const runtimeState = await loadRuntimeState("telegram_update_offset");
    if (runtimeState?.updateOffset) {
      updateOffset = Number(runtimeState.updateOffset);
    }

    try {
      await configureTelegramBotMenu();
    } catch (error) {
      console.warn("Telegram bot menu configuration skipped:", error.message);
    }
  }

  if (TELEGRAM_ENABLED && TELEGRAM_TRANSPORT === "webhook") {
    await configureTelegramWebhookMode();
  }

  if (MAX_ENABLED) {
    await configureMaxWebhookMode();
  }

  if (MATTERMOST_ENABLED) {
    mattermostTransport = createMattermostTransport(
      {
        url: MATTERMOST_URL,
        token: MATTERMOST_TOKEN,
        username: MATTERMOST_USERNAME,
        password: MATTERMOST_PASSWORD,
        mode: MATTERMOST_MODE,
        replyMode: MATTERMOST_REPLY_MODE,
      },
      {
        onText: (message) => processMattermostText(message.chat, message.text),
      },
    );
    await mattermostTransport.start();
    console.log("Mattermost transport is running...");
  }

  const needsWebhookServer =
    (TELEGRAM_ENABLED && TELEGRAM_TRANSPORT === "webhook") ||
    MAX_ENABLED ||
    ALICE_ENABLED ||
    WEB_CHAT_ENABLED ||
    MATTERMOST_ENABLED;
  if (needsWebhookServer) {
    await startWebhookServer();
  }

  if (TELEGRAM_ENABLED && TELEGRAM_TRANSPORT !== "webhook") {
    await configureTelegramPollingMode();
    console.log("Telegram bot is running in polling mode...");
    await poll();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
