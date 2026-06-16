const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseMattermostActionPayload,
  parseMattermostSlashPayload,
  resolveTraektoriaSlashCommand,
} = require("../src/mattermost-integration");

test("resolves /traektoria slash subcommands", () => {
  assert.equal(resolveTraektoriaSlashCommand(""), "start");
  assert.equal(resolveTraektoriaSlashCommand("menu"), "start");
  assert.equal(resolveTraektoriaSlashCommand("text"), "text");
  assert.equal(resolveTraektoriaSlashCommand("quiz now"), "quiz");
  assert.equal(resolveTraektoriaSlashCommand("deep"), "deep");
  assert.equal(resolveTraektoriaSlashCommand("wide"), "wide");
  assert.equal(resolveTraektoriaSlashCommand("help"), "help");
  assert.equal(resolveTraektoriaSlashCommand("unknown"), null);
});

test("parses valid Mattermost slash command payload", () => {
  const parsed = parseMattermostSlashPayload(new URLSearchParams({
    token: "slash-secret",
    text: "quiz",
    user_id: "user1",
    user_name: "parent",
    channel_id: "channel1",
    channel_name: "town-square",
    team_id: "team1",
    team_domain: "talents",
  }), { token: "slash-secret" });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "quiz");
  assert.equal(parsed.target.platform, "mattermost");
  assert.equal(parsed.target.id, "channel:channel1:user:user1");
  assert.equal(parsed.target.channelId, "channel1");
  assert.equal(parsed.target.userId, "user1");
  assert.equal(parsed.target.username, "parent");
});

test("parses direct-channel Mattermost slash command payload", () => {
  const parsed = parseMattermostSlashPayload({
    token: "slash-secret",
    text: "",
    user_id: "user1",
    channel_id: "channel1",
    channel_name: "user1__bot1",
  }, { token: "slash-secret" });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "start");
  assert.equal(parsed.target.id, "dm:user1");
  assert.equal(parsed.target.channelType, "D");
});

test("rejects invalid Mattermost slash token", () => {
  const parsed = parseMattermostSlashPayload({
    token: "wrong",
    text: "quiz",
    user_id: "user1",
    channel_id: "channel1",
  }, { token: "slash-secret" });

  assert.deepEqual(parsed, { ok: false, status: 401, error: "unauthorized" });
});

test("returns help for unknown Mattermost slash subcommand", () => {
  const parsed = parseMattermostSlashPayload({
    token: "slash-secret",
    text: "wat",
    user_id: "user1",
    channel_id: "channel1",
  }, { token: "slash-secret" });

  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, 200);
  assert.equal(parsed.error, "unknown_command");
  assert.match(parsed.text, /\/traektoria quiz/);
});

test("parses valid Mattermost action payload", () => {
  const parsed = parseMattermostActionPayload({
    user_id: "user1",
    post_id: "button-post",
    channel_id: "channel1",
    context: {
      token: "action-secret",
      callback_data: "scenario:description",
      user_id: "user1",
      username: "parent",
      channel_id: "channel1",
      channel_type: "O",
      root_id: "root1",
    },
  }, { secret: "action-secret" });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.callbackData, "scenario:description");
  assert.equal(parsed.target.id, "channel:channel1:user:user1");
  assert.equal(parsed.target.rootId, "root1");
  assert.equal(parsed.target.username, "parent");
});

test("rejects invalid Mattermost action secret", () => {
  const parsed = parseMattermostActionPayload({
    user_id: "user1",
    context: {
      token: "wrong",
      callback_data: "scenario:description",
      user_id: "user1",
      channel_id: "channel1",
    },
  }, { secret: "action-secret" });

  assert.deepEqual(parsed, { ok: false, status: 401, error: "unauthorized" });
});

test("rejects Mattermost action click from another user", () => {
  const parsed = parseMattermostActionPayload({
    user_id: "user2",
    context: {
      token: "action-secret",
      callback_data: "scenario:description",
      user_id: "user1",
      channel_id: "channel1",
    },
  }, { secret: "action-secret" });

  assert.deepEqual(parsed, { ok: false, status: 403, error: "wrong_user" });
});
