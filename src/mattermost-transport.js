const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_RECONNECT_MIN_MS = 1000;
const DEFAULT_RECONNECT_MAX_MS = 30000;
const USER_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

class MattermostTransport {
  constructor(config, handlers) {
    this.config = normalizeConfig(config);
    this.handlers = handlers;
    this.token = this.config.token || "";
    this.user = null;
    this.socket = null;
    this.stopped = true;
    this.connected = false;
    this.authenticated = false;
    this.lastError = "";
    this.reconnectDelayMs = DEFAULT_RECONNECT_MIN_MS;
    this.reconnectTimer = null;
    this.wsSeq = 1;
    this.WebSocket = null;
    this.userMetadataCache = new Map();
  }

  async start() {
    this.WebSocket = getWebSocketImpl();
    this.stopped = false;
    await this.authenticate();
    this.connectWebSocket();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  getStatus() {
    return {
      enabled: true,
      connected: this.connected,
      authenticated: this.authenticated,
      username: this.user?.username || this.config.username || "",
      lastError: this.lastError,
    };
  }

  async authenticate() {
    if (this.config.token) {
      this.token = this.config.token;
      this.user = await this.getMe();
      return;
    }

    const { data, response } = await this.request("/api/v4/users/login", {
      method: "POST",
      body: {
        login_id: this.config.username,
        password: this.config.password,
      },
      auth: false,
    });
    const token = response.headers.get("token");
    if (!token) {
      throw new Error("Mattermost login succeeded but did not return a Token header.");
    }
    this.token = token;
    this.user = data;
  }

  async getMe() {
    const { data } = await this.request("/api/v4/users/me");
    return data;
  }

  connectWebSocket() {
    const url = toWebSocketUrl(this.config.url);
    this.authenticated = false;
    this.connected = false;

    const socket = new this.WebSocket(url);
    this.socket = socket;

    addSocketListener(socket, "open", () => {
      this.connected = true;
      this.lastError = "";
      this.reconnectDelayMs = DEFAULT_RECONNECT_MIN_MS;
      this.sendWebSocketAuthentication();
    });

    addSocketListener(socket, "message", (event) => {
      this.handleWebSocketMessage(event.data).catch((error) => {
        this.lastError = error.message;
        console.error("Mattermost event handling failed:", error.message);
      });
    });

    addSocketListener(socket, "close", () => {
      this.connected = false;
      this.authenticated = false;
      this.scheduleReconnect();
    });

    addSocketListener(socket, "error", (event) => {
      this.lastError = event.error?.message || event.message || "Mattermost WebSocket error";
    });
  }

  sendWebSocketAuthentication() {
    if (!this.socket || this.socket.readyState !== this.WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      seq: this.wsSeq,
      action: "authentication_challenge",
      data: { token: this.token },
    }));
    this.wsSeq += 1;
  }

  async handleWebSocketMessage(raw) {
    const payload = JSON.parse(String(raw));
    if (payload.status === "OK" && payload.seq_reply) {
      this.authenticated = true;
      return;
    }

    if (payload.status === "FAIL") {
      this.authenticated = false;
      this.lastError = payload.error?.message || "Mattermost WebSocket authentication failed";
      return;
    }

    if (payload.event !== "posted") return;

    const incoming = parseMattermostPostedEvent(payload, {
      botUserId: this.user?.id,
      username: this.user?.username || this.config.username,
      replyMode: this.config.replyMode,
    });
    if (!incoming) return;

    const metadata = await this.getUserMetadata(incoming.target.userId);
    await this.handlers.onText({
      platform: "mattermost",
      chat: { ...incoming.target, ...metadata },
      text: incoming.text,
    });
  }

  async getUserMetadata(userId) {
    if (!userId) return { username: null };
    const cacheKey = String(userId);
    const cached = this.userMetadataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.metadata;
    }

    let metadata;
    try {
      const { data } = await this.request(`/api/v4/users/${encodeURIComponent(cacheKey)}`);
      metadata = {
        userId: cacheKey,
        username: data?.username || null,
      };
    } catch (error) {
      this.lastError = error.message;
      metadata = {
        userId: cacheKey,
        username: null,
      };
    }

    this.userMetadataCache.set(cacheKey, {
      metadata,
      expiresAt: Date.now() + USER_METADATA_CACHE_TTL_MS,
    });
    return metadata;
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;

    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, DEFAULT_RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        if (!this.config.token) {
          await this.authenticate();
        }
        this.connectWebSocket();
      } catch (error) {
        this.lastError = error.message;
        console.error("Mattermost reconnect failed:", error.message);
        this.scheduleReconnect();
      }
    }, delay);
  }

  async sendMessage(target, text, replyMarkup) {
    assertChannelTarget(target);
    return this.createPost(buildMattermostPost({
      target,
      text,
      replyMarkup,
      actionUrl: this.config.actionUrl,
      actionSecret: this.config.actionSecret,
      botUsername: this.user?.username || this.config.username,
    }));
  }

  buildPost(target, text, replyMarkup) {
    return buildMattermostPost({
      target,
      text,
      replyMarkup,
      actionUrl: this.config.actionUrl,
      actionSecret: this.config.actionSecret,
      botUsername: this.user?.username || this.config.username,
    });
  }

  async sendDocument(target, filePath, caption) {
    assertChannelTarget(target);
    try {
      const upload = await this.uploadFile(target.channelId, filePath);
      return await this.createPost({
        channel_id: target.channelId,
        message: caption || "",
        file_ids: upload.fileIds,
        ...(target.rootId ? { root_id: target.rootId } : {}),
      });
    } catch (error) {
      console.error("Mattermost file delivery failed:", error.message);
      return this.sendMessage(
        target,
        "PDF-файл подготовлен, но отправка файлов сейчас недоступна в Mattermost.",
      );
    }
  }

  async createPost(post) {
    const { data } = await this.request("/api/v4/posts", {
      method: "POST",
      body: post,
    });
    return data;
  }

  async uploadFile(channelId, filePath) {
    const buffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append("channel_id", channelId);
    form.append("files", new Blob([buffer], { type: "application/pdf" }), path.basename(filePath));

    const { data } = await this.request("/api/v4/files", {
      method: "POST",
      form,
    });
    const fileIds = (data.file_infos || []).map((file) => file.id).filter(Boolean);
    if (!fileIds.length) {
      throw new Error("Mattermost file upload returned no file IDs.");
    }
    return { fileIds };
  }

  async request(pathname, options = {}) {
    const url = new URL(pathname, this.config.url);
    const headers = {};
    let body;

    if (options.auth !== false) {
      if (!this.token) throw new Error("Mattermost token is not available.");
      headers.Authorization = `Bearer ${this.token}`;
    }

    if (options.form) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const message = data.message || text || response.status;
      throw new Error(`${options.method || "GET"} ${pathname} failed: ${message}`);
    }

    return { data, response };
  }
}

function createMattermostTransport(config, handlers) {
  return new MattermostTransport(config, handlers);
}

function normalizeConfig(config) {
  const url = String(config.url || "").trim().replace(/\/+$/, "");
  if (!url) throw new Error("Missing MATTERMOST_URL");
  if (!config.token && (!config.username || !config.password)) {
    throw new Error("Missing MATTERMOST_TOKEN or MATTERMOST_USERNAME/MATTERMOST_PASSWORD");
  }

  return {
    url,
    token: String(config.token || "").trim(),
    username: String(config.username || "").trim(),
    password: String(config.password || ""),
    mode: config.mode || "mentions",
    replyMode: config.replyMode || "thread",
    actionUrl: String(config.actionUrl || "").trim(),
    actionSecret: String(config.actionSecret || "").trim(),
  };
}

function parseMattermostPostedEvent(payload, options) {
  const post = parsePost(payload?.data?.post);
  if (!post || !post.message || post.delete_at) return null;
  if (post.user_id && post.user_id === options.botUserId) return null;

  const channelType = payload?.data?.channel_type || payload?.broadcast?.channel_type || post.channel_type || "";
  const isDirect = channelType === "D";
  const isMentioned = isMattermostMention(post.message, options.username, options.botUserId);
  if (!isDirect && !isMentioned) return null;

  const text = (isDirect ? post.message : stripMattermostMention(post.message, options.username, options.botUserId)).trim() || "/start";
  const channelId = post.channel_id || payload?.broadcast?.channel_id;
  if (!channelId || !post.user_id) return null;

  return {
    text,
    target: createMattermostTarget({
      userId: post.user_id,
      channelId,
      postId: post.id,
      channelType,
      rootId: !isDirect && options.replyMode === "thread" ? (post.root_id || post.id) : "",
    }),
  };
}

function parsePost(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createMattermostTarget({ userId, channelId, postId, channelType, rootId = "" }) {
  const isDirect = channelType === "D";
  return {
    platform: "mattermost",
    id: isDirect ? `dm:${userId}` : `channel:${channelId}:user:${userId}`,
    userId,
    channelId,
    postId: postId || "",
    rootId,
    channelType,
  };
}

function isMattermostMention(text, username, userId) {
  const value = String(text || "");
  if (username && new RegExp(`(^|[\\s,;:])@${escapeRegex(username)}(?=$|[\\s,;:,.!?])`, "i").test(value)) {
    return true;
  }
  if (userId && value.includes(`<@${userId}>`)) return true;
  return false;
}

function stripMattermostMention(text, username, userId) {
  let value = String(text || "");
  if (username) {
    value = value.replace(
      new RegExp(`(^|[\\s,;:])@${escapeRegex(username)}[\\s,;:,.!?]*`, "gi"),
      "$1",
    );
  }
  if (userId) {
    value = value.replace(new RegExp(`<@${escapeRegex(userId)}>`, "g"), "");
  }
  return value.replace(/\s+/g, " ").trim();
}

function formatMattermostMessage(text, replyMarkup) {
  const options = replyMarkupOptions(replyMarkup);
  const base = String(text || "");
  if (!options.length) return base;
  return [
    base,
    "",
    ...options.map((option, index) => `${index + 1}. ${option.label}`),
  ].join("\n");
}

function replyMarkupOptions(replyMarkup) {
  if (!replyMarkup?.inline_keyboard?.length) return [];
  return replyMarkup.inline_keyboard
    .flat()
    .map((button) => ({
      label: String(button.text || "").replace(/^✓\s*/, ""),
      data: String(button.callback_data || ""),
    }))
    .filter((button) => button.label && button.data);
}

function buildMattermostPost({ target, text, replyMarkup, actionUrl = "", actionSecret = "", botUsername = "" }) {
  assertChannelTarget(target);
  const post = {
    channel_id: target.channelId,
    message: formatMattermostMessage(text, replyMarkup),
    ...(target.rootId ? { root_id: target.rootId } : {}),
  };

  const attachments = buildMattermostAttachments({
    target,
    replyMarkup,
    actionUrl,
    actionSecret,
    botUsername,
  });
  if (attachments.length) {
    post.props = { attachments };
  }
  return post;
}

function buildMattermostAttachments({ target, replyMarkup, actionUrl, actionSecret, botUsername }) {
  if (!actionUrl || !actionSecret || !replyMarkup?.inline_keyboard?.length) return [];

  return replyMarkup.inline_keyboard
    .map((row, rowIndex) => {
      const actions = row
        .map((button, columnIndex) => buildMattermostAction({
          target,
          button,
          actionUrl,
          actionSecret,
          botUsername,
          index: `${rowIndex}${columnIndex}`,
        }))
        .filter(Boolean);
      return actions.length ? { actions } : null;
    })
    .filter(Boolean);
}

function buildMattermostAction({ target, button, actionUrl, actionSecret, botUsername, index }) {
  const label = String(button?.text || "").replace(/^✓\s*/, "");
  const callbackData = String(button?.callback_data || "");
  if (!label || !callbackData) return null;

  return {
    id: `a${index}`,
    type: "button",
    name: label,
    integration: {
      url: actionUrl,
      context: {
        token: actionSecret,
        callback_data: callbackData,
        user_id: String(target.userId || ""),
        username: String(target.username || ""),
        channel_id: String(target.channelId || ""),
        channel_type: String(target.channelType || ""),
        root_id: String(target.rootId || ""),
        post_id: String(target.postId || ""),
        bot_username: String(botUsername || ""),
      },
    },
  };
}

function toWebSocketUrl(baseUrl) {
  const url = new URL("/api/v4/websocket", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

function assertChannelTarget(target) {
  if (!target?.channelId) {
    throw new Error("Mattermost target is missing channelId.");
  }
}

function getWebSocketImpl() {
  if (typeof globalThis.WebSocket === "function") return globalThis.WebSocket;
  return require("ws");
}

function addSocketListener(socket, eventName, handler) {
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(eventName, handler);
    return;
  }

  socket.on(eventName, (...args) => {
    if (eventName === "message") {
      handler({ data: args[0] });
      return;
    }
    if (eventName === "error") {
      handler({ error: args[0], message: args[0]?.message });
      return;
    }
    handler({});
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  buildMattermostPost,
  createMattermostTransport,
  createMattermostTarget,
  formatMattermostMessage,
  isMattermostMention,
  parseMattermostPostedEvent,
  replyMarkupOptions,
  stripMattermostMention,
};
