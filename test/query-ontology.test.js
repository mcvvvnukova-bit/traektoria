const test = require("node:test");
const assert = require("node:assert/strict");

const { analyzeQueryInterests } = require("../src/query-ontology");

test("extracts basketball as a specific sport interest", () => {
  const result = analyzeQueryInterests("занятия по баскетболу в Оленегорске");

  assert.deepEqual(result.broadInterests, ["sports"]);
  assert.ok(result.specificInterestTerms.includes("баскетбол"));
  assert.ok(result.specificInterestTerms.includes("баскет"));
  assert.deepEqual(result.specificInterestLabels, ["баскетбол"]);
  assert.equal(result.direction, "sport");
});

test("keeps negated activities out of positive specific terms", () => {
  const result = analyzeQueryInterests("подберите спорт, но не футбол");

  assert.deepEqual(result.specificInterestTerms, []);
  assert.ok(result.excludedSpecificInterestTerms.includes("футбол"));
});

test("keeps an unknown explicit activity as a raw specific term", () => {
  const result = analyzeQueryInterests("ищем флорбол для школьника");

  assert.deepEqual(result.broadInterests, []);
  assert.deepEqual(result.specificInterestTerms, ["флорбол"]);
  assert.deepEqual(result.specificInterestLabels, ["флорбол"]);
});
