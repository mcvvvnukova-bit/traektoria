const test = require("node:test");
const assert = require("node:assert/strict");

const { getRecommendations } = require("../src/recommendations");

const profile = {
  age: "10-12",
  interests: ["building", "logic"],
  avoidances: [],
  adaptation: null,
  goal: "discover",
  location: "Мурманск",
  budget: "",
  schedule: "вечером",
  clarifyGroup: null,
  clarifyFocus: null,
  directionLabel: "Техническая",
};

function createProgram(id) {
  return {
    id,
    name: `Робототехника ${id}`,
    organization_name: "Кванториум",
    age_min: 84,
    age_max: 144,
    keywords: ["робототехника", "программирование"],
    direction: { id: 1, name: "Техническая" },
    address: { name: "Мурманск" },
  };
}

function createDetail() {
  return {
    program: {
      annotation: "Учимся робототехнике и программированию.",
      task: "",
      age_group_min: 84,
      age_group_max: 144,
      directory_program_document_id: 1,
    },
    available_groups: [{
      start_date: "2026-09-01",
      end_date: "2027-05-31",
      period_price: 0,
      free_places_counter: 5,
      periods: [{
        schedule: {
          monday: [{ week_day: "Понедельник", start_time: "18:00" }],
        },
      }],
    }],
    organization: { name: "Кванториум" },
    address: { name: "Мурманск" },
    direction: { name: "Техническая" },
  };
}

function createDetailWithoutSchedule() {
  return {
    ...createDetail(),
    available_groups: [{
      start_date: "2026-09-01",
      end_date: "2027-05-31",
      period_price: 0,
      free_places_counter: 5,
      periods: [],
    }],
  };
}

test("strict recommendations return at most requested limit", async () => {
  const source = {
    name: "fake",
    getMunicipalities: async () => [{ id: 1, name: "Мурманск" }],
    searchPrograms: async () => Array.from({ length: 12 }, (_, index) => createProgram(index + 1)),
    getProgramDetail: async () => createDetail(),
  };

  const result = await getRecommendations(profile, { source, strict: true, limit: 10 });

  assert.equal(result.source, "fake");
  assert.equal(result.items.length, 10);
  assert.equal(result.items[0].schedule, "Пн 18:00");
  assert.equal(result.emptyReason, undefined);
});

test("strict recommendations show booking clarification when schedule is unknown", async () => {
  const source = {
    name: "fake",
    getMunicipalities: async () => [{ id: 1, name: "Мурманск" }],
    searchPrograms: async () => [createProgram(1)],
    getProgramDetail: async () => createDetailWithoutSchedule(),
  };

  const result = await getRecommendations(profile, { source, strict: true, limit: 10 });

  assert.equal(result.items[0].schedule, "Уточните при записи");
});

test("strict recommendations return empty result instead of mock fallback", async () => {
  const source = {
    name: "empty",
    getMunicipalities: async () => [{ id: 1, name: "Мурманск" }],
    searchPrograms: async () => [],
    getProgramDetail: async () => createDetail(),
  };

  const result = await getRecommendations(profile, { source, strict: true, limit: 10 });

  assert.equal(result.source, "empty");
  assert.deepEqual(result.items, []);
  assert.equal(result.emptyReason, "no_candidates");
});

test("non-strict recommendations keep mock fallback on catalog failure", async () => {
  const source = {
    name: "broken",
    getMunicipalities: async () => {
      throw new Error("catalog down");
    },
  };

  const result = await getRecommendations(profile, { source, limit: 3 });

  assert.equal(result.source, "mock");
  assert.ok(result.items.length > 0);
});
