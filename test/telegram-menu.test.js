const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TELEGRAM_BOT_COMMANDS,
  MAX_BOT_COMMANDS,
  parseBotCommand,
  buildHelpText,
} = require("../src/telegram-menu");

test("defines Telegram menu commands for available scenarios", () => {
  assert.deepEqual(
    TELEGRAM_BOT_COMMANDS.map((item) => item.command),
    ["start", "text", "quiz", "deep", "wide", "help"],
  );
  assert.ok(TELEGRAM_BOT_COMMANDS.every((item) => item.description && item.description.length <= 256));
});

test("defines MAX menu commands with MAX Bot API field names", () => {
  assert.deepEqual(
    MAX_BOT_COMMANDS,
    TELEGRAM_BOT_COMMANDS.map(({ command, description }) => ({
      name: command,
      description,
    })),
  );
  assert.ok(MAX_BOT_COMMANDS.every((item) => !("command" in item)));
});

test("parses Telegram bot commands with bot username and arguments", () => {
  assert.equal(parseBotCommand("/deep@TraektoriaBot anything"), "deep");
  assert.equal(parseBotCommand("/wide"), "wide");
  assert.equal(parseBotCommand("/quiz@TraektoriaBot anything"), "quiz");
  assert.equal(parseBotCommand("/TEXT"), "text");
  assert.equal(parseBotCommand("/MENU"), "start");
});

test("ignores unknown or non-command text", () => {
  assert.equal(parseBotCommand("deep"), null);
  assert.equal(parseBotCommand("/unknown"), null);
  assert.equal(parseBotCommand("/description"), null);
  assert.equal(parseBotCommand("/agent"), null);
  assert.equal(parseBotCommand("/new_interests"), null);
});

test("builds help text with scenario commands", () => {
  const text = buildHelpText();

  assert.match(text, /\/text/);
  assert.match(text, /\/quiz/);
  assert.match(text, /\/deep/);
  assert.match(text, /\/wide/);
  assert.match(text, /Подобрать по описанию/);
  assert.doesNotMatch(text, /<b>/);
  assert.doesNotMatch(text, /\/description/);
  assert.doesNotMatch(text, /\/agent/);
  assert.doesNotMatch(text, /\/new_interests/);
});

test("builds help text with bold scenario titles for Telegram html", () => {
  const text = buildHelpText({ format: "html" });

  assert.match(text, /\/text - <b>Подобрать по описанию<\/b>/);
  assert.match(text, /\/quiz - <b>Подобрать через вопросы<\/b>/);
  assert.match(text, /\/deep - <b>Составить углубленную траекторию<\/b>/);
  assert.match(text, /\/wide - <b>Траектория новых интересов<\/b>/);
});
