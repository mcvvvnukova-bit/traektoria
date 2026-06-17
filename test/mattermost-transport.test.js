const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMattermostPost,
  buildMattermostPosts,
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

test("formats inline buttons as numbered Mattermost choices", () => {
  const text = formatMattermostMessage("Выберите вариант", {
    inline_keyboard: [
      [{ text: "✓ Первый", callback_data: "one" }],
      [{ text: "Второй", callback_data: "two" }],
    ],
  });

  assert.equal(text, "Выберите вариант\n\n1. Первый\n2. Второй");
});

test("builds Mattermost interactive button attachments when action config is present", () => {
  const post = buildMattermostPost({
    target: {
      platform: "mattermost",
      id: "channel:channel1:user:user1",
      userId: "user1",
      username: "parent",
      channelId: "channel1",
      channelType: "O",
      rootId: "root1",
      postId: "post1",
    },
    text: "Выберите вариант",
    replyMarkup: {
      inline_keyboard: [
        [{ text: "✓ Первый", callback_data: "one" }],
        [{ text: "Второй", callback_data: "two" }],
      ],
    },
    actionUrl: "https://bot.example/mattermost/actions",
    actionSecret: "secret",
    botUsername: "traektoria51_bot",
  });

  assert.equal(post.channel_id, "channel1");
  assert.equal(post.root_id, "root1");
  assert.equal(post.message, "Выберите вариант\n\n1. Первый\n2. Второй");
  assert.equal(post.props.attachments.length, 1);
  assert.equal(post.props.attachments[0].fallback, "Доступные варианты выбора");
  assert.deepEqual(
    post.props.attachments[0].actions.map((action) => action.name),
    ["Первый", "Второй"],
  );
  assert.equal(post.props.attachments[0].actions[0].integration.url, "https://bot.example/mattermost/actions");
  assert.equal(post.props.attachments[0].actions[0].integration.context.token, "secret");
  assert.equal(post.props.attachments[0].actions[0].integration.context.callback_data, "one");
  assert.equal(post.props.attachments[0].actions[0].integration.context.user_id, "user1");
  assert.equal(post.props.attachments[0].actions[0].integration.context.channel_id, "channel1");
});

test("splits long Mattermost interactive keyboards into several posts", () => {
  const posts = buildMattermostPosts({
    target: {
      platform: "mattermost",
      id: "dm:user1",
      userId: "user1",
      channelId: "channel1",
      channelType: "D",
    },
    text: "Выберите варианты",
    replyMarkup: {
      inline_keyboard: [
        [{ text: "Первый", callback_data: "one" }],
        [{ text: "Второй", callback_data: "two" }],
        [{ text: "Третий", callback_data: "three" }],
        [{ text: "Четвертый", callback_data: "four" }],
        [{ text: "Пятый", callback_data: "five" }],
        [{ text: "Продолжить", callback_data: "continue" }],
      ],
    },
    actionUrl: "https://bot.example/mattermost/actions",
    actionSecret: "secret",
  });

  assert.equal(posts.length, 2);
  assert.equal(posts[0].message, "Выберите варианты\n\n1. Первый\n2. Второй\n3. Третий\n4. Четвертый\n5. Пятый\n6. Продолжить");
  assert.deepEqual(
    posts[0].props.attachments[0].actions.map((action) => action.name),
    ["Первый", "Второй", "Третий", "Четвертый", "Пятый"],
  );
  assert.equal(posts[1].message, "Еще вариант (6):");
  assert.deepEqual(
    posts[1].props.attachments[0].actions.map((action) => action.name),
    ["Продолжить"],
  );
  assert.equal(posts[1].props.attachments[0].actions[0].integration.context.callback_data, "continue");
});

test("keeps Mattermost numbered fallback without action config", () => {
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
  });

  assert.equal(post.message, "Выберите вариант\n\n1. Первый");
  assert.equal(post.props, undefined);
});
