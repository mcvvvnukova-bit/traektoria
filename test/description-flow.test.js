const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startDescriptionFlow,
  handleDescriptionText,
  handleDescriptionCallback,
} = require("../src/description-flow");
const { createDescriptionSelectionState } = require("../src/description-selection");

function createHarness(session = {}) {
  const messages = [];
  const documents = [];
  const logs = [];
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
});

test("missing required data asks one combined clarification", async () => {
  const harness = createHarness({ step: "s1_wait_description" });

  await handleDescriptionText(harness.context({ text: "8 лет" }));

  assert.equal(harness.session.step, "s1_wait_required_clarification");
  assert.match(harness.messages[0].text, /где искать занятия/);
  assert.match(harness.messages[0].text, /интересы или направление/);
});

test("enriches incomplete request with llm slots before deciding next step", async () => {
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

  assert.equal(harness.session.step, "s1_pdf");
  assert.match(harness.messages[0].text, /Подбираю программы/);
  assert.equal(harness.session.descriptionSelection.llm.attempted, true);
  assert.equal(harness.session.descriptionSelection.llm.applied, true);
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
