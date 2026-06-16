const test = require("node:test");
const assert = require("node:assert/strict");

const { SCENARIO_3 } = require("../src/flow");

test("scenario 3 full topics follow-up reuses criteria continuation buttons", () => {
  assert.match(SCENARIO_3.completedTopics.followupText, /Продолжим подбор/);
  assert.deepEqual(
    SCENARIO_3.criteria.keyboard.inline_keyboard.map((row) => row[0].callback_data),
    ["s3:criteria:edit", "s3:criteria:skip"],
  );
});

test("scenario 3 asks for child interests when completed topics are not meaningful", () => {
  assert.match(SCENARIO_3.criteria.interestsFallbackText, /что интересно ребенку/);
  assert.match(SCENARIO_3.criteria.interestsFallbackText, /углубленное продолжение/);
});
