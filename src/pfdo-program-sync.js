const path = require("node:path");
const { executeSql, executeSqlFile, queryRows } = require("./db");
const { fetchJson } = require("./pfdo");
const { getMirrorDatabaseUrl } = require("./pfdo-mirror");
const { getOperatorId } = require("./pfdo-config");
const {
  detailExpand,
  renderAddress,
  renderDirection,
  renderGroups,
  renderOrganization,
  renderProgram,
  renderProgramKeywords,
  renderProgramLinks,
  renderProgramModules,
  renderRawDocument,
  renderRegistryEntries,
} = require("../scripts/import-pfdo-mirror");
const {
  finishSyncRun,
  markProgramImported,
  recordProgramSyncError,
  startSyncRun,
} = require("./pfdo-sync-state");

const schemaPath = path.resolve(__dirname, "..", "db", "pfdo-mirror-schema.sql");

async function ensurePfdoProgramsImported(programIds, options = {}) {
  const ids = [...new Set((programIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) {
    return { runId: null, results: [] };
  }

  await executeSqlFile(schemaPath, getMirrorDatabaseUrl());

  const force = Boolean(options.force);
  const existingIds = force ? new Set() : await loadExistingProgramIds(ids);
  const missingIds = ids.filter((id) => !existingIds.has(id));
  if (!missingIds.length) {
    return {
      runId: null,
      results: ids.map((id) => ({ programId: id, status: "exists" })),
    };
  }

  const runId = await startSyncRun({
    runType: "on_demand_program",
    triggerSource: options.triggerSource || "manual",
    counters: {
      requested: ids.length,
      missing: missingIds.length,
    },
  });

  const results = ids
    .filter((id) => existingIds.has(id))
    .map((id) => ({ programId: id, status: "exists" }));
  let imported = 0;
  let failed = 0;

  for (const programId of missingIds) {
    try {
      const result = await importPfdoProgramById(programId, { runId });
      imported += 1;
      results.push(result);
    } catch (error) {
      failed += 1;
      await recordProgramSyncError(programId, error, { runId });
      results.push({
        programId,
        status: "failed",
        error: String(error?.message || error),
      });
    }
  }

  await finishSyncRun(runId, {
    status: failed ? "failed" : "succeeded",
    counters: {
      requested: ids.length,
      alreadyPresent: existingIds.size,
      imported,
      failed,
    },
    error: failed ? "Some on-demand PFDO programs failed to import" : "",
  });

  return { runId, results };
}

async function ensurePfdoProgramImported(programId, options = {}) {
  const { results } = await ensurePfdoProgramsImported([programId], options);
  return results[0] || { programId: Number(programId), status: "skipped" };
}

async function importPfdoProgramById(programId, { runId = null, searchItem = null } = {}) {
  const normalizedId = Number(programId);
  if (!Number.isFinite(normalizedId)) {
    throw new Error(`Invalid PFDO program id: ${programId}`);
  }

  const endpoint = `/public/programs/${normalizedId}?${detailExpand}`;
  const response = await fetchJson(endpoint);
  const detail = response.data || {};
  const normalizedSearchItem = normalizeSearchItem(normalizedId, detail, searchItem);
  const seenAddresses = new Set();
  const seenPedagogues = new Set();
  const sqlParts = [
    renderRawDocument(`public/programs/${normalizedId}`, endpoint, response),
    renderProgramChildCleanup(normalizedId),
  ];

  const direction = detail.direction || normalizedSearchItem.direction || null;
  const address = detail.address || normalizedSearchItem.address || null;
  const organization = detail.organization || null;
  if (direction?.id) sqlParts.push(renderDirection(direction));
  if (address?.id) {
    sqlParts.push(renderAddress(address));
    seenAddresses.add(address.id);
  }
  if (organization?.id) sqlParts.push(renderOrganization(organization));

  sqlParts.push(renderProgram(getOperatorId(), normalizedSearchItem, detail));
  sqlParts.push(renderProgramLinks(normalizedId, detail));
  sqlParts.push(renderProgramKeywords(normalizedId, detail.keywords || []));
  sqlParts.push(renderProgramModules(normalizedId, detail.modules || []));
  sqlParts.push(renderRegistryEntries(normalizedId, detail.registry || []));
  sqlParts.push(renderGroups(normalizedId, detail.available_groups || [], seenAddresses, seenPedagogues).sql);

  await executeSql(sqlParts.filter(Boolean).join("\n"), getMirrorDatabaseUrl());
  await markProgramImported(normalizedId, {
    runId,
    documentStatus: "pending",
    topicsStatus: "pending",
  });

  return {
    programId: normalizedId,
    status: "imported",
    name: normalizedSearchItem.name,
  };
}

async function loadExistingProgramIds(programIds) {
  const ids = (programIds || []).map(Number).filter(Number.isFinite);
  if (!ids.length) return new Set();
  const rows = await queryRows(
    `
    SELECT id
    FROM pfdo_programs
    WHERE id IN (${ids.join(", ")});
  `,
    getMirrorDatabaseUrl(),
  );
  return new Set(rows.map((row) => Number(row[0])));
}

function normalizeSearchItem(programId, detail, fallback = null) {
  const program = detail.program || {};
  const id = Number(program.id || detail.id || fallback?.id || programId);
  if (!Number.isFinite(id)) {
    throw new Error(`PFDO detail payload has no numeric program id: ${programId}`);
  }

  return {
    ...(fallback || {}),
    id,
    name: fallback?.name || program.short_name || program.full_name || detail.name || `Программа ${id}`,
    direction: detail.direction || fallback?.direction || null,
    address: detail.address || fallback?.address || null,
    duration_string: fallback?.duration_string || buildDurationString(program),
    organization_name: fallback?.organization_name || detail.organization?.name || "",
    all_region: fallback?.all_region ?? program.all_region ?? null,
    enrollment: fallback?.enrollment ?? program.enrollment ?? null,
    municipality_id: fallback?.municipality_id ?? program.mun ?? detail.mun ?? null,
  };
}

function buildDurationString(program) {
  const years = Number(program.duration_year || 0);
  const months = Number(program.duration_month || 0);
  const parts = [];
  if (years > 0) parts.push(formatRussianCount(years, ["год", "года", "лет"]));
  if (months > 0) parts.push(formatRussianCount(months, ["месяц", "месяца", "месяцев"]));
  return parts.join(" ");
}

function formatRussianCount(value, forms) {
  const number = Math.abs(Number(value));
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${forms[1]}`;
  return `${value} ${forms[2]}`;
}

function renderProgramChildCleanup(programId) {
  const id = Number(programId);
  return `
DELETE FROM pfdo_schedule_entry_pedagogues
WHERE schedule_entry_id IN (
  SELECT entry.id
  FROM pfdo_group_schedule_entries entry
  JOIN pfdo_program_groups group_item ON group_item.id = entry.group_id
  WHERE group_item.program_id = ${id}
);
DELETE FROM pfdo_group_schedule_entries
WHERE group_id IN (SELECT id FROM pfdo_program_groups WHERE program_id = ${id});
DELETE FROM pfdo_program_group_periods
WHERE group_id IN (SELECT id FROM pfdo_program_groups WHERE program_id = ${id});
DELETE FROM pfdo_group_addresses
WHERE group_id IN (SELECT id FROM pfdo_program_groups WHERE program_id = ${id});
DELETE FROM pfdo_program_groups WHERE program_id = ${id};
DELETE FROM pfdo_program_registry_entries WHERE program_id = ${id};
DELETE FROM pfdo_program_modules WHERE program_id = ${id};
DELETE FROM pfdo_program_activities WHERE program_id = ${id};
DELETE FROM pfdo_program_project_links WHERE program_id = ${id};
DELETE FROM pfdo_program_activity_links WHERE program_id = ${id};
DELETE FROM pfdo_program_keyword_links WHERE program_id = ${id};`;
}

module.exports = {
  ensurePfdoProgramImported,
  ensurePfdoProgramsImported,
  importPfdoProgramById,
  normalizeSearchItem,
};
