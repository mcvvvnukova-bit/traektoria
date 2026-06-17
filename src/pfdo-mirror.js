const { queryRows, decodeJsonCell } = require("./db");

const PFDO_MIRROR_DATABASE_URL =
  process.env.PFDO_MIRROR_DATABASE_URL || "postgresql://localhost:5432/pfdo_51_mirror";

function getMirrorDatabaseUrl() {
  return PFDO_MIRROR_DATABASE_URL;
}

async function getMunicipalities() {
  const rows = await queryRows(
    `
    SELECT id, name
    FROM pfdo_main_municipalities
    ORDER BY name;
  `,
    getMirrorDatabaseUrl(),
  );

  return rows.map(([id, name]) => ({
    id: Number(id),
    name,
  }));
}

async function searchPrograms({ municipalityId }) {
  const where = municipalityId ? `WHERE p.municipality_id = ${Number(municipalityId)}` : "";
  const rows = await queryRows(
    `
    SELECT
      p.id,
      p.search_name,
      p.organization_name,
      p.age_group_min,
      p.age_group_max,
      p.duration_string,
      p.enrollment,
      p.all_region,
      p.municipality_id,
      p.direction_id,
      p.edu_form,
      ${encodeTextSql("ef.name")} AS edu_form_name_b64,
      p.directory_level_id,
      p.organization_id,
      ${encodeTextSql("p.annotation_html")} AS annotation_html_b64,
      ${encodeTextSql("p.task_html")} AS task_html_b64,
      replace(encode(convert_to(COALESCE(p.search_payload, '{}'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '') AS search_payload_b64,
      replace(encode(convert_to(COALESCE(keyword_agg.keyword_names, '[]'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '') AS keywords_b64,
      replace(encode(convert_to(jsonb_build_object('id', d.id, 'name', d.name)::text, 'UTF8'), 'base64'), E'\\n', '') AS direction_b64,
      replace(encode(convert_to(jsonb_build_object('id', a.id, 'name', a.name, 'lat', a.lat, 'lng', a.lng)::text, 'UTF8'), 'base64'), E'\\n', '') AS address_b64
    FROM pfdo_programs p
    LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
    LEFT JOIN pfdo_program_education_forms ef ON ef.id = p.edu_form
    LEFT JOIN pfdo_addresses a ON a.id = ((p.detail_payload -> 'address' ->> 'id')::bigint)
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(k.name ORDER BY k.name) AS keyword_names
      FROM pfdo_program_keyword_links l
      JOIN pfdo_program_keywords k ON k.id = l.keyword_id
      WHERE l.program_id = p.id
    ) keyword_agg ON TRUE
    ${where}
    ORDER BY p.id;
  `,
    getMirrorDatabaseUrl(),
  );

  return rows.map(
    ([
      id,
      searchName,
      organizationName,
      ageMin,
      ageMax,
      durationString,
      enrollment,
      allRegion,
      municipalityIdValue,
      directionId,
      eduForm,
      eduFormNameB64,
      directoryLevelId,
      organizationId,
      annotationHtmlB64,
      taskHtmlB64,
      searchPayloadB64,
      keywordsB64,
      directionB64,
      addressB64,
    ]) => {
      const keywords = decodeSafeJson(keywordsB64) || [];
      return {
        id: Number(id),
        name: searchName,
        organization_name: organizationName,
        age_min: nullableNumber(ageMin),
        age_max: nullableNumber(ageMax),
        duration_string: durationString,
        enrollment: nullableNumber(enrollment),
        all_region: nullableNumber(allRegion),
        municipalityId: nullableNumber(municipalityIdValue),
        directionId: nullableNumber(directionId),
        eduForm: nullableNumber(eduForm),
        eduFormName: decodeText(eduFormNameB64),
        directoryLevelId: nullableNumber(directoryLevelId),
        organizationId: nullableNumber(organizationId),
        annotation: stripHtml(decodeText(annotationHtmlB64)),
        task: stripHtml(decodeText(taskHtmlB64)),
        keywords: Array.isArray(keywords) ? keywords : [],
        direction: decodeSafeJson(directionB64),
        address: decodeSafeJson(addressB64),
      };
    },
  );
}

async function getProgramScoringData(programIds) {
  const ids = [...new Set((programIds || []).map(Number).filter(Number.isFinite))];
  const result = new Map();
  for (const id of ids) {
    result.set(id, {
      modules: [],
      groups: [],
      topics: [],
      topicsKnown: true,
    });
  }
  if (!ids.length) return result;

  await Promise.all([
    loadScoringModules(ids, result),
    loadScoringGroups(ids, result),
    loadScoringTopics(ids, result),
  ]);

  return result;
}

async function loadScoringModules(ids, result) {
  const rows = await queryRows(
    `
    SELECT
      id,
      program_id,
      min_child_group,
      max_child_group,
      price,
      normative_price
    FROM pfdo_program_modules
    WHERE program_id IN (${ids.join(",")})
    ORDER BY program_id, id;
  `,
    getMirrorDatabaseUrl(),
  );

  for (const row of rows) {
    const programId = Number(row[1]);
    const entry = result.get(programId);
    if (!entry) continue;
    entry.modules.push({
      id: Number(row[0]),
      programId,
      min_child_group: nullableNumber(row[2]),
      max_child_group: nullableNumber(row[3]),
      price: row[4],
      normative_price: row[5],
    });
  }
}

async function loadScoringGroups(ids, result) {
  const rows = await queryRows(
    `
    SELECT
      g.id,
      g.program_id,
      g.organization_id,
      g.module_id,
      g.status,
      g.free_places_counter,
      g.period_price,
      g.recommended_min_age_for_enrollment,
      g.recommended_max_age_for_enrollment,
      se.period_hash,
      ${encodeTextSql("se.week_day")},
      ${encodeTextSql("se.start_time")},
      ${encodeTextSql("se.end_time")}
    FROM pfdo_program_groups g
    LEFT JOIN pfdo_group_schedule_entries se ON se.group_id = g.id
    WHERE g.program_id IN (${ids.join(",")})
    ORDER BY g.program_id, g.id, se.period_hash, se.id;
  `,
    getMirrorDatabaseUrl(),
  );

  const groupById = new Map();
  for (const row of rows) {
    const groupId = Number(row[0]);
    const programId = Number(row[1]);
    const entry = result.get(programId);
    if (!entry) continue;

    let group = groupById.get(groupId);
    if (!group) {
      group = {
        id: groupId,
        program_id: programId,
        organization_id: nullableNumber(row[2]),
        module_id: nullableNumber(row[3]),
        status: nullableNumber(row[4]),
        free_places_counter: nullableNumber(row[5]),
        period_price: row[6],
        recommended_min_age_for_enrollment: nullableNumber(row[7]),
        recommended_max_age_for_enrollment: nullableNumber(row[8]),
        periods: [],
      };
      groupById.set(groupId, group);
      entry.groups.push(group);
    }

    const periodHash = nullableNumber(row[9]);
    const weekDay = decodeText(row[10]);
    const startTime = decodeText(row[11]);
    const endTime = decodeText(row[12]);
    if (!periodHash && !weekDay && !startTime && !endTime) continue;

    let period = group.periods.find((item) => item.hash === periodHash);
    if (!period) {
      period = { hash: periodHash, schedule: {} };
      group.periods.push(period);
    }
    const dayKey = weekDay || "unknown";
    if (!period.schedule[dayKey]) period.schedule[dayKey] = [];
    period.schedule[dayKey].push({
      week_day: weekDay,
      start_time: startTime,
      end_time: endTime,
    });
  }
}

async function loadScoringTopics(ids, result) {
  const rows = await queryRows(
    `
    SELECT
      a.program_id,
      ${encodeTextSql("a.normalized_topic_name")},
      ${encodeTextSql("a.normalized_topic_key")},
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
    const programId = Number(row[0]);
    const entry = result.get(programId);
    if (!entry) continue;
    entry.topics.push({
      programId,
      name: decodeText(row[1]),
      key: decodeText(row[2]),
      hoursTotal: nullableNumber(row[3]) || 0,
      hoursTheory: nullableNumber(row[4]) || 0,
      hoursPractice: nullableNumber(row[5]) || 0,
      hoursControl: nullableNumber(row[6]) || 0,
      categoryCode: decodeText(row[7]),
      categoryName: decodeText(row[8]),
      parentCode: decodeText(row[9]),
      parentName: decodeText(row[10]),
      confidence: nullableNumber(row[11]) || 0,
    });
  }
}

async function getProgramDetail(programId) {
  const rows = await queryRows(
    `
    SELECT replace(encode(convert_to(detail_payload::text, 'UTF8'), 'base64'), E'\\n', '')
    FROM pfdo_programs
    WHERE id = ${Number(programId)}
    LIMIT 1;
  `,
    getMirrorDatabaseUrl(),
  );

  if (!rows.length) {
    throw new Error(`Mirror program not found: ${programId}`);
  }

  return decodeJsonCell(rows[0][0]);
}

async function checkMirrorHealth() {
  const rows = await queryRows(
    `
    SELECT count(*)
    FROM pfdo_programs;
  `,
    getMirrorDatabaseUrl(),
  );

  return Number(rows[0]?.[0] || 0) > 0;
}

function decodeSafeJson(cell) {
  if (!cell) return null;
  return decodeJsonCell(cell);
}

function encodeTextSql(column) {
  return `replace(encode(convert_to(COALESCE(${column}, ''), 'UTF8'), 'base64'), E'\\n', '')`;
}

function decodeText(value) {
  if (!value) return "";
  return Buffer.from(value, "base64").toString("utf-8");
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

module.exports = {
  getMirrorDatabaseUrl,
  getMunicipalities,
  searchPrograms,
  getProgramDetail,
  getProgramScoringData,
  checkMirrorHealth,
};
