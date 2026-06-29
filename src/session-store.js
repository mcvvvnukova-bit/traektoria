const { executeSql, queryRows, jsonToSql, textToSql, decodeJsonCell } = require("./db");
const { SCENARIO_1_CRITERIA_COLUMNS } = require("./scenario1-criteria-recognition");

async function loadSession(platform, chatId) {
  const rows = await queryRows(`
    SELECT replace(encode(convert_to(payload::text, 'UTF8'), 'base64'), E'\n', '')
    FROM bot_sessions
    WHERE platform = ${textToSql(normalizePlatform(platform))}
      AND chat_id = ${textToSql(normalizeChatId(chatId))}
    LIMIT 1;
  `);

  if (!rows.length) return null;
  return decodeJsonCell(rows[0][0]);
}

async function saveSession(platform, chatId, payload, metadata = {}) {
  await executeSql(`
    INSERT INTO bot_sessions (platform, chat_id, payload, metadata, updated_at)
    VALUES (
      ${textToSql(normalizePlatform(platform))},
      ${textToSql(normalizeChatId(chatId))},
      ${jsonToSql(payload)},
      ${jsonToSql(normalizeMetadata(metadata))},
      NOW()
    )
    ON CONFLICT (platform, chat_id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      metadata = bot_sessions.metadata || EXCLUDED.metadata,
      updated_at = NOW();
  `);
}

async function deleteSession(platform, chatId) {
  await executeSql(`
    DELETE FROM bot_sessions
    WHERE platform = ${textToSql(normalizePlatform(platform))}
      AND chat_id = ${textToSql(normalizeChatId(chatId))};
  `);
}

async function saveRuntimeState(key, payload) {
  await executeSql(`
    INSERT INTO bot_runtime_state (state_key, payload, updated_at)
    VALUES (${textToSql(key)}, ${jsonToSql(payload)}, NOW())
    ON CONFLICT (state_key)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW();
  `);
}

async function loadRuntimeState(key) {
  const rows = await queryRows(`
    SELECT replace(encode(convert_to(payload::text, 'UTF8'), 'base64'), E'\n', '')
    FROM bot_runtime_state
    WHERE state_key = ${textToSql(key)}
    LIMIT 1;
  `);

  if (!rows.length) return null;
  return decodeJsonCell(rows[0][0]);
}

async function logRecommendation(platform, chatId, result, metadata = {}) {
  await executeSql(`
    INSERT INTO recommendation_history (platform, chat_id, source, confidence, payload, metadata)
    VALUES (
      ${textToSql(normalizePlatform(platform))},
      ${textToSql(normalizeChatId(chatId))},
      ${textToSql(result.source || "unknown")},
      ${textToSql(result.confidence || "unknown")},
      ${jsonToSql(result)},
      ${jsonToSql(normalizeMetadata(metadata))}
    );
  `);
}

async function logScenario1CriteriaRecognition(platform, sessionId, record, metadata = {}) {
  const criteria = record?.criteria || {};
  const criterionColumns = SCENARIO_1_CRITERIA_COLUMNS;
  const columns = [
    "platform",
    "session_id",
    "channel",
    "channel_id",
    "channel_type",
    "input_text",
    "recognition_method",
    "recognition_confidence",
    ...criterionColumns,
    "metadata",
  ];
  const normalizedPlatform = normalizePlatform(platform || record?.platform);
  const normalizedSessionId = normalizeChatId(sessionId || record?.sessionId);
  const mergedMetadata = {
    ...normalizeMetadata(metadata),
    ...(record?.metadata && typeof record.metadata === "object" ? normalizeMetadata(record.metadata) : {}),
  };
  const values = [
    textToSql(normalizedPlatform),
    textToSql(normalizedSessionId),
    textToSql(record?.channel || normalizedPlatform),
    nullableTextToSql(record?.channelId),
    nullableTextToSql(record?.channelType),
    textToSql(record?.inputText || ""),
    textToSql(record?.recognitionMethod === "LLM" ? "LLM" : "regexp"),
    confidenceToSql(record?.recognitionConfidence),
    ...criterionColumns.map((column) => jsonToSql(criteria[column] || {})),
    jsonToSql(mergedMetadata),
  ];

  await executeSql(`
    INSERT INTO scenario1_criteria_recognition_log (${columns.join(", ")})
    VALUES (${values.join(", ")});
  `);
}

function normalizePlatform(platform) {
  return platform || "telegram";
}

function normalizeChatId(chatId) {
  if (chatId === null || chatId === undefined || chatId === "") {
    throw new Error("Missing chat id");
  }
  return String(chatId);
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

function nullableTextToSql(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return textToSql(value);
}

function confidenceToSql(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return String(Math.max(0, Math.min(1, Math.round(number * 1000) / 1000)));
}

module.exports = {
  loadSession,
  saveSession,
  deleteSession,
  saveRuntimeState,
  loadRuntimeState,
  logRecommendation,
  logScenario1CriteriaRecognition,
};
