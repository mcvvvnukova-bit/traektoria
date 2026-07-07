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
    filled_slots: {
      age: null,
      experience: null,
      interests: [],
      avoidances: [],
      adaptation: null,
      goal: null,
      location: null,
      budget: null,
      schedule: null,
      clarifyGroup: null,
      clarifyFocus: null,
    },
    criterion_confidences: {
      criterion_03_age: 0.83,
      criterion_01_municipality_confidence: 0.94,
    },
    criteria: {
      criterion_01_municipality: {
        status: "recognized",
        value: "Мурманск",
        confidence: 0.94,
      },
    },
  }));

  const result = await analyzeFreeText(
    { scenario: "description_selection" },
    "Сыну 10 лет, робототехника после школы",
  );

  assert.equal(result.filledSlots.age, null);
  assert.deepEqual(result.filledSlots.interests, []);
  assert.equal(result.filledSlots.schedule, null);
  assert.deepEqual(result.criterionConfidences, {
    criterion_01_municipality: 0.94,
    criterion_03_age: 0.83,
  });
  assert.deepEqual(result.criteria, {
    criterion_01_municipality: {
      status: "recognized",
      value: "Мурманск",
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
      filled_slots: {
        age: null,
        experience: null,
        interests: [],
        avoidances: [],
        adaptation: null,
        goal: null,
        location: "Оленегорск",
        budget: null,
        schedule: null,
        clarifyGroup: null,
        clarifyFocus: null,
      },
    });
  });

  await analyzeFreeText(
    { scenario: "description_selection", mode: "clarification", current: {} },
    "Оленегорск",
  );

  const systemPrompt = requestBody.messages[0].content;
  assert.match(systemPrompt, /населенным пунктом Мурманской области/);
  assert.match(systemPrompt, /Оленегорск/);
  assert.match(systemPrompt, /Мурманск/);
  assert.match(systemPrompt, /новое сообщение состоит только из населенного пункта/);
  assert.match(systemPrompt, /центр города/);
  assert.match(systemPrompt, /criterion_confidences/);
  assert.match(systemPrompt, /criteria: объект с найденными критериями С1/);
  assert.match(systemPrompt, /criterion_01_municipality/);
  assert.match(systemPrompt, /criterion_03_age/);
});

test("scenario 1 prompt and parser keep exact specific interests", async (t) => {
  let requestBody = null;
  const { analyzeFreeText } = setupEnabledLlm(t, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return llmResponse({
      scenario: "ready_to_recommend",
      message_for_user: "",
      filled_slots: {
        age: "13 лет",
        experience: null,
        interests: ["sports"],
        specificInterests: ["баскетбол"],
        avoidances: [],
        adaptation: null,
        goal: null,
        location: "Оленегорск",
        budget: null,
        schedule: null,
        clarifyGroup: null,
        clarifyFocus: null,
      },
    });
  });

  const result = await analyzeFreeText(
    { scenario: "description_selection", mode: "description", current: {} },
    "мальчик 13 лет хочет играть в баскетбол в оленегорске",
  );

  const systemPrompt = requestBody.messages[0].content;
  assert.match(systemPrompt, /specificInterests/);
  assert.match(systemPrompt, /баскетбол.*sports/s);
  assert.match(systemPrompt, /ageYears/);
  assert.match(systemPrompt, /13 лет.*13\+/s);
  assert.match(systemPrompt, /9 лет.*7-9/s);
  assert.equal(result.filledSlots.age, "13+");
  assert.equal(result.filledSlots.ageYears, 13);
  assert.equal(result.filledSlots.ageText, "13 лет");
  assert.deepEqual(result.filledSlots.interests, ["sports"]);
  assert.deepEqual(result.filledSlots.specificInterests, ["баскетбол"]);
});
