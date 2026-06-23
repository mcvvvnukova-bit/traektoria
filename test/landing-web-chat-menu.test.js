const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const landingHtml = fs.readFileSync(path.join(__dirname, "..", "landing", "index.html"), "utf8");

test("landing web chat exposes scenario command menu", () => {
  const commands = [...landingHtml.matchAll(/data-chat-command="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(commands, ["/text", "/quiz", "/deep", "/wide", "/help"]);
  assert.match(landingHtml, /data-chat-label="Подобрать по описанию"/);
  assert.match(landingHtml, /data-chat-label="Подобрать с AI агентом"/);
  assert.match(landingHtml, /data-chat-label="Составить углубленную траекторию"/);
  assert.match(landingHtml, />\s*Углубленная траектория\s*</);
  assert.match(landingHtml, /data-chat-label="Траектория новых интересов"/);
});

test("landing command menu sends slash commands through web chat message endpoint", () => {
  assert.match(landingHtml, /querySelectorAll\("\[data-chat-command\]"\)/);
  assert.match(landingHtml, /sendToChat\("message", \{ text: command \}\)/);
});
