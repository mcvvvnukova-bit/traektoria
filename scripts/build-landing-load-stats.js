const { execFileSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const path = require("path");

const databaseUrl =
  process.env.PFDO_MIRROR_DATABASE_URL ||
  "postgresql://localhost:5432/pfdo_51_mirror";

// «Загруженность» = отношение общего числа программ к числу программ с открытой записью
// (enrollment = 1 — «идёт приём»). Считается по направленности.
const sql = `
SELECT json_build_object(
  'generatedAt', to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', 'pfdo_51_mirror',
  'metric', 'load_total_to_open_by_direction',
  'rule', 'Загруженность направленности = отношение общего числа программ к числу программ с открытой записью (enrollment = 1, «идёт приём»). Чем выше, тем меньше программ доступно для записи относительно общего числа.',
  'directions', (
    SELECT json_agg(row_to_json(t) ORDER BY t.ratio DESC)
    FROM (
      SELECT
        d.id AS direction_id,
        d.name AS label,
        COUNT(p.id)::int AS total,
        COUNT(p.id) FILTER (WHERE p.enrollment = 1)::int AS open,
        ROUND(
          COUNT(p.id)::numeric
          / NULLIF(COUNT(p.id) FILTER (WHERE p.enrollment = 1), 0),
          2
        ) AS ratio
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
const outputPath = path.join(outputDir, "load-stats.json");

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

process.stdout.write(`Updated ${outputPath}\n`);
