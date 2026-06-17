const AGE_LABELS = {
  "3-4": "3-4 года",
  "5-6": "5-6 лет",
  "7-9": "7-9 лет",
  "10-12": "10-12 лет",
  "13+": "13 лет и старше",
};

const DIRECTION_RULES = [
  {
    value: "technical",
    label: "Техническая",
    interests: ["building", "logic"],
    pattern: /техническ|робот|программ|инженер|констру|3d|модел|информат|технолог/i,
  },
  {
    value: "art",
    label: "Художественная",
    interests: ["creative"],
    pattern: /художеств|рисован|рисовать|лепк|дизайн|музык|вокал|танц|театр|творческ/i,
  },
  {
    value: "sport",
    label: "Физкультурно-спортивная",
    interests: ["sports"],
    pattern: /спорт|плаван|футбол|хокке|гимнаст|самбо|дзюдо|борьб|баскет|волей/i,
  },
  {
    value: "social",
    label: "Социально-гуманитарная",
    interests: ["social"],
    pattern: /социальн|гуманитар|общени|лидер|журналист|волонтер|английск|язык/i,
  },
  {
    value: "science",
    label: "Естественно-научная",
    interests: ["logic"],
    pattern: /естественно|научн|биолог|хими|физик|математ|исследован|эколог/i,
  },
  {
    value: "tourism",
    label: "Туристско-краеведческая",
    interests: ["sports", "social"],
    pattern: /туризм|турист|краевед|поход|экскурс|ориентирован/i,
  },
];

const INTEREST_RULES = [
  ["creative", "творчество", /рис|леп|твор|дизайн|мастер|худож|придум|музык|танц|поделк|вокал/i],
  ["building", "конструирование", /робот|констру|собират|инженер|3d|модел|техн/i],
  ["sports", "спорт", /спорт|плав|футбол|хокке|гимнаст|самбо|дзюдо|борьб|бег|волейбол|баскетбол/i],
  ["social", "общение", /обща|друз|команд|театр|сцен|выступ|лидер|журналист/i],
  ["logic", "логика и программирование", /логик|математ|программ|шахмат|как все устроено|информат|физик/i],
  ["calm", "спокойные занятия", /спокой|усидчив|в своем темпе|не спеша/i],
];

const MUNICIPALITY_RULES = [
  ["Мурманск", /мурманск|мурманске/i],
  ["Североморск", /североморск|североморске/i],
  ["Апатиты", /апатит/i],
  ["Кировск", /кировск|кировске/i],
  ["Мончегорск", /мончегорск|мончегорске/i],
  ["Кандалакша", /кандалакш/i],
  ["Кола", /\bкол[аеу]\b/i],
  ["Оленегорск", /оленегорск|оленегорске/i],
  ["Полярный", /полярн(ый|ом)/i],
  ["Полярные Зори", /полярн(ые|ых)\s+зор/i],
  ["Снежногорск", /снежногорск|снежногорске/i],
  ["Заозерск", /заозерск|заозерске/i],
  ["Гаджиево", /гаджиев/i],
  ["Видяево", /видяев/i],
  ["Заполярный", /заполярн(ый|ом)/i],
  ["Никель", /никел/i],
  ["Ковдор", /ковдор/i],
  ["Умба", /умб[аеу]/i],
  ["Ловозеро", /ловозер/i],
  ["Ревда", /ревд[аеу]/i],
];

function createDescriptionSelectionState() {
  return {
    originalText: "",
    clarifications: [],
    edits: [],
    fields: {
      age: null,
      ageYears: null,
      ageText: "",
      place: "",
      placeKnown: false,
      interestsText: "",
      interests: [],
      interestLabels: [],
      broadInterest: false,
      direction: null,
      directionLabel: "",
      goal: null,
      goalLabel: "",
      budget: "",
      schedule: [],
      scheduleText: "",
      format: null,
      formatLabel: "",
      avoidances: [],
      avoidanceLabels: [],
      adaptation: null,
      clarifyGroup: null,
      clarifyFocus: null,
    },
    ambiguities: [],
    llm: {
      attempted: false,
      applied: false,
      error: "",
    },
    lastResult: null,
    pdfPath: "",
  };
}

function ensureDescriptionSelectionState(session) {
  if (!session.descriptionSelection) {
    session.descriptionSelection = createDescriptionSelectionState();
  }
  if (!session.descriptionSelection.fields) {
    session.descriptionSelection.fields = createDescriptionSelectionState().fields;
  }
  if (!Array.isArray(session.descriptionSelection.clarifications)) {
    session.descriptionSelection.clarifications = [];
  }
  if (!Array.isArray(session.descriptionSelection.edits)) {
    session.descriptionSelection.edits = [];
  }
  return session.descriptionSelection;
}

function applyDescriptionText(state, text, options = {}) {
  const mode = options.mode || "description";
  const value = String(text || "").trim();
  if (!value) {
    state.ambiguities = buildAmbiguities(state);
    return state;
  }

  if (mode === "description" && !state.originalText) {
    state.originalText = value;
  } else if (mode === "edit") {
    state.edits.push(value);
  } else {
    state.clarifications.push(value);
  }

  const parseText = mode === "edit" ? extractPositiveCorrectionText(value) : value;
  const patch = parseDescriptionText(parseText);
  mergeFields(state.fields, patch.fields, { mode, rawText: value });
  state.ambiguities = buildAmbiguities(state, patch.ambiguities);
  state.lastResult = null;
  return state;
}

function shouldUseLlmForDescription(state, text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return getMissingRequiredFields(state).length > 0 ||
    buildAmbiguities(state).length > 0 ||
    value.length > 160;
}

function applyLlmAnalysis(state, analysis, options = {}) {
  state.llm = {
    ...(state.llm || {}),
    attempted: true,
    applied: false,
    error: "",
  };

  const slots = analysis?.filledSlots || analysis?.filled_slots || {};
  const patch = {};

  if (slots.age && (!state.fields.age || isApproximateAgeText(state.fields.ageText))) {
    patch.age = slots.age;
    patch.ageText = AGE_LABELS[slots.age] || slots.age;
  }

  if (slots.location && !state.fields.place) {
    const place = detectPlace(slots.location);
    patch.place = place.place || cleanupPlace(slots.location);
    patch.placeKnown = Boolean(place.known);
  }

  if (Array.isArray(slots.interests) && slots.interests.length) {
    patch.interests = slots.interests;
    patch.interestLabels = labelsForInterests(slots.interests);
    patch.interestsText = patch.interestLabels.join(", ");
    patch.broadInterest = false;
  }

  if (Array.isArray(slots.avoidances) && slots.avoidances.length) {
    patch.avoidances = slots.avoidances.filter((item) => item !== "unknown");
    patch.avoidanceLabels = labelsForAvoidances(patch.avoidances);
  }

  if (slots.goal && !state.fields.goal) {
    patch.goal = normalizeGoalValue(slots.goal);
    patch.goalLabel = goalLabel(patch.goal);
  }

  if (slots.budget && !state.fields.budget) {
    patch.budget = slots.budget;
  }

  if (slots.schedule && !state.fields.scheduleText) {
    patch.scheduleText = slots.schedule;
    patch.schedule = detectSchedule(slots.schedule).values;
  }

  if (slots.adaptation && !state.fields.adaptation) {
    patch.adaptation = slots.adaptation;
  }

  if (slots.clarifyGroup && !state.fields.clarifyGroup) {
    patch.clarifyGroup = slots.clarifyGroup;
  }

  if (slots.clarifyFocus && !state.fields.clarifyFocus) {
    patch.clarifyFocus = slots.clarifyFocus;
  }

  mergeFields(state.fields, patch, { mode: options.mode || "llm" });
  state.ambiguities = buildAmbiguities(state);
  state.llm.applied = Object.keys(patch).length > 0;
  return state.llm.applied;
}

function recordLlmError(state, error) {
  state.llm = {
    ...(state.llm || {}),
    attempted: true,
    applied: false,
    error: error?.message || String(error || "unknown_error"),
  };
}

function parseDescriptionText(text) {
  const normalized = normalizeText(text);
  const fields = {};
  const ambiguities = [];

  const age = detectAge(text);
  if (age) {
    fields.age = age.age;
    fields.ageYears = age.ageYears;
    fields.ageText = age.ageText;
    if (age.ambiguous) ambiguities.push(age.ambiguity);
  }

  const place = detectPlace(text);
  if (place.place) {
    fields.place = place.place;
    fields.placeKnown = place.known;
    if (place.ambiguous) ambiguities.push("place_unknown");
  }

  const interests = detectInterests(text);
  if (interests.values.length || interests.broad) {
    fields.interests = interests.values;
    fields.interestLabels = interests.labels;
    fields.interestsText = interests.text;
    fields.broadInterest = interests.broad;
    if (interests.broad) ambiguities.push("interest_broad");
  }

  const direction = detectDirection(text);
  if (direction) {
    fields.direction = direction.value;
    fields.directionLabel = direction.label;
    fields.interests = [...new Set([...(fields.interests || []), ...direction.interests])];
    fields.interestLabels = labelsForInterests(fields.interests);
    if (!fields.interestsText) fields.interestsText = direction.label;
  }

  const budget = detectBudget(text);
  if (budget) fields.budget = budget;

  const schedule = detectSchedule(text);
  if (schedule.values.length) {
    fields.schedule = schedule.values;
    fields.scheduleText = schedule.text;
  }

  const format = detectFormat(normalized);
  if (format) {
    fields.format = format.value;
    fields.formatLabel = format.label;
  }

  const goal = detectGoal(normalized);
  if (goal) {
    fields.goal = goal.value;
    fields.goalLabel = goal.label;
  }

  const avoidances = detectAvoidances(normalized);
  if (avoidances.values.length) {
    fields.avoidances = avoidances.values;
    fields.avoidanceLabels = avoidances.labels;
  }

  if (hasMultipleDirections(text)) ambiguities.push("multiple_directions");
  if (hasInterestConflict(fields, normalized)) ambiguities.push("interest_conflict");

  return {
    fields,
    ambiguities,
  };
}

function extractPositiveCorrectionText(text) {
  const match = String(text || "").match(/(?:^|\s)не\s+.+?\s+а\s+(.+)$/i);
  return match ? match[1].trim() : text;
}

function mergeFields(target, patch, options = {}) {
  const mode = options.mode || "description";
  const isCorrection = mode === "edit" && /(^|\s)не\s+.+\s+а\s+/i.test(options.rawText || "");
  const replaceArrays = mode === "edit" || isCorrection;

  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (replaceArrays || !Array.isArray(target[key])) {
        target[key] = [...value];
      } else {
        target[key] = [...new Set([...(target[key] || []), ...value])];
      }
      continue;
    }
    target[key] = value;
  }
}

function getMissingRequiredFields(state) {
  const fields = state.fields || {};
  const missing = [];
  if (!fields.age) missing.push("age");
  if (!fields.place) missing.push("place");
  if (!hasInterestOrDirection(fields)) missing.push("interest");
  return missing;
}

function hasInterestOrDirection(fields) {
  return Boolean(
    fields.direction ||
      (Array.isArray(fields.interests) && fields.interests.length) ||
      fields.broadInterest ||
      fields.interestsText,
  );
}

function shouldConfirmSummary(state) {
  return getMissingRequiredFields(state).length === 0 && buildAmbiguities(state).length > 0;
}

function buildRequiredClarificationPrompt(missing) {
  const labels = missing.map((field) => {
    if (field === "age") return "сколько лет ребенку";
    if (field === "place") return "где искать занятия";
    return "какие интересы или направление важны";
  });
  if (labels.length === 1) {
    return buildSingleFieldPrompt(missing[0]);
  }
  return `Чтобы подобрать программы, уточните, пожалуйста: ${joinRussianList(labels)}.`;
}

function buildSingleFieldPrompt(field) {
  if (field === "age") return "Уточните, пожалуйста, сколько лет ребенку.";
  if (field === "place") return "Уточните, пожалуйста, где искать занятия: населенный пункт, район или организация.";
  return "Уточните, пожалуйста, какие интересы ребенка или направленность программы важны.";
}

function buildSummaryText(state) {
  const fields = state.fields || {};
  const parts = [];
  if (fields.ageText) parts.push(`возраст: ${fields.ageText}`);
  if (fields.place) parts.push(`место: ${fields.place}`);
  const interestLabel = fields.interestsText || fields.directionLabel || labelsForInterests(fields.interests).join(", ");
  if (interestLabel) parts.push(`интересы/направление: ${interestLabel}`);
  if (fields.scheduleText) parts.push(`время: ${fields.scheduleText}`);
  if (fields.budget) parts.push(`бюджет: ${fields.budget}`);
  if (fields.avoidanceLabels?.length) parts.push(`ограничения: ${fields.avoidanceLabels.join(", ")}`);
  return `Я понял запрос так: ${parts.join("; ")}. Все верно?`;
}

function buildRecommendationProfile(state) {
  const fields = state.fields || {};
  const interests = new Set(fields.interests || []);
  const direction = DIRECTION_RULES.find((item) => item.value === fields.direction);
  for (const interest of direction?.interests || []) interests.add(interest);

  return {
    age: fields.age || "7-9",
    experience: "new",
    interests: [...interests],
    avoidances: (fields.avoidances || []).filter((item) => item !== "unknown"),
    adaptation: fields.adaptation || null,
    goal: fields.goal || "discover",
    location: fields.place,
    budget: fields.budget,
    schedule: fields.scheduleText,
    clarifyGroup: fields.clarifyGroup || null,
    clarifyFocus: fields.clarifyFocus || null,
    directionLabel: fields.directionLabel,
  };
}

function buildPdfAnswers(state) {
  const fields = state.fields || {};
  return {
    ageText: fields.ageText || AGE_LABELS[fields.age] || "",
    age: fields.age || "",
    interestsText: fields.interestsText || fields.directionLabel || labelsForInterests(fields.interests).join(", "),
    interests: fields.interests || [],
    goal: fields.goal || "discover",
    goalLabel: fields.goalLabel || "Подобрать подходящие занятия",
    schedule: fields.schedule || [],
    format: fields.format || null,
    formatLabel: fields.formatLabel || "Любой формат",
    place: fields.place || "",
    cost: fields.budget || "",
    wantsRefinement: false,
    groupSizeLabel: "",
    avoidanceLabels: fields.avoidanceLabels || [],
    avoidanceCustom: "",
    direction: fields.direction || null,
    directionLabel: fields.directionLabel || "",
  };
}

function buildHistoryPayload(state) {
  return {
    originalText: state.originalText,
    clarifications: state.clarifications || [],
    edits: state.edits || [],
    fields: state.fields || {},
    ambiguities: buildAmbiguities(state),
    llm: state.llm || {},
  };
}

function buildDescriptionResultMessage(state, result) {
  const items = result?.items || [];
  if (!items.length) {
    return (
      "По заданным условиям подходящих программ не нашлось.\n\n" +
      "Попробуйте расширить место поиска, выбрать более широкое направление или убрать ограничение по расписанию/бюджету."
    );
  }

  const lines = ["Я нашел подходящие программы:", ""];
  items.slice(0, 10).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.program}`,
      `Адрес: ${item.district}`,
      `Расписание: ${item.schedule}`,
      `Стоимость: ${item.price}`,
      `Онлайн-запись: ${item.sourceUrl || "ссылка уточняется"}`,
      "",
    );
  });

  if (items.length < 3 || result?.isSparse) {
    lines.push("Я нашел мало точных совпадений. Можно расширить место поиска, возрастной диапазон, направление, расписание или бюджет.");
  }

  return lines.join("\n");
}

function buildAmbiguities(state, extra = []) {
  const fields = state.fields || {};
  const values = new Set(extra.filter(Boolean));
  if (fields.ageText && !/^\d{1,2}\s*лет?$|^\d{1,2}$/i.test(fields.ageText) && fields.age) {
    values.add("age_approximate");
  }
  if (fields.place && fields.placeKnown === false && !looksLikeOrganizationOrDistrict(fields.place)) {
    values.add("place_unknown");
  }
  if (fields.broadInterest) values.add("interest_broad");
  if (fields.interests?.includes("sports") && fields.avoidances?.includes("intense")) {
    values.add("interest_conflict");
  }
  return [...values];
}

function isApproximateAgeText(value) {
  return /школьник|подросток|первоклассник/i.test(String(value || ""));
}

function detectAge(text) {
  const range = String(text).match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:лет|года|год|л\.)?/i);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    const avg = Math.round((first + second) / 2);
    return {
      age: ageBucket(avg),
      ageYears: avg,
      ageText: `${first}-${second} лет`,
      ambiguous: true,
      ambiguity: "age_range",
    };
  }

  const numeric = String(text).match(/(?:^|\D)(\d{1,2})\s*(?:лет|года|год|л\.)?/i);
  if (numeric) {
    const ageYears = Number(numeric[1]);
    const bucket = ageBucket(ageYears);
    if (bucket) {
      return {
        age: bucket,
        ageYears,
        ageText: `${ageYears} лет`,
        ambiguous: false,
      };
    }
  }

  const normalized = normalizeText(text);
  if (/первоклассник|первый класс/.test(normalized)) {
    return { age: "7-9", ageYears: 7, ageText: "первоклассник", ambiguous: true, ambiguity: "age_approximate" };
  }
  if (/подросток/.test(normalized)) {
    return { age: "13+", ageYears: 13, ageText: "подросток", ambiguous: true, ambiguity: "age_approximate" };
  }
  if (/школьник/.test(normalized)) {
    return { age: "7-9", ageYears: 8, ageText: "школьник", ambiguous: true, ambiguity: "age_approximate" };
  }
  return null;
}

function ageBucket(age) {
  if (age >= 3 && age <= 4) return "3-4";
  if (age >= 5 && age <= 6) return "5-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  if (age >= 13 && age <= 18) return "13+";
  return null;
}

function detectPlace(text) {
  for (const [place, pattern] of MUNICIPALITY_RULES) {
    if (pattern.test(text)) return { place, known: true, ambiguous: false };
  }

  const placeMatch = String(text).match(/(?:\bв|\bво|\bг\.|\bгород|\bрайон|\bпоселок|\bпгт|\bзато|\bискать в)\s+([А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?)/);
  if (placeMatch) {
    const place = cleanupPlace(placeMatch[1]);
    if (place) {
      return {
        place,
        known: false,
        ambiguous: !looksLikeOrganizationOrDistrict(place),
      };
    }
  }

  const orgMatch = String(text).match(/\b(кванториум|лапландия|дворец|центр\s+[А-ЯЁа-яё -]+|школ[аеуы]\s+\d+)\b/i);
  if (orgMatch) {
    return { place: cleanupPlace(orgMatch[0]), known: false, ambiguous: false };
  }

  return { place: "", known: false, ambiguous: false };
}

function cleanupPlace(value) {
  return String(value || "")
    .replace(/[.,;:!?]+$/g, "")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function looksLikeOrganizationOrDistrict(value) {
  return /(район|кванториум|лапландия|дворец|центр|школ|дом творчества|цдт|ддт)/i.test(value);
}

function detectInterests(text) {
  const values = [];
  const labels = [];
  for (const [value, label, pattern] of INTEREST_RULES) {
    if (pattern.test(text)) {
      values.push(value);
      labels.push(label);
    }
  }

  const broad = /что-нибудь полезн|для развития|пока не знаем|не знаем что|попробовать разное|любой кружок/i.test(text);
  return {
    values: [...new Set(values)],
    labels: [...new Set(labels)],
    text: labels.length ? [...new Set(labels)].join(", ") : (broad ? "широкий запрос на развитие" : ""),
    broad,
  };
}

function detectDirection(text) {
  return DIRECTION_RULES.find((item) => item.pattern.test(text)) || null;
}

function detectBudget(text) {
  if (/бесплатн/i.test(text)) return "бесплатно";
  const match = String(text).match(/до\s*([\d\s]+)\s*(?:₽|руб|рубл)/i) ||
    String(text).match(/бюджет\s*[:до ]*\s*([\d\s]+)\s*(?:₽|руб|рубл)?/i);
  if (!match) return "";
  return `до ${match[1].replace(/\s+/g, " ").trim()} рублей`;
}

function detectSchedule(text) {
  const normalized = normalizeText(text);
  const values = [];
  const labels = [];
  addSchedule(values, labels, /будн|после школы/.test(normalized), "weekdays", "будни");
  addSchedule(values, labels, /выходн|суббот|воскрес/.test(normalized), "weekends", "выходные");
  addSchedule(values, labels, /утр/.test(normalized), "morning", "утром");
  addSchedule(values, labels, /вечер|после школы/.test(normalized), "evening", "вечером");
  return {
    values: [...new Set(values)],
    text: [...new Set(labels)].join(", "),
  };
}

function addSchedule(values, labels, condition, value, label) {
  if (!condition) return;
  values.push(value);
  labels.push(label);
}

function detectFormat(text) {
  if (/онлайн|дистанц/.test(text)) return { value: "online", label: "Онлайн" };
  if (/офлайн|очно|рядом/.test(text)) return { value: "offline", label: "Офлайн" };
  return null;
}

function detectGoal(text) {
  if (/первый кружок|первый опыт|в первый раз/.test(text)) return { value: "first_try", label: "Первый опыт" };
  if (/практическ|навык|сильн/.test(text)) return { value: "strengths", label: "Практические навыки" };
  if (/общени|друз/.test(text)) return { value: "social", label: "Общение" };
  if (/дисциплин|режим/.test(text)) return { value: "discipline", label: "Дисциплина" };
  if (/интерес|нрав/.test(text)) return { value: "interest", label: "Интерес к теме" };
  return null;
}

function detectAvoidances(text) {
  const values = [];
  const labels = [];
  addAvoidance(values, labels, /(не любит|боится|избега).{0,24}(шум|шумн|больш)/.test(text), "noise", "Шумные группы");
  addAvoidance(values, labels, /(не любит|боится|избега).{0,24}(жестк|строг)/.test(text), "strict", "Жесткая дисциплина");
  addAvoidance(values, labels, /(не любит|боится|избега).{0,24}(выступ|сцен)/.test(text), "stage", "Выступления");
  addAvoidance(values, labels, /(однообраз|рутин)/.test(text), "routine", "Однообразные задания");
  addAvoidance(values, labels, /(слишком актив|перегруз|интенсив|активный темп)/.test(text), "intense", "Слишком активный темп");
  return {
    values: [...new Set(values)],
    labels: [...new Set(labels)],
  };
}

function addAvoidance(values, labels, condition, value, label) {
  if (!condition) return;
  values.push(value);
  labels.push(label);
}

function hasMultipleDirections(text) {
  return DIRECTION_RULES.filter((item) => item.pattern.test(text)).length > 1;
}

function hasInterestConflict(fields, normalizedText) {
  return Boolean(
    (fields.interests || []).includes("sports") &&
    (/не любит актив|не подходит актив|не любит интенсив|спокойн/.test(normalizedText) || (fields.avoidances || []).includes("intense")),
  );
}

function labelsForInterests(values = []) {
  return values
    .map((value) => INTEREST_RULES.find((item) => item[0] === value)?.[1])
    .filter(Boolean);
}

function labelsForAvoidances(values = []) {
  const labels = {
    noise: "Шумные группы",
    strict: "Жесткая дисциплина",
    stage: "Выступления",
    routine: "Однообразные задания",
    intense: "Слишком активный темп",
  };
  return values.map((value) => labels[value]).filter(Boolean);
}

function normalizeGoalValue(value) {
  if (value === "practical_skills") return "strengths";
  if (value === "communication") return "social";
  return value;
}

function goalLabel(value) {
  const labels = {
    interest: "Интерес к теме",
    first_try: "Первый опыт",
    strengths: "Практические навыки",
    social: "Общение",
    discipline: "Дисциплина",
    discover: "Понять, что подойдет",
  };
  return labels[value] || "";
}

function joinRussianList(values) {
  if (values.length <= 1) return values.join("");
  if (values.length === 2) return `${values[0]} и ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} и ${values[values.length - 1]}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

module.exports = {
  createDescriptionSelectionState,
  ensureDescriptionSelectionState,
  applyDescriptionText,
  shouldUseLlmForDescription,
  applyLlmAnalysis,
  recordLlmError,
  parseDescriptionText,
  getMissingRequiredFields,
  shouldConfirmSummary,
  buildRequiredClarificationPrompt,
  buildSingleFieldPrompt,
  buildSummaryText,
  buildRecommendationProfile,
  buildPdfAnswers,
  buildHistoryPayload,
  buildDescriptionResultMessage,
};
