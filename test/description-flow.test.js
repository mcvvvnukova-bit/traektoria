const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isDescriptionTextStep,
  startDescriptionFlow,
  handleDescriptionText,
  handleDescriptionCallback,
} = require("../src/description-flow");
const { createDescriptionSelectionState } = require("../src/description-selection");

function createHarness(session = {}) {
  const messages = [];
  const documents = [];
  const logs = [];
  const criteriaLogs = [];
  const target = { platform: "telegram", id: 123 };
  const fullSession = {
    step: "entry",
    descriptionSelection: createDescriptionSelectionState(),
    ...session,
  };

  return {
    target,
    session: fullSession,
    messages,
    documents,
    logs,
    criteriaLogs,
    context(extra = {}) {
      return {
        target,
        session: fullSession,
        persistSession: async () => {},
        sendMessage: async (_target, text, replyMarkup) => messages.push({ text, replyMarkup }),
        sendDocument: async (_target, filePath, caption) => documents.push({ filePath, caption }),
        getRecommendations: async () => ({
          source: "test",
          confidence: "medium",
          isSparse: false,
          items: [{
            program: "Робототехника",
            district: "Мурманск, ул. Ленина, 1",
            schedule: "Понедельник 18:00",
            price: "Бесплатно",
            topics: ["робототехника"],
            sourceUrl: "https://51.pfdo.ru/programs/1",
          }],
        }),
        logRecommendation: async (_platform, _id, payload) => logs.push(payload),
        logCriteriaRecognition: async (_platform, _id, payload) => criteriaLogs.push(payload),
        createSelectionPdf: async ({ outputPath }) => outputPath,
        normalizeTarget: (value) => value,
        ...extra,
      };
    },
  };
}

test("starts description flow from menu", async () => {
  const harness = createHarness();

  await startDescriptionFlow(harness.context());

  assert.equal(harness.session.step, "s1_wait_description");
  assert.equal(harness.session.scenario.id, "description_selection");
  assert.match(harness.messages[0].text, /Напишите, что ищете/);
});

test("only accepts free text on description input steps", () => {
  assert.equal(isDescriptionTextStep("s1_wait_description"), true);
  assert.equal(isDescriptionTextStep("s1_wait_required_clarification"), true);
  assert.equal(isDescriptionTextStep("s1_wait_edit"), true);
  assert.equal(isDescriptionTextStep("s1_confirm_summary"), false);
  assert.equal(isDescriptionTextStep("s1_pdf"), false);
});

test("complete request goes directly to recommendations and PDF prompt", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет, Североморск, робототехника после школы",
  }));

  assert.equal(harness.session.step, "s1_pdf");
  assert.match(harness.messages[0].text, /Подбираю программы/);
  assert.match(harness.messages[1].text, /1\. Робототехника/);
  assert.doesNotMatch(harness.messages[1].text, /Темы:/);
  assert.match(harness.messages[2].text, /PDF-файлом/);
  assert.equal(harness.logs[0].scenario, "description_selection");
  assert.equal(harness.criteriaLogs.length, 1);
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "regexp");
  assert.equal(harness.criteriaLogs[0].criterion_03_age_years, 10);
});

test("missing required data asks one combined clarification", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({ text: "8 лет" }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[0].text, /где искать занятия/);
  assert.match(harness.messages[0].text, /интересы или направление/);
});

test("multiple municipalities ask for one exact place before recommendations", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет, Мурманск и Североморск, робототехника после школы",
  }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[0].text, /несколько населенных пунктов/);
  assert.match(harness.messages[0].text, /Мурманск, Североморск/);
  assert.equal(harness.logs.length, 0);

  await handleDescriptionText(harness.context({
    text: "Мурманск или Кола",
  }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[1].text, /Мурманск, Кола/);
  assert.equal(harness.logs.length, 0);

  await handleDescriptionText(harness.context({
    text: "Североморск",
  }));

  assert.equal(harness.session.step, "s1_pdf");
  assert.match(harness.messages[2].text, /Подбираю программы/);
  assert.equal(harness.logs[0].scenario, "description_selection");
});

test("Murmansk region asks for a concrete municipality", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет, Мурманская область, робототехника после школы",
  }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[0].text, /конкретный населенный пункт Мурманской области/);
  assert.equal(harness.logs.length, 0);
});

test("enriches incomplete request with llm criteria before deciding next step", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет",
    analyzeFreeText: async () => ({
      criteria: {
        criterion_01_municipality: {
          status: "recognized",
          value: ["Мурманск"],
          confidence: 0.91,
        },
        criterion_13_interest_level2_category: {
          status: "recognized",
          values: ["building", "logic"],
          labels: ["конструирование", "логика и программирование"],
          confidence: 0.9,
        },
      },
    }),
  }));

  assert.equal(harness.session.step, "s1_pdf");
  assert.match(harness.messages[0].text, /Подбираю программы/);
  assert.equal(harness.session.descriptionSelection.llm.attempted, true);
  assert.equal(harness.session.descriptionSelection.llm.applied, true);
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "LLM");
  assert.deepEqual(harness.criteriaLogs[0].criterion_01_municipality_value, ["Мурманск"]);
  assert.equal(harness.criteriaLogs[0].criterion_01_municipality_confidence, 0.91);
  assert.equal(harness.criteriaLogs[0].criterion_03_age_confidence, null);
});

test("does not derive fields or logs from old llm slots without criteria", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет",
    analyzeFreeText: async () => ({
      filledSlots: {
        location: "Мурманск",
        interests: ["building", "logic"],
      },
    }),
  }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.equal(harness.session.descriptionSelection.fields.place, "");
  assert.deepEqual(harness.session.descriptionSelection.fields.interests, []);
  assert.equal(harness.session.descriptionSelection.llm.applied, false);
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "LLM");
  assert.equal(harness.criteriaLogs[0].criterion_01_municipality_status, "not_specified");
  assert.deepEqual(harness.criteriaLogs[0].criterion_01_municipality_value, []);
  assert.equal(harness.criteriaLogs[0].criterion_01_municipality_confidence, null);
});

test("llm municipality criteria log multiple place candidates as an array", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет",
    analyzeFreeText: async () => ({
      criteria: {
        criterion_01_municipality: {
          status: "recognized_ambiguous",
          value: ["Мурманск", "Североморск"],
          confidence: 0.74,
        },
        criterion_13_interest_level2_category: {
          status: "recognized",
          values: ["building", "logic"],
          labels: ["конструирование", "логика и программирование"],
          confidence: 0.9,
        },
      },
    }),
  }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[0].text, /Мурманск, Североморск/);
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "LLM");
  assert.equal(harness.criteriaLogs[0].criterion_01_municipality_status, "recognized_ambiguous");
  assert.deepEqual(harness.criteriaLogs[0].criterion_01_municipality_value, ["Мурманск", "Североморск"]);
  assert.equal(harness.criteriaLogs[0].criterion_01_municipality_confidence, 0.74);
});

test("scenario 1 llm-only sends unparsed state to llm", async (t) => {
  const previous = process.env.SCENARIO1_LLM_ONLY;
  process.env.SCENARIO1_LLM_ONLY = "true";
  t.after(() => {
    if (previous === undefined) {
      delete process.env.SCENARIO1_LLM_ONLY;
    } else {
      process.env.SCENARIO1_LLM_ONLY = previous;
    }
  });
  const harness = createHarness({ step: "s1_wait_description" });
  let llmCurrentFields = null;

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет, Североморск, робототехника после школы",
    analyzeFreeText: async (session) => {
      llmCurrentFields = JSON.parse(JSON.stringify(session.current.fields));
      return {
        criteria: {
          criterion_01_municipality: {
            status: "recognized",
            value: ["Мурманск"],
            confidence: 0.95,
          },
          criterion_03_age: {
            status: "recognized",
            age_bucket: "10-12",
            age_years: 10,
            age_text: "10 лет",
            confidence: 0.95,
          },
          criterion_13_interest_level2_category: {
            status: "recognized",
            values: ["building"],
            labels: ["конструирование"],
            confidence: 0.9,
          },
        },
      };
    },
  }));

  assert.equal(llmCurrentFields.age, null);
  assert.equal(llmCurrentFields.place, "");
  assert.deepEqual(llmCurrentFields.interests, []);
  assert.equal(harness.session.descriptionSelection.originalText, "Сыну 10 лет, Североморск, робототехника после школы");
  assert.equal(harness.session.descriptionSelection.fields.place, "Мурманск");
  assert.equal(harness.session.descriptionSelection.fields.age, "10-12");
  assert.equal(harness.session.step, "s1_pdf");
  assert.match(harness.messages[0].text, /Подбираю программы/);
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "LLM");
  assert.deepEqual(harness.criteriaLogs[0].criterion_01_municipality_value, ["Мурманск"]);
  assert.equal(harness.criteriaLogs[0].criterion_03_age_years, 10);
});

test("scenario 1 llm-only reports unavailable llm without regexp fallback", async (t) => {
  const previous = process.env.SCENARIO1_LLM_ONLY;
  process.env.SCENARIO1_LLM_ONLY = "true";
  t.after(() => {
    if (previous === undefined) {
      delete process.env.SCENARIO1_LLM_ONLY;
    } else {
      process.env.SCENARIO1_LLM_ONLY = previous;
    }
  });
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет, Североморск, робототехника после школы",
    analyzeFreeText: async () => null,
  }));

  assert.equal(harness.session.step, "s1_wait_description");
  assert.match(harness.messages[0].text, /AI-анализ текста недоступен/);
  assert.equal(harness.session.descriptionSelection.fields.age, null);
  assert.equal(harness.session.descriptionSelection.fields.place, "");
  assert.equal(harness.logs.length, 0);
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "LLM");
  assert.equal(harness.criteriaLogs[0].criterion_03_age_status, "not_specified");
  assert.equal(harness.criteriaLogs[0].criterion_03_age_confidence, null);
});

test("falls back to clarification when llm enrichment fails", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Сыну 10 лет",
    analyzeFreeText: async () => {
      throw new Error("llm down");
    },
  }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[0].text, /где искать занятия/);
  assert.equal(harness.session.descriptionSelection.llm.error, "llm down");
  assert.equal(harness.criteriaLogs[0].recognitionMethod, "LLM");
  assert.equal(harness.criteriaLogs[0].criterion_03_age_status, "not_specified");
  assert.equal(harness.criteriaLogs[0].criterion_03_age_confidence, null);
});

test("ambiguous request asks for summary confirmation", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({
    text: "Школьник, Мурманск, что-нибудь полезное для развития",
  }));

  assert.equal(harness.session.step, "s1_confirm_summary");
  assert.match(harness.messages[0].text, /Я понял запрос так/);
  assert.equal(harness.messages[0].replyMarkup.inline_keyboard[0][0].callback_data, "s1:confirm");
});

test("stale callback does not run inactive flow", async () => {
  const harness = createHarness({ step: "entry" });

  await handleDescriptionCallback(harness.context({ data: "s1:confirm" }));

  assert.match(harness.messages[0].text, /больше не активен/);
});

test("MAX description flow restart prompts can include visible main menu button", async () => {
  const harness = createHarness({ step: "s1_pdf" });
  const target = { platform: "max", id: 123 };

  await handleDescriptionCallback(harness.context({
    target,
    data: "s1:pdf:no",
    restartKeyboard: () => ({
      inline_keyboard: [[{ text: "Главное меню", callback_data: "menu:start" }]],
    }),
  }));

  assert.match(harness.messages[0].text, /главное меню/);
  assert.equal(harness.messages[0].replyMarkup.inline_keyboard[0][0].callback_data, "menu:start");
});
