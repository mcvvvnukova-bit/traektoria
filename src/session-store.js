const { executeSql, queryRows, jsonToSql, textToSql, decodeJsonCell } = require("./db");

async function loadSession(platform, chatId) {
  const rows = await queryRows(`
    SELECT replace(encode(convert_to(payload::text, 'UTF8'), 'base64'), E'\n', '')
    FROM bot_sessions
    WHERE platform = ${textToSql(normalizePlatform(platform))}
      AND chat_id = ${Number(chatId)}
    LIMIT 1;
  `);

  if (!rows.length) return null;
  return decodeJsonCell(rows[0][0]);
}

async function saveSession(platform, chatId, payload) {
  await executeSql(`
    INSERT INTO bot_sessions (platform, chat_id, payload, updated_at)
    VALUES (${textToSql(normalizePlatform(platform))}, ${Number(chatId)}, ${jsonToSql(payload)}, NOW())
    ON CONFLICT (platform, chat_id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW();
  `);
}

async function deleteSession(platform, chatId) {
  await executeSql(`
    DELETE FROM bot_sessions
    WHERE platform = ${textToSql(normalizePlatform(platform))}
      AND chat_id = ${Number(chatId)};
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

async function logRecommendation(platform, chatId, result) {
  await executeSql(`
    INSERT INTO recommendation_history (platform, chat_id, source, confidence, payload)
    VALUES (
      ${textToSql(normalizePlatform(platform))},
      ${Number(chatId)},
      ${textToSql(result.source || "unknown")},
      ${textToSql(result.confidence || "unknown")},
      ${jsonToSql(result)}
    );
  `);
}

function normalizePlatform(platform) {
  return platform || "telegram";
}

module.exports = {
  loadSession,
  saveSession,
  deleteSession,
  saveRuntimeState,
  loadRuntimeState,
  logRecommendation,
};
