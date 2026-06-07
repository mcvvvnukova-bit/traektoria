function makeTarget(platform, chatId, metadata = {}) {
  const normalizedPlatform = normalizePlatform(platform);
  return {
    ...metadata,
    platform: normalizedPlatform,
    id: normalizeTargetId(chatId),
  };
}

function normalizeTarget(target) {
  if (typeof target === "object" && target !== null) {
    return makeTarget(target.platform, target.id ?? target.chatId ?? target.chat_id, target);
  }
  return makeTarget("telegram", target);
}

function targetKey(target) {
  const normalized = normalizeTarget(target);
  return `${normalized.platform}:${normalized.id}`;
}

function normalizePlatform(platform) {
  return String(platform || "telegram").trim() || "telegram";
}

function normalizeTargetId(chatId) {
  if (chatId === null || chatId === undefined || chatId === "") {
    throw new Error("Missing chat target id");
  }
  return String(chatId);
}

function targetFilePart(target) {
  const normalized = normalizeTarget(target);
  return `${normalized.platform}-${normalized.id}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

module.exports = {
  makeTarget,
  normalizeTarget,
  targetKey,
  targetFilePart,
};
