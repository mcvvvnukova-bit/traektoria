const test = require("node:test");
const assert = require("node:assert/strict");

const {
  makeTarget,
  normalizeTarget,
  targetFilePart,
  targetKey,
} = require("../src/target");

test("keeps numeric transport ids as stable strings", () => {
  const target = makeTarget("telegram", 12345);

  assert.equal(target.platform, "telegram");
  assert.equal(target.id, "12345");
  assert.equal(targetKey(target), "telegram:12345");
});

test("preserves Mattermost string identifiers and metadata", () => {
  const target = makeTarget("mattermost", "channel:abc:user:def", {
    channelId: "abc",
    rootId: "root-post",
  });

  assert.equal(target.id, "channel:abc:user:def");
  assert.equal(target.channelId, "abc");
  assert.equal(target.rootId, "root-post");
  assert.equal(targetKey(target), "mattermost:channel:abc:user:def");
});

test("normalizes object targets without dropping transport metadata", () => {
  const target = normalizeTarget({
    platform: "mattermost",
    id: "dm:user1",
    channelId: "dm-channel",
  });

  assert.deepEqual(target, {
    platform: "mattermost",
    id: "dm:user1",
    channelId: "dm-channel",
  });
});

test("builds safe file path fragments from string ids", () => {
  assert.equal(
    targetFilePart({ platform: "mattermost", id: "channel:abc/user:def" }),
    "mattermost-channel_abc_user_def",
  );
});
