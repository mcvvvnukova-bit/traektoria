const test = require("node:test");
const assert = require("node:assert/strict");

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function setupEnabledLlm(t, fetchMock) {
  const previousEnabled = process.env.LOCAL_LLM_ENABLED;
  const previousOnly = process.env.SCENARIO1_LLM_ONLY;
  const previousLlmEnabled = process.env.LLM_ENABLED;
  const previousProvider = process.env.LLM_PROVIDER;
  const previousFetch = global.fetch;
  const routerPath = require.resolve("../src/llm-router");
  const clientPath = require.resolve("../src/llm-client");

  process.env.LOCAL_LLM_ENABLED = "true";
  process.env.SCENARIO1_LLM_ONLY = "true";
  delete process.env.LLM_ENABLED;
  process.env.LLM_PROVIDER = "local";
  delete require.cache[routerPath];
  delete require.cache[clientPath];
  global.fetch = fetchMock;

  t.after(() => {
    restoreEnv("LOCAL_LLM_ENABLED", previousEnabled);
    restoreEnv("SCENARIO1_LLM_ONLY", previousOnly);
    restoreEnv("LLM_ENABLED", previousLlmEnabled);
    restoreEnv("LLM_PROVIDER", previousProvider);
    global.fetch = previousFetch;
    delete require.cache[routerPath];
    delete require.cache[clientPath];
  });

  return require("../src/llm-router");
}

function llmResponse(content) {
  return {
    ok: true,
    text: async () => JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify(content),
        },
      }],
    }),
  };
}

test("scenario 1 llm-only skips llm-router post heuristics", async (t) => {
  const { analyzeFreeText } = setupEnabledLlm(t, async () => llmResponse({
    scenario: "fallback",
    message_for_user: "",
    criteria: {
      criterion_01_municipality: {
        status: "recognized",
        value: ["Мурманск"],
        confidence: 0.94,
      },
    },
  }));

  const result = await analyzeFreeText(
    { scenario: "description_selection" },
    "Сыну 10 лет, робототехника после школы",
  );

  assert.equal(result.filledSlots, undefined);
  assert.equal(result.criterionConfidences, undefined);
  assert.deepEqual(result.criteria, {
    criterion_01_municipality: {
      status: "recognized",
      value: ["Мурманск"],
      confidence: 0.94,
    },
  });
});

test("scenario 1 prompt explains Murmansk region location extraction", async (t) => {
  let requestBody = null;
  const { analyzeFreeText } = setupEnabledLlm(t, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return llmResponse({
      scenario: "fallback",
      message_for_user: "",
      criteria: {
        criterion_01_municipality: {
          status: "recognized",
          value: ["Оленегорск"],
          confidence: 0.95,
        },
      },
    });
  });

  await analyzeFreeText(
    { scenario: "description_selection", mode: "clarification", current: {} },
    "Оленегорск",
  );

  const systemPrompt = requestBody.messages[0].content;
  assert.match(systemPrompt, /населенным пунктом Мурманской области/);
  assert.match(systemPrompt, /полного списка Росстата/);
  assert.match(systemPrompt, /Оленегорск/);
  assert.match(systemPrompt, /Мурманск/);
  assert.match(systemPrompt, /с Варзуга/);
  assert.match(systemPrompt, /ж\/д ст Нял/);
  assert.match(systemPrompt, /нп Путевая Усадьба 9 км железной дороги Луостари-Никель/);
  assert.match(systemPrompt, /ж\/д ст Нял' -> 'Нял'/);
  assert.match(systemPrompt, /Допускай опечатки/);
  assert.match(systemPrompt, /до 3 односимвольных ошибок/);
  assert.match(systemPrompt, /до 4 букв не исправляй по догадке/);
  assert.match(systemPrompt, /recognized_ambiguous/);
  assert.match(systemPrompt, /прилагательное от населенного пункта/);
  assert.match(systemPrompt, /мурманские кружки/);
  assert.match(systemPrompt, /североморские секции/);
  assert.match(systemPrompt, /новое сообщение состоит только из населенного пункта/);
  assert.match(systemPrompt, /центр города/);
  assert.doesNotMatch(systemPrompt, /criterion_confidences/);
  assert.doesNotMatch(systemPrompt, /filled_slots/);
  assert.match(systemPrompt, /Всегда возвращай только scenario, message_for_user и criteria/);
  assert.match(systemPrompt, /criterion_01_municipality/);
  assert.match(systemPrompt, /criterion_03_age/);
});

test("scenario 1 normalizes official typed settlement values from llm", async (t) => {
  const { analyzeFreeText } = setupEnabledLlm(t, async () => llmResponse({
    scenario: "ready_to_recommend",
    message_for_user: "",
    criteria: {
      criterion_01_municipality: {
        status: "recognized",
        value: ["с Варзуга"],
        confidence: 0.95,
      },
    },
  }));

  const result = await analyzeFreeText(
    { scenario: "description_selection", mode: "description", current: {} },
    "рисование в Варзуге для девочки 9 лет",
  );

  assert.deepEqual(result.criteria.criterion_01_municipality.value, ["Варзуга"]);
});

test("scenario 1 prompt and parser keep exact specific interests", async (t) => {
  let requestBody = null;
  const { analyzeFreeText } = setupEnabledLlm(t, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return llmResponse({
      scenario: "ready_to_recommend",
      message_for_user: "",
      criteria: {
        criterion_01_municipality: {
          status: "recognized",
          value: ["Оленегорск"],
          confidence: 0.95,
        },
        criterion_03_age: {
          status: "recognized",
          age_bucket: "13+",
          age_years: 13,
          age_text: "13 лет",
          confidence: 1,
        },
        criterion_12_exact_interest_topic: {
          status: "recognized",
          terms: ["баскетбол"],
          labels: ["баскетбол"],
          confidence: 0.95,
        },
        criterion_13_interest_level2_category: {
          status: "recognized",
          values: ["sports"],
          labels: ["спорт"],
          confidence: 0.9,
        },
      },
    });
  });

  const result = await analyzeFreeText(
    { scenario: "description_selection", mode: "description", current: {} },
    "мальчик 13 лет хочет играть в баскетбол в оленегорске",
  );

  const systemPrompt = requestBody.messages[0].content;
  assert.doesNotMatch(systemPrompt, /specificInterests/);
  assert.match(systemPrompt, /criterion_12_exact_interest_topic/);
  assert.match(systemPrompt, /баскетбол.*sports/s);
  assert.match(systemPrompt, /age_years/);
  assert.match(systemPrompt, /13 лет.*13\+/s);
  assert.match(systemPrompt, /9 лет.*7-9/s);
  assert.equal(result.criteria.criterion_03_age.age_bucket, "13+");
  assert.equal(result.criteria.criterion_03_age.age_years, 13);
  assert.equal(result.criteria.criterion_03_age.age_text, "13 лет");
  assert.deepEqual(result.criteria.criterion_13_interest_level2_category.values, ["sports"]);
  assert.deepEqual(result.criteria.criterion_12_exact_interest_topic.terms, ["баскетбол"]);
});
