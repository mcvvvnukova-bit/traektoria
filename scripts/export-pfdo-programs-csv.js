const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { loadEnvFile } = require("../src/load-env");

loadEnvFile();

const execFileAsync = promisify(execFile);
const DEFAULT_PSQL_BIN = `${os.homedir()}/Applications/Postgres.app/Contents/Versions/latest/bin/psql`;
const PSQL_BIN = process.env.PSQL_BIN || DEFAULT_PSQL_BIN;
const DATABASE_URL =
  process.env.PFDO_MIRROR_DATABASE_URL || "postgresql://localhost:5432/pfdo_51_mirror";
const outputPath = path.resolve(
  __dirname,
  "..",
  "exports",
  process.env.PFDO_PROGRAMS_CSV_FILENAME || "pfdo_51_programs_export.csv",
);

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const { stdout } = await execFileAsync(
    PSQL_BIN,
    [DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-c", buildExportSql()],
    { maxBuffer: 256 * 1024 * 1024 },
  );

  await fs.writeFile(outputPath, stdout, "utf-8");
  const stats = await fs.stat(outputPath);
  console.log(
    JSON.stringify(
      {
        outputPath,
        bytes: stats.size,
      },
      null,
      2,
    ),
  );
}

function buildExportSql() {
  return `
COPY (
  WITH activity_agg AS (
    SELECT
      p.id AS program_id,
      COALESCE(
        (
          SELECT string_agg(
            COALESCE(activity_item ->> 'name', trim(both '"' from activity_item::text)),
            '; ' ORDER BY COALESCE(activity_item ->> 'name', trim(both '"' from activity_item::text))
          )
          FROM jsonb_array_elements(COALESCE(p.detail_payload -> 'activity', '[]'::jsonb)) AS activity_item
        ),
        ''
      ) AS activity_names
    FROM pfdo_programs p
  ),
  registry_agg AS (
    SELECT
      program_id,
      string_agg(name, '; ' ORDER BY registry_value) FILTER (WHERE name IS NOT NULL) AS registry_names
    FROM pfdo_program_registry_entries
    GROUP BY program_id
  ),
  keyword_agg AS (
    SELECT
      l.program_id,
      string_agg(k.name, '; ' ORDER BY k.name) AS keyword_names
    FROM pfdo_program_keyword_links l
    JOIN pfdo_program_keywords k ON k.id = l.keyword_id
    GROUP BY l.program_id
  ),
  module_agg AS (
    SELECT
      program_id,
      string_agg(name, '; ' ORDER BY id) AS module_names,
      min(NULLIF(price, '')) AS module_min_price_text,
      max(NULLIF(price, '')) AS module_max_price_text
    FROM pfdo_program_modules
    GROUP BY program_id
  ),
  group_agg AS (
    SELECT
      g.program_id,
      count(*) AS groups_count,
      count(se.id) AS schedule_entries_count,
      sum(COALESCE(g.free_places_counter, 0)) AS total_free_places,
      min(NULLIF(g.start_date, '')) AS first_group_start_date,
      max(NULLIF(g.end_date, '')) AS last_group_end_date
    FROM pfdo_program_groups g
    LEFT JOIN pfdo_group_schedule_entries se ON se.group_id = g.id
    GROUP BY g.program_id
  )
  SELECT
    p.id AS program_id,
    p.search_name AS program_name,
    p.full_name,
    p.short_name,
    p.kind AS program_kind_id,
    pk.name AS program_kind_name,
    p.edu_form AS education_form_id,
    ef.name AS education_form_name,
    p.need_medical_certificate AS medical_certificate_requirement_id,
    mcr.name AS medical_certificate_requirement_name,
    p.directory_level_id AS program_level_id,
    pl.name AS program_level_name,
    p.directory_program_document_id AS program_document_type_id,
    pdt.name AS program_document_type_name,
    d.name AS direction_name,
    p.municipality_id,
    mm.name AS municipality_name,
    o.id AS organization_id,
    o.name AS organization_name,
    o.phone AS organization_phone,
    a.id AS address_id,
    a.name AS address_name,
    a.lat AS latitude,
    a.lng AS longitude,
    p.age_group_min,
    p.age_group_max,
    p.duration_year,
    p.duration_month,
    p.duration_string,
    p.modules_count,
    p.enrollment,
    p.all_region,
    COALESCE(activity_agg.activity_names, '') AS activity_names,
    COALESCE(keyword_agg.keyword_names, '') AS keyword_names,
    COALESCE(registry_agg.registry_names, '') AS registry_names,
    COALESCE(module_agg.module_names, '') AS module_names,
    COALESCE(module_agg.module_min_price_text, '') AS module_min_price_text,
    COALESCE(module_agg.module_max_price_text, '') AS module_max_price_text,
    COALESCE(group_agg.groups_count, 0) AS groups_count,
    COALESCE(group_agg.schedule_entries_count, 0) AS schedule_entries_count,
    COALESCE(group_agg.total_free_places, 0) AS total_free_places,
    COALESCE(group_agg.first_group_start_date, '') AS first_group_start_date,
    COALESCE(group_agg.last_group_end_date, '') AS last_group_end_date,
    regexp_replace(COALESCE(p.annotation_html, ''), '<[^>]+>', ' ', 'g') AS annotation_text,
    regexp_replace(COALESCE(p.task_html, ''), '<[^>]+>', ' ', 'g') AS task_text,
    p.source_url
  FROM pfdo_programs p
  LEFT JOIN pfdo_program_kinds pk ON pk.id = p.kind
  LEFT JOIN pfdo_program_education_forms ef ON ef.id = p.edu_form
  LEFT JOIN pfdo_program_medical_certificate_requirements mcr ON mcr.id = p.need_medical_certificate
  LEFT JOIN pfdo_program_levels pl ON pl.id = p.directory_level_id
  LEFT JOIN pfdo_program_document_types pdt ON pdt.id = p.directory_program_document_id
  LEFT JOIN pfdo_program_directions d ON d.id = p.direction_id
  LEFT JOIN pfdo_main_municipalities mm ON mm.id = p.municipality_id
  LEFT JOIN pfdo_organizations o ON o.id = p.organization_id
  LEFT JOIN pfdo_addresses a ON a.id = (
    (p.detail_payload -> 'address' ->> 'id')::bigint
  )
  LEFT JOIN activity_agg ON activity_agg.program_id = p.id
  LEFT JOIN keyword_agg ON keyword_agg.program_id = p.id
  LEFT JOIN registry_agg ON registry_agg.program_id = p.id
  LEFT JOIN module_agg ON module_agg.program_id = p.id
  LEFT JOIN group_agg ON group_agg.program_id = p.id
  ORDER BY p.id
) TO STDOUT WITH (FORMAT CSV, HEADER, ENCODING 'UTF8');
`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
