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
      replace(encode(convert_to(COALESCE(p.search_payload, '{}'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '') AS search_payload_b64,
      replace(encode(convert_to(COALESCE(keyword_agg.keyword_names, '[]'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '') AS keywords_b64,
      replace(encode(convert_to(jsonb_build_object('id', d.id, 'name', d.name)::text, 'UTF8'), 'base64'), E'\\n', '') AS direction_b64,
      replace(encode(convert_to(jsonb_build_object('id', a.id, 'name', a.name, 'lat', a.lat, 'lng', a.lng)::text, 'UTF8'), 'base64'), E'\\n', '') AS address_b64
    FROM pfdo_programs p
    LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
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
        keywords: Array.isArray(keywords) ? keywords : [],
        direction: decodeSafeJson(directionB64),
        address: decodeSafeJson(addressB64),
      };
    },
  );
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

function nullableNumber(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

module.exports = {
  getMirrorDatabaseUrl,
  getMunicipalities,
  searchPrograms,
  getProgramDetail,
  checkMirrorHealth,
};
