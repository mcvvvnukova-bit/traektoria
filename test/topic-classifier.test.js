const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeAndClassifyTopic,
} = require("../services/program-topic-extractor/src/classification/technical-topic-classifier");

function classify(topicName, {
  directionName = "Туристско-краеведческая",
  programName = "Юный турист-краевед",
  sectionTitle = "Учебно-тематический план",
} = {}) {
  return normalizeAndClassifyTopic({
    topicName,
    directionName,
    programName,
    sectionTitle,
    activityType: "",
    controlForm: "",
  }).classification;
}

test("classifies tourism and local-history topics by direction-specific taxonomy", () => {
  const cases = [
    ["Введение в краеведение (лекция, викторина, инструктаж)", "content", "local_history", "regional_studies"],
    ["Основы музейных знаний", "content", "museum_excursion", "museum_studies"],
    ["Методика проведения экскурсии", "content", "museum_excursion", "excursion_guiding"],
    ["Ориентирование и топография Рисование плана учебного кабинета с оборудованием", "content", "orientation", "orientation_topography"],
    ["Знакомство с туризмом.", "content", "tourism_skills", "tourism_basics"],
    ["Соревнования по технике пешеходного туризма (ТПТ)", "content", "sport_training", "tourism_competitions"],
    ["Личное и общественное туристское снаряжение", "content", "tourism_skills", "tourism_equipment_knots"],
    ["Выживание в природной среде", "content", "tourism_skills", "safety_survival"],
    ["Оказание первой помощи при условно заданной травме. Бинтование.", "content", "tourism_skills", "first_aid"],
    ["Основы строевой подготовки", "content", "civic_patriotic", "drill_civil_defense"],
    ["Общая физическая подготовка", "content", "sport_training", "physical_training"],
  ];

  for (const [topicName, recordType, parentCode, categoryCode] of cases) {
    const result = classify(topicName);
    assert.equal(result.recordType, recordType, topicName);
    assert.equal(result.parentCode, parentCode, topicName);
    assert.equal(result.categoryCode, categoryCode, topicName);
  }
});

test("keeps generic final and intro rows as service topics", () => {
  const result = classify("Итоговое занятие");

  assert.equal(result.recordType, "service");
  assert.equal(result.parentCode, "service");
  assert.equal(result.categoryCode, "intro_final");
});

test("uses tourism taxonomy only for tourism-local-history direction", () => {
  const tourism = classify("Компас и карта", {
    directionName: "Туристско-краеведческая",
    programName: "Спортивное ориентирование",
  });
  const technical = classify("Компас 3D", {
    directionName: "Техническая",
    programName: "3D-моделирование",
  });

  assert.equal(tourism.categoryCode, "orientation_topography");
  assert.notEqual(technical.categoryCode, "orientation_topography");
});
