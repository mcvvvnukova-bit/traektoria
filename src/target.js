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

function targetMetadata(target) {
  const normalized = normalizeTarget(target);
  const metadata = {};

  assignOptionalId(metadata, "userId", firstDefined(normalized.userId, normalized.user_id));
  assignOptionalText(metadata, "username", firstDefined(normalized.username));
  assignOptionalId(metadata, "channelId", firstDefined(normalized.channelId, normalized.channel_id));
  assignOptionalText(metadata, "channelType", firstDefined(normalized.channelType, normalized.channel_type));

  return metadata;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function assignOptionalId(target, key, value) {
  if (value === undefined) return;
  if (value === null || value === "") {
    target[key] = null;
    return;
  }
  target[key] = String(value);
}

function assignOptionalText(target, key, value) {
  if (value === undefined) return;
  if (value === null || String(value).trim() === "") {
    target[key] = null;
    return;
  }
  target[key] = String(value).trim();
}

module.exports = {
  makeTarget,
  normalizeTarget,
  targetMetadata,
  targetKey,
  targetFilePart,
};
