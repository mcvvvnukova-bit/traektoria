// Source: Rosstat OKTMO OK 033-2013, volume 2, section 2.
// https://rosstat.gov.ru/storage/mediabank/OKTMO_tom2_Sev-Zap_fo.docx

const MURMANSK_SETTLEMENTS = Object.freeze([
  { type: "г", name: "Заполярный" },
  { type: "пгт", name: "Никель" },
  { type: "пгт", name: "Печенга" },
  { type: "нп", name: "Борисоглебский" },
  { type: "нп", name: "Вайда-Губа" },
  { type: "нп", name: "Корзуново" },
  { type: "нп", name: "Лиинахамари" },
  { type: "нп", name: "Луостари" },
  { type: "нп", name: "Приречный" },
  { type: "нп", name: "Путевая Усадьба 9 км железной дороги Луостари-Никель" },
  { type: "нп", name: "Раякоски" },
  { type: "нп", name: "Сальмиярви" },
  { type: "нп", name: "Спутник" },
  { type: "нп", name: "Цыпнаволок" },
  { type: "ж/д ст", name: "Печенга" },
  { type: "ж/д ст", name: "Титовка" },
  { type: "ж/д ст", name: "Луостари" },
  { type: "г", name: "Ковдор" },
  { type: "нп", name: "Ёнский" },
  { type: "нп", name: "Риколатва" },
  { type: "нп", name: "Куропта" },
  { type: "нп", name: "Лейпи" },
  { type: "с", name: "Ёна" },
  { type: "г", name: "Апатиты" },
  { type: "нп", name: "Тик-Губа" },
  { type: "ж/д ст", name: "Хибины" },
  { type: "г", name: "Кировск" },
  { type: "нп", name: "Коашва" },
  { type: "нп", name: "Титан" },
  { type: "г", name: "Мончегорск" },
  { type: "нп", name: "25 км железной дороги Мончегорск-Оленья" },
  { type: "нп", name: "27 км железной дороги Мончегорск-Оленья" },
  { type: "г", name: "Оленегорск" },
  { type: "с", name: "Имандра" },
  { type: "нп", name: "Высокий" },
  { type: "ж/д ст", name: "Лапландия" },
  { type: "ж/д ст", name: "Ягельный Бор" },
  { type: "г", name: "Полярные Зори" },
  { type: "нп", name: "Зашеек" },
  { type: "нп", name: "Африканда" },
  { type: "г", name: "Кандалакша" },
  { type: "пгт", name: "Зеленоборский" },
  { type: "нп", name: "Белое Море" },
  { type: "нп", name: "Зареченск" },
  { type: "нп", name: "Кайралы" },
  { type: "нп", name: "Куолоярви" },
  { type: "нп", name: "Лесозаводский" },
  { type: "нп", name: "Нивский" },
  { type: "нп", name: "Пояконда" },
  { type: "нп", name: "Приозерный" },
  { type: "с", name: "Алакуртти" },
  { type: "с", name: "Княжая Губа" },
  { type: "с", name: "Ковда" },
  { type: "с", name: "Ковдозеро" },
  { type: "с", name: "Колвица" },
  { type: "с", name: "Лувеньга" },
  { type: "с", name: "Федосеевка" },
  { type: "ж/д ст", name: "Жемчужная" },
  { type: "ж/д ст", name: "Ковда" },
  { type: "ж/д ст", name: "Нямозеро" },
  { type: "ж/д ст", name: "Пинозеро" },
  { type: "ж/д ст", name: "Проливы" },
  { type: "ж/д ст", name: "Ручьи" },
  { type: "пгт", name: "Умба" },
  { type: "нп", name: "Восточное Мунозеро" },
  { type: "нп", name: "Индель" },
  { type: "нп", name: "Маяк Никодимский" },
  { type: "с", name: "Варзуга" },
  { type: "с", name: "Кузомень" },
  { type: "с", name: "Кашкаранцы" },
  { type: "с", name: "Оленица" },
  { type: "с", name: "Пялица" },
  { type: "с", name: "Тетрино" },
  { type: "с", name: "Чаваньга" },
  { type: "с", name: "Чапома" },
  { type: "пгт", name: "Ревда" },
  { type: "с", name: "Ловозеро" },
  { type: "с", name: "Каневка" },
  { type: "с", name: "Краснощелье" },
  { type: "с", name: "Сосновка" },
  { type: "г", name: "Кола" },
  { type: "пгт", name: "Верхнетуломский" },
  { type: "пгт", name: "Кильдинстрой" },
  { type: "пгт", name: "Молочный" },
  { type: "пгт", name: "Мурмаши" },
  { type: "пгт", name: "Туманный" },
  { type: "с", name: "Белокаменка" },
  { type: "с", name: "Минькино" },
  { type: "с", name: "Пулозеро" },
  { type: "с", name: "Териберка" },
  { type: "с", name: "Тулома" },
  { type: "с", name: "Ура-Губа" },
  { type: "нп", name: "Восточный Кильдин" },
  { type: "нп", name: "Голубые Ручьи" },
  { type: "нп", name: "Дальние Зеленцы" },
  { type: "нп", name: "Западный Кильдин" },
  { type: "нп", name: "Зверосовхоз" },
  { type: "нп", name: "Килпъявр" },
  { type: "нп", name: "Междуречье" },
  { type: "нп", name: "Мишуково" },
  { type: "нп", name: "Мокрая Кица" },
  { type: "нп", name: "Остров Большой Олений" },
  { type: "нп", name: "Песчаный" },
  { type: "нп", name: "Пушной" },
  { type: "нп", name: "Ретинское" },
  { type: "нп", name: "Светлый" },
  { type: "нп", name: "Шонгуй" },
  { type: "ж/д ст", name: "Выходной" },
  { type: "ж/д ст", name: "Кица" },
  { type: "ж/д ст", name: "Лопарская" },
  { type: "ж/д ст", name: "Магнетиты" },
  { type: "ж/д ст", name: "Нял" },
  { type: "ж/д ст", name: "Пяйве" },
  { type: "ж/д ст", name: "Тайбола" },
  { type: "г", name: "Мурманск" },
  { type: "г", name: "Североморск" },
  { type: "пгт", name: "Сафоново" },
  { type: "нп", name: "Североморск-3" },
  { type: "нп", name: "Щукозеро" },
  { type: "г", name: "Островной" },
  { type: "нп", name: "Лумбовка" },
  { type: "нп", name: "Корабельное" },
  { type: "нп", name: "Святой Нос" },
  { type: "нп", name: "Мыс-Чёрный" },
  { type: "нп", name: "Маяк-Городецкий" },
  { type: "нп", name: "Терско-Орловский Маяк" },
  { type: "г", name: "Заозерск" },
  { type: "нп", name: "Видяево" },
  { type: "нп", name: "Чан-Ручей" },
  { type: "г", name: "Полярный" },
  { type: "г", name: "Гаджиево" },
  { type: "г", name: "Снежногорск" },
  { type: "нп", name: "Кувшинская Салма" },
  { type: "нп", name: "Оленья Губа" },
  { type: "нп", name: "Сайда-Губа" },
]);

const TYPE_ALIASES = Object.freeze({
  "г": ["г", "г.", "город"],
  "пгт": ["пгт", "п.г.т.", "поселок городского типа", "посёлок городского типа"],
  "нп": ["нп", "н.п.", "населенный пункт", "населённый пункт", "поселок", "посёлок"],
  "с": ["с", "с.", "село"],
  "ж/д ст": ["ж/д ст", "жд ст", "железнодорожная станция", "станция", "ст"],
});

const MURMANSK_SETTLEMENT_NAMES = Object.freeze([
  ...new Set(MURMANSK_SETTLEMENTS.map((settlement) => settlement.name)),
]);

const MURMANSK_SETTLEMENT_PROMPT_LIST = MURMANSK_SETTLEMENTS
  .map(settlementDisplayName)
  .join(", ");

const SETTLEMENT_MATCHERS = MURMANSK_SETTLEMENTS.map((settlement) => ({
  settlement,
  patterns: buildSettlementPatterns(settlement),
}));

function settlementDisplayName(settlement) {
  return `${settlement.type} ${settlement.name}`;
}

function findMurmanskSettlements(text) {
  const normalizedText = normalizeForSearch(text);
  if (!normalizedText) return [];

  const matches = [];
  for (const [order, { settlement, patterns }] of SETTLEMENT_MATCHERS.entries()) {
    const found = patterns
      .map((pattern) => normalizedText.match(pattern))
      .filter(Boolean)
      .map((match) => match.index);
    if (found.length) {
      matches.push({
        name: settlement.name,
        index: Math.min(...found),
        order,
      });
    }
  }
  return [...new Map(
    matches
      .sort((left, right) => left.index - right.index || left.order - right.order)
      .map((match) => [match.name, match.name]),
  ).values()];
}

function normalizeSettlementLocation(value) {
  const matches = findMurmanskSettlements(value);
  return matches.length === 1 ? matches[0] : "";
}

function buildSettlementPatterns(settlement) {
  const namePattern = phrasePattern(settlement.name);
  const aliases = TYPE_ALIASES[settlement.type] || [settlement.type];
  const typePattern = aliases.map(phrasePattern).join("|");
  return [
    boundedPattern(namePattern),
    boundedPattern(`(?:${typePattern})\\s+${namePattern}`),
  ];
}

function boundedPattern(pattern) {
  return new RegExp(`(^|[^а-яa-z0-9])${pattern}(?=$|[^а-яa-z0-9])`, "i");
}

function phrasePattern(value) {
  return normalizeForSearch(value)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(wordPattern)
    .join("[\\s-]+");
}

function wordPattern(word) {
  if (/^\d+$/.test(word)) return escapeRegExp(word);
  if (word.length <= 4) return escapeRegExp(word);

  if (word.endsWith("ск")) return `${escapeRegExp(word)}(?:е|а|у|ом)?`;
  if (word.endsWith("ый")) return `${escapeRegExp(word.slice(0, -2))}(?:ый|ого|ому|ым|ом)`;
  if (word.endsWith("ий")) return `${escapeRegExp(word.slice(0, -2))}(?:ий|его|ему|им|ем)`;
  if (word.endsWith("ая")) return `${escapeRegExp(word.slice(0, -2))}(?:ая|ой|ую)`;
  if (word.endsWith("ое")) return `${escapeRegExp(word.slice(0, -2))}(?:ое|ом)`;
  if (word.endsWith("а")) return `${escapeRegExp(word.slice(0, -1))}(?:а|е|у|ой|ы)`;
  if (word.endsWith("я")) return `${escapeRegExp(word.slice(0, -1))}(?:я|е|ю|ей|и)`;
  if (word.endsWith("о")) return `${escapeRegExp(word.slice(0, -1))}(?:о|е|ом|а)`;
  if (word.endsWith("ь")) return `${escapeRegExp(word.slice(0, -1))}(?:ь|е|я|ю|ем)`;
  if (word.endsWith("ы") || word.endsWith("и")) {
    return `${escapeRegExp(word.slice(0, -1))}(?:${escapeRegExp(word.slice(-1))}|ах|ам|ами|ов)`;
  }
  return `${escapeRegExp(word)}(?:е|а|у|ом)?`;
}

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  MURMANSK_SETTLEMENTS,
  MURMANSK_SETTLEMENT_NAMES,
  MURMANSK_SETTLEMENT_PROMPT_LIST,
  findMurmanskSettlements,
  normalizeSettlementLocation,
  settlementDisplayName,
};
