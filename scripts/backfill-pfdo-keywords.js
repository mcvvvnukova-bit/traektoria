const path = require("node:path");
const { loadEnvFile } = require("../src/load-env");

loadEnvFile();
if (process.env.PFDO_MIRROR_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PFDO_MIRROR_DATABASE_URL;
}

const { decodeJsonCell, executeSql, executeSqlFile, jsonToSql, queryRows, textToSql } = require("../src/db");
const { fetchJson } = require("../src/pfdo");

const schemaPath = path.resolve(__dirname, "..", "db", "pfdo-mirror-schema.sql");
const keywordExpand = new URLSearchParams({ expand: "keywords" }).toString();
const concurrency = Math.max(1, Number(process.env.PFDO_KEYWORDS_BACKFILL_CONCURRENCY || 8));

async function main() {
  await executeSqlFile(schemaPath);

  const programKeywordRows = await queryRows(`
    SELECT
      id,
      replace(encode(convert_to(COALESCE(search_payload -> 'keywords', '[]'::jsonb)::text, 'UTF8'), 'base64'), E'\\n', '')
    FROM pfdo_programs
    ORDER BY id;
  `);

  const programKeywordIds = programKeywordRows.map(([programId, keywordsB64]) => ({
    programId: Number(programId),
    keywordIds: (decodeJsonCell(keywordsB64) || []).map(Number).filter(Number.isFinite),
  }));

  const allKeywordIds = new Set();
  for (const item of programKeywordIds) {
    for (const keywordId of item.keywordIds) {
      allKeywordIds.add(keywordId);
    }
  }

  const existingRows = await queryRows(`
    SELECT
      id,
      name,
      replace(encode(convert_to(raw_payload::text, 'UTF8'), 'base64'), E'\\n', '')
    FROM pfdo_program_keywords
    ORDER BY id;
  `);
  const keywordsById = new Map(
    existingRows.map(([id, name, rawPayloadB64]) => [
      Number(id),
      { id: Number(id), name, raw_payload: decodeJsonCell(rawPayloadB64) || { id: Number(id), name } },
    ]),
  );
  const unresolved = new Set(
    [...allKeywordIds].filter((id) => !keywordsById.has(id) || keywordsById.get(id).raw_payload?.unresolved),
  );

  for (let start = 0; start < programKeywordIds.length && unresolved.size; start += concurrency) {
    const candidates = programKeywordIds
      .slice(start, start + concurrency)
      .filter((item) => item.keywordIds.some((keywordId) => unresolved.has(keywordId)));

    const results = await Promise.all(
      candidates.map(({ programId }) => fetchProgramKeywords(programId)),
    );

    for (const keywords of results) {
      for (const keyword of keywords) {
        if (!Number.isFinite(Number(keyword.id)) || !keyword.name) {
          continue;
        }
        const keywordId = Number(keyword.id);
        keywordsById.set(keywordId, { id: keywordId, name: keyword.name, raw_payload: keyword });
        unresolved.delete(keywordId);
      }
    }

    if ((start / concurrency + 1) % 25 === 0 || !unresolved.size) {
      console.log(`Resolved keywords: ${keywordsById.size}/${allKeywordIds.size}`);
    }
  }

  for (const keywordId of unresolved) {
    keywordsById.set(keywordId, {
      id: keywordId,
      name: `keyword:${keywordId}`,
      raw_payload: { id: keywordId, unresolved: true },
    });
  }

  await upsertKeywords([...keywordsById.values()].filter((keyword) => allKeywordIds.has(keyword.id)));
  await rebuildLinks(programKeywordIds);

  console.log(
    JSON.stringify(
      {
        programs: programKeywordIds.length,
        keywords: allKeywordIds.size,
        unresolved: unresolved.size,
      },
      null,
      2,
    ),
  );
}

async function fetchProgramKeywords(programId) {
  try {
    const response = await fetchJson(`/public/programs/${programId}?${keywordExpand}`);
    return response.data?.keywords || [];
  } catch (error) {
    console.warn(`Skipping program ${programId}: ${error.message}`);
    return [];
  }
}

async function upsertKeywords(keywords) {
  for (const batch of chunk(keywords, 500)) {
    const values = batch
      .map(
        (keyword) =>
          `(${keyword.id}, ${textToSql(keyword.name)}, ${jsonToSql(keyword.raw_payload || keyword)}, NOW())`,
      )
      .join(",\n");

    await executeSql(`
      INSERT INTO pfdo_program_keywords (id, name, raw_payload, imported_at)
      VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        raw_payload = EXCLUDED.raw_payload,
        imported_at = NOW();
    `);
  }
}

async function rebuildLinks(programKeywordIds) {
  await executeSql("TRUNCATE pfdo_program_keyword_links;");
  const links = [];

  for (const { programId, keywordIds } of programKeywordIds) {
    for (const keywordId of new Set(keywordIds)) {
      links.push({ programId, keywordId });
    }
  }

  for (const batch of chunk(links, 1000)) {
    const values = batch.map((link) => `(${link.programId}, ${link.keywordId})`).join(",\n");
    await executeSql(`
      INSERT INTO pfdo_program_keyword_links (program_id, keyword_id)
      VALUES ${values}
      ON CONFLICT (program_id, keyword_id) DO NOTHING;
    `);
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
