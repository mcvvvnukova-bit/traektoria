const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TELEGRAM_BOT_COMMANDS,
  parseBotCommand,
  buildHelpText,
} = require("../src/telegram-menu");

test("defines Telegram menu commands for available scenarios", () => {
  assert.deepEqual(
    TELEGRAM_BOT_COMMANDS.map((item) => item.command),
    ["start", "description", "agent", "deep", "new_interests", "help"],
  );
  assert.ok(TELEGRAM_BOT_COMMANDS.every((item) => item.description && item.description.length <= 256));
});

test("parses Telegram bot commands with bot username and arguments", () => {
  assert.equal(parseBotCommand("/deep@TraektoriaBot anything"), "deep");
  assert.equal(parseBotCommand("/new_interests"), "new_interests");
  assert.equal(parseBotCommand("/MENU"), "start");
});

test("ignores unknown or non-command text", () => {
  assert.equal(parseBotCommand("deep"), null);
  assert.equal(parseBotCommand("/unknown"), null);
});

test("builds help text with scenario commands", () => {
  const text = buildHelpText();

  assert.match(text, /\/description/);
  assert.match(text, /\/agent/);
  assert.match(text, /\/deep/);
  assert.match(text, /\/new_interests/);
});
