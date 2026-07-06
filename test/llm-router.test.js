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
  const previousFetch = global.fetch;
  const modulePath = require.resolve("../src/llm-router");

  process.env.LOCAL_LLM_ENABLED = "true";
  process.env.SCENARIO1_LLM_ONLY = "true";
  delete require.cache[modulePath];
  global.fetch = fetchMock;

  t.after(() => {
    restoreEnv("LOCAL_LLM_ENABLED", previousEnabled);
    restoreEnv("SCENARIO1_LLM_ONLY", previousOnly);
    global.fetch = previousFetch;
    delete require.cache[modulePath];
  });

  return require("../src/llm-router");
}

test("scenario 1 llm-only skips llm-router post heuristics", async (t) => {
  const { analyzeFreeText } = setupEnabledLlm(t, async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
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
          }),
        },
      }],
    }),
  }));

  const result = await analyzeFreeText(
    { scenario: "description_selection" },
    "Сыну 10 лет, робототехника после школы",
  );

  assert.equal(result.filledSlots.age, null);
  assert.deepEqual(result.filledSlots.interests, []);
  assert.equal(result.filledSlots.schedule, null);
});

test("scenario 1 prompt explains Murmansk region location extraction", async (t) => {
  let requestBody = null;
  const { analyzeFreeText } = setupEnabledLlm(t, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
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
            }),
          },
        }],
      }),
    };
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
});
