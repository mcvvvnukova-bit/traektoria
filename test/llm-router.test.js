const test = require("node:test");
const assert = require("node:assert/strict");

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("scenario 1 llm-only skips llm-router post heuristics", async (t) => {
  const previousEnabled = process.env.LOCAL_LLM_ENABLED;
  const previousOnly = process.env.SCENARIO1_LLM_ONLY;
  const previousFetch = global.fetch;
  const modulePath = require.resolve("../src/llm-router");

  process.env.LOCAL_LLM_ENABLED = "true";
  process.env.SCENARIO1_LLM_ONLY = "true";
  delete require.cache[modulePath];
  global.fetch = async () => ({
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
  });

  t.after(() => {
    restoreEnv("LOCAL_LLM_ENABLED", previousEnabled);
    restoreEnv("SCENARIO1_LLM_ONLY", previousOnly);
    global.fetch = previousFetch;
    delete require.cache[modulePath];
  });

  const { analyzeFreeText } = require("../src/llm-router");
  const result = await analyzeFreeText(
    { scenario: "description_selection" },
    "Сыну 10 лет, робототехника после школы",
  );

  assert.equal(result.filledSlots.age, null);
  assert.deepEqual(result.filledSlots.interests, []);
  assert.equal(result.filledSlots.schedule, null);
});
