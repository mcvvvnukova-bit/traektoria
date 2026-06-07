const { queryRows, decodeJsonCell } = require("./db");
const { getMirrorDatabaseUrl, getProgramDetail } = require("./pfdo-mirror");
const { getProgramUrl } = require("./pfdo-config");

const MAX_COMPLETED_LINKS = 5;
const UNKNOWN_SCHEDULE_LABEL = "Уточните при записи";
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
    completedProgramIds: [],
    missingProgramIds: [],
    invalidLinks: [],
    completedPrograms: [],
    municipalityOptions: [],
    municipalityId: null,
    municipalityName: "",
    age: null,
    ageYears: null,
    completedTopicProfile: null,
    lastResult: null,
  };
}

async function analyzeCompletedProgramsFromText(text) {
  const parsed = parsePfdoProgramLinks(text);
  if (!parsed.programIds.length) {
    return {
      ...parsed,
      programs: [],
      missingProgramIds: [],
      municipalities: [],
      topicProfile: createTopicProfile([]),
      inferredAge: null,
      shouldAskAge: true,
    };
  }

  const programs = await loadProgramsByIds(parsed.programIds);
  const foundIds = new Set(programs.map((program) => Number(program.id)));
  const missingProgramIds = parsed.programIds.filter((id) => !foundIds.has(Number(id)));
  const topicMap = await loadTopicsForPrograms(programs.map((program) => program.id));
  const programsWithTopics = programs.map((program) => ({
    ...program,
    topics: topicMap.get(Number(program.id)) || [],
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
  const inferredAge = inferAgeFromPrograms(programsWithTopics);

  return {
    ...parsed,
    programs: programsWithTopics,
    missingProgramIds,
    municipalities,
    topicProfile: createTopicProfile(programsWithTopics),
    inferredAge,
    shouldAskAge: !inferredAge,
  };
}

async function getDeepTrajectoryRecommendations(state, options = {}) {
  const limit = options.limit || 10;
  const municipalityId = Number(state.municipalityId);
  const ageYears = Number(state.ageYears);
  if (!Number.isFinite(municipalityId)) {
    throw new Error("Missing municipality for deep trajectory");
  }
  if (!Number.isFinite(ageYears)) {
    throw new Error("Missing age for deep trajectory");
  }

  const completedIds = (state.completedProgramIds || []).map(Number).filter(Number.isFinite);
  const topicProfile = state.completedTopicProfile || createTopicProfile(state.completedPrograms || []);
  const candidates = await loadCandidatePrograms({ municipalityId, ageYears, excludeIds: completedIds });
  if (!candidates.length) {
    return {
      source: "mirror",
      confidence: "low",
      items: [],
      reason: "В выбранном населенном пункте не нашлось программ для этого возраста.",
      topicProfile,
    };
  }

  const topicMap = await loadTopicsForPrograms(candidates.map((program) => program.id));
  const ranked = candidates
    .map((program) => {
      const topics = topicMap.get(Number(program.id)) || [];
      return {
        ...program,
        topics,
        ...scoreCandidate(program, topics, topicProfile, ageYears),
      };
    })
    .filter((program) => program.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit * 2, 12));

  const detailed = [];
  for (const item of ranked.slice(0, limit)) {
    let detail = null;
    try {
      detail = await getProgramDetail(item.id);
    } catch (error) {
      detail = null;
    }
    detailed.push(normalizeRecommendationItem(item, detail));
  }

  return {
    source: "mirror",
    confidence: detailed.length >= 3 ? "medium" : "low",
    items: detailed,
    reason: detailed.length ? "" : explainNoCandidates(candidates, topicProfile),
    topicProfile,
  };
}

function parsePfdoProgramLinks(text) {
  const raw = String(text || "");
  const urlMatches = raw.match(/https?:\/\/[^\s<>()]+/gi) || [];
  const links = [];
  const invalidLinks = [];
  const ids = [];

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
  }

  return {
    links,
    invalidLinks,
    programIds: [...new Set(ids)].slice(0, MAX_COMPLETED_LINKS),
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

async function loadCandidatePrograms({ municipalityId, ageYears, excludeIds }) {
  const ageMonths = Number(ageYears) * 12;
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
      AND (p.age_group_min IS NULL OR p.age_group_min <= ${ageMonths})
      AND (p.age_group_max IS NULL OR p.age_group_max >= ${ageMonths})
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

function rowToProgram(row) {
  const keywords = decodeSafeJson(row[14]) || [];
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
    annotation: stripHtml(decodeText(row[12])),
    task: stripHtml(decodeText(row[13])),
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
    directions: topEntries(directionCounts, 6).map(([name, count]) => ({ name, count })),
    hoursTotal,
    topicRows,
    averageHours: topicRows ? hoursTotal / topicRows : 0,
  };
}

function inferAgeFromPrograms(programs) {
  const ranges = (programs || [])
    .map((program) => ({
      min: monthsToYears(program.ageMinMonths),
      max: monthsToYears(program.ageMaxMonths),
    }))
    .filter((range) => range.min != null || range.max != null);

  if (!ranges.length) return null;

  const intersectionMin = Math.max(...ranges.map((range) => range.min ?? 3));
  const intersectionMax = Math.min(...ranges.map((range) => range.max ?? 18));
  if (intersectionMin > intersectionMax) return null;
  if (intersectionMax - intersectionMin > 4) return null;

  return Math.round((intersectionMin + intersectionMax) / 2);
}

function scoreCandidate(program, topics, profile, ageYears) {
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

function normalizeRecommendationItem(item, detail) {
  const program = detail?.program || {};
  const groups = detail?.available_groups || [];
  const bestGroup = chooseBestGroup(groups);
  const relatedTopicNames = uniqueBy(
    [...item.topicKeyMatches, ...item.categoryMatches].map((topic) => topic.name).filter(Boolean),
    (name) => normalizeText(name),
  ).slice(0, 5);
  const newTopicNames = uniqueBy(
    item.newRelatedTopics.map((topic) => topic.name).filter(Boolean),
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
    schedule: summarizeSchedule(bestGroup),
    price: summarizePrice(program, bestGroup),
    ageLabel: formatAgeRange(item.ageMinMonths, item.ageMaxMonths),
    relatedTopics: relatedTopicNames,
    newTopics: newTopicNames,
    depthSignals: item.depthSignals,
    score: item.score,
  };
}

function buildDeepTrajectoryResultMessage(analysis, state, result) {
  const profile = result.topicProfile || state.completedTopicProfile || analysis?.topicProfile || createTopicProfile([]);
  const topicSummary = profile.topicNames.length
    ? profile.topicNames.slice(0, 8).join(", ")
    : "темы не удалось надежно распознать";
  const lines = [
    "Я нашел пройденные программы и определил основные темы:",
    topicSummary,
    "",
    `Буду искать продолжение в населенном пункте: ${state.municipalityName}.`,
    `Возраст: ${state.ageYears} лет.`,
    "",
  ];

  const missingProgramIds = analysis?.missingProgramIds || state.missingProgramIds || [];
  if (missingProgramIds.length) {
    lines.push(`Не нашел в базе программы: ${missingProgramIds.join(", ")}. Продолжаю по найденным ссылкам.`, "");
  }

  if (!result.items.length) {
    lines.push(
      result.reason || "Подходящих углубленных программ не нашлось.",
      "Можно попробовать другой населенный пункт или начать новый поиск через /start.",
    );
    return lines.join("\n");
  }

  lines.push("Вот программы, которые выглядят как следующий шаг:", "");
  result.items.forEach((item, index) => {
    const related = item.relatedTopics.length
      ? item.relatedTopics.join(", ")
      : "похожа по направлению и описанию программы";
    const deeper = [...item.newTopics, ...item.depthSignals].slice(0, 5);
    lines.push(
      `${index + 1}. ${item.program}`,
      "",
      "Почему это следующий шаг:",
      `продолжает темы: ${related}`,
      `углубляет за счет: ${deeper.length ? deeper.join(", ") : "более продвинутого тематического профиля"}`,
      "",
      `Где: ${item.venue}, ${item.address}`,
      `Когда: ${item.schedule}`,
      `Возраст: ${item.ageLabel}`,
      `Стоимость: ${item.price}`,
      `Онлайн-запись: ${item.sourceUrl}`,
      "",
    );
  });

  return lines.join("\n");
}

function buildMunicipalityKeyboard(municipalities) {
  return {
    inline_keyboard: municipalities.map((item) => [
      { text: item.name, callback_data: `s3:municipality:${item.id}` },
    ]),
  };
}

function explainNoCandidates(candidates, profile) {
  if (!candidates.length) return "В выбранном населенном пункте нет программ для указанного возраста.";
  if (!profile.topicKeys.length && !profile.categories.length) {
    return "У пройденных программ не нашлось распознанных тем, поэтому точный углубленный подбор невозможен.";
  }
  return "Есть программы для этого возраста, но они не выглядят как углубленное продолжение пройденных тем.";
}

function chooseBestGroup(groups) {
  if (!Array.isArray(groups) || !groups.length) return null;
  return groups.find((group) => Number(group.free_places_counter) > 0) || groups[0];
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
  if (program?.directory_program_document_id) return "Смотрите условия на карточке PFDO";
  return "Стоимость уточняется на карточке программы";
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
  getDeepTrajectoryRecommendations,
  buildDeepTrajectoryResultMessage,
  buildMunicipalityKeyboard,
  parsePfdoProgramLinks,
};
