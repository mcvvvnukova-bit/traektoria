const { execFileSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const path = require("path");

const databaseUrl =
  process.env.PFDO_MIRROR_DATABASE_URL ||
  "postgresql://localhost:5432/pfdo_51_mirror";

const sql = `
WITH price_per_program AS (
  SELECT
    p.id AS program_id,
    CASE
      WHEN COUNT(g.id) FILTER (WHERE COALESCE(btrim(g.period_price), '') <> '') = 0 THEN NULL
      ELSE MIN(NULLIF(regexp_replace(COALESCE(g.period_price, ''), '[^0-9]', '', 'g'), '')::numeric)
    END AS min_price
  FROM pfdo_programs p
  LEFT JOIN pfdo_program_groups g ON g.program_id = p.id
  GROUP BY p.id
)
SELECT json_build_object(
  'generatedAt', to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', 'pfdo_51_mirror',
  'metric', 'programs_by_min_group_period_price',
  'rule', 'Программа попадает в сегмент по минимальной известной стоимости среди ее групп. Если у программы нет ни одной указанной стоимости, она попадает в сегмент ''Стоимость не указана''. Бесплатные программы и программы с ценой 0 рублей считаются отдельным сегментом.',
  'segments', (
    SELECT json_agg(row_to_json(t) ORDER BY t.sort_order)
    FROM (
      SELECT 'no_price' AS key, 'Стоимость не указана' AS label, COUNT(*)::int AS count, 1 AS sort_order, '#BFC3CC' AS color
      FROM price_per_program
      WHERE min_price IS NULL
      UNION ALL
      SELECT 'free' AS key, 'Бесплатно' AS label, COUNT(*)::int AS count, 2 AS sort_order, '#63D1F8' AS color
      FROM price_per_program
      WHERE min_price = 0
      UNION ALL
      SELECT '1_5000' AS key, 'От 1 до 5 000 ₽' AS label, COUNT(*)::int AS count, 3 AS sort_order, '#68FDB6' AS color
      FROM price_per_program
      WHERE min_price BETWEEN 1 AND 5000
      UNION ALL
      SELECT '5001_10000' AS key, 'От 5 001 до 10 000 ₽' AS label, COUNT(*)::int AS count, 4 AS sort_order, '#8C9EFF' AS color
      FROM price_per_program
      WHERE min_price BETWEEN 5001 AND 10000
      UNION ALL
      SELECT '10001_plus' AS key, 'От 10 001 ₽' AS label, COUNT(*)::int AS count, 5 AS sort_order, '#5149E2' AS color
      FROM price_per_program
      WHERE min_price >= 10001
    ) t
  )
);
`;

const rawJson = execFileSync("psql", [databaseUrl, "-Atc", sql], {
  encoding: "utf8",
});

const payload = JSON.parse(rawJson);
const outputDir = path.join(__dirname, "..", "landing", "assets");
const outputPath = path.join(outputDir, "cost-stats.json");

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

process.stdout.write(`Updated ${outputPath}\n`);
