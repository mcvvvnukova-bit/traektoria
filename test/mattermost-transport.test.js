const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMattermostPost,
  formatMattermostMessage,
  isMattermostMention,
  parseMattermostPostedEvent,
  stripMattermostMention,
} = require("../src/mattermost-transport");

function postedEvent(post, data = {}) {
  return {
    event: "posted",
    data: {
      ...(data.omitDataChannelType ? {} : { channel_type: data.channelType || "O" }),
      post: JSON.stringify({
        id: data.postId || "post1",
        user_id: data.userId || "user1",
        channel_id: data.channelId || "channel1",
        message: post,
        root_id: data.rootId || "",
      }),
    },
    broadcast: {
      channel_id: data.channelId || "channel1",
      ...(data.broadcastChannelType ? { channel_type: data.broadcastChannelType } : {}),
    },
  };
}

test("accepts direct Mattermost messages without mention", () => {
  const incoming = parseMattermostPostedEvent(
    postedEvent("Здравствуйте", { channelType: "D" }),
    { botUserId: "bot1", username: "botnumber2", replyMode: "thread" },
  );

  assert.equal(incoming.text, "Здравствуйте");
  assert.equal(incoming.target.id, "dm:user1");
  assert.equal(incoming.target.channelId, "channel1");
  assert.equal(incoming.target.rootId, "");
});

test("uses broadcast channel type when Mattermost omits data channel type", () => {
  const incoming = parseMattermostPostedEvent(
    postedEvent("Здравствуйте", { omitDataChannelType: true, broadcastChannelType: "D" }),
    { botUserId: "bot1", username: "botnumber2", replyMode: "thread" },
  );

  assert.equal(incoming.text, "Здравствуйте");
  assert.equal(incoming.target.id, "dm:user1");
});

test("accepts channel messages only when bot is mentioned", () => {
  const ignored = parseMattermostPostedEvent(
    postedEvent("подбери кружок"),
    { botUserId: "bot1", username: "botnumber2", replyMode: "thread" },
  );
  const incoming = parseMattermostPostedEvent(
    postedEvent("@botnumber2 подбери кружок", { channelId: "channel2", postId: "post2" }),
    { botUserId: "bot1", username: "botnumber2", replyMode: "thread" },
  );

  assert.equal(ignored, null);
  assert.equal(incoming.text, "подбери кружок");
  assert.equal(incoming.target.id, "channel:channel2:user:user1");
  assert.equal(incoming.target.rootId, "post2");
});

test("ignores Mattermost posts from the bot user", () => {
  const incoming = parseMattermostPostedEvent(
    postedEvent("@botnumber2 hello", { userId: "bot1" }),
    { botUserId: "bot1", username: "botnumber2", replyMode: "thread" },
  );

  assert.equal(incoming, null);
});

test("detects and strips username and id mentions", () => {
  assert.equal(isMattermostMention("ping @botnumber2!", "botnumber2", "bot1"), true);
  assert.equal(isMattermostMention("ping <@bot1>", "botnumber2", "bot1"), true);
  assert.equal(stripMattermostMention("@botnumber2, подбери", "botnumber2", "bot1"), "подбери");
  assert.equal(stripMattermostMention("<@bot1> подбери", "botnumber2", "bot1"), "подбери");
});

test("formats inline keyboards as numbered Mattermost choices", () => {
  const text = formatMattermostMessage("Выберите вариант", {
    inline_keyboard: [
      [{ text: "✓ Первый", callback_data: "one" }],
      [{ text: "Второй", callback_data: "two" }],
    ],
  });

  assert.equal(
    text,
    "Выберите вариант\n\n1. Первый\n2. Второй\n\nОтветьте номером варианта или напишите ответ текстом, если нужен свой вариант.",
  );
});

test("formats Mattermost multi-select choices with comma-number guidance", () => {
  const text = formatMattermostMessage("Выберите варианты", {
    inline_keyboard: [
      [{ text: "Первый", callback_data: "s2:goal:first" }],
      [{ text: "Второй", callback_data: "s2:goal:second" }],
      [{ text: "Продолжить", callback_data: "s2:goal_continue" }],
    ],
  });

  assert.equal(
    text,
    "Выберите варианты\n\n1. Первый\n2. Второй\n3. Продолжить\n\nОтветьте одним или несколькими номерами через запятую. Чтобы перейти дальше, укажите номер «Продолжить».",
  );
});

test("keeps Mattermost choices text-only without attachments", () => {
  const post = buildMattermostPost({
    target: {
      platform: "mattermost",
      id: "dm:user1",
      userId: "user1",
      channelId: "channel1",
      channelType: "D",
    },
    text: "Выберите вариант",
    replyMarkup: {
      inline_keyboard: [
        [{ text: "Первый", callback_data: "one" }],
      ],
    },
    actionUrl: "ignored",
    actionSecret: "secret",
  });

  assert.equal(
    post.message,
    "Выберите вариант\n\n1. Первый\n\nОтветьте номером варианта или напишите ответ текстом, если нужен свой вариант.",
  );
  assert.equal(post.props, undefined);
});
