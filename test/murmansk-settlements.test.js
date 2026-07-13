const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MURMANSK_SETTLEMENTS,
  MURMANSK_SETTLEMENT_PROMPT_LIST,
  findMurmanskSettlements,
  normalizeSettlementLocation,
} = require("../src/murmansk-settlements");

test("contains the full Rosstat settlement list for Murmansk region", () => {
  assert.equal(MURMANSK_SETTLEMENTS.length, 135);
  assert.match(MURMANSK_SETTLEMENT_PROMPT_LIST, /г Мурманск/);
  assert.match(MURMANSK_SETTLEMENT_PROMPT_LIST, /с Варзуга/);
  assert.match(MURMANSK_SETTLEMENT_PROMPT_LIST, /ж\/д ст Нял/);
  assert.match(MURMANSK_SETTLEMENT_PROMPT_LIST, /нп Путевая Усадьба 9 км железной дороги Луостари-Никель/);
});

test("finds full-list settlements in common user forms", () => {
  assert.deepEqual(findMurmanskSettlements("ищем рисование в Варзуге"), ["Варзуга"]);
  assert.deepEqual(findMurmanskSettlements("подойдут занятия в ж/д ст Нял"), ["Нял"]);
  assert.deepEqual(findMurmanskSettlements("Мурманская область"), []);
});

test("normalizes typed official settlement names to bare names", () => {
  assert.equal(normalizeSettlementLocation("с Варзуга"), "Варзуга");
  assert.equal(normalizeSettlementLocation("ж/д ст Нял"), "Нял");
  assert.equal(normalizeSettlementLocation("Мурманск и Североморск"), "");
});
