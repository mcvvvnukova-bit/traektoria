const TELEGRAM_BOT_COMMANDS = [
  { command: "start", description: "Главное меню" },
  { command: "description", description: "Подобрать по описанию" },
  { command: "agent", description: "Подобрать с AI агентом" },
  { command: "deep", description: "Составить углубленную траекторию" },
  { command: "new_interests", description: "Траектория новых интересов" },
  { command: "help", description: "Что умеет бот" },
];

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

function buildHelpText() {
  return [
    "Я помогу подобрать программы дополнительного образования и построить траекторию обучения.",
    "",
    "Доступные сценарии:",
    "/description - подобрать по описанию",
    "/agent - пройти пошаговый подбор",
    "/deep - составить углубленную траекторию",
    "/new_interests - найти новые направления",
    "",
    "Команду можно выбрать в меню Telegram в любой момент.",
  ].join("\n");
}

module.exports = {
  TELEGRAM_BOT_COMMANDS,
  parseBotCommand,
  buildHelpText,
};
