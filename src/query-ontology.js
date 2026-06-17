const DIRECTION_LABELS = {
  technical: "Техническая",
  art: "Художественная",
  sport: "Физкультурно-спортивная",
  social: "Социально-гуманитарная",
  science: "Естественно-научная",
  tourism: "Туристско-краеведческая",
};

const QUERY_ACTIVITY_ONTOLOGY = [
  activity("баскетбол", ["баскетбол", "баскет"], ["sports"], "sport", [
    /баскетбол[а-яё]*/iu,
    /баскет\b/iu,
  ]),
  activity("футбол", ["футбол"], ["sports"], "sport", [/футбол[а-яё]*/iu]),
  activity("волейбол", ["волейбол"], ["sports"], "sport", [/волейбол[а-яё]*/iu]),
  activity("хоккей", ["хоккей", "хокке"], ["sports"], "sport", [/хокке[а-яё]*/iu]),
  activity("плавание", ["плавание", "плав"], ["sports"], "sport", [/плаван[а-яё]*/iu]),
  activity("гимнастика", ["гимнастика", "гимнаст"], ["sports"], "sport", [/гимнаст[а-яё]*/iu]),
  activity("самбо", ["самбо"], ["sports"], "sport", [/самбо/iu]),
  activity("дзюдо", ["дзюдо"], ["sports"], "sport", [/дзюдо/iu]),
  activity("борьба", ["борьба", "борьб"], ["sports"], "sport", [/борьб[а-яё]*/iu]),
  activity("бокс", ["бокс"], ["sports"], "sport", [/бокс[а-яё]*/iu]),
  activity("каратэ", ["каратэ", "карате"], ["sports"], "sport", [/карат[эе]/iu]),
  activity("пауэрлифтинг", ["пауэрлифтинг"], ["sports"], "sport", [/пауэрлифтинг[а-яё]*/iu]),
  activity("лыжные гонки", ["лыжные гонки", "лыж"], ["sports"], "sport", [/лыж[а-яё]*/iu]),
  activity("теннис", ["теннис"], ["sports"], "sport", [/теннис[а-яё]*/iu]),
  activity("настольный теннис", ["настольный теннис", "теннис"], ["sports"], "sport", [
    /настольн[а-яё]*\s+теннис[а-яё]*/iu,
  ]),
  activity("шахматы", ["шахматы", "шахмат"], ["logic", "calm"], "science", [/шахмат[а-яё]*/iu]),
  activity("робототехника", ["робототехника", "робот"], ["building", "logic"], "technical", [
    /робот[а-яё]*/iu,
  ]),
  activity("программирование", ["программирование", "программ"], ["logic", "building"], "technical", [
    /программ[а-яё]*/iu,
  ]),
  activity("конструирование", ["конструирование", "констру"], ["building"], "technical", [
    /констру[а-яё]*/iu,
  ]),
  activity("рисование", ["рисование", "рис"], ["creative", "calm"], "art", [/рисован[а-яё]*|рису[а-яё]*/iu]),
  activity("танцы", ["танцы", "танц", "хореография"], ["creative", "social"], "art", [
    /танц[а-яё]*/iu,
    /хореограф[а-яё]*/iu,
  ]),
  activity("вокал", ["вокал", "пение"], ["creative", "social"], "art", [/вокал[а-яё]*|пени[а-яё]*/iu]),
  activity("театр", ["театр", "театральная студия"], ["creative", "social"], "art", [/театр[а-яё]*/iu]),
];

const RAW_TERM_TRIGGERS = new Set([
  "по",
  "любит",
  "нравится",
  "интересует",
  "интересуется",
  "ищем",
  "нужны",
  "нужно",
  "хочет",
]);

const RAW_TERM_STOPWORDS = new Set([
  "занятия",
  "занятие",
  "кружок",
  "кружки",
  "программа",
  "программы",
  "ребенок",
  "ребенку",
  "мальчик",
  "мальчика",
  "девочка",
  "девочку",
  "сын",
  "сыну",
  "дочь",
  "дочке",
  "лет",
  "года",
  "город",
  "оленегорск",
  "оленегорске",
  "мурманск",
  "мурманске",
]);

function activity(canonical, terms, broadInterests, direction, patterns) {
  return {
    canonical,
    terms,
    broadInterests,
    direction,
    directionLabel: DIRECTION_LABELS[direction] || "",
    patterns,
  };
}

function analyzeQueryInterests(text) {
  const normalizedText = normalizeText(text);
  const broadInterests = new Set();
  const specificInterestTerms = new Set();
  const specificInterestLabels = new Set();
  const excludedSpecificInterestTerms = new Set();
  const directions = new Map();
  const matches = [];

  for (const entry of QUERY_ACTIVITY_ONTOLOGY) {
    const match = findEntryMatch(normalizedText, entry);
    if (!match) continue;

    if (isNegated(normalizedText, match.index)) {
      for (const term of entry.terms) excludedSpecificInterestTerms.add(normalizeText(term));
      continue;
    }

    for (const value of entry.broadInterests) broadInterests.add(value);
    for (const term of entry.terms) specificInterestTerms.add(normalizeText(term));
    specificInterestLabels.add(entry.canonical);
    if (entry.direction) directions.set(entry.direction, entry.directionLabel);
    matches.push({
      canonical: entry.canonical,
      matchedText: match.text,
      source: "ontology",
    });
  }

  if (!specificInterestTerms.size) {
    const rawTerm = extractRawSpecificTerm(normalizedText);
    if (rawTerm && !isNegatedTerm(normalizedText, rawTerm)) {
      specificInterestTerms.add(rawTerm);
      specificInterestLabels.add(rawTerm);
      matches.push({
        canonical: rawTerm,
        matchedText: rawTerm,
        source: "raw_user_text",
      });
    }
  }

  const [direction, directionLabel] = directions.size === 1
    ? [...directions.entries()][0]
    : [null, ""];

  return {
    broadInterests: [...broadInterests],
    specificInterestTerms: [...specificInterestTerms],
    specificInterestLabels: [...specificInterestLabels],
    excludedSpecificInterestTerms: [...excludedSpecificInterestTerms],
    direction,
    directionLabel,
    matches,
  };
}

function findEntryMatch(normalizedText, entry) {
  for (const pattern of entry.patterns || []) {
    const match = normalizedText.match(pattern);
    if (match?.[0]) {
      return {
        text: match[0],
        index: match.index || 0,
      };
    }
  }
  return null;
}

function isNegated(text, index) {
  const prefix = text.slice(Math.max(0, index - 32), index);
  return /(?:^|\s)(?:не|без|кроме|исключ(?:ить|ая)?|не\s+нужн[а-яё]*|но\s+не)\s+$/iu.test(prefix) ||
    /(?:^|\s)(?:не|без|кроме|исключ(?:ить|ая)?|но\s+не)\s+[а-яё-]{0,16}$/iu.test(prefix);
}

function isNegatedTerm(text, term) {
  const index = text.indexOf(term);
  return index >= 0 && isNegated(text, index);
}

function extractRawSpecificTerm(text) {
  const tokens = text
    .split(/[^а-яёa-z0-9-]+/iu)
    .map((token) => token.trim())
    .filter(Boolean);

  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (!RAW_TERM_TRIGGERS.has(tokens[index])) continue;
    const term = normalizeRawTerm(tokens[index + 1]);
    if (isUsefulRawTerm(term)) return term;
  }

  return "";
}

function normalizeRawTerm(value) {
  return normalizeText(value)
    .replace(/(?:ом|ем|ами|ями|ами|ями|ах|ях|ов|ев|ам|ям|ой|ей|ую|юю|а|я|у|ю|е|ы|и)$/iu, "")
    .trim();
}

function isUsefulRawTerm(value) {
  if (!value || value.length < 4) return false;
  if (RAW_TERM_STOPWORDS.has(value)) return false;
  if (/^\d+$/u.test(value)) return false;
  return true;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  QUERY_ACTIVITY_ONTOLOGY,
  analyzeQueryInterests,
  normalizeText,
};
