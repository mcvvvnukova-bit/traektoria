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

test("strict recommendations prioritize exact basketball buckets before other sports", async () => {
  const basketballProfile = {
    ...profile,
    age: "13+",
    ageYears: 13,
    interests: ["sports"],
    location: "Оленегорск",
    schedule: "",
    direction: "sport",
    directionLabel: "Физкультурно-спортивная",
    specificInterestTerms: ["баскетбол", "баскет"],
    specificInterestLabels: ["баскетбол"],
  };
  const programs = [
    sportProgram(1, "Футбол", 7, 18, ["футбол"]),
    sportProgram(2, "Баскетбол с местами", 13, 15, ["баскетбол"]),
    sportProgram(3, "Баскетбол без мест", 13, 15, ["баскетбол"]),
    sportProgram(4, "Баскетбол 15+", 15, 18, ["баскетбол"], { enrollment: 3 }),
  ];
  const scoringData = new Map([
    [1, sportScoringData(programs[0], "Игра в футбол", [openGroup(6)])],
    [2, sportScoringData(programs[1], "Игра в баскетбол", [openGroup(4)])],
    [3, sportScoringData(programs[2], "Игра в баскетбол", [openGroup(0)])],
    [4, sportScoringData(programs[3], "", [])],
  ]);
  const source = {
    name: "fake",
    getMunicipalities: async () => [{ id: 1, name: "Оленегорск" }],
    searchPrograms: async () => programs,
    getProgramScoringData: async () => scoringData,
    getProgramDetail: async (id) => scoringData.get(Number(id)).detail,
  };

  const result = await getRecommendations(basketballProfile, { source, strict: true, limit: 4 });

  assert.deepEqual(result.items.map((item) => item.id), ["2", "3", "4", "1"]);
  assert.deepEqual(result.items.map((item) => item.specificInterestBucket), [10, 20, 30, 40]);
  assert.equal(result.items[2].ageEligible, false);
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

function sportProgram(id, name, ageMinYears, ageMaxYears, keywords, overrides = {}) {
  return {
    id,
    name,
    municipalityId: 1,
    organizationId: 1,
    organization_name: "Спортивная школа",
    age_min: ageMinYears * 12,
    age_max: ageMaxYears * 12,
    enrollment: 1,
    keywords,
    direction: { id: 4, name: "Физкультурно-спортивная" },
    address: { name: "Оленегорск" },
    ...overrides,
  };
}

function sportScoringData(program, topicName, groups) {
  return {
    detail: {
      program: {
        annotation: `${program.name}.`,
        task: "",
        age_group_min: program.age_min,
        age_group_max: program.age_max,
        directory_program_document_id: Number(program.id),
      },
      available_groups: groups,
      organization: { name: "Спортивная школа" },
      address: { name: "Оленегорск" },
      direction: { name: "Физкультурно-спортивная" },
    },
    modules: [],
    groups,
    topics: topicName ? [{ name: topicName, key: topicName.toLowerCase() }] : [],
    topicsKnown: true,
  };
}

function openGroup(freePlaces) {
  return {
    period_price: 0,
    free_places_counter: freePlaces,
    periods: [{
      schedule: {
        monday: [{ week_day: "Понедельник", start_time: "18:00" }],
      },
    }],
  };
}
