const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getMaxCallbackId,
  getMaxCallbackMessageId,
  getMaxCallbackPayload,
  getMaxChatId,
} = require("../src/max-update");

test("extracts MAX SDK callback fields used by inline multi-select buttons", () => {
  const update = {
    update_type: "message_callback",
    callback: {
      callback_id: "callback-1",
      payload: "s2:goal:interest",
      user: { user_id: 7, username: "parent" },
    },
    message: {
      recipient: { chat_id: 42, chat_type: "dialog" },
      body: {
        mid: "mid.123",
        text: "Какие цели обучения сейчас важнее?",
      },
    },
  };

  assert.equal(getMaxChatId(update), 42);
  assert.equal(getMaxCallbackId(update), "callback-1");
  assert.equal(getMaxCallbackPayload(update), "s2:goal:interest");
  assert.equal(getMaxCallbackMessageId(update), "mid.123");
});

test("keeps legacy MAX callback field fallbacks", () => {
  const update = {
    chat_id: 42,
    callback_id: "callback-2",
    payload: "s2:goal:first_try",
    message: { message_id: "legacy-message-1" },
  };

  assert.equal(getMaxChatId(update), 42);
  assert.equal(getMaxCallbackId(update), "callback-2");
  assert.equal(getMaxCallbackPayload(update), "s2:goal:first_try");
  assert.equal(getMaxCallbackMessageId(update), "legacy-message-1");
});
