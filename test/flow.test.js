const test = require("node:test");
const assert = require("node:assert/strict");

const { FLOW, SCENARIO_2, SCENARIO_3, SCENARIO_4 } = require("../src/flow");

test("entry text has bold scenario titles in html variant only", () => {
  assert.match(FLOW.entry.text, /Подобрать по описанию/);
  assert.doesNotMatch(FLOW.entry.text, /<b>/);
  assert.match(FLOW.entry.htmlText, /<b>Подобрать по описанию<\/b>/);
  assert.match(FLOW.entry.htmlText, /<b>Подобрать с AI агентом<\/b>/);
  assert.match(FLOW.entry.htmlText, /<b>Составить углубленную траекторию<\/b>/);
  assert.match(FLOW.entry.htmlText, /<b>Траектория новых интересов<\/b>/);
});

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

test("scenario 2 does not ask about child special needs", () => {
  assert.equal(SCENARIO_2.specialNeeds, undefined);
  assert.equal(SCENARIO_2.specialNeedsOther, undefined);
  assert.doesNotMatch(JSON.stringify(SCENARIO_2), /ОВЗ|РАС|СДВГ|зрением|слухом|особенности ребенка/i);
});

test("scenario 2 education form options use PFDO ids", () => {
  assert.deepEqual(SCENARIO_2.format.options, [
    ["Очная", "s2:format:1"],
    ["Очно-заочная", "s2:format:2"],
    ["Заочная", "s2:format:3"],
    ["Любая форма", "s2:format:any"],
  ]);
});

test("scenario 3 has a separate municipality prompt after completed program review", () => {
  assert.match(SCENARIO_3.municipality.text, /В каком населенном пункте/);
  assert.match(SCENARIO_3.municipality.text, /хотите продолжить обучение/);
  assert.equal(
    SCENARIO_3.municipality.customText,
    "Напишите населенный пункт, в котором хотите продолжить обучение",
  );
});

test("scenario 4 has new interests wording while reusing scenario 3 controls", () => {
  assert.match(SCENARIO_4.intro, /новыми темами/);
  assert.match(SCENARIO_4.criteria.text, /новых направлений/);
  assert.match(SCENARIO_4.completedTopics.followupText, /новых направлений/);
  assert.deepEqual(SCENARIO_4.criteria.keyboard, SCENARIO_3.criteria.keyboard);
  assert.deepEqual(SCENARIO_4.pdfDownload.keyboard, SCENARIO_3.pdfDownload.keyboard);
});
