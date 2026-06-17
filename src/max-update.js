function getMaxChatId(update) {
  return firstDefined(
    update?.chat_id,
    update?.message?.chat_id,
    update?.message?.recipient?.chat_id,
    update?.callback?.chat_id,
    update?.message_callback?.chat_id,
  );
}

function getMaxCallbackPayload(update) {
  const callback = update?.callback || update?.message_callback || {};
  const payload = firstDefined(callback.payload, callback.callback_data, callback.data, update?.payload);
  if (payload === undefined || payload === null || payload === "") return "";
  return String(payload);
}

function getMaxCallbackId(update) {
  const callback = update?.callback || update?.message_callback || {};
  return firstDefined(callback.callback_id, update?.callback_id);
}

function getMaxCallbackMessageId(update) {
  const callback = update?.callback || update?.message_callback || {};
  return firstDefined(
    callback.message?.message_id,
    callback.message_id,
    update?.message?.message_id,
    update?.message_id,
    callback.message?.body?.mid,
    update?.message?.body?.mid,
  );
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

module.exports = {
  getMaxCallbackId,
  getMaxCallbackMessageId,
  getMaxCallbackPayload,
  getMaxChatId,
};
