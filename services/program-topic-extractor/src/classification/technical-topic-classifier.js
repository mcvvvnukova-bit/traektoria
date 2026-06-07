const NORMALIZER_VERSION = "topic-normalizer-v3";
const CLASSIFIER_VERSION = "technical-hierarchical-taxonomy-v3";
const AGGREGATION_VERSION = "program-topic-aggregate-v1";

const SERVICE_CATEGORY_BY_CODE = {
  assessment: "Диагностика, контроль и аттестация",
  intro_final: "Вводные, повторение и итоговые занятия",
  methods: "Формы занятий и методики",
  schedule: "Организация занятий и учебный график",
  materials_equipment: "Оборудование, материалы и источники",
};

const NOISE_CATEGORY_BY_CODE = {
  ocr_noise: "OCR/табличный шум",
  too_generic: "Слишком общая тема",
  toc_fragment: "Фрагмент оглавления",
  location_fragment: "Место проведения или кабинет",
  unknown: "Не удалось классифицировать",
};
const UNKNOWN_CONTENT_CATEGORY = "Предметная тема без категории";
const DOMAIN_BY_CODE = {
  it: "IT и программирование",
  engineering: "Инженерия и робототехника",
  media_design: "Медиа и дизайн",
  transport: "Транспорт и безопасность",
  project: "Проектная деятельность",
  service: "Служебные темы",
  noise: "Шум и нераспознанные темы",
  unknown_content: "Предметные темы без категории",
  content: "Предметные темы",
};
const CONTENT_CATEGORY_BY_CODE = {
  programming: "Программирование и алгоритмы",
  robotics: "Робототехника и LEGO",
  electronics: "Электроника, схемотехника и Arduino",
  web: "Веб-разработка",
  games_apps: "Разработка игр и приложений",
  cad_3d: "3D-моделирование и печать",
  engineering_graphics: "САПР, черчение и инженерная графика",
  technical_modeling: "Техническое моделирование и механизмы",
  digital_design: "Графический и цифровой дизайн",
  media_animation: "Медиа, фото, видео и анимация",
  data_ai: "Данные, базы данных и искусственный интеллект",
  networks_security: "Интернет, сети и цифровая безопасность",
  math_logic: "Математика, логика и олимпиадные задачи",
  engineering_science: "Инженерные и естественнонаучные основы",
  transport_safety: "ПДД, транспорт и первая помощь",
  project_research: "Проектная и исследовательская деятельность",
};
const CONTENT_DOMAIN_BY_CATEGORY = {
  programming: "it",
  web: "it",
  games_apps: "it",
  data_ai: "it",
  networks_security: "it",
  math_logic: "it",
  robotics: "engineering",
  electronics: "engineering",
  cad_3d: "engineering",
  engineering_graphics: "engineering",
  technical_modeling: "engineering",
  engineering_science: "engineering",
  digital_design: "media_design",
  media_animation: "media_design",
  transport_safety: "transport",
  project_research: "project",
};

const CONTENT_RULES = [
  rule("programming", "Программирование и алгоритмы", "it", "IT и программирование", [
    "программир",
    "алгоритм",
    "python",
    "java",
    "pascal",
    "scratch",
    "c++",
    "переменн",
    "цикл",
    "массив",
    "функц",
    "рекурс",
    "код",
    "компиля",
    "оператор",
    "язык программ",
    "блоки программы",
    "лабиринт",
    "сумо",
    "команды",
  ], ["язык программирования", "основы программирования", "блоки программы", "интеллектуальное сумо"]),
  rule("robotics", "Робототехника и LEGO", "engineering", "Инженерия и робототехника", [
    "робот",
    "lego",
    "wedo",
    "ev3",
    "mindstorms",
    "spike",
    "nxt",
    "датчик",
    "манипулятор",
    "кегельринг",
    "автоматическая дверь",
    "автоматическая урна",
    "жучок",
    "карусель",
    "качели",
    "лягушка",
    "вездеход",
  ], ["соревнования роботов", "роботы на сцене", "колесо обозрения", "голодный аллигатор"]),
  rule("electronics", "Электроника, схемотехника и Arduino", "engineering", "Инженерия и робототехника", [
    "электр",
    "электрон",
    "схем",
    "цепь",
    "ток",
    "напряж",
    "резист",
    "транзист",
    "arduino",
    "ардуино",
    "микроконтрол",
    "пайк",
    "светодиод",
    "breadboard",
  ], ["электрическая цепь"]),
  rule("web", "Веб-разработка", "it", "IT и программирование", [
    "html",
    "css",
    "javascript",
    "веб",
    "web",
    "сайт",
    "страниц",
    "гипертекст",
    "хостинг",
    "домен",
    "браузер",
  ], ["создание сайта", "web-дизайн", "веб-дизайн"]),
  rule("games_apps", "Разработка игр и приложений", "it", "IT и программирование", [
    "создание игры",
    "игровой проект",
    "компьютерная игра",
    "unity",
    "minecraft",
    "майнкрафт",
    "приложен",
    "android",
    "pygame",
    "персонаж",
    "сценарий игры",
  ], ["разработка приложений"]),
  rule("cad_3d", "3D-моделирование и печать", "engineering", "Инженерия и робототехника", [
    "3d",
    "3д",
    "трехмер",
    "объемн",
    "объёмн",
    "blender",
    "tinkercad",
    "sketchup",
    "fusion",
    "stl",
    "слайсер",
    "3d-принтер",
    "3d принтер",
    "печать",
    "прототип",
  ], ["3d моделирование", "3d-моделирование", "3d печать", "трехмерное моделирование"]),
  rule("engineering_graphics", "САПР, черчение и инженерная графика", "engineering", "Инженерия и робототехника", [
    "чертеж",
    "чертёж",
    "сапр",
    "cad",
    "autocad",
    "inventor",
    "компас",
    "ескд",
    "проекц",
    "размер",
    "разрез",
    "сечен",
    "инженерн граф",
  ], ["инженерная графика"]),
  rule("technical_modeling", "Техническое моделирование и механизмы", "engineering", "Инженерия и робототехника", [
    "авиа",
    "самолет",
    "самолёт",
    "планер",
    "ракета",
    "судо",
    "кораб",
    "автомод",
    "модель",
    "моделизм",
    "катапульт",
    "кран",
    "механизм",
    "передач",
    "рычаг",
    "шасси",
    "конструктор",
    "конструирование",
    "тяга",
    "тягач",
  ], ["модель самолета", "модель ракеты", "техническое моделирование", "конструирование по замыслу", "создание модели", "свободная сборка"]),
  rule("digital_design", "Графический и цифровой дизайн", "media_design", "Медиа и дизайн", [
    "дизайн",
    "композици",
    "цвет",
    "шрифт",
    "логотип",
    "фирменн",
    "бренд",
    "айдентик",
    "макет",
    "графическ",
    "плакат",
    "иллюстрац",
    "интерфейс",
    "krita",
    "оригами",
    "рисунок",
    "живопись",
  ], ["графический дизайн", "цифровой дизайн", "техника оригами", "тематический рисунок"]),
  rule("media_animation", "Медиа, фото, видео и анимация", "media_design", "Медиа и дизайн", [
    "видео",
    "монтаж",
    "фильм",
    "ролик",
    "звук",
    "аудио",
    "фото",
    "фотограф",
    "кадр",
    "камера",
    "мульт",
    "анимац",
    "медиа",
    "журналист",
  ], ["создание мультфильма", "культура речи журналиста"]),
  rule("data_ai", "Данные, базы данных и искусственный интеллект", "it", "IT и программирование", [
    "данн",
    "база данных",
    "sql",
    "таблиц",
    "нейро",
    "искусственн интеллект",
    "машинн",
    "анализ данных",
  ], ["базы данных", "искусственный интеллект"]),
  rule("networks_security", "Интернет, сети и цифровая безопасность", "it", "IT и программирование", [
    "интернет",
    "сеть",
    "сетев",
    "кибер",
    "безопасн",
    "аккаунт",
    "парол",
    "почт",
    "поисков",
    "социальн сет",
  ], ["цифровая безопасность"]),
  rule("math_logic", "Математика, логика и олимпиадные задачи", "it", "IT и программирование", [
    "математ",
    "логик",
    "задач",
    "олимпиад",
    "геометр",
    "комбинатор",
    "головолом",
    "шифр",
    "системы счисления",
  ], ["решение задач"]),
  rule("engineering_science", "Инженерные и естественнонаучные основы", "engineering", "Инженерия и робототехника", [
    "физик",
    "хими",
    "энерг",
    "возобновляем",
    "эксперимент",
    "опыт",
    "измерен",
    "сила",
    "давлен",
    "температур",
  ], ["возобновляемые источники энергии"]),
  rule("transport_safety", "ПДД, транспорт и первая помощь", "transport", "Транспорт и безопасность", [
    "пдд",
    "дорож",
    "транспорт",
    "автомоб",
    "велосип",
    "светофор",
    "пешеход",
    "дтп",
    "первая помощь",
    "аптечк",
    "повязк",
    "эвакуац",
    "перекрест",
    "регулировщик",
    "ожог",
    "кровотеч",
  ], ["правила дорожного движения", "проезд перекрестков", "знаки регулировщика", "оказание первой помощи"]),
  rule("project_research", "Проектная и исследовательская деятельность", "project", "Проектная деятельность", [
    "проект",
    "исслед",
    "защита",
    "презентация проекта",
    "стартап",
    "бизнес",
    "заказчик",
    "творческ проект",
    "соревнован",
  ], ["защита проекта", "проектная деятельность", "подготовка к защите", "участие в соревнованиях"]),
];

const SERVICE_RULES = [
  serviceRule("assessment", ["диагност", "контроль", "тест", "аттеста", "зачет", "зачёт", "опрос", "экзамен", "викторин", "провероч", "норматив"]),
  serviceRule("intro_final", ["вводн", "повтор", "заключ", "итогов", "подведение итогов", "обобщение", "рефлексия"]),
  serviceRule("schedule", ["режим", "расписан", "продолжительность", "учебн недел", "академическ", "год обуч", "срок осво", "срок реализации", "объем программы", "наполняемость", "периодичность"]),
  serviceRule("materials_equipment", ["кабинет", "оборудован", "материал", "литератур", "пособие", "энциклопед", "издатель", "ноутбук", "стул", "стол", "накопитель", "ssd"]),
  serviceRule("methods", ["практическая работа", "практическая", "практические", "беседа", "демонстрац", "наблюдение", "самостоятельная", "лекция", "группов", "индивидуальн"]),
];

const MANUAL_BATCH1_RULES = [
  manualRule("noise", "toc_fragment", [
    /\b(м\.|москва|санкт-петербург|петербург|пресс|просвещение|астрель|диалектика|бхв|наука|бином|лаборатория знаний|мозаика-синтез|вильямс|аркти|галактика)\b/u,
    /\b(20[0-2]\d|19\d\d)\b\.?$/u,
    /поляков .* еремин/u,
    /педагог дополнительного образования/u,
  ]),
  manualRule("noise", "ocr_noise", [
    /^\(?макс\.?$/u,
    /^тий$/u,
    /^часа?,?$/u,
    /^программы$/u,
    /^группы$/u,
    /^занятиями$/u,
    /^последствия\)?$/u,
    /^формы форма занятия$/u,
    /^конструирование по$/u,
    /^инструктаж по$/u,
    /^пострадавшему\.?$/u,
  ]),
  manualRule("noise", "too_generic", [
    /^первые шаги$/u,
    /^введение\.?$/u,
    /^введение в программу$/u,
    /^творческая$/u,
    /^выполнение$/u,
    /^использование$/u,
    /^заказать$/u,
    /^информации$/u,
    /^современность\)?$/u,
    /^высокий уровень$/u,
    /^третий уровень сложности\.?$/u,
  ]),
  manualRule("service", "schedule", [
    /срок реализации программы/u,
    /объем программы/u,
    /длительность программы/u,
    /кол(?:ич)?-?во учебных недель/u,
    /количество учебных недель/u,
    /учебн(ый|ых|ого) график/u,
    /время (занятий|обучения)/u,
    /период обучения/u,
    /перерыв после первого часа/u,
    /\b36 недель\b/u,
    /\b18 учебных недель\b/u,
    /\b45 мин\b/u,
    /установленного периода обучения/u,
    /количество обучающихся в группе/u,
    /наполняемость/u,
  ]),
  manualRule("service", "materials_equipment", [
    /накопитель/u,
    /\bssd\b/u,
    /стулья/u,
    /столы/u,
    /ноутбук/u,
    /доска магнитно-маркерная/u,
    /карандаши/u,
    /ножницы/u,
    /линейка/u,
    /надфил/u,
    /напильник/u,
    /металлическ/u,
    /инструменты:/u,
    /яндекс\.телемост/u,
  ]),
  manualRule("service", "assessment", [
    /^промежуточн\w*\.?$/u,
    /^предварительн\w*\.?$/u,
    /^текущий\.?$/u,
    /^устный\.?$/u,
    /^практическое задание\.?$/u,
    /максимальное количество баллов/u,
    /соответствие требуемой структуре/u,
    /наличия плана действий/u,
    /качество презентации/u,
    /новизна/u,
    /актуальность/u,
    /анализ существующих аналогов/u,
    /техническая красота/u,
    /выступление/u,
    /вая аттес/u,
  ]),
  manualRule("service", "intro_final", [/подведение работы объединения за год/u]),
  manualRule("content", "robotics", [
    /автоматическая (дверь|урна)/u,
    /жучок/u,
    /карусель/u,
    /качели/u,
    /лягушка/u,
    /танцующие птицы/u,
    /рычащий лев/u,
    /голодный аллигатор/u,
    /обезьянка-барабанщица/u,
    /колесо обозрения/u,
    /вездеход/u,
    /динозавры/u,
    /великан/u,
    /машины будущего/u,
    /старинные машины/u,
  ]),
  manualRule("content", "technical_modeling", [
    /конструирование по замыслу/u,
    /конструирование$/u,
    /конструирование и/u,
    /простое моделирование/u,
    /моделирование на каркасах/u,
    /конструкции/u,
    /полезные приспособления/u,
    /свободная сборка/u,
    /создание модели/u,
    /терминал для прохода/u,
    /тяга/u,
  ]),
  manualRule("content", "programming", [/блоки программы/u, /лабиринт/u, /интеллектуальное сумо/u]),
  manualRule("content", "digital_design", [
    /символика мира/u,
    /тематический рисунок/u,
    /рисунок\. живопись/u,
    /фантазируй/u,
    /наш двор/u,
    /что нас окружает/u,
    /день победы/u,
    /техника оригами/u,
    /косынка/u,
    /домашние животные/u,
  ]),
  manualRule("content", "media_animation", [/культура речи журналиста/u]),
  manualRule("content", "transport_safety", [
    /проезд перекрестков/u,
    /перекрестки/u,
    /знаки регулировщика/u,
    /регулировщик/u,
    /знаки приоритета/u,
    /запрещающие знаки/u,
    /предупреждающие знаки/u,
    /дорога,/u,
    /дорож/u,
    /юид/u,
    /водителя/u,
    /ожоги/u,
    /первая помощь/u,
    /кровотеч/u,
    /повяз/u,
    /наложение жгута/u,
    /обморок/u,
    /формы тб и пп/u,
    /команды движения/u,
    /переходы/u,
    /движения и повороты/u,
  ]),
  manualRule("content", "project_research", [
    /подготовка к защите/u,
    /подготовка к соревнованиям/u,
    /участие в соревнованиях/u,
    /возможность реализации/u,
  ]),
  manualRule("content", "engineering_science", [/основы медицинских знаний/u, /освещение/u]),
  manualRule("content", "engineering_graphics", [/линейка металлическая/u]),
];

const SYNONYMS = [
  [/\b3д\b/giu, "3D"],
  [/\bтр[её]хмерн\w*/giu, "3D"],
  [/\bардуино\b/giu, "Arduino"],
  [/\bлего\b/giu, "LEGO"],
  [/\bпайтон\b/giu, "Python"],
  [/\bджаваскрипт\b/giu, "JavaScript"],
  [/\bскретч\b/giu, "Scratch"],
];

function normalizeAndClassifyTopic(row) {
  const normalized = normalizeTopic(row);
  const classification = classifyNormalizedTopic({
    normalizedTopicName: normalized.normalizedTopicName,
    normalizedTopicKey: normalized.normalizedTopicKey,
    programName: row.programName,
    sectionTitle: row.sectionTitle,
    recordTypeHint: normalized.recordType,
    noiseReason: normalized.noiseReason,
  });

  return {
    ...normalized,
    classification,
  };
}

function normalizeTopic(row) {
  const rawTopicName = String(row.topicName || "").trim();
  const activityType = normalizeActivityType(row.activityType, rawTopicName);
  const cleaned = cleanTopicName(rawTopicName);
  const key = normalizeKey(cleaned);
  const noiseReason = detectNoiseReason(rawTopicName, cleaned, key);
  const manualRuleMatch = !noiseReason ? detectManualBatch1Rule(key) : null;
  const serviceCode = !noiseReason && !manualRuleMatch ? detectServiceCode(key) : "";
  const recordType = noiseReason ? "noise" : manualRuleMatch ? manualRuleMatch.recordType : serviceCode ? "service" : "content";
  const confidence = estimateNormalizationConfidence(rawTopicName, cleaned, noiseReason, serviceCode);

  return {
    rawTopicName,
    normalizedTopicName: cleaned || rawTopicName,
    normalizedTopicKey: key || normalizeKey(rawTopicName),
    activityTypeNormalized: activityType,
    recordType,
    serviceCode,
    noiseReason: noiseReason || (manualRuleMatch?.recordType === "noise" ? manualRuleMatch.categoryCode : ""),
    manualRule: manualRuleMatch?.ruleId || "",
    normalizationMethod: "rules",
    normalizationVersion: NORMALIZER_VERSION,
    normalizationConfidence: confidence,
    rawPayload: {
      original_activity_type: row.activityType || "",
      section_title: row.sectionTitle || "",
      control_form: row.controlForm || "",
      manual_rule_category: manualRuleMatch?.categoryCode || "",
    },
  };
}

function classifyNormalizedTopic({ normalizedTopicName, normalizedTopicKey, programName, sectionTitle, recordTypeHint, noiseReason }) {
  if (recordTypeHint === "noise") {
    const code = noiseReason || "unknown";
    return buildClassification({
      recordType: "noise",
      parentCode: "noise",
      parentName: "Шум и нераспознанные темы",
      categoryCode: code,
      categoryName: NOISE_CATEGORY_BY_CODE[code] || NOISE_CATEGORY_BY_CODE.unknown,
      confidence: code === "unknown" ? 0.35 : 0.9,
      topCategories: [],
      matchedRules: [{ rule: `noise:${code}` }],
      inputText: normalizedTopicName,
    });
  }

  const manualRuleMatch = detectManualBatch1Rule(normalizedTopicKey);
  if (manualRuleMatch) {
    return buildManualBatch1Classification(
      manualRuleMatch,
      buildInputText(normalizedTopicName, programName, sectionTitle),
    );
  }

  const serviceCode = detectServiceCode(normalizedTopicKey);
  if (recordTypeHint === "service" || serviceCode) {
    const code = serviceCode || "methods";
    return buildClassification({
      recordType: "service",
      parentCode: "service",
      parentName: "Служебные темы",
      categoryCode: code,
      categoryName: SERVICE_CATEGORY_BY_CODE[code],
      confidence: serviceCode ? 0.86 : 0.62,
      topCategories: [],
      matchedRules: [{ rule: `service:${code}` }],
      inputText: buildInputText(normalizedTopicName, programName, sectionTitle),
    });
  }

  const inputText = buildInputText(normalizedTopicName, programName, sectionTitle);
  const topicKey = normalizeKey(normalizedTopicName);
  const contextKey = normalizeKey(`${sectionTitle || ""} ${programName || ""}`);
  const scored = scoreContentRules(topicKey, contextKey);
  const best = scored[0];

  if (!best || best.score <= 0 || (!best.topicMatches.length && !best.phraseMatches.length)) {
    return buildClassification({
      recordType: "content",
      parentCode: "unknown_content",
      parentName: "Предметные темы без категории",
      categoryCode: "unknown_content",
      categoryName: UNKNOWN_CONTENT_CATEGORY,
      confidence: best?.score > 0 ? 0.42 : 0.34,
      topCategories: [],
      matchedRules: [],
      inputText,
    });
  }

  const secondScore = scored[1]?.score || 0;
  const confidence = estimateClassificationConfidence(best.score, secondScore, best.topicMatches.length, best.phraseMatches.length);

  return buildClassification({
    recordType: "content",
    parentCode: best.rule.parentCode,
    parentName: best.rule.parentName,
    categoryCode: best.rule.code,
    categoryName: best.rule.name,
    confidence,
    topCategories: scored.slice(0, 3).map((item) => ({
      category_code: item.rule.code,
      category_name: item.rule.name,
      score: Number(item.score.toFixed(3)),
    })),
    matchedRules: [...best.phraseMatches, ...best.topicMatches, ...best.contextMatches].map((match) => ({
      rule: `${best.rule.code}:${match.kind}`,
      value: match.value,
      weight: match.weight,
    })),
    inputText,
  });
}

function classificationFromGoldenLabel({ normalizedTopicName, programName, recordType, categoryCode, categoryName, source }) {
  const resolvedCategoryName = categoryName || categoryNameFor(recordType, categoryCode);
  const parentCode = parentCodeFor(recordType, categoryCode);
  const parentName = parentNameFor(recordType, categoryCode);
  return buildClassification({
    recordType,
    parentCode,
    parentName,
    categoryCode,
    categoryName: resolvedCategoryName,
    confidence: 0.99,
    topCategories: [{
      category_code: categoryCode,
      category_name: resolvedCategoryName,
      score: 100,
    }],
    matchedRules: [{ rule: `golden_label:${source || "manual"}` }],
    inputText: buildInputText(normalizedTopicName, programName, ""),
  });
}

function cleanTopicName(value) {
  let text = String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[«»]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/^TABLE_ROW\s*\|\|\s*/iu, "");
  text = text.replace(/^(?:текущий|предварительный|промежуточный)\s+\d+(?:[.)])?\s*/iu, "");
  text = text.replace(/^\d+(?:[.)]|\.\d+)?\s*/u, "");
  text = text.replace(/^(?:тема|раздел|модуль)\s*\d+(?:[.)])?\s*/iu, "");
  text = text.replace(/^(?:практическая\s+работа|самостоятельная\s+работа|теоретическое\s+занятие|теория|практика|комбинированное|контроль|проект)\s*[:.-]\s*/iu, "");
  text = text.replace(/\s+(?:теория|практика|контроль|зач[её]т|опрос|наблюдение)\.?$/iu, "");
  text = text.replace(/\s+\d+(?:[,.]\d+)?\s*(?:час(?:а|ов)?\.?)?$/iu, "");
  text = text.replace(/\s+/g, " ").trim(" .;-");

  for (const [pattern, replacement] of SYNONYMS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\bhtml\b/giu, "HTML");
  text = text.replace(/\bcss\b/giu, "CSS");
  text = text.replace(/\bsql\b/giu, "SQL");
  text = text.replace(/\bev3\b/giu, "EV3");
  text = text.replace(/\bwedo\b/giu, "WeDo");
  return text.trim();
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\u00a0/g, " ")
    .replace(/[«»"“”]/g, "")
    .replace(/[^0-9a-zа-я+#. -]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim(" .-");
}

function detectNoiseReason(raw, cleaned, key) {
  if (!key) return "unknown";
  if (key.length <= 2) return "too_generic";
  if (/^table_row\b/iu.test(raw)) return "ocr_noise";
  if (/^[\d .,:;/-]+$/u.test(key)) return "ocr_noise";
  if (/\b(м\.|москва|санкт-петербург|петербург|пресс|просвещение|астрель|диалектика|бхв|наука|бином|лаборатория знаний|мозаика-синтез|вильямс|аркти|галактика)\b/iu.test(key)) {
    return "toc_fragment";
  }
  if (/\b(20[0-2]\d|19\d\d)\b\.?$/u.test(key) && key.length < 120) return "toc_fragment";
  if (/\.{4,}|…{2,}|[._·]{3,}\s*\d{1,3}$/u.test(raw)) return "toc_fragment";
  if (/^(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)$/iu.test(key)) {
    return "too_generic";
  }
  if (/^(цели|формы|текст|результат|урок|занятие|макс|транспорт|информация|интернет|компьютерный|компьютер|практика|теория|введение)$/iu.test(key)) {
    return "too_generic";
  }
  if (/^(каб\.?|кабинет|аудитория|зал|дюц|мбу|мау|моу)\b/iu.test(key)) return "location_fragment";
  if (/ддт|дию|полярис|ровесник/iu.test(key) && key.length < 40) return "location_fragment";
  if (/^-\d+\s+год/iu.test(key)) return "ocr_noise";
  if (/^(специальная|техническая|тактическая|подготовка)$/iu.test(key)) return "too_generic";
  if (!cleaned || cleaned.length < 3) return "too_generic";
  return "";
}

function detectServiceCode(key) {
  const exactAssessment = /^(промежуточн\w*|предварительн\w*|текущий|устный|практическое задание)\.?$/iu;
  if (exactAssessment.test(key)) return "assessment";
  for (const item of SERVICE_RULES) {
    if (item.code === "methods" && looksContentLike(key)) continue;
    if (item.needles.some((needle) => key.includes(needle))) return item.code;
  }
  return "";
}

function detectManualBatch1Rule(key) {
  for (const item of MANUAL_BATCH1_RULES) {
    if (item.patterns.some((pattern) => pattern.test(key))) {
      return item;
    }
  }
  return null;
}

function buildManualBatch1Classification(item, inputText) {
  if (item.recordType === "noise") {
    return buildClassification({
      recordType: "noise",
      parentCode: "noise",
      parentName: "Шум и нераспознанные темы",
      categoryCode: item.categoryCode,
      categoryName: NOISE_CATEGORY_BY_CODE[item.categoryCode] || NOISE_CATEGORY_BY_CODE.unknown,
      confidence: 0.9,
      topCategories: [],
      matchedRules: [{ rule: item.ruleId }],
      inputText,
    });
  }

  if (item.recordType === "service") {
    return buildClassification({
      recordType: "service",
      parentCode: "service",
      parentName: "Служебные темы",
      categoryCode: item.categoryCode,
      categoryName: SERVICE_CATEGORY_BY_CODE[item.categoryCode],
      confidence: 0.9,
      topCategories: [],
      matchedRules: [{ rule: item.ruleId }],
      inputText,
    });
  }

  const categoryName = CONTENT_CATEGORY_BY_CODE[item.categoryCode] || item.categoryCode;
  return buildClassification({
    recordType: "content",
    parentCode: parentCodeFor("content", item.categoryCode),
    parentName: parentNameFor("content", item.categoryCode),
    categoryCode: item.categoryCode,
    categoryName,
    confidence: 0.9,
    topCategories: [{
      category_code: item.categoryCode,
      category_name: categoryName,
      score: 10,
    }],
    matchedRules: [{ rule: item.ruleId }],
    inputText,
  });
}

function parentCodeFor(recordType, categoryCode) {
  if (recordType === "service") return "service";
  if (recordType === "noise") return "noise";
  if (categoryCode === "unknown_content") return "unknown_content";
  return CONTENT_DOMAIN_BY_CATEGORY[categoryCode] || "content";
}

function parentNameFor(recordType, categoryCode) {
  return DOMAIN_BY_CODE[parentCodeFor(recordType, categoryCode)] || DOMAIN_BY_CODE.content;
}

function categoryNameFor(recordType, categoryCode) {
  if (recordType === "service") return SERVICE_CATEGORY_BY_CODE[categoryCode] || categoryCode;
  if (recordType === "noise") return NOISE_CATEGORY_BY_CODE[categoryCode] || categoryCode;
  if (categoryCode === "unknown_content") return UNKNOWN_CONTENT_CATEGORY;
  return CONTENT_CATEGORY_BY_CODE[categoryCode] || categoryCode;
}

function looksContentLike(key) {
  return CONTENT_RULES.some(
    (item) => item.phrases.some((phrase) => key.includes(phrase)) || item.needles.some((needle) => key.includes(needle)),
  );
}

function scoreContentRules(topicKey, contextKey) {
  return CONTENT_RULES.map((item) => {
    const phraseMatches = item.phrases
      .filter((phrase) => topicKey.includes(phrase))
      .map((value) => ({ kind: "phrase", value, weight: 3 }));
    const topicMatches = item.needles
      .filter((needle) => topicKey.includes(needle))
      .map((value) => ({ kind: "topic", value, weight: 2 }));
    const contextMatches = item.needles
      .filter((needle) => contextKey.includes(needle))
      .map((value) => ({ kind: "context", value, weight: 0.5 }));
    const score =
      phraseMatches.reduce((sum, match) => sum + match.weight, 0) +
      topicMatches.reduce((sum, match) => sum + match.weight, 0) +
      Math.min(2, contextMatches.reduce((sum, match) => sum + match.weight, 0));

    return {
      rule: item,
      phraseMatches,
      topicMatches,
      contextMatches,
      score,
    };
  }).sort((left, right) => right.score - left.score);
}

function estimateNormalizationConfidence(raw, cleaned, noiseReason, serviceCode) {
  if (noiseReason) return 0.9;
  let score = 0.72;
  if (cleaned && cleaned !== raw) score += 0.08;
  if (serviceCode) score += 0.08;
  if (cleaned.length >= 8 && cleaned.length <= 120) score += 0.08;
  return Number(Math.min(0.95, score).toFixed(2));
}

function estimateClassificationConfidence(score, secondScore, topicMatchCount, phraseMatchCount) {
  let confidence = 0.52 + Math.min(0.32, score * 0.08);
  if (phraseMatchCount > 0) confidence += 0.08;
  if (topicMatchCount >= 2) confidence += 0.06;
  if (secondScore > 0 && score - secondScore < 1.5) confidence -= 0.18;
  return Number(Math.max(0.35, Math.min(0.96, confidence)).toFixed(2));
}

function normalizeActivityType(activityType, topicName) {
  const text = normalizeKey(`${activityType || ""} ${topicName || ""}`);
  if (/контроль|зачет|зачёт|тест|экзамен|опрос|аттеста|соревнован|норматив/.test(text)) return "контроль";
  if (/проект/.test(text)) return "проект";
  if (/теория/.test(text) && /практик/.test(text)) return "теория+практика";
  if (/практик|лаборатор|упражнен|трениров/.test(text)) return "практика";
  if (/теор|лекци|беседа|знакомство|история/.test(text)) return "теория";
  return activityType || "не определено";
}

function buildInputText(topicName, programName, sectionTitle) {
  return [
    `Тема: ${topicName || ""}`,
    programName ? `Программа: ${programName}` : "",
    sectionTitle ? `Раздел: ${sectionTitle}` : "",
  ].filter(Boolean).join("\n");
}

function buildClassification({
  recordType,
  parentCode,
  parentName,
  categoryCode,
  categoryName,
  confidence,
  topCategories,
  matchedRules,
  inputText,
}) {
  return {
    recordType,
    parentCode,
    parentName,
    categoryCode,
    categoryName,
    confidence,
    topCategories,
    matchedRules,
    inputText,
    classifierMethod: "rules",
    classifierVersion: CLASSIFIER_VERSION,
  };
}

function rule(code, name, parentCode, parentName, needles, phrases = []) {
  return {
    code,
    name,
    parentCode,
    parentName,
    needles: needles.map(normalizeKey),
    phrases: phrases.map(normalizeKey),
  };
}

function serviceRule(code, needles) {
  return {
    code,
    needles: needles.map(normalizeKey),
  };
}

function manualRule(recordType, categoryCode, patterns) {
  return {
    recordType,
    categoryCode,
    patterns,
    ruleId: `manual_batch1:${recordType}:${categoryCode}`,
  };
}

module.exports = {
  normalizeAndClassifyTopic,
  classifyNormalizedTopic,
  classificationFromGoldenLabel,
  normalizeKey,
  NORMALIZER_VERSION,
  CLASSIFIER_VERSION,
  AGGREGATION_VERSION,
};
