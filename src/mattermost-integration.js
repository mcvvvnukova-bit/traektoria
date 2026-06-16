const { createMattermostTarget } = require("./mattermost-transport");

const SLASH_COMMANDS = new Map([
  ["", "start"],
  ["start", "start"],
  ["menu", "start"],
  ["help", "help"],
  ["text", "text"],
  ["quiz", "quiz"],
  ["deep", "deep"],
  ["wide", "wide"],
]);

function parseMattermostSlashPayload(body, options = {}) {
  const payload = normalizeSlashBody(body);
  const expectedToken = String(options.token || "");
  if (!expectedToken) {
    return { ok: false, status: 503, error: "slash_disabled" };
  }
  if (String(payload.token || "") !== expectedToken) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const command = resolveTraektoriaSlashCommand(payload.text);
  if (!command) {
    return {
      ok: false,
      status: 200,
      error: "unknown_command",
      text: buildMattermostSlashHelpText(),
    };
  }

  const target = createMattermostTarget({
    userId: payload.user_id,
    channelId: payload.channel_id,
    postId: "",
    channelType: inferMattermostChannelType(payload),
    rootId: "",
  });

  target.username = payload.user_name || null;
  target.teamId = payload.team_id || null;
  target.teamDomain = payload.team_domain || null;
  target.channelName = payload.channel_name || null;

  return {
    ok: true,
    command,
    target,
  };
}

function parseMattermostActionPayload(payload, options = {}) {
  const expectedSecret = String(options.secret || "");
  if (!expectedSecret) {
    return { ok: false, status: 503, error: "actions_disabled" };
  }

  const context = payload?.context || {};
  if (String(context.token || "") !== expectedSecret) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const targetUserId = String(context.user_id || "");
  const actorUserId = String(payload?.user_id || "");
  if (targetUserId && actorUserId && targetUserId !== actorUserId) {
    return { ok: false, status: 403, error: "wrong_user" };
  }

  const callbackData = String(context.callback_data || "");
  const channelId = String(context.channel_id || payload?.channel_id || "");
  const userId = targetUserId || actorUserId;
  if (!callbackData || !channelId || !userId) {
    return { ok: false, status: 400, error: "bad_request" };
  }

  const target = createMattermostTarget({
    userId,
    channelId,
    postId: String(payload?.post_id || context.post_id || ""),
    channelType: String(context.channel_type || ""),
    rootId: String(context.root_id || ""),
  });

  target.username = context.username || null;

  return {
    ok: true,
    callbackData,
    target,
  };
}

function normalizeSlashBody(body) {
  if (body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries());
  }
  if (typeof body === "string") {
    return Object.fromEntries(new URLSearchParams(body).entries());
  }
  if (body && typeof body === "object") return body;
  return {};
}

function resolveTraektoriaSlashCommand(text) {
  const [first] = String(text || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const key = first || "";
  return SLASH_COMMANDS.get(key) || null;
}

function buildMattermostSlashHelpText() {
  return [
    "Не понял команду. Используйте:",
    "`/traektoria` - открыть меню",
    "`/traektoria text` - подобрать по описанию",
    "`/traektoria quiz` - подобрать через вопросы",
    "`/traektoria deep` - составить углубленную траекторию",
    "`/traektoria wide` - траектория новых интересов",
    "`/traektoria help` - справка",
  ].join("\n");
}

function inferMattermostChannelType(payload) {
  if (payload.channel_type) return String(payload.channel_type);
  const channelName = String(payload.channel_name || "");
  return channelName.includes("__") ? "D" : "O";
}

module.exports = {
  buildMattermostSlashHelpText,
  parseMattermostActionPayload,
  parseMattermostSlashPayload,
  resolveTraektoriaSlashCommand,
};
