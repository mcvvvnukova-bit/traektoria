const { execFileSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const path = require("path");

const databaseUrl =
  process.env.PFDO_MIRROR_DATABASE_URL ||
  "postgresql://localhost:5432/pfdo_51_mirror";

// Цвет закреплён за direction_id (стабильный набор направленностей ПФДО).
const sql = `
SELECT json_build_object(
  'generatedAt', to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', 'pfdo_51_mirror',
  'metric', 'programs_by_direction',
  'rule', 'Количество программ по направленности (pfdo_programs.direction_id -> pfdo_program_directions). Учитываются все программы с указанной направленностью.',
  'directions', (
    SELECT json_agg(row_to_json(t) ORDER BY t.count DESC)
    FROM (
      SELECT
        d.id AS direction_id,
        d.name AS label,
        COUNT(p.id)::int AS count,
        CASE d.id
          WHEN 3 THEN '#C9BCF5'
          WHEN 5 THEN '#A7D2FF'
          WHEN 7 THEN '#9FE9C9'
          WHEN 2 THEN '#B9C2FF'
          WHEN 4 THEN '#BFE3F7'
          WHEN 6 THEN '#E2DBF7'
          ELSE '#D9D3FF'
        END AS color
      FROM pfdo_programs p
      JOIN pfdo_program_directions d ON d.id = p.direction_id
      GROUP BY d.id, d.name
    ) t
  )
);
`;

const rawJson = execFileSync("psql", [databaseUrl, "-Atc", sql], {
  encoding: "utf8",
});

const payload = JSON.parse(rawJson);
const outputDir = path.join(__dirname, "..", "landing", "assets");
const outputPath = path.join(outputDir, "direction-stats.json");

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

process.stdout.write(`Updated ${outputPath}\n`);
