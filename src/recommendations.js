const { getProgramUrl } = require("./pfdo-config");
const {
  getMunicipalities: getMirrorMunicipalities,
  searchPrograms: searchMirrorPrograms,
  getProgramDetail: getMirrorProgramDetail,
  getProgramScoringData: getMirrorProgramScoringData,
  checkMirrorHealth,
} = require("./pfdo-mirror");
const {
  SCENARIO_DESCRIPTION,
  scoreProgramCandidate,
} = require("./scoring-model");

let catalogSourceCache = null;
const UNKNOWN_SCHEDULE_LABEL = "Уточните при записи";

const MOCK_CATALOG = [
  {
    id: "robotics-start",
    program: "Начальная робототехника",
    formatLabel: "Лучший вариант для старта",
    venue: "Робоцентр Север",
    district: "центр",
    schedule: "сб 11:00",
    price: "7 500 ₽ / месяц",
    ageMin: 7,
    ageMax: 10,
    interests: ["building", "logic"],
    temperament: ["small_calm", "structured", "soft", "careful", "hands"],
    avoidsConflict: ["noise", "intense"],
    goals: ["first_try", "strengths", "discover"],
    summary:
      "Подходит детям, которым нравится собирать и разбираться, как все устроено. Формат помогает удерживать интерес через практику.",
    note:
      "Лучше начинать с спокойной группы без сильной соревновательности.",
  },
  {
    id: "engineering-lab",
    program: "Инженерное конструирование",
    formatLabel: "Хороший вариант на вырост",
    venue: "Лаборатория Юный инженер",
    district: "север",
    schedule: "вт 18:30",
    price: "8 000 ₽ / месяц",
    ageMin: 8,
    ageMax: 12,
    interests: ["building", "logic", "calm"],
    temperament: ["structured", "hands", "logic"],
    avoidsConflict: ["routine"],
    goals: ["strengths", "discipline"],
    summary:
      "Сильный вариант, если ребенку интересны конструкция и понятная логика. Хорошо подходит для постепенного усложнения.",
    note:
      "Темп выше, чем в стартовых кружках, поэтому для первого входа подходит не всем.",
  },
  {
    id: "art-maker",
    program: "Творческая мастерская",
    formatLabel: "Мягкая проба",
    venue: "Студия Мастерская идей",
    district: "центр",
    schedule: "чт 17:30",
    price: "6 200 ₽ / месяц",
    ageMin: 6,
    ageMax: 10,
    interests: ["creative", "calm", "hands"],
    temperament: ["small_calm", "free", "soft", "careful"],
    avoidsConflict: ["strict", "noise"],
    goals: ["first_try", "interest", "discover"],
    summary:
      "Бережный формат для детей, которым важно сначала освоиться и почувствовать удовольствие от занятий.",
    note:
      "Если семье важнее логика и инженерность, это скорее мягкий старт, чем основной трек.",
  },
  {
    id: "theatre-lab",
    program: "Театральная студия",
    formatLabel: "Подойдет, если важнее общение",
    venue: "Театр-студия Диалог",
    district: "юг",
    schedule: "ср 18:00",
    price: "5 900 ₽ / месяц",
    ageMin: 8,
    ageMax: 13,
    interests: ["social", "creative"],
    temperament: ["active_group", "free", "social"],
    avoidsConflict: [],
    goals: ["social", "interest"],
    summary:
      "Хороший выбор, если ребенку нравится взаимодействовать с другими и выражать себя через роль и речь.",
    note:
      "Если ребенку некомфортны выступления, этот формат лучше отложить.",
  },
  {
    id: "swim-balance",
    program: "Плавание",
    formatLabel: "Более активный формат",
    venue: "Спортклуб Волна",
    district: "центр",
    schedule: "пн/ср 19:00",
    price: "4 800 ₽ / месяц",
    ageMin: 5,
    ageMax: 12,
    interests: ["sports"],
    temperament: ["active_group", "structured", "fast"],
    avoidsConflict: [],
    goals: ["discipline", "health", "interest"],
    summary:
      "Подходит детям, которым нужен активный формат, ритм и понятная регулярность.",
    note:
      "Не лучший первый вариант для ребенка, которому нужна очень мягкая адаптация.",
  },
];

function ageRangeToNumber(ageRange) {
  const map = {
    "3-4": 4,
    "5-6": 6,
    "7-9": 8,
    "10-12": 11,
    "13+": 13,
  };
  return map[ageRange] ?? 8;
}

function computeConfidence(profile) {
  let score = 0;
  const goals = profileGoals(profile).filter((goal) => goal !== "discover");

  if (profile.interests.length >= 2) score += 2;
  if (profile.avoidances.length > 0 && !profile.avoidances.includes("unknown")) score += 1;
  if (profile.adaptation && profile.adaptation !== "depends") score += 1;
  if (goals.length) score += 1;

  if (profile.interests.length >= 4) score -= 1;
  if (profile.avoidances.includes("unknown")) score -= 1;
  if (profile.adaptation === "depends") score -= 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function scoreProgram(item, profile) {
  const age = ageRangeToNumber(profile.age);
  if (age < item.ageMin || age > item.ageMax) return -999;

  let score = 0;

  for (const interest of profile.interests) {
    if (item.interests.includes(interest)) score += 3;
  }

  for (const avoidance of profile.avoidances) {
    if (item.avoidsConflict.includes(avoidance)) score += 1;
    if (avoidance === "stage" && item.program.includes("Театраль")) score -= 4;
  }

  const matchingGoals = profileGoals(profile).filter((goal) => item.goals.includes(goal));
  if (matchingGoals.length) score += Math.min(4, matchingGoals.length * 2);

  if (profile.adaptation && item.temperament.includes(profile.adaptation)) score += 2;
  if (profile.clarifyGroup && item.temperament.includes(profile.clarifyGroup)) score += 2;
  if (profile.clarifyFocus && item.temperament.includes(profile.clarifyFocus)) score += 2;

  if (profile.location && item.district.toLowerCase().includes(profile.location.toLowerCase())) {
    score += 2;
  }

  if (profile.budget) {
    const budgetValue = extractNumber(profile.budget);
    const itemPrice = extractNumber(item.price);
    if (budgetValue && itemPrice && itemPrice <= budgetValue) score += 2;
    if (budgetValue && itemPrice && itemPrice > budgetValue * 1.25) score -= 2;
  }

  if (profile.schedule) {
    const normalized = profile.schedule.toLowerCase();
    if (
      normalized.includes("суб") && item.schedule.includes("сб") ||
      normalized.includes("буд") && (item.schedule.includes("пн") || item.schedule.includes("вт") || item.schedule.includes("ср") || item.schedule.includes("чт") || item.schedule.includes("пт")) ||
      normalized.includes("веч") && item.schedule.match(/1[7-9]:|20:/)
    ) {
      score += 1;
    }
  }

  return score;
}

async function getRecommendations(profile, options = {}) {
  try {
    const source = options.source || await resolveCatalogSource();
    return await getCatalogRecommendations(profile, source, options);
  } catch (error) {
    if (options.strict) {
      console.error("Catalog lookup failed in strict mode:", error.message);
      return {
        source: options.source?.name || "mirror",
        confidence: computeConfidence(profile),
        items: [],
        emptyReason: "catalog_unavailable",
        error: error.message,
      };
    }
    console.error("Catalog lookup failed, fallback to mock data:", error.message);
    return getMockRecommendations(profile, options);
  }
}

function getMockRecommendations(profile, options = {}) {
  const limit = options.limit || 0;
  const confidence = computeConfidence(profile);
  const ranked = MOCK_CATALOG.map((item) => ({
    ...item,
    score: scoreProgram(item, profile),
  }))
    .filter((item) => item.score > -100)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit || (confidence === "high" ? 4 : 3));

  return {
    source: "mock",
    confidence,
    items: ranked,
  };
}

function buildRecommendationMessage(profile, result) {
  if (!result.items.length) {
    return (
      "Сейчас точных совпадений не нашлось.\n\n" +
      "Можно немного расширить район, бюджет или расписание, и я попробую подобрать больше вариантов."
    );
  }

  const introByConfidence = {
    high: "Вот варианты, которые лучше всего подходят вашему ребенку.",
    medium: "Вот варианты, которые выглядят наиболее подходящими с учетом того, что мы уже знаем.",
    low: "Сейчас разумнее начать с вариантов, где ребенку будет проще включиться и понять, интересно ли ему это.",
  };

  const lines = [introByConfidence[result.confidence], ""];

  result.items.forEach((item, index) => {
    const sourceLine = item.sourceUrl ? `Карточка программы: ${item.sourceUrl}` : null;
    lines.push(
      `${index + 1}. ${item.program} — ${item.formatLabel}`,
      `Где: ${item.venue}, ${item.district}`,
      `Когда: ${item.schedule}`,
      `Стоимость: ${item.price}`,
      `Почему подходит: ${item.summary}`,
      `Что важно учесть: ${item.note}`,
      ...(sourceLine ? [sourceLine] : []),
      "",
    );
  });

  lines.push(
    "Если хотите, я могу сразу показать:",
    "• что спросить на пробном занятии",
    "• как понять после 2-3 занятий, что кружок подходит",
  );

  return lines.join("\n");
}

function buildTrialQuestionsMessage() {
  return (
    "Что спросить на пробном занятии:\n\n" +
    "• Как ребенок обычно входит в группу, если сначала присматривается?\n" +
    "• Насколько интенсивный темп на старте?\n" +
    "• Сколько детей в группе?\n" +
    "• Есть ли пробное занятие?\n" +
    "• Как преподаватель понимает, что ребенку подходит этот формат?"
  );
}

function buildFitCheckMessage() {
  return (
    "На что смотреть после 2-3 занятий:\n\n" +
    "• ребенок идет без сильного сопротивления\n" +
    "• после занятия скорее оживлен, чем перегружен\n" +
    "• появляется желание рассказать или показать что-то\n" +
    "• интерес не исчезает после первой новизны\n\n" +
    "Если кружок кажется хорошим, но ребенок стабильно идет с напряжением, часто это значит, что не совпал формат, а не само направление."
  );
}

function extractNumber(text) {
  const match = String(text).replace(/\s/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function getCatalogRecommendations(profile, source, options = {}) {
  const limit = options.limit || 0;
  const confidence = computeConfidence(profile);
  const municipalities = await source.getMunicipalities();
  const municipality = matchMunicipality(profile.location, municipalities);
  const context = buildCatalogScoringContext(profile, municipality, options);
  const candidates = await source.searchPrograms({
    municipalityId: municipality ? municipality.id : null,
  });
  const scoringData = await loadCatalogScoringData(candidates, source);

  const ranked = candidates
    .map((item) => {
      const candidateScoringData = scoringData.get(Number(item.id)) || {};
      const scoring = scoreProgramCandidate(
        buildCatalogScoringCandidate(item, candidateScoringData),
        context,
      );
      return {
        ...item,
        scoring,
        scoringData: candidateScoringData,
        score: scoring.score,
      };
    })
    .filter((item) => item.scoring.passesFilters !== false && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max((limit || 4) * 3, 12));

  const detailed = [];
  for (const item of ranked) {
    try {
      const detail = item.scoringData?.detail || await source.getProgramDetail(item.id);
      detailed.push(normalizeLiveProgram(item, detail, profile, item.score, item.scoringData));
    } catch (error) {
      console.error(`Program detail failed for ${item.id}:`, error.message);
      detailed.push(normalizeLiveProgram(item, null, profile, item.score, item.scoringData));
    }
  }

  const filtered = detailed
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit || (confidence === "high" ? 4 : 3));

  if (!filtered.length) {
    if (options.strict) {
      return {
        source: source.name || "catalog",
        confidence,
        items: [],
        municipality,
        emptyReason: candidates.length ? "filtered_out" : "no_candidates",
        isSparse: false,
      };
    }
    throw new Error("No live recommendations after ranking");
  }

  return {
    source: source.name || "catalog",
    confidence,
    items: filtered,
    municipality,
    isSparse: filtered.length < (options.sparseThreshold || 3),
  };
}

async function resolveCatalogSource() {
  if (catalogSourceCache) {
    return catalogSourceCache;
  }

  const mirrorHealthy = await checkMirrorHealth();
  if (!mirrorHealthy) {
    throw new Error("PFDO mirror is unavailable or empty");
  }

  catalogSourceCache = {
    name: "mirror",
    getMunicipalities: getMirrorMunicipalities,
    searchPrograms: searchMirrorPrograms,
    getProgramDetail: getMirrorProgramDetail,
    getProgramScoringData: getMirrorProgramScoringData,
  };
  return catalogSourceCache;
}

function buildCatalogScoringContext(profile, municipality, options = {}) {
  return {
    scenario: options.scenario || profile.scenario || SCENARIO_DESCRIPTION,
    municipalityId: municipality?.id || profile.municipalityId || null,
    organizationId: profile.organizationId || null,
    organizationName: profile.organization || (!municipality && profile.location ? profile.location : ""),
    age: profile.age,
    ageYears: profile.ageYears,
    ageRangeYears: profile.ageRangeYears,
    budget: profile.budget,
    scheduleText: profile.schedule,
    schedule: profile.scheduleValues || [],
    format: profile.format || profile.formatLabel,
    direction: profile.direction,
    directionLabel: profile.directionLabel,
    groupSize: profile.groupSize,
    clarifyGroup: profile.clarifyGroup,
    interests: profile.interests || [],
    interestsText: profile.interestsText || "",
  };
}

async function loadCatalogScoringData(candidates, source) {
  const ids = candidates.map((item) => Number(item.id)).filter(Number.isFinite);
  if (source.getProgramScoringData) {
    return source.getProgramScoringData(ids);
  }

  const result = new Map();
  for (const item of candidates) {
    try {
      const detail = await source.getProgramDetail(item.id);
      result.set(Number(item.id), {
        detail,
        modules: normalizeDetailModules(detail),
        groups: detail?.available_groups || [],
        topics: [],
        topicsKnown: false,
      });
    } catch (_) {
      result.set(Number(item.id), {
        modules: [],
        groups: [],
        topics: [],
        topicsKnown: false,
      });
    }
  }
  return result;
}

function buildCatalogScoringCandidate(item, scoringData = {}) {
  return {
    id: Number(item.id),
    name: item.name,
    municipalityId: item.municipalityId,
    organizationId: item.organizationId,
    organizationName: item.organization_name,
    directionId: item.directionId || item.direction?.id,
    directionName: item.direction?.name,
    eduForm: item.eduForm,
    eduFormName: item.eduFormName,
    directoryLevelId: item.directoryLevelId,
    ageMinMonths: item.age_min,
    ageMaxMonths: item.age_max,
    enrollment: item.enrollment,
    annotation: item.annotation,
    task: item.task,
    keywords: item.keywords || [],
    modules: scoringData.modules || [],
    groups: scoringData.groups || [],
    topics: scoringData.topics || [],
    topicsKnown: scoringData.topicsKnown,
  };
}

function normalizeDetailModules(detail) {
  const modules = detail?.modules || detail?.program?.modules || [];
  return Array.isArray(modules) ? modules : [];
}

function scoreLiveProgram(item, profile) {
  const text = normalizeText(
    [
      item.name,
      item.direction?.name,
      item.organization_name,
      ...(item.keywords || []).map(String),
    ].join(" "),
  );

  const age = ageRangeToNumber(profile.age) * 12;
  if (item.age_min && age < item.age_min) return -999;
  if (item.age_max && age > item.age_max) return -999;

  let score = 0;
  let interestScore = 0;

  for (const interest of profile.interests) {
    const current = scoreInterestMatch(interest, text, item.direction?.name || "");
    interestScore += current;
    score += current;
  }

  if (profile.interests.length && interestScore === 0) {
    score -= 4;
  }

  for (const avoidance of profile.avoidances) {
    score += scoreAvoidance(avoidance, text);
  }

  score += scoreGoals(profileGoals(profile), text);
  score += scoreDirection(profile.directionLabel, text);
  score += scoreAdaptation(profile.adaptation, text);
  score += scoreAdaptation(profile.clarifyGroup, text);
  score += scoreAdaptation(profile.clarifyFocus, text);

  if (profile.location) {
    const locationText = normalizeText(profile.location);
    const addressText = normalizeText(item.address?.name || "");
    const organizationText = normalizeText(item.organization_name || "");
    if (addressText && (addressText.includes(locationText) || locationText.includes(addressText))) {
      score += 3;
    }
    if (organizationText && (organizationText.includes(locationText) || locationText.includes(organizationText))) {
      score += 3;
    }
  }

  if (item.organization_name && /лапландия|кванториум|дворец|центр/i.test(item.organization_name)) {
    score += 1;
  }

  return score;
}

function normalizeLiveProgram(listItem, detail, profile, baseScore, scoringData = {}) {
  const data = detail || {};
  const program = data.program || {};
  const groups = data.available_groups || scoringData.groups || [];
  const organization = data.organization || {};
  const address = data.address || listItem.address || {};
  const sourceUrl = getProgramUrl(listItem.id);
  const summarySource = stripHtml(program.annotation || program.task || "");
  const directionName = data.direction?.name || listItem.direction?.name || "Направление не указано";
  const programScore = Number.isFinite(baseScore) ? baseScore : 0;
  const { bestGroup, groupScore } = chooseBestGroup(groups, profile);
  const finalScore = programScore;

  return {
    id: String(listItem.id),
    program: listItem.name,
    formatLabel: chooseLiveLabel(profile, groups, directionName),
    venue: organization.name || listItem.organization_name || "Организация не указана",
    district: address.name || "Локация уточняется на карточке",
    schedule: summarizeSchedule(bestGroup),
    price: summarizePrice(program, bestGroup),
    summary: buildLiveSummary(summarySource, directionName, profile),
    note: buildLiveNote(bestGroup, groups.length, program),
    topics: buildLiveTopics(listItem, program, directionName),
    score: finalScore,
    programScore,
    groupScore,
    sourceUrl,
    availableGroups: groups.length,
    availablePlaces: countFreePlaces(groups),
    enrollment: listItem.enrollment,
    phone: organization.phone || null,
    programTextUrl: data.program_text?.link ? data.program_text.value : null,
    ageMin: Math.floor((program.age_group_min || listItem.age_min || 0) / 12),
    ageMax: Math.ceil((program.age_group_max || listItem.age_max || 0) / 12),
    isLive: true,
    firstGroup: bestGroup,
    bestGroup,
  };
}

function countFreePlaces(groups) {
  if (!Array.isArray(groups)) return null;
  let total = 0;
  let hasKnownValue = false;
  for (const group of groups) {
    const value = Number(group?.free_places_counter);
    if (!Number.isFinite(value)) continue;
    hasKnownValue = true;
    if (value > 0) total += value;
  }
  return hasKnownValue ? total : null;
}

function chooseLiveLabel(profile, groups, directionName) {
  if (groups.length > 0 && (hasProfileGoal(profile, "first_try") || profile.adaptation === "soft")) {
    return "Лучший вариант для старта";
  }
  if (hasProfileGoal(profile, "social")) {
    return "Подойдет, если важнее общение";
  }
  if (/тех|робот|инженер|программ|физик|математ/i.test(directionName)) {
    return "Хороший вариант на вырост";
  }
  return groups.length > 0 ? "Можно попробовать сейчас" : "Нужно уточнить условия";
}

function summarizeSchedule(group) {
  if (!group) {
    return UNKNOWN_SCHEDULE_LABEL;
  }

  const period = group.periods?.[0];
  if (period?.schedule) {
    const scheduleEntries = [];
    for (const [dayKey, entries] of Object.entries(period.schedule)) {
      if (!entries?.length) continue;
      const firstEntry = entries[0];
      const label = shortWeekday(firstEntry.week_day || dayKey);
      const time = firstEntry.start_time || "";
      scheduleEntries.push(`${label} ${time}`.trim());
    }
    if (scheduleEntries.length) {
      return scheduleEntries.slice(0, 3).join(", ");
    }
  }

  return UNKNOWN_SCHEDULE_LABEL;
}

function shortWeekday(value) {
  const normalized = normalizeText(value);
  const labels = {
    monday: "Пн",
    tuesday: "Вт",
    wednesday: "Ср",
    thursday: "Чт",
    friday: "Пт",
    saturday: "Сб",
    sunday: "Вс",
    понедельник: "Пн",
    вторник: "Вт",
    среда: "Ср",
    четверг: "Чт",
    пятница: "Пт",
    суббота: "Сб",
    воскресенье: "Вс",
    пн: "Пн",
    вт: "Вт",
    ср: "Ср",
    чт: "Чт",
    пт: "Пт",
    сб: "Сб",
    вс: "Вс",
  };
  return labels[normalized] || capitalize(String(value || ""));
}

function summarizePrice(program, group) {
  if (group?.period_price != null && String(group.period_price).trim() !== "") {
    const amount = extractPriceAmount(group.period_price);
    if (amount === 0) return "Бесплатно";
    return `${formatPrice(group.period_price)} за период`;
  }
  const registryId = program.directory_program_document_id;
  if (registryId) {
    return "Смотрите условия на карточке PFDO";
  }
  return "Стоимость уточняется на карточке программы";
}

function buildLiveSummary(sourceText, directionName, profile) {
  const focus = [
    profile.interests.includes("building") ? "интерес к конструированию" : null,
    profile.interests.includes("creative") ? "творческий интерес" : null,
    profile.interests.includes("logic") ? "интерес к логике и устройству вещей" : null,
    profile.adaptation === "careful" || profile.adaptation === "soft"
      ? "бережный вход в новое"
      : null,
  ].filter(Boolean);

  const firstSentence = extractFirstSentence(sourceText);
  const tail = focus.length
    ? ` Лучше всего совпадает с запросом на ${focus.slice(0, 2).join(" и ")}.`
    : "";

  if (firstSentence) {
    return `${firstSentence}${tail}`;
  }

  return `Программа из направления "${directionName}", которую стоит рассмотреть с учетом профиля ребенка.${tail}`;
}

function buildLiveNote(bestGroup, totalGroups, program) {
  const notes = [];

  if (!bestGroup) {
    notes.push("По открытым группам и расписанию лучше перейти в карточку программы.");
  } else {
    if (totalGroups > 1) {
      notes.push("Показана наиболее подходящая открытая группа по бюджету и расписанию.");
    }
    if (Number.isFinite(bestGroup.free_places_counter)) {
      notes.push(`Сейчас свободных мест: ${bestGroup.free_places_counter}.`);
    }
    if (bestGroup.typical_lesson_duration_minutes) {
      notes.push(`Обычная длительность занятия: ${bestGroup.typical_lesson_duration_minutes} мин.`);
    }
  }

  if (program.need_medical_certificate) {
    notes.push("Может потребоваться медицинская справка.");
  }

  return notes.join(" ") || "Перед записью лучше открыть карточку и проверить детали набора.";
}

function chooseBestGroup(groups, profile) {
  if (!Array.isArray(groups) || !groups.length) {
    return {
      bestGroup: null,
      groupScore: 0,
    };
  }

  const ranked = groups
    .map((group) => ({
      group,
      score: scoreLiveGroup(group, profile),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    bestGroup: ranked[0]?.group || null,
    groupScore: ranked[0]?.score || 0,
  };
}

function scoreLiveGroup(group, profile) {
  let score = 0;
  score += scoreGroupBudget(group, profile.budget);
  score += scoreGroupSchedule(group, profile.schedule);
  score += scoreGroupAge(group, profile.age);

  if (Number.isFinite(group.free_places_counter) && group.free_places_counter > 0) {
    score += 1;
  }

  return score;
}

function scoreGroupBudget(group, budgetText) {
  if (!budgetText) return 0;

  const budgetValue = extractNumber(budgetText);
  const priceValue = extractPriceAmount(group?.period_price);
  if (!budgetValue || priceValue == null) return 0;
  if (priceValue <= budgetValue) return 3;
  if (priceValue <= budgetValue * 1.25) return -1;
  return -4;
}

function scoreGroupSchedule(group, scheduleText) {
  if (!scheduleText) return 0;

  const normalizedSchedule = normalizeText(scheduleText);
  const requestedDays = detectRequestedDays(normalizedSchedule);
  const requestedEvening = normalizedSchedule.includes("веч");
  const requestedWeekdays = normalizedSchedule.includes("буд");
  const requestedWeekend =
    normalizedSchedule.includes("выход") || normalizedSchedule.includes("суб") || normalizedSchedule.includes("воск");

  const availableDays = collectGroupDays(group);
  const firstStartHour = getEarliestGroupHour(group);
  let score = 0;

  if (requestedDays.length) {
    const exactDayMatch = requestedDays.some((day) => availableDays.includes(day));
    score += exactDayMatch ? 2 : -2;
  }

  if (requestedWeekdays && availableDays.some((day) => ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day))) {
    score += 1;
  }

  if (requestedWeekend && availableDays.some((day) => ["saturday", "sunday"].includes(day))) {
    score += 1;
  }

  if (requestedEvening && firstStartHour != null) {
    score += firstStartHour >= 17 ? 1 : -1;
  }

  return score;
}

function scoreGroupAge(group, ageRange) {
  if (!ageRange) return 0;
  const ageMonths = ageRangeToNumber(ageRange) * 12;
  const min = Number(group?.recommended_min_age_for_enrollment);
  const max = Number(group?.recommended_max_age_for_enrollment);

  if (Number.isFinite(min) && ageMonths < min) return -999;
  if (Number.isFinite(max) && ageMonths > max) return -999;
  if (Number.isFinite(min) || Number.isFinite(max)) return 1;
  return 0;
}

function collectGroupDays(group) {
  const daySet = new Set();
  for (const period of group?.periods || []) {
    for (const dayKey of Object.keys(period.schedule || {})) {
      daySet.add(dayKey);
    }
  }
  return [...daySet];
}

function getEarliestGroupHour(group) {
  let earliest = null;
  for (const period of group?.periods || []) {
    for (const entries of Object.values(period.schedule || {})) {
      for (const entry of entries || []) {
        const hour = Number(String(entry.start_time || "").split(":")[0]);
        if (!Number.isFinite(hour)) continue;
        if (earliest == null || hour < earliest) earliest = hour;
      }
    }
  }
  return earliest;
}

function detectRequestedDays(text) {
  const matches = [];
  const patterns = {
    monday: /пон|пн/i,
    tuesday: /втор|вт/i,
    wednesday: /сред|ср/i,
    thursday: /четв|чт/i,
    friday: /пят|пт/i,
    saturday: /суб|сб/i,
    sunday: /воск|вс/i,
  };

  for (const [day, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) matches.push(day);
  }

  return matches;
}

function extractPriceAmount(value) {
  if (value == null) return null;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function matchMunicipality(input, municipalities) {
  if (!input) return null;

  const normalizedInput = simplifyMunicipalityName(input);
  if (!normalizedInput) return null;

  let exact = municipalities.find(
    (item) => simplifyMunicipalityName(item.name) === normalizedInput,
  );
  if (exact) return exact;

  exact = municipalities.find((item) =>
    simplifyMunicipalityName(item.name).includes(normalizedInput),
  );
  if (exact) return exact;

  return municipalities.find((item) =>
    normalizedInput.includes(simplifyMunicipalityName(item.name)),
  );
}

function simplifyMunicipalityName(value) {
  return normalizeText(value)
    .replace(/\b(г|город|зато|муниципальный|округ|район|область|с подведомственной территорией)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function scoreInterestMatch(interest, text, directionName) {
  const rules = {
    creative: [/худож|рис|дизайн|театр|музык|танц|хореограф|твор/i],
    building: [/робот|констру|инженер|модел|техн|maker|3d/i],
    sports: [/спорт|плав|футбол|хокк|борьб|гимнаст|туризм/i],
    social: [/театр|журналист|лидер|дебат|коммуник|волонтер/i],
    logic: [/математ|программ|физик|информат|логик|робот/i],
    calm: [/мастер|студия|твор|шахмат|модел|рис/i],
  };

  const patterns = rules[interest] || [];
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(text) || pattern.test(directionName)) {
      score += 3;
    }
  }
  return score;
}

function scoreAvoidance(avoidance, text) {
  const penalties = {
    noise: [/спорт|театр|ансамбл|оркестр|хореограф/i],
    strict: [/кадет|строев|военн/i],
    stage: [/театр|вокал|сцен|хореограф/i],
    routine: [/классическ|строев|традицион/i],
    intense: [/спорт|соревн|турнир|интенсив/i],
  };

  const patterns = penalties[avoidance] || [];
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) score -= 2;
  }
  return score;
}

function scoreGoal(goal, text) {
  const rules = {
    interest: [/игров|твор|мастер|студия/i],
    first_try: [/началь|азбук|введение|перв/i],
    strengths: [/углуб|инженер|профиль|продвин/i],
    social: [/театр|команд|группа|клуб/i],
    discipline: [/спорт|школа|подготовка|система/i],
    discover: [/студия|мастер|введение|проба/i],
  };

  const patterns = rules[goal] || [];
  return patterns.some((pattern) => pattern.test(text)) ? 2 : 0;
}

function scoreGoals(goals, text) {
  return Math.min(4, goals.reduce((sum, goal) => sum + scoreGoal(goal, text), 0));
}

function profileGoals(profile) {
  const goals = Array.isArray(profile.goals) ? profile.goals : [];
  if (profile.goal && !goals.includes(profile.goal)) return [...goals, profile.goal];
  return goals.length ? goals : ["discover"];
}

function hasProfileGoal(profile, goal) {
  return profileGoals(profile).includes(goal);
}

function scoreDirection(directionLabel, text) {
  if (!directionLabel || directionLabel === "Не важно") return 0;
  return normalizeText(text).includes(normalizeText(directionLabel)) ? 8 : 0;
}

function buildLiveTopics(listItem, program, directionName) {
  const keywords = Array.isArray(listItem.keywords)
    ? listItem.keywords.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
  if (keywords.length) {
    return [...new Set(keywords)].slice(0, 6);
  }

  const text = stripHtml([program.annotation, program.task].filter(Boolean).join(" "));
  const firstSentence = extractFirstSentence(text);
  if (firstSentence) {
    return [firstSentence];
  }

  return [directionName || "Темы уточняются в карточке программы"];
}

function scoreAdaptation(signal, text) {
  if (!signal) return 0;

  const rules = {
    soft: [/игров|мягк|началь|студия/i],
    careful: [/игров|началь|введение|студия/i],
    fast: [/интенсив|соревн|продвин/i],
    small_calm: [/студия|мастер|шахмат|рис/i],
    active_group: [/команд|ансамбл|театр|спорт/i],
    structured: [/школа|классическ|система|программа/i],
    free: [/твор|мастер|студия|проект/i],
    hands: [/робот|констру|мастер|модел|техн/i],
    logic: [/математ|программ|физик|информат/i],
    social: [/театр|журналист|лидер|дебат/i],
    mixed: [/студия|клуб|мастер/i],
  };

  const patterns = rules[signal] || [];
  return patterns.some((pattern) => pattern.test(text)) ? 2 : 0;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstSentence(text) {
  const clean = stripHtml(text);
  if (!clean) return "";
  const match = clean.match(/^(.{30,220}?[.!?])(\s|$)/);
  return match ? match[1].trim() : clean.slice(0, 220).trim();
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function formatPrice(value) {
  const amount = Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount)) + " ₽";
}

module.exports = {
  getRecommendations,
  buildRecommendationMessage,
  buildTrialQuestionsMessage,
  buildFitCheckMessage,
};
