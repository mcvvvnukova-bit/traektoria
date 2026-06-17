const { queryRows, decodeJsonCell } = require("./db");
const { getMirrorDatabaseUrl, getMunicipalities, getProgramDetail } = require("./pfdo-mirror");
const { getProgramUrl } = require("./pfdo-config");
const { ensurePfdoProgramsImported } = require("./pfdo-program-sync");
const { loadProgramSyncStates } = require("./pfdo-sync-state");

const MAX_COMPLETED_LINKS = 5;
const UNKNOWN_SCHEDULE_LABEL = "Уточните при записи";
const UNKNOWN_PRICE_LABEL = "Уточните при записи";
const DEEP_TRAJECTORY_NO_RESULTS_MESSAGE = "Не могу найти подходящих программ. Попробуйте изменить критерии поиска";
const TOPIC_SUMMARY_GROUP_LIMIT = 4;
const TOPIC_SUMMARY_CATEGORY_LIMIT = 3;
const ADVANCED_TOPIC_PATTERNS = [
  /углуб/i,
  /проект/i,
  /разработ/i,
  /исслед/i,
  /соревн/i,
  /олимпиад/i,
  /модел/i,
  /программ/i,
  /констру/i,
  /инженер/i,
  /практик/i,
];

function createScenario3State() {
  return {
    links: [],
    programLinks: [],
    submittedProgramIds: [],
    completedProgramIds: [],
    missingProgramIds: [],
    invalidLinks: [],
    completedPrograms: [],
    pendingTopicProgramIds: [],
    recommendationMode: "deep",
    municipalityOptions: [],
    municipalityId: null,
    municipalityName: "",
    age: null,
    ageYears: null,
    ageRangeYears: null,
    completedTopicProfile: null,
    criteria: null,
    lastResult: null,
    pdfRequested: null,
    pdfPath: "",
  };
}

async function analyzeCompletedProgramsFromText(text) {
  const parsed = parsePfdoProgramLinks(text);
  return analyzeCompletedProgramsFromIds(parsed.programIds, {
    links: parsed.links,
    invalidLinks: parsed.invalidLinks,
    programLinks: parsed.programLinks,
  });
}

async function analyzeCompletedProgramsFromIds(programIds, options = {}) {
  const parsed = {
    links: options.links || [],
    invalidLinks: options.invalidLinks || [],
    programLinks: options.programLinks || [],
    programIds: [...new Set((programIds || []).map(Number).filter(Number.isFinite))].slice(0, MAX_COMPLETED_LINKS),
  };
  if (!parsed.programIds.length) {
    return {
      ...parsed,
      programs: [],
      missingProgramIds: [],
      municipalities: [],
      topicProfile: createTopicProfile([]),
      inferredAge: null,
      inferredAgeRange: null,
      shouldAskAge: true,
    };
  }

  let programs = await loadProgramsByIds(parsed.programIds);
  const foundIds = new Set(programs.map((program) => Number(program.id)));
  let missingProgramIds = parsed.programIds.filter((id) => !foundIds.has(Number(id)));
  let importResults = [];
  if (missingProgramIds.length && options.importMissing !== false) {
    const syncResult = await ensurePfdoProgramsImported(missingProgramIds, {
      triggerSource: options.triggerSource || "scenario3",
    });
    importResults = syncResult.results || [];
    if (importResults.some((result) => result.status === "imported")) {
      programs = await loadProgramsByIds(parsed.programIds);
      const refreshedFoundIds = new Set(programs.map((program) => Number(program.id)));
      missingProgramIds = parsed.programIds.filter((id) => !refreshedFoundIds.has(Number(id)));
    }
  }
  const topicMap = await loadTopicsForPrograms(programs.map((program) => program.id));
  const syncStateMap = await safeLoadProgramSyncStates(programs.map((program) => program.id));
  const programsWithTopics = await Promise.all(programs.map(async (program) => {
    const topics = topicMap.get(Number(program.id)) || [];
    const detail = await getProgramDetailSafe(program.id);
    const groups = detail?.available_groups || [];
    const bestGroup = chooseBestGroup(groups);
    const syncState = syncStateMap.get(Number(program.id)) || null;
    return {
      ...program,
      topics,
      syncState,
      documentStatus: syncState?.documentStatus || "",
      topicsStatus: syncState?.topicsStatus || (topics.length ? "ready" : ""),
      price: summarizePrice(detail?.program || {}, bestGroup),
      schedule: summarizeSchedule(bestGroup),
      ageLabel: formatAgeRange(program.ageMinMonths, program.ageMaxMonths),
      period: program.durationString || UNKNOWN_SCHEDULE_LABEL,
      availableGroups: groups.length,
      availablePlaces: countFreePlaces(groups),
      enrollment: program.enrollment,
    };
  }));
  const municipalities = uniqueBy(
    programsWithTopics
      .filter((program) => program.municipalityId)
      .map((program) => ({
        id: program.municipalityId,
        name: program.municipalityName || "Населенный пункт не указан",
      })),
    (item) => item.id,
  );
  const inferredAgeRange = inferAgeRangeFromPrograms(programsWithTopics);
  const inferredAge = midpointAgeYears(inferredAgeRange);
  const pendingTopicProgramIds = programsWithTopics
    .filter((program) => !program.topics.length && program.topicsStatus && program.topicsStatus !== "ready")
    .map((program) => Number(program.id));

  return {
    ...parsed,
    programs: programsWithTopics,
    missingProgramIds,
    importResults,
    pendingTopicProgramIds,
    municipalities,
    topicProfile: createTopicProfile(programsWithTopics),
    inferredAge,
    inferredAgeRange,
    shouldAskAge: !inferredAgeRange,
  };
}

function mergeScenario3Links(state, text) {
  const parsed = parsePfdoProgramLinks(text);
  const entriesById = new Map();
  for (const entry of state.programLinks || []) {
    if (Number.isFinite(Number(entry.id))) {
      entriesById.set(Number(entry.id), { id: Number(entry.id), url: entry.url });
    }
  }

  const added = [];
  const duplicates = [];
  let ignoredBecauseLimit = 0;
  for (const entry of parsed.programLinks || []) {
    const id = Number(entry.id);
    if (entriesById.has(id)) {
      duplicates.push(entry);
      continue;
    }
    if (entriesById.size >= MAX_COMPLETED_LINKS) {
      ignoredBecauseLimit += 1;
      continue;
    }
    entriesById.set(id, { id, url: entry.url });
    added.push(entry);
  }

  state.programLinks = [...entriesById.values()];
  state.links = state.programLinks.map((entry) => entry.url);
  state.submittedProgramIds = state.programLinks.map((entry) => entry.id);
  state.invalidLinks = uniqueBy([...(state.invalidLinks || []), ...parsed.invalidLinks], (url) => url);
  state.lastResult = null;

  return {
    parsed,
    added,
    duplicates,
    ignoredBecauseLimit,
    total: state.programLinks.length,
    maxReached: state.programLinks.length >= MAX_COMPLETED_LINKS,
  };
}

async function getDeepTrajectoryRecommendations(state, options = {}) {
  const limit = options.limit || 10;
  const recommendationMode = normalizeRecommendationMode(options.recommendationMode || state.recommendationMode);
  const criteria = normalizeSearchCriteria(options.criteria || state.criteria);
  const searchContext = await resolveSearchContext(state, criteria);
  const municipalityId = Number(searchContext.municipalityId);
  const ageRangeYears = normalizeAgeRangeYears(searchContext.ageRangeYears);
  const ageYears = Number(searchContext.ageYears || midpointAgeYears(ageRangeYears));
  if (!Number.isFinite(municipalityId)) {
    throw new Error("Missing municipality for deep trajectory");
  }
  if (!ageRangeYears) {
    throw new Error("Missing age for deep trajectory");
  }

  const completedIds = (state.completedProgramIds || []).map(Number).filter(Number.isFinite);
  const topicProfile = state.completedTopicProfile || createTopicProfile(state.completedPrograms || []);
  const candidates = await loadCandidatePrograms({
    municipalityId,
    ageYears,
    ageRangeYears,
    excludeIds: completedIds,
  });
  if (!candidates.length) {
    return {
      source: "mirror",
      confidence: "low",
      items: [],
      reason: DEEP_TRAJECTORY_NO_RESULTS_MESSAGE,
      topicProfile,
      searchContext,
      recommendationMode,
    };
  }

  const topicMap = await loadTopicsForPrograms(candidates.map((program) => program.id));
  const ranked = candidates
    .map((program) => {
      const topics = topicMap.get(Number(program.id)) || [];
      return {
        ...program,
        topics,
        ...scoreRecommendationCandidate(program, topics, topicProfile, ageYears, criteria, recommendationMode),
      };
    })
    .filter((program) => program.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit * 3, 18));

  const detailed = [];
  for (const item of ranked) {
    const detail = await getProgramDetailSafe(item.id);
    detailed.push(normalizeRecommendationItem(item, detail, criteria, { recommendationMode }));
  }
  detailed.sort((a, b) => b.score - a.score);
  const items = detailed.slice(0, limit);

  return {
    source: "mirror",
    confidence: items.length >= 3 ? "medium" : "low",
    items,
    reason: items.length ? "" : explainNoCandidates(candidates, topicProfile),
    topicProfile,
    searchContext,
    recommendationMode,
  };
}

function parsePfdoProgramLinks(text) {
  const raw = String(text || "");
  const urlMatches = raw.match(/https?:\/\/[^\s<>()]+/gi) || [];
  const links = [];
  const invalidLinks = [];
  const ids = [];
  const programLinks = [];

  for (const rawUrl of urlMatches.slice(0, MAX_COMPLETED_LINKS)) {
    const url = rawUrl.replace(/[.,;:!?]+$/g, "");
    if (!/^https?:\/\/(?:www\.)?51\.pfdo\.ru\//i.test(url)) {
      invalidLinks.push(url);
      continue;
    }
    const id = extractProgramId(url);
    if (!id) {
      invalidLinks.push(url);
      continue;
    }
    links.push(url);
    ids.push(id);
    programLinks.push({ id, url });
  }

  return {
    links,
    invalidLinks,
    programIds: [...new Set(ids)].slice(0, MAX_COMPLETED_LINKS),
    programLinks: uniqueBy(programLinks, (entry) => entry.id).slice(0, MAX_COMPLETED_LINKS),
  };
}

function extractProgramId(url) {
  const patterns = [
    /\/programs?\/(\d+)(?:[/?#]|$)/i,
    /\/app\/programs?\/(\d+)(?:[/?#]|$)/i,
    /[?&](?:program|program_id|id)=(\d+)(?:&|$)/i,
  ];
  for (const pattern of patterns) {
    const match = String(url).match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

async function loadProgramsByIds(programIds) {
  const ids = programIds.map(Number).filter(Number.isFinite);
  if (!ids.length) return [];
  const rows = await queryRows(
    `
    SELECT
      p.id,
      ${encodeTextSql("p.search_name")},
      p.municipality_id,
      ${encodeTextSql("mm.name")},
      p.direction_id,
      ${encodeTextSql("d.name")},
      p.age_group_min,
      p.age_group_max,
      ${encodeTextSql("p.organization_name")},
      ${encodeTextSql("p.address_name")},
      ${encodeTextSql("p.duration_string")},
      ${encodeTextSql("COALESCE(p.source_url, '')")},
      p.enrollment,
      ${encodeTextSql("p.annotation_html")},
      ${encodeTextSql("p.task_html")},
      replace(encode(convert_to(COALESCE(keyword_agg.keyword_names, '[]'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '')
    FROM pfdo_programs p
    LEFT JOIN pfdo_main_municipalities mm ON mm.id = p.municipality_id
    LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(k.name ORDER BY k.name) AS keyword_names
      FROM pfdo_program_keyword_links l
      JOIN pfdo_program_keywords k ON k.id = l.keyword_id
      WHERE l.program_id = p.id
    ) keyword_agg ON TRUE
    WHERE p.id IN (${ids.join(",")})
    ORDER BY array_position(ARRAY[${ids.join(",")}]::bigint[], p.id);
  `,
    getMirrorDatabaseUrl(),
  );

  return rows.map(rowToProgram);
}

async function loadCandidatePrograms({ municipalityId, ageYears, ageRangeYears, excludeIds }) {
  const normalizedAgeRange = normalizeAgeRangeYears(ageRangeYears) || ageRangeFromYears(ageYears);
  if (!normalizedAgeRange) {
    throw new Error("Missing age range for candidate programs");
  }
  const minAgeMonths = Math.round(normalizedAgeRange.min * 12);
  const maxAgeMonths = Math.round(normalizedAgeRange.max * 12);
  const excluded = (excludeIds || []).map(Number).filter(Number.isFinite);
  const excludedSql = excluded.length ? `AND p.id NOT IN (${excluded.join(",")})` : "";
  const rows = await queryRows(
    `
    SELECT
      p.id,
      ${encodeTextSql("p.search_name")},
      p.municipality_id,
      ${encodeTextSql("mm.name")},
      p.direction_id,
      ${encodeTextSql("d.name")},
      p.age_group_min,
      p.age_group_max,
      ${encodeTextSql("p.organization_name")},
      ${encodeTextSql("p.address_name")},
      ${encodeTextSql("p.duration_string")},
      ${encodeTextSql("COALESCE(p.source_url, '')")},
      p.enrollment,
      ${encodeTextSql("p.annotation_html")},
      ${encodeTextSql("p.task_html")},
      replace(encode(convert_to(COALESCE(keyword_agg.keyword_names, '[]'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '')
    FROM pfdo_programs p
    LEFT JOIN pfdo_main_municipalities mm ON mm.id = p.municipality_id
    LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(k.name ORDER BY k.name) AS keyword_names
      FROM pfdo_program_keyword_links l
      JOIN pfdo_program_keywords k ON k.id = l.keyword_id
      WHERE l.program_id = p.id
    ) keyword_agg ON TRUE
    WHERE p.municipality_id = ${Number(municipalityId)}
      ${excludedSql}
      AND (p.age_group_min IS NULL OR p.age_group_min <= ${maxAgeMonths})
      AND (p.age_group_max IS NULL OR p.age_group_max >= ${minAgeMonths})
    ORDER BY p.id;
  `,
    getMirrorDatabaseUrl(),
  );

  return rows.map(rowToProgram);
}

async function loadTopicsForPrograms(programIds) {
  const ids = programIds.map(Number).filter(Number.isFinite);
  const topicMap = new Map();
  if (!ids.length) return topicMap;

  const rows = await queryRows(
    `
    SELECT
      a.program_id,
      ${encodeTextSql("a.normalized_topic_name")},
      ${encodeTextSql("a.normalized_topic_key")},
      ${encodeTextSql("a.record_type")},
      COALESCE(a.hours_total, 0),
      COALESCE(a.hours_theory, 0),
      COALESCE(a.hours_practice, 0),
      COALESCE(a.hours_control, 0),
      ${encodeTextSql("COALESCE(c.category_code, '')")},
      ${encodeTextSql("COALESCE(c.category_name, '')")},
      ${encodeTextSql("COALESCE(c.parent_code, '')")},
      ${encodeTextSql("COALESCE(c.parent_name, '')")},
      COALESCE(c.confidence, 0)
    FROM pfdo_program_topic_aggregates a
    LEFT JOIN pfdo_program_topic_classifications c ON c.aggregate_id = a.id
    WHERE a.program_id IN (${ids.join(",")})
      AND a.record_type = 'content'
    ORDER BY a.program_id, a.first_topic_order NULLS LAST, a.normalized_topic_name;
  `,
    getMirrorDatabaseUrl(),
  );

  for (const row of rows) {
    const topic = {
      programId: Number(row[0]),
      name: decodeText(row[1]),
      key: decodeText(row[2]),
      recordType: decodeText(row[3]),
      hoursTotal: nullableNumber(row[4]) || 0,
      hoursTheory: nullableNumber(row[5]) || 0,
      hoursPractice: nullableNumber(row[6]) || 0,
      hoursControl: nullableNumber(row[7]) || 0,
      categoryCode: decodeText(row[8]),
      categoryName: decodeText(row[9]),
      parentCode: decodeText(row[10]),
      parentName: decodeText(row[11]),
      confidence: nullableNumber(row[12]) || 0,
    };
    if (!topicMap.has(topic.programId)) topicMap.set(topic.programId, []);
    topicMap.get(topic.programId).push(topic);
  }

  return topicMap;
}

async function safeLoadProgramSyncStates(programIds) {
  try {
    return await loadProgramSyncStates(programIds);
  } catch (error) {
    console.warn("PFDO sync state unavailable:", error.message);
    return new Map();
  }
}

function rowToProgram(row) {
  const keywords = decodeSafeJson(row[15]) || [];
  return {
    id: Number(row[0]),
    name: decodeText(row[1]),
    municipalityId: nullableNumber(row[2]),
    municipalityName: decodeText(row[3]),
    directionId: nullableNumber(row[4]),
    directionName: decodeText(row[5]),
    ageMinMonths: nullableNumber(row[6]),
    ageMaxMonths: nullableNumber(row[7]),
    organizationName: decodeText(row[8]),
    addressName: decodeText(row[9]),
    durationString: decodeText(row[10]),
    sourceUrl: decodeText(row[11]) || getProgramUrl(Number(row[0])),
    enrollment: nullableNumber(row[12]),
    annotation: stripHtml(decodeText(row[13])),
    task: stripHtml(decodeText(row[14])),
    keywords: Array.isArray(keywords) ? keywords.map(String) : [],
    topics: [],
  };
}

function createTopicProfile(programs) {
  const topicKeyCounts = new Map();
  const topicNameCounts = new Map();
  const topicNameHours = new Map();
  const categoryCounts = new Map();
  const categoryNames = new Map();
  const categoryKeyCounts = new Map();
  const categoryLabelCounts = new Map();
  const parentCategoryKeyCounts = new Map();
  const directionCounts = new Map();
  let hoursTotal = 0;
  let topicRows = 0;

  for (const program of programs || []) {
    if (program.directionName) {
      directionCounts.set(program.directionName, (directionCounts.get(program.directionName) || 0) + 1);
    }
    for (const topic of program.topics || []) {
      topicRows += 1;
      hoursTotal += Number(topic.hoursTotal || 0);
      if (topic.key) topicKeyCounts.set(topic.key, (topicKeyCounts.get(topic.key) || 0) + 1);
      if (topic.name) {
        topicNameCounts.set(topic.name, (topicNameCounts.get(topic.name) || 0) + 1);
        topicNameHours.set(topic.name, (topicNameHours.get(topic.name) || 0) + Number(topic.hoursTotal || 0));
      }
      if (topic.categoryCode) {
        categoryCounts.set(topic.categoryCode, (categoryCounts.get(topic.categoryCode) || 0) + 1);
        categoryNames.set(topic.categoryCode, topic.categoryName || topic.categoryCode);
      }
      for (const key of topicLevel2Keys(topic)) {
        categoryKeyCounts.set(key, (categoryKeyCounts.get(key) || 0) + 1);
      }
      for (const key of topicLevel1Keys(topic)) {
        parentCategoryKeyCounts.set(key, (parentCategoryKeyCounts.get(key) || 0) + 1);
      }
      const categoryLabel = formatTopicClassifierPath(topic);
      if (categoryLabel) {
        categoryLabelCounts.set(categoryLabel, (categoryLabelCounts.get(categoryLabel) || 0) + 1);
      }
    }
  }

  return {
    topicKeys: [...topicKeyCounts.keys()],
    topicNames: topTopicNames(topicNameCounts, topicNameHours, 12),
    categories: topEntries(categoryCounts, 12).map(([code, count]) => ({
      code,
      name: categoryNames.get(code) || code,
      count,
    })),
    categoryKeys: topEntries(categoryKeyCounts, 24).map(([key]) => key),
    parentCategoryKeys: topEntries(parentCategoryKeyCounts, 24).map(([key]) => key),
    categoryLabels: topEntries(categoryLabelCounts, 12).map(([name]) => name),
    directions: topEntries(directionCounts, 6).map(([name, count]) => ({ name, count })),
    hoursTotal,
    topicRows,
    averageHours: topicRows ? hoursTotal / topicRows : 0,
  };
}

function inferAgeRangeFromPrograms(programs) {
  const ranges = (programs || [])
    .map((program) => ({
      min: monthsToYears(program.ageMinMonths),
      max: monthsToYears(program.ageMaxMonths),
    }))
    .filter((range) => range.min != null || range.max != null);

  if (!ranges.length) return null;

  const intersectionMin = Math.max(...ranges.map((range) => range.min ?? 3));
  const intersectionMax = Math.min(...ranges.map((range) => range.max ?? 18));
  return normalizeAgeRangeYears({ min: intersectionMin, max: intersectionMax });
}

function inferAgeFromPrograms(programs) {
  return midpointAgeYears(inferAgeRangeFromPrograms(programs));
}

function normalizeRecommendationMode(value) {
  return value === "wide" ? "wide" : "deep";
}

function scoreRecommendationCandidate(program, topics, profile, ageYears, criteria = {}, mode = "deep") {
  if (normalizeRecommendationMode(mode) === "wide") {
    return scoreCandidateForNewInterests(program, topics, profile, ageYears, criteria);
  }
  return scoreCandidate(program, topics, profile, ageYears, criteria);
}

function scoreCandidate(program, topics, profile, ageYears, criteria = {}) {
  const completedTopicKeys = new Set(profile.topicKeys || []);
  const completedCategories = new Set((profile.categories || []).map((item) => item.code));
  const completedDirections = new Set((profile.directions || []).map((item) => normalizeText(item.name)));

  const topicKeyMatches = topics.filter((topic) => topic.key && completedTopicKeys.has(topic.key));
  const categoryMatches = topics.filter((topic) => topic.categoryCode && completedCategories.has(topic.categoryCode));
  const newRelatedTopics = topics.filter(
    (topic) => topic.categoryCode && completedCategories.has(topic.categoryCode) && !completedTopicKeys.has(topic.key),
  );
  const directionMatch = completedDirections.has(normalizeText(program.directionName));
  const fallbackTextMatch = !profile.topicKeys.length && scoreFallbackText(program, profile) > 0;
  const hasThematicLink = topicKeyMatches.length || fallbackTextMatch || (directionMatch && categoryMatches.length);
  if (!hasThematicLink) {
    return { score: 0, topicKeyMatches, categoryMatches, newRelatedTopics, depthSignals: [] };
  }

  const depthSignals = collectDepthSignals(program, topics, profile, ageYears);
  let score = 0;
  score += topicKeyMatches.length * 3;
  score += directionMatch ? categoryMatches.length * 4 : 0;
  score += Math.min(newRelatedTopics.length * 2, 8);
  if (directionMatch) score += 3;
  if (fallbackTextMatch) score += 2;
  score += scoreCriteriaProgramMatch(program, criteria);
  score += depthSignals.length * 2;
  if (!depthSignals.length && topicKeyMatches.length && !newRelatedTopics.length) score -= 4;
  if (topics.length) score += 1;

  return {
    score,
    topicKeyMatches,
    categoryMatches,
    newRelatedTopics,
    depthSignals,
  };
}

function scoreCandidateForNewInterests(program, topics, profile, ageYears, criteria = {}) {
  const completedLevel2Keys = new Set(profile.categoryKeys || []);
  for (const category of profile.categories || []) {
    for (const key of topicClassifierKeys(category.code, category.name)) {
      completedLevel2Keys.add(key);
    }
  }
  const completedLevel1Keys = new Set(profile.parentCategoryKeys || []);
  const meaningfulTopics = (topics || []).filter(hasMeaningfulClassifierTopic);
  const repeatedLevel2Topics = meaningfulTopics.filter((topic) => topicMatchesAnyKey(topic, completedLevel2Keys, "level2"));
  if (repeatedLevel2Topics.length) {
    return {
      score: 0,
      topicKeyMatches: [],
      categoryMatches: repeatedLevel2Topics,
      newRelatedTopics: [],
      depthSignals: [],
      noveltySignals: [],
    };
  }

  if (!meaningfulTopics.length) {
    return {
      score: 0,
      topicKeyMatches: [],
      categoryMatches: [],
      newRelatedTopics: [],
      depthSignals: [],
      noveltySignals: [],
    };
  }

  const sameLevel1Topics = meaningfulTopics.filter((topic) => topicMatchesAnyKey(topic, completedLevel1Keys, "level1"));
  const differentLevel1Topics = meaningfulTopics.filter((topic) => !topicMatchesAnyKey(topic, completedLevel1Keys, "level1"));
  const newRelatedTopics = uniqueBy(meaningfulTopics, (topic) => formatTopicClassifierPath(topic) || topic.name);
  const noveltySignals = [];
  if (differentLevel1Topics.length) {
    noveltySignals.push("добавляет новый раздел тем");
  }
  if (!sameLevel1Topics.length) {
    noveltySignals.push("не повторяет изученные темы по классификатору");
  } else {
    noveltySignals.push("не повторяет конкретные изученные темы");
  }

  const depthSignals = collectDepthSignals(program, topics, profile, ageYears);
  let score = 0;
  score += Math.min(differentLevel1Topics.length * 4, 16);
  score += Math.min(sameLevel1Topics.length * 2, 6);
  score += Math.min(meaningfulTopics.length, 6);
  score += scoreCriteriaProgramMatch(program, criteria);
  score += Math.min(depthSignals.length, 2);
  if (sameLevel1Topics.length) score -= Math.min(sameLevel1Topics.length * 2, 8);

  return {
    score: Math.max(0, score),
    topicKeyMatches: [],
    categoryMatches: [],
    newRelatedTopics,
    depthSignals,
    noveltySignals,
  };
}

function collectDepthSignals(program, topics, profile, ageYears) {
  const signals = [];
  const combinedText = normalizeText([
    program.name,
    program.annotation,
    program.task,
    program.directionName,
    ...program.keywords,
    ...topics.map((topic) => topic.name),
  ].join(" "));

  if (ADVANCED_TOPIC_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    signals.push("продвинутые темы или проектная работа");
  }

  const minAge = monthsToYears(program.ageMinMonths);
  if (minAge != null && Number(ageYears) >= minAge && minAge >= Number(ageYears) - 1) {
    signals.push("рассчитана на текущий или более старший возраст");
  }

  const hoursTotal = topics.reduce((sum, topic) => sum + Number(topic.hoursTotal || 0), 0);
  if (profile.averageHours && topics.length && hoursTotal / topics.length > profile.averageHours * 1.15) {
    signals.push("больший объем часов по связанным темам");
  }

  const practiceHours = topics.reduce((sum, topic) => sum + Number(topic.hoursPractice || 0), 0);
  if (practiceHours > 0 && practiceHours >= hoursTotal * 0.4) {
    signals.push("заметная практическая часть");
  }

  return [...new Set(signals)];
}

function scoreCriteriaProgramMatch(program, criteria = {}) {
  let score = 0;
  if (criteria.directionLabel && normalizeText(program.directionName).includes(normalizeText(criteria.directionLabel))) {
    score += 4;
  }
  if (criteria.direction && normalizeText(program.directionName).includes(normalizeText(directionLabel(criteria.direction)))) {
    score += 4;
  }
  if (criteria.interestsText && scoreFallbackText(program, {
    directions: [],
    topicNames: [criteria.interestsText],
  }) > 0) {
    score += 2;
  }
  return score;
}

function normalizeSearchCriteria(criteriaState) {
  const fields = criteriaState?.fields || criteriaState || {};
  return {
    ageYears: nullableNumber(fields.ageYears) || ageBucketToYears(fields.age),
    ageText: fields.ageText || "",
    place: fields.place || "",
    budget: fields.budget || fields.cost || "",
    scheduleText: fields.scheduleText || scheduleValuesToText(fields.schedule),
    schedule: Array.isArray(fields.schedule) ? fields.schedule : [],
    formatLabel: fields.formatLabel || "",
    direction: fields.direction || null,
    directionLabel: fields.directionLabel || "",
    interestsText: fields.interestsText || "",
    avoidanceLabels: fields.avoidanceLabels || [],
  };
}

function ageBucketToYears(value) {
  const map = {
    "3-4": 4,
    "5-6": 6,
    "7-9": 8,
    "10-12": 11,
    "13+": 13,
  };
  return map[value] || null;
}

function scheduleValuesToText(values) {
  const labels = {
    weekdays: "будни",
    weekends: "выходные",
    morning: "утром",
    evening: "вечером",
    any: "",
  };
  return (values || []).map((value) => labels[value]).filter(Boolean).join(", ");
}

function directionLabel(value) {
  const labels = {
    technical: "Техническая",
    art: "Художественная",
    sport: "Физкультурно-спортивная",
    social: "Социально-гуманитарная",
    science: "Естественно-научная",
    tourism: "Туристско-краеведческая",
    any: "",
  };
  return labels[value] || "";
}

async function resolveSearchContext(state, criteria = {}) {
  const defaultMunicipalityId = nullableNumber(state.municipalityId);
  let municipalityId = defaultMunicipalityId;
  let municipalityName = state.municipalityName || "";
  if (criteria.place) {
    const municipality = await findMunicipalityByName(criteria.place);
    if (municipality) {
      municipalityId = municipality.id;
      municipalityName = municipality.name;
    }
  }

  const criteriaAgeYears = nullableNumber(criteria.ageYears);
  const stateAgeYears = nullableNumber(state.ageYears);
  const stateAgeRangeYears = normalizeAgeRangeYears(state.ageRangeYears);
  const ageRangeYears = criteriaAgeYears
    ? ageRangeFromYears(criteriaAgeYears)
    : stateAgeRangeYears || ageRangeFromYears(stateAgeYears);
  const ageYears = criteriaAgeYears || stateAgeYears || midpointAgeYears(ageRangeYears);
  return {
    municipalityId,
    municipalityName,
    ageYears,
    ageRangeYears,
    criteria,
  };
}

async function findMunicipalityByName(place) {
  const value = normalizeText(place).trim();
  if (!value) return null;
  const municipalities = await getMunicipalities();
  return municipalities.find((item) => normalizeText(item.name) === value) ||
    municipalities.find((item) => value.includes(normalizeText(item.name)) || normalizeText(item.name).includes(value)) ||
    null;
}

async function getProgramDetailSafe(programId) {
  try {
    return await getProgramDetail(programId);
  } catch (_) {
    return null;
  }
}

function normalizeRecommendationItem(item, detail, criteria = {}, options = {}) {
  const recommendationMode = normalizeRecommendationMode(options.recommendationMode);
  const hasDetail = Boolean(detail);
  const program = detail?.program || {};
  const groups = detail?.available_groups || [];
  const bestGroup = chooseBestGroup(groups, criteria);
  const criteriaScore = scoreGroupCriteria(bestGroup, criteria);
  const relatedTopicNames = uniqueBy(
    [...item.topicKeyMatches, ...item.categoryMatches].map(formatTopicClassifierPath).filter(Boolean),
    (name) => normalizeText(name),
  ).slice(0, 5);
  const newTopicNames = uniqueBy(
    item.newRelatedTopics.map(formatTopicClassifierPath).filter(Boolean),
    (name) => normalizeText(name),
  ).slice(0, 5);

  return {
    id: item.id,
    program: item.name,
    sourceUrl: item.sourceUrl || getProgramUrl(item.id),
    municipalityName: item.municipalityName,
    directionName: item.directionName,
    venue: detail?.organization?.name || item.organizationName || "Организация не указана",
    address: detail?.address?.name || item.addressName || "Адрес уточняется на карточке",
    district: detail?.address?.name || item.addressName || "Адрес уточняется на карточке",
    schedule: summarizeSchedule(bestGroup),
    price: summarizePrice(program, bestGroup),
    ageLabel: formatAgeRange(item.ageMinMonths, item.ageMaxMonths),
    period: item.durationString || UNKNOWN_SCHEDULE_LABEL,
    availableGroups: hasDetail ? groups.length : null,
    availablePlaces: hasDetail ? countFreePlaces(groups) : null,
    enrollment: item.enrollment,
    relatedTopics: relatedTopicNames,
    newTopics: newTopicNames,
    depthSignals: item.depthSignals,
    noveltySignals: item.noveltySignals || [],
    recommendationMode,
    score: item.score + criteriaScore,
  };
}

function buildDeepTrajectoryResultMessage(analysis, state, result, options = {}) {
  const linkFormat = options.linkFormat || "plain";
  const display = (value) => formatDisplayText(value, linkFormat);
  const recommendationMode = normalizeRecommendationMode(result.recommendationMode || state.recommendationMode);
  if (!result.items.length) {
    return DEEP_TRAJECTORY_NO_RESULTS_MESSAGE;
  }

  if (recommendationMode === "wide") {
    return buildNewInterestsResultMessage(result, { linkFormat });
  }

  const lines = ["Вот программы, которые выглядят как следующий шаг:", ""];
  result.items.forEach((item, index) => {
    const related = item.relatedTopics.length
      ? item.relatedTopics.map(display).join(", ")
      : "похожа по направлению и описанию программы";
    const deeper = [...item.newTopics, ...item.depthSignals].slice(0, 5).map(display);
    lines.push(
      formatProgramTitle(item, index, linkFormat),
      "",
      "Почему это следующий шаг:",
      `продолжает направления: ${related}`,
      `углубляет за счет: ${deeper.length ? deeper.join(", ") : "более продвинутого тематического профиля"}`,
      "",
      `Где: ${display(item.venue)}, ${display(item.address)}`,
      `Когда: ${display(item.schedule)}`,
      `Возраст: ${display(item.ageLabel)}`,
      `Стоимость: ${display(item.price || UNKNOWN_PRICE_LABEL)}`,
      `Онлайн-запись: ${display(item.sourceUrl)}`,
      "",
    );
  });

  return lines.join("\n");
}

function buildNewInterestsResultMessage(result, options = {}) {
  const linkFormat = options.linkFormat || "plain";
  const display = (value) => formatDisplayText(value, linkFormat);
  const lines = ["Вот программы по новым направлениям:", ""];

  result.items.forEach((item, index) => {
    const newTopics = item.newTopics.length
      ? item.newTopics.slice(0, 5).map(display).join(", ")
      : "темы не повторяют изученное по классификатору";
    const novelty = item.noveltySignals?.length
      ? item.noveltySignals.slice(0, 3).map(display).join(", ")
      : "не пересекается с уже изученными темами";
    lines.push(
      formatProgramTitle(item, index, linkFormat),
      "",
      "Почему это новое направление:",
      `новые темы: ${newTopics}`,
      `отличие: ${novelty}`,
      "",
      `Где: ${display(item.venue)}, ${display(item.address)}`,
      `Когда: ${display(item.schedule)}`,
      `Возраст: ${display(item.ageLabel)}`,
      `Стоимость: ${display(item.price || UNKNOWN_PRICE_LABEL)}`,
      `Онлайн-запись: ${display(item.sourceUrl)}`,
      "",
    );
  });

  return lines.join("\n");
}

function buildCompletedProgramsReviewMessage(state, analysis, options = {}) {
  const linkFormat = options.linkFormat || "plain";
  const display = (value) => formatDisplayText(value, linkFormat);
  const programs = state.completedPrograms || analysis?.programs || [];
  const lines = ["Я собрал информацию по пройденным программам:", ""];

  if (state.missingProgramIds?.length) {
    lines.push(`Не нашел в локальном каталоге программы: ${state.missingProgramIds.map(display).join(", ")}.`, "");
  }

  programs.forEach((program, index) => {
    const topicSummary = shouldShowPendingTopics(program)
      ? "классификация тем еще готовится. Я уже нашел карточку программы в PFDO, темы появятся после обработки документа программы."
      : formatProgramTopicClassifications(program.topics, { linkFormat });
    lines.push(
      formatProgramTitle(program, index, linkFormat),
      "",
      "Что ребенок уже проходил:",
      topicSummary,
      "",
      `Населенный пункт: ${display(program.municipalityName || "не указан")}`,
      `Возраст: ${display(program.ageLabel || formatAgeRange(program.ageMinMonths, program.ageMaxMonths))}`,
      `Стоимость: ${display(program.price || UNKNOWN_PRICE_LABEL)}`,
      "",
    );
  });

  return lines.join("\n");
}

function buildCompletedProgramsTopicsMessage(state, analysis, options = {}) {
  const linkFormat = options.linkFormat || "plain";
  const programs = state.completedPrograms || analysis?.programs || [];
  const lines = ["Все темы по пройденным программам:", ""];

  programs.forEach((program, index) => {
    const topicsText = shouldShowPendingTopics(program)
      ? "Классификация тем еще готовится. Полный список появится после обработки документа программы."
      : formatProgramTopicClassifications(program.topics, { full: true, linkFormat });
    lines.push(
      formatProgramTitle(program, index, linkFormat),
      "",
      topicsText,
      "",
    );
  });

  return lines.join("\n").trim();
}

function buildScenario3PdfAnswers(state) {
  const criteria = normalizeSearchCriteria(state.criteria);
  const recommendationMode = normalizeRecommendationMode(state.recommendationMode);
  const profile = state.completedTopicProfile || createTopicProfile(state.completedPrograms || []);
  const interestLabels = profile.categoryLabels?.length
    ? profile.categoryLabels
    : profile.topicNames;
  const directions = (profile.directions || []).map((item) => item.name).filter(Boolean);
  const ageText = criteria.ageText ||
    formatAgeRangeYears(
      criteria.ageYears
        ? ageRangeFromYears(criteria.ageYears)
        : state.ageRangeYears || ageRangeFromYears(state.ageYears),
    ) ||
    (state.age ? `${state.age} лет` : "");
  return {
    ageText,
    age: "",
    interestsText: uniqueBy(interestLabels, (item) => normalizeText(item)).slice(0, 8).join(", "),
    interests: [],
    goal: recommendationMode === "wide" ? "new_interests" : "strengths",
    goalLabel: recommendationMode === "wide" ? "Найти новые интересы" : "Углубить пройденные темы",
    schedule: criteria.schedule || [],
    format: null,
    formatLabel: criteria.formatLabel || "Любой формат",
    place: criteria.place || state.municipalityName || "",
    cost: criteria.budget || "",
    wantsRefinement: Boolean(criteria.directionLabel || criteria.avoidanceLabels?.length),
    groupSizeLabel: "",
    avoidanceLabels: criteria.avoidanceLabels || [],
    avoidanceCustom: "",
    direction: criteria.direction || null,
    directionLabel: criteria.directionLabel || directions.join(", "),
  };
}

function buildScenario3PdfResult(result) {
  return {
    ...result,
    items: (result.items || []).map((item) => ({
      ...item,
      district: item.district || item.address || "Адрес уточняется на карточке",
      period: item.period || item.ageLabel || UNKNOWN_SCHEDULE_LABEL,
      availableGroups: item.availableGroups,
      availablePlaces: item.availablePlaces,
      enrollment: item.enrollment,
    })),
  };
}

function shouldShowPendingTopics(program) {
  return !program?.topics?.length && program?.topicsStatus && program.topicsStatus !== "ready";
}

function hasMeaningfulCompletedTopics(state, analysis = null) {
  const programs = state?.completedPrograms || analysis?.programs || [];
  return programs.some((program) => hasMeaningfulTopicClassifications(program.topics || []));
}

function hasMeaningfulTopicClassifications(topics) {
  return buildTopicClassifierGroups(topics).some((group) => !isGenericTopicGroup(group));
}

function isGenericTopicGroup(group) {
  return Boolean(group?.generic) || normalizeText(group?.parentName) === "прочее";
}

function formatProgramTopicClassifications(topics, options = {}) {
  const groups = buildTopicClassifierGroups(topics);
  const linkFormat = options.linkFormat || "plain";
  const display = (value) => formatDisplayText(value, linkFormat);
  if (!groups.length) return "категории тем не удалось надежно определить";

  const full = Boolean(options.full);
  const visibleGroups = full ? groups : groups.slice(0, TOPIC_SUMMARY_GROUP_LIMIT);
  const lines = [];
  let hiddenCount = groups
    .slice(visibleGroups.length)
    .reduce((sum, group) => sum + group.children.length, 0);

  for (const group of visibleGroups) {
    lines.push(display(group.parentName));
    const visibleChildren = full ? group.children : group.children.slice(0, TOPIC_SUMMARY_CATEGORY_LIMIT);
    hiddenCount += full ? 0 : Math.max(0, group.children.length - visibleChildren.length);
    for (const child of visibleChildren) {
      lines.push(`• ${display(child)}`);
    }
    if (!full && group.children.length > visibleChildren.length) {
      lines.push(`• еще ${group.children.length - visibleChildren.length}`);
    }
    lines.push("");
  }

  if (!full && hiddenCount > 0) {
    lines.push(`Еще ${hiddenCount} категорий не показано. Нажмите «Показать все темы», чтобы увидеть полный список.`);
  }

  return lines.join("\n").trim();
}

function formatTopicClassifierPath(topic) {
  if (!topic) return "";
  const parentName = cleanClassifierLabel(topic.parentName);
  const categoryName = cleanClassifierLabel(topic.categoryName);
  if (parentName && categoryName && normalizeText(parentName) !== normalizeText(categoryName)) {
    return `${parentName} / ${categoryName}`;
  }
  return categoryName || parentName;
}

function topicLevel2Keys(topic) {
  return topicClassifierKeys(topic?.categoryCode, topic?.categoryName);
}

function topicLevel1Keys(topic) {
  return topicClassifierKeys(topic?.parentCode, topic?.parentName);
}

function topicClassifierKeys(code, name) {
  const keys = [];
  const cleanCode = cleanClassifierLabel(code);
  const cleanName = cleanClassifierLabel(name);
  if (cleanName && isGenericClassifierLabel(cleanName)) {
    return keys;
  }
  if (cleanCode && !isGenericClassifierLabel(cleanCode)) {
    keys.push(`code:${normalizeText(cleanCode)}`);
  }
  if (cleanName && !isGenericClassifierLabel(cleanName)) {
    keys.push(`name:${normalizeText(cleanName)}`);
  }
  return keys;
}

function hasMeaningfulClassifierTopic(topic) {
  return topicLevel2Keys(topic).length > 0 || topicLevel1Keys(topic).length > 0;
}

function topicMatchesAnyKey(topic, keySet, level) {
  if (!keySet?.size) return false;
  const keys = level === "level1" ? topicLevel1Keys(topic) : topicLevel2Keys(topic);
  return keys.some((key) => keySet.has(key));
}

function buildTopicClassifierGroups(topics) {
  const groups = new Map();
  for (const topic of topics || []) {
    const rawParentName = cleanClassifierLabel(topic.parentName);
    const rawCategoryName = cleanClassifierLabel(topic.categoryName);
    if (!rawParentName && !rawCategoryName) continue;

    const parentGeneric = isGenericClassifierLabel(rawParentName);
    const categoryGeneric = isGenericClassifierLabel(rawCategoryName);
    const parentName = parentGeneric || !rawParentName ? "Прочее" : rawParentName;
    const categoryName = categoryGeneric || !rawCategoryName ? "Без категории" : rawCategoryName;
    const generic = parentGeneric || parentName === "Прочее";
    const key = normalizeText(parentName);

    if (!groups.has(key)) {
      groups.set(key, {
        parentName,
        generic,
        children: [],
        childKeys: new Set(),
      });
    }

    const group = groups.get(key);
    const childKey = normalizeText(categoryName);
    if (!group.childKeys.has(childKey)) {
      group.childKeys.add(childKey);
      group.children.push(categoryName);
    }
  }

  return [...groups.values()]
    .sort((left, right) => Number(left.generic) - Number(right.generic))
    .map(({ childKeys, ...group }) => group);
}

function formatProgramTitle(program, index, linkFormat = "plain") {
  const name = program.program || program.name || "Программа";
  const url = program.sourceUrl || (program.id ? getProgramUrl(Number(program.id)) : "");
  const number = `${index + 1}.`;
  if (!url) return `${number} ${formatDisplayText(name, linkFormat)}`;
  if (linkFormat === "html") {
    return `${number} <a href="${escapeHtmlAttribute(url)}">${escapeHtml(name)}</a>`;
  }
  if (linkFormat === "markdown") {
    return `${number} [${escapeMarkdownLinkText(name)}](${url})`;
  }
  return `${number} ${name}`;
}

function cleanClassifierLabel(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const normalized = normalizeText(text);
  if (!text || normalized === "unknown" || normalized === "unknown_content") return "";
  return text;
}

function isGenericClassifierLabel(value) {
  const normalized = normalizeText(value);
  return normalized === "предметные темы без категории" ||
    normalized === "предметная тема без категории" ||
    normalized === "прочее" ||
    normalized === "без категории";
}

function formatDisplayText(value, linkFormat = "plain") {
  const text = String(value ?? "");
  return linkFormat === "html" ? escapeHtml(text) : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeMarkdownLinkText(value) {
  return String(value ?? "").replace(/[[\]\\]/g, "\\$&");
}

function buildMunicipalityKeyboard(municipalities) {
  return {
    inline_keyboard: [
      ...municipalities.map((item) => [
        { text: item.name, callback_data: `s3:municipality:${item.id}` },
      ]),
      [{ text: "Другой населенный пункт", callback_data: "s3:municipality:custom" }],
    ],
  };
}

function explainNoCandidates() {
  return DEEP_TRAJECTORY_NO_RESULTS_MESSAGE;
}

function chooseBestGroup(groups, criteria = {}) {
  if (!Array.isArray(groups) || !groups.length) return null;
  return [...groups].sort((a, b) => scoreGroupChoice(b, criteria) - scoreGroupChoice(a, criteria))[0];
}

function scoreGroupChoice(group, criteria = {}) {
  let score = 0;
  const freePlaces = Number(group?.free_places_counter);
  if (Number.isFinite(freePlaces) && freePlaces > 0) score += 3;
  score += scoreGroupCriteria(group, criteria);
  return score;
}

function scoreGroupCriteria(group, criteria = {}) {
  if (!group) return 0;
  let score = 0;
  if (criteria.budget) {
    const budgetValue = extractPriceAmount(criteria.budget);
    const priceValue = extractPriceAmount(group.period_price);
    if (budgetValue != null && priceValue != null) {
      if (priceValue <= budgetValue) score += 3;
      else if (priceValue <= budgetValue * 1.25) score -= 1;
      else score -= 4;
    }
  }
  if (criteria.scheduleText) {
    score += scoreGroupSchedule(group, criteria.scheduleText);
  }
  return score;
}

function scoreGroupSchedule(group, scheduleText) {
  const normalized = normalizeText(scheduleText);
  if (!normalized) return 0;
  const days = collectGroupDays(group);
  const wantsWeekend = normalized.includes("выход") || normalized.includes("суб") || normalized.includes("воск");
  const wantsWeekday = normalized.includes("буд");
  const wantsEvening = normalized.includes("веч");
  const wantsMorning = normalized.includes("утр");
  const firstHour = getEarliestGroupHour(group);
  let score = 0;
  if (wantsWeekend) score += days.some((day) => day === "saturday" || day === "sunday") ? 2 : -2;
  if (wantsWeekday) score += days.some((day) => !["saturday", "sunday"].includes(day)) ? 1 : -1;
  if (wantsEvening && firstHour != null) score += firstHour >= 17 ? 1 : -1;
  if (wantsMorning && firstHour != null) score += firstHour < 13 ? 1 : -1;
  return score;
}

function collectGroupDays(group) {
  const days = [];
  for (const period of group?.periods || []) {
    for (const dayKey of Object.keys(period.schedule || {})) {
      days.push(normalizeText(dayKey));
    }
  }
  return [...new Set(days)];
}

function getEarliestGroupHour(group) {
  const hours = [];
  for (const period of group?.periods || []) {
    for (const entries of Object.values(period.schedule || {})) {
      for (const entry of entries || []) {
        const match = String(entry.start_time || "").match(/(\d{1,2}):/);
        if (match) hours.push(Number(match[1]));
      }
    }
  }
  if (!hours.length) return null;
  return Math.min(...hours);
}

function countFreePlaces(groups) {
  return (groups || []).reduce((sum, group) => {
    const count = Number(group.free_places_counter);
    return sum + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);
}

function summarizeSchedule(group) {
  if (!group) return UNKNOWN_SCHEDULE_LABEL;
  const parts = [];
  const period = group.periods?.[0];
  if (period?.schedule) {
    const scheduleEntries = [];
    for (const [dayKey, entries] of Object.entries(period.schedule)) {
      const firstEntry = entries?.[0];
      if (!firstEntry) continue;
      scheduleEntries.push(`${shortWeekday(firstEntry.week_day || dayKey)} ${firstEntry.start_time || ""}`.trim());
    }
    if (scheduleEntries.length) parts.push(scheduleEntries.slice(0, 3).join(", "));
  }
  if (!parts.length) return UNKNOWN_SCHEDULE_LABEL;
  if (Number.isFinite(group.free_places_counter)) {
    parts.push(`свободных мест: ${group.free_places_counter}`);
  }
  return parts.join(" | ");
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
  return UNKNOWN_PRICE_LABEL;
}

function topEntries(map, limit) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
}

function topTopicNames(counts, hours, limit) {
  return [...counts.keys()]
    .sort((a, b) => {
      const countDiff = (counts.get(b) || 0) - (counts.get(a) || 0);
      if (countDiff) return countDiff;
      const hourDiff = (hours.get(b) || 0) - (hours.get(a) || 0);
      if (hourDiff) return hourDiff;
      return String(a).localeCompare(String(b));
    })
    .slice(0, limit);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function formatAgeRange(minMonths, maxMonths) {
  const min = monthsToYears(minMonths);
  const max = monthsToYears(maxMonths);
  if (min != null && max != null) return `${min}-${max} лет`;
  if (min != null) return `от ${min} лет`;
  if (max != null) return `до ${max} лет`;
  return "Возраст уточняется на карточке";
}

function formatAgeRangeYears(range) {
  const normalized = normalizeAgeRangeYears(range);
  if (!normalized) return "";
  if (normalized.min === normalized.max) return `${normalized.min} лет`;
  return `${normalized.min}-${normalized.max} лет`;
}

function normalizeAgeRangeYears(range) {
  if (!range) return null;
  const min = nullableNumber(range.min);
  const max = nullableNumber(range.max);
  if (min == null && max == null) return null;
  const normalizedMin = min ?? 3;
  const normalizedMax = max ?? 18;
  if (normalizedMin > normalizedMax) return null;
  return { min: normalizedMin, max: normalizedMax };
}

function ageRangeFromYears(ageYears) {
  const age = nullableNumber(ageYears);
  if (age == null) return null;
  return { min: age, max: age };
}

function midpointAgeYears(range) {
  const normalized = normalizeAgeRangeYears(range);
  if (!normalized) return null;
  return Math.round((normalized.min + normalized.max) / 2);
}

function monthsToYears(value) {
  const number = nullableNumber(value);
  if (number == null) return null;
  return Math.round(number / 12);
}

function scoreFallbackText(program, profile) {
  const haystack = normalizeText([program.name, program.annotation, program.task, program.directionName, ...program.keywords].join(" "));
  let score = 0;
  for (const direction of profile.directions || []) {
    if (haystack.includes(normalizeText(direction.name))) score += 1;
  }
  for (const topicName of profile.topicNames || []) {
    const words = normalizeText(topicName).split(/\s+/).filter((word) => word.length > 4);
    if (words.some((word) => haystack.includes(word))) score += 1;
  }
  return score;
}

function encodeTextSql(column) {
  return `replace(encode(convert_to(COALESCE(${column}, ''), 'UTF8'), 'base64'), E'\\n', '')`;
}

function decodeText(value) {
  if (!value) return "";
  return Buffer.from(value, "base64").toString("utf-8");
}

function decodeSafeJson(value) {
  if (!value) return null;
  try {
    return decodeJsonCell(value);
  } catch (error) {
    return null;
  }
}

function nullableNumber(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/ё/g, "е");
}

function extractPriceAmount(value) {
  if (value == null) return null;
  if (/бесплат/i.test(String(value))) return 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function formatPrice(value) {
  const amount = extractPriceAmount(value);
  if (amount == null) return String(value);
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ₽`;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

module.exports = {
  createScenario3State,
  analyzeCompletedProgramsFromText,
  analyzeCompletedProgramsFromIds,
  mergeScenario3Links,
  getDeepTrajectoryRecommendations,
  buildCompletedProgramsReviewMessage,
  buildCompletedProgramsTopicsMessage,
  buildDeepTrajectoryResultMessage,
  buildScenario3PdfAnswers,
  buildScenario3PdfResult,
  buildMunicipalityKeyboard,
  createTopicProfile,
  findMunicipalityByName,
  hasMeaningfulCompletedTopics,
  inferAgeRangeFromPrograms,
  scoreCandidateForNewInterests,
  formatAgeRangeYears,
  parsePfdoProgramLinks,
};
