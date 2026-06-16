const TELEGRAM_BOT_COMMANDS = [
  { command: "start", description: "Главное меню" },
  { command: "text", description: "Подобрать по описанию" },
  { command: "quiz", description: "Подобрать через вопросы" },
  { command: "deep", description: "Составить углубленную траекторию" },
  { command: "wide", description: "Траектория новых интересов" },
  { command: "help", description: "Что умеет бот" },
];

const MAX_BOT_COMMANDS = TELEGRAM_BOT_COMMANDS.map(({ command, description }) => ({
  name: command,
  description,
}));

const COMMAND_ALIASES = new Map([
  ["menu", "start"],
]);

function parseBotCommand(text) {
  const value = String(text || "").trim();
  const match = value.match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s|$)/i);
  if (!match) return null;

  const command = match[1].toLowerCase();
  if (COMMAND_ALIASES.has(command)) return COMMAND_ALIASES.get(command);
  if (TELEGRAM_BOT_COMMANDS.some((item) => item.command === command)) return command;
  return null;
}

function formatScenarioTitle(title, format = "plain") {
  if (format === "html") return `<b>${title}</b>`;
  return title;
}

function buildHelpText(options = {}) {
  const format = options.format || "plain";
  return [
    "Я помогу подобрать программы дополнительного образования и построить траекторию обучения.",
    "",
    "Доступные сценарии:",
    `/text - ${formatScenarioTitle("Подобрать по описанию", format)}`,
    `/quiz - ${formatScenarioTitle("Подобрать через вопросы", format)}`,
    `/deep - ${formatScenarioTitle("Составить углубленную траекторию", format)}`,
    `/wide - ${formatScenarioTitle("Траектория новых интересов", format)}`,
    "",
    "Команду можно выбрать в меню Telegram в любой момент.",
  ].join("\n");
}

module.exports = {
  TELEGRAM_BOT_COMMANDS,
  MAX_BOT_COMMANDS,
  parseBotCommand,
  buildHelpText,
};
