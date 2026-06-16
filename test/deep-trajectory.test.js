const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createScenario3State,
  mergeScenario3Links,
  parsePfdoProgramLinks,
  buildCompletedProgramsReviewMessage,
  buildCompletedProgramsTopicsMessage,
  buildDeepTrajectoryResultMessage,
  buildScenario3PdfAnswers,
  buildScenario3PdfResult,
  buildMunicipalityKeyboard,
} = require("../src/deep-trajectory");

test("parses PFDO program links and keeps link-to-program mapping", () => {
  const parsed = parsePfdoProgramLinks(
    "https://51.pfdo.ru/programs/12345 и https://example.com/programs/777",
  );

  assert.deepEqual(parsed.programIds, [12345]);
  assert.deepEqual(parsed.programLinks, [{ id: 12345, url: "https://51.pfdo.ru/programs/12345" }]);
  assert.equal(parsed.invalidLinks.length, 1);
});

test("accumulates scenario 3 links across separate messages", () => {
  const state = createScenario3State();

  const first = mergeScenario3Links(state, "https://51.pfdo.ru/programs/101");
  const second = mergeScenario3Links(
    state,
    "https://51.pfdo.ru/app/program/101 https://51.pfdo.ru/programs/202",
  );

  assert.equal(first.total, 1);
  assert.equal(second.total, 2);
  assert.equal(second.added.length, 1);
  assert.equal(second.duplicates.length, 1);
  assert.deepEqual(state.submittedProgramIds, [101, 202]);
});

test("caps accumulated scenario 3 links at five programs", () => {
  const state = createScenario3State();

  mergeScenario3Links(
    state,
    [
      "https://51.pfdo.ru/programs/1",
      "https://51.pfdo.ru/programs/2",
      "https://51.pfdo.ru/programs/3",
      "https://51.pfdo.ru/programs/4",
      "https://51.pfdo.ru/programs/5",
      "https://51.pfdo.ru/programs/6",
    ].join(" "),
  );

  assert.deepEqual(state.submittedProgramIds, [1, 2, 3, 4, 5]);
});

test("adds custom municipality option to scenario 3 municipality keyboard", () => {
  const keyboard = buildMunicipalityKeyboard([
    { id: 10, name: "Мурманск" },
    { id: 20, name: "ЗАТО Североморск" },
  ]);

  assert.deepEqual(keyboard.inline_keyboard.at(-1), [
    { text: "Другой населенный пункт", callback_data: "s3:municipality:custom" },
  ]);
  assert.deepEqual(keyboard.inline_keyboard[0], [
    { text: "Мурманск", callback_data: "s3:municipality:10" },
  ]);
});

test("builds completed programs review with classifier hierarchy labels and program facts", () => {
  const state = createScenario3State();
  state.completedPrograms = [{
    name: "Робототехника",
    municipalityName: "Мурманск",
    ageLabel: "10-12 лет",
    price: "Бесплатно",
    sourceUrl: "https://51.pfdo.ru/app/?program=101",
    topics: [
      {
        name: "Конструирование робота",
        parentName: "Инженерное творчество",
        categoryName: "Робототехника",
      },
      {
        name: "Программирование датчиков",
        parentName: "Информационные технологии",
        categoryName: "Программирование",
      },
      {
        name: "Основы моделирования",
        parentName: "Инженерное творчество",
        categoryName: "Моделирование",
      },
    ],
  }];

  const message = buildCompletedProgramsReviewMessage(state, null, { linkFormat: "html" });

  assert.match(message, /1\. <a href="https:\/\/51\.pfdo\.ru\/app\/\?program=101">Робототехника<\/a>/);
  assert.match(message, /Что ребенок уже проходил:/);
  assert.match(message, /Инженерное творчество\n• Робототехника\n• Моделирование/);
  assert.match(message, /Информационные технологии\n• Программирование/);
  assert.doesNotMatch(message, /Конструирование робота/);
  assert.doesNotMatch(message, /Программирование датчиков/);
  assert.match(message, /Населенный пункт: Мурманск/);
  assert.match(message, /Стоимость: Бесплатно/);
});

test("builds full completed topics message without summary limits", () => {
  const state = createScenario3State();
  state.completedPrograms = [{
    id: 101,
    name: "Маршрут построен",
    topics: [
      { parentName: "Туристская подготовка", categoryName: "Походы, маршруты, техника и тактика" },
      { parentName: "Туристская подготовка", categoryName: "Безопасность и выживание в природной среде" },
      { parentName: "Туристская подготовка", categoryName: "Снаряжение и туристские узлы" },
      { parentName: "Ориентирование и топография", categoryName: "Карты, компас и топография" },
      { parentName: "Ориентирование и топография", categoryName: "Спортивное ориентирование" },
    ],
  }];

  const message = buildCompletedProgramsTopicsMessage(state);

  assert.match(message, /Все темы по пройденным программам:/);
  assert.match(message, /1\. Маршрут построен/);
  assert.match(message, /Туристская подготовка\n• Походы, маршруты, техника и тактика\n• Безопасность и выживание в природной среде\n• Снаряжение и туристские узлы/);
  assert.match(message, /Ориентирование и топография\n• Карты, компас и топография\n• Спортивное ориентирование/);
  assert.doesNotMatch(message, /не показано/);
});

test("uses booking clarification when completed program price is unknown", () => {
  const state = createScenario3State();
  state.completedPrograms = [{
    name: "Робототехника",
    municipalityName: "Мурманск",
    ageLabel: "10-12 лет",
    topics: [{
      parentName: "Инженерное творчество",
      categoryName: "Робототехника",
    }],
  }];

  const message = buildCompletedProgramsReviewMessage(state);

  assert.match(message, /Стоимость: Уточните при записи/);
  assert.doesNotMatch(message, /Стоимость уточняется на карточке программы/);
});

test("explains pending topic processing for on-demand imported programs", () => {
  const state = createScenario3State();
  state.completedPrograms = [{
    name: "Маленькие следопыты",
    municipalityName: "Североморск",
    ageLabel: "6-7 лет",
    price: "Уточните при записи",
    topicsStatus: "pending",
    topics: [],
  }];

  const reviewMessage = buildCompletedProgramsReviewMessage(state);
  const allTopicsMessage = buildCompletedProgramsTopicsMessage(state);

  assert.match(reviewMessage, /классификация тем еще готовится/);
  assert.match(allTopicsMessage, /Полный список появится после обработки документа программы/);
  assert.doesNotMatch(reviewMessage, /категории тем не удалось надежно определить/);
});

test("builds deep trajectory result with classifier hierarchy labels instead of raw topics", () => {
  const profile = {
    categoryLabels: ["Инженерное творчество / Робототехника"],
    topicNames: ["Конструирование робота"],
  };
  const message = buildDeepTrajectoryResultMessage(
    { topicProfile: profile },
    { municipalityName: "Мурманск", ageYears: 10 },
    {
      topicProfile: profile,
      searchContext: { municipalityName: "Мурманск", ageYears: 10 },
      items: [{
        program: "Инженерный проект",
        relatedTopics: ["Инженерное творчество / Робототехника"],
        newTopics: ["Информационные технологии / Программирование"],
        depthSignals: ["проектная работа"],
        venue: "Кванториум",
        address: "ул. Ленина, 1",
        schedule: "Пн 16:00",
        ageLabel: "10-14 лет",
        price: "Бесплатно",
        sourceUrl: "https://51.pfdo.ru/app/?program=1",
      }],
    },
  );

  assert.match(message, /основные направления тем по классификатору/);
  assert.match(message, /Инженерное творчество \/ Робототехника/);
  assert.match(message, /продолжает направления: Инженерное творчество \/ Робототехника/);
  assert.match(message, /углубляет за счет: Информационные технологии \/ Программирование, проектная работа/);
  assert.doesNotMatch(message, /Конструирование робота/);
});

test("uses booking clarification when recommended program price is unknown", () => {
  const profile = {
    categoryLabels: ["Инженерное творчество / Робототехника"],
  };
  const message = buildDeepTrajectoryResultMessage(
    { topicProfile: profile },
    { municipalityName: "Мурманск", ageYears: 10 },
    {
      topicProfile: profile,
      searchContext: { municipalityName: "Мурманск", ageYears: 10 },
      items: [{
        program: "Инженерный проект",
        relatedTopics: ["Инженерное творчество / Робототехника"],
        newTopics: [],
        depthSignals: [],
        venue: "Кванториум",
        address: "ул. Ленина, 1",
        schedule: "Пн 16:00",
        ageLabel: "10-14 лет",
        price: "",
        sourceUrl: "https://51.pfdo.ru/app/?program=1",
      }],
    },
  );

  assert.match(message, /Стоимость: Уточните при записи/);
});

test("builds scenario 3 PDF answers from classifier hierarchy labels", () => {
  const state = createScenario3State();
  state.ageYears = 10;
  state.municipalityName = "Мурманск";
  state.completedTopicProfile = {
    categoryLabels: ["Робототехника", "Программирование"],
    topicNames: ["Датчики"],
    directions: [{ name: "Техническая", count: 1 }],
  };
  state.criteria = {
    fields: {
      place: "Североморск",
      budget: "бесплатно",
      schedule: ["weekends"],
      scheduleText: "по выходным",
    },
  };

  const answers = buildScenario3PdfAnswers(state);

  assert.equal(answers.ageText, "10 лет");
  assert.equal(answers.place, "Североморск");
  assert.equal(answers.cost, "бесплатно");
  assert.equal(answers.interestsText, "Робототехника, Программирование");
});

test("adapts scenario 3 recommendations to common PDF item fields", () => {
  const result = buildScenario3PdfResult({
    items: [{
      program: "Инженерный проект",
      address: "Мурманск, ул. Ленина, 1",
      ageLabel: "10-14 лет",
      availablePlaces: null,
      availableGroups: null,
    }],
  });

  assert.equal(result.items[0].district, "Мурманск, ул. Ленина, 1");
  assert.equal(result.items[0].period, "10-14 лет");
  assert.equal(result.items[0].availablePlaces, null);
});
