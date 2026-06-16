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
  assert.equal(
    SCENARIO_3.criteria.interestsFallbackText,
    "Не удалось точно определить интересы по пройденным программам.\n\n" +
      "Расскажите, что сейчас интересно ребенку. Можно также добавить удобное расписание, комфортную стоимость занятий или цели обучения.",
  );
});

test("scenario 3 has a separate municipality prompt after completed program review", () => {
  assert.match(SCENARIO_3.municipality.text, /В каком населенном пункте/);
  assert.match(SCENARIO_3.municipality.text, /хотите продолжить обучение/);
  assert.equal(
    SCENARIO_3.municipality.customText,
    "Напишите населенный пункт, в котором хотите продолжить обучение",
  );
});
