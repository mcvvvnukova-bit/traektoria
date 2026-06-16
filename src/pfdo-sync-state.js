const { queryRows, executeSql, jsonToSql, textToSql } = require("./db");
const { getMirrorDatabaseUrl } = require("./pfdo-mirror");

async function startSyncRun({ runType, triggerSource = "manual", counters = {} }) {
  const rows = await queryRows(
    `
    INSERT INTO pfdo_sync_runs (run_type, trigger_source, status, counters)
    VALUES (${textToSql(runType)}, ${textToSql(triggerSource)}, 'running', ${jsonToSql(counters)})
    RETURNING id;
  `,
    getMirrorDatabaseUrl(),
  );

  return Number(rows[0]?.[0]);
}

async function finishSyncRun(runId, { status = "succeeded", counters = {}, error = "" } = {}) {
  if (!Number.isFinite(Number(runId))) return;
  await executeSql(
    `
    UPDATE pfdo_sync_runs
    SET
      status = ${textToSql(status)},
      finished_at = NOW(),
      counters = ${jsonToSql(counters)},
      error_text = ${nullableText(error)}
    WHERE id = ${Number(runId)};
  `,
    getMirrorDatabaseUrl(),
  );
}

async function markFullCatalogImported({ runId = null } = {}) {
  await executeSql(
    `
    WITH current_programs AS (
      SELECT
        id AS program_id,
        md5(COALESCE(search_payload::text, '')) AS search_payload_hash,
        md5(COALESCE(detail_payload::text, '')) AS detail_payload_hash
      FROM pfdo_programs
    ),
    upserted AS (
      INSERT INTO pfdo_program_sync_state (
        program_id,
        catalog_status,
        first_seen_at,
        last_seen_at,
        last_catalog_missing_at,
        last_detail_imported_at,
        search_payload_hash,
        detail_payload_hash,
        document_status,
        topics_status,
        last_sync_run_id,
        last_error,
        updated_at
      )
      SELECT
        program_id,
        'active',
        NOW(),
        NOW(),
        NULL,
        NOW(),
        search_payload_hash,
        detail_payload_hash,
        'pending',
        'pending',
        ${nullableNumber(runId)},
        NULL,
        NOW()
      FROM current_programs
      ON CONFLICT (program_id) DO UPDATE SET
        catalog_status = 'active',
        last_seen_at = EXCLUDED.last_seen_at,
        last_catalog_missing_at = NULL,
        last_detail_imported_at = EXCLUDED.last_detail_imported_at,
        search_payload_hash = EXCLUDED.search_payload_hash,
        detail_payload_hash = EXCLUDED.detail_payload_hash,
        document_status = CASE
          WHEN pfdo_program_sync_state.detail_payload_hash IS DISTINCT FROM EXCLUDED.detail_payload_hash THEN 'pending'
          ELSE pfdo_program_sync_state.document_status
        END,
        topics_status = CASE
          WHEN pfdo_program_sync_state.detail_payload_hash IS DISTINCT FROM EXCLUDED.detail_payload_hash THEN 'pending'
          ELSE pfdo_program_sync_state.topics_status
        END,
        last_sync_run_id = EXCLUDED.last_sync_run_id,
        last_error = NULL,
        updated_at = NOW()
      RETURNING program_id
    )
    UPDATE pfdo_program_sync_state state
    SET
      catalog_status = 'missing',
      last_catalog_missing_at = NOW(),
      last_sync_run_id = ${nullableNumber(runId)},
      updated_at = NOW()
    WHERE state.catalog_status <> 'missing'
      AND NOT EXISTS (
        SELECT 1
        FROM current_programs current
        WHERE current.program_id = state.program_id
      );
  `,
    getMirrorDatabaseUrl(),
  );
}

async function markProgramImported(programId, { runId = null, documentStatus = "pending", topicsStatus = "pending" } = {}) {
  const normalizedId = Number(programId);
  if (!Number.isFinite(normalizedId)) {
    throw new Error(`Invalid PFDO program id: ${programId}`);
  }

  await executeSql(
    `
    INSERT INTO pfdo_program_sync_state (
      program_id,
      catalog_status,
      first_seen_at,
      last_seen_at,
      last_catalog_missing_at,
      last_detail_imported_at,
      search_payload_hash,
      detail_payload_hash,
      document_status,
      topics_status,
      last_sync_run_id,
      last_error,
      updated_at
    )
    SELECT
      p.id,
      'active',
      NOW(),
      NOW(),
      NULL,
      NOW(),
      md5(COALESCE(p.search_payload::text, '')),
      md5(COALESCE(p.detail_payload::text, '')),
      ${textToSql(documentStatus)},
      ${textToSql(topicsStatus)},
      ${nullableNumber(runId)},
      NULL,
      NOW()
    FROM pfdo_programs p
    WHERE p.id = ${normalizedId}
    ON CONFLICT (program_id) DO UPDATE SET
      catalog_status = 'active',
      last_seen_at = EXCLUDED.last_seen_at,
      last_catalog_missing_at = NULL,
      last_detail_imported_at = EXCLUDED.last_detail_imported_at,
      search_payload_hash = EXCLUDED.search_payload_hash,
      detail_payload_hash = EXCLUDED.detail_payload_hash,
      document_status = CASE
        WHEN pfdo_program_sync_state.detail_payload_hash IS DISTINCT FROM EXCLUDED.detail_payload_hash THEN EXCLUDED.document_status
        ELSE pfdo_program_sync_state.document_status
      END,
      topics_status = CASE
        WHEN pfdo_program_sync_state.detail_payload_hash IS DISTINCT FROM EXCLUDED.detail_payload_hash THEN EXCLUDED.topics_status
        ELSE pfdo_program_sync_state.topics_status
      END,
      last_sync_run_id = EXCLUDED.last_sync_run_id,
      last_error = NULL,
      updated_at = NOW();
  `,
    getMirrorDatabaseUrl(),
  );
}

async function recordProgramSyncError(programId, error, { runId = null } = {}) {
  const normalizedId = Number(programId);
  if (!Number.isFinite(normalizedId)) return;
  await executeSql(
    `
    INSERT INTO pfdo_program_sync_state (
      program_id,
      catalog_status,
      first_seen_at,
      document_status,
      topics_status,
      last_sync_run_id,
      last_error,
      updated_at
    )
    VALUES (
      ${normalizedId},
      'missing',
      NOW(),
      'error',
      'error',
      ${nullableNumber(runId)},
      ${nullableText(normalizeError(error))},
      NOW()
    )
    ON CONFLICT (program_id) DO UPDATE SET
      document_status = 'error',
      topics_status = 'error',
      last_sync_run_id = EXCLUDED.last_sync_run_id,
      last_error = EXCLUDED.last_error,
      updated_at = NOW();
  `,
    getMirrorDatabaseUrl(),
  );
}

async function refreshProgramProcessingStatuses({ programIds = [], runId = null } = {}) {
  const ids = (programIds || []).map(Number).filter(Number.isFinite);
  const filter = ids.length ? `AND p.id IN (${ids.join(", ")})` : "";

  await executeSql(
    `
    WITH topic_counts AS (
      SELECT program_id, count(*) AS topic_rows
      FROM pfdo_program_calendar_topics
      GROUP BY program_id
    ),
    aggregate_counts AS (
      SELECT program_id, count(*) AS aggregate_rows
      FROM pfdo_program_topic_aggregates
      GROUP BY program_id
    )
    UPDATE pfdo_program_sync_state state
    SET
      document_status = CASE
        WHEN NULLIF(p.program_document_url, '') IS NULL THEN 'missing'
        WHEN p.program_document_download_error IS NOT NULL THEN 'error'
        WHEN p.program_document_local_path IS NOT NULL THEN 'ready'
        ELSE state.document_status
      END,
      topics_status = CASE
        WHEN COALESCE(topic_counts.topic_rows, 0) > 0
          AND COALESCE(aggregate_counts.aggregate_rows, 0) > 0 THEN 'ready'
        WHEN NULLIF(p.program_document_url, '') IS NULL THEN 'missing'
        WHEN p.program_document_download_error IS NOT NULL THEN 'error'
        ELSE state.topics_status
      END,
      last_document_processed_at = CASE
        WHEN p.program_document_downloaded_at IS NOT NULL THEN p.program_document_downloaded_at
        WHEN p.program_document_download_error IS NOT NULL THEN NOW()
        ELSE state.last_document_processed_at
      END,
      last_topics_processed_at = CASE
        WHEN COALESCE(topic_counts.topic_rows, 0) > 0 THEN NOW()
        ELSE state.last_topics_processed_at
      END,
      last_sync_run_id = COALESCE(${nullableNumber(runId)}, state.last_sync_run_id),
      last_error = CASE
        WHEN p.program_document_download_error IS NOT NULL THEN p.program_document_download_error
        ELSE state.last_error
      END,
      updated_at = NOW()
    FROM pfdo_programs p
    LEFT JOIN topic_counts ON topic_counts.program_id = p.id
    LEFT JOIN aggregate_counts ON aggregate_counts.program_id = p.id
    WHERE state.program_id = p.id
      ${filter};
  `,
    getMirrorDatabaseUrl(),
  );
}

async function loadProgramSyncStates(programIds) {
  const ids = (programIds || []).map(Number).filter(Number.isFinite);
  if (!ids.length) return new Map();

  const rows = await queryRows(
    `
    SELECT
      program_id,
      catalog_status,
      document_status,
      topics_status,
      COALESCE(last_error, '')
    FROM pfdo_program_sync_state
    WHERE program_id IN (${ids.join(", ")});
  `,
    getMirrorDatabaseUrl(),
  );

  return new Map(rows.map((row) => [
    Number(row[0]),
    {
      programId: Number(row[0]),
      catalogStatus: row[1],
      documentStatus: row[2],
      topicsStatus: row[3],
      lastError: row[4],
    },
  ]));
}

async function loadSyncCounters() {
  const rows = await queryRows(
    `
    SELECT
      (SELECT count(*) FROM pfdo_programs),
      (SELECT count(*) FROM pfdo_program_sync_state WHERE catalog_status = 'active'),
      (SELECT count(*) FROM pfdo_program_sync_state WHERE catalog_status = 'missing'),
      (SELECT count(*) FROM pfdo_program_sync_state WHERE document_status = 'ready'),
      (SELECT count(*) FROM pfdo_program_sync_state WHERE topics_status = 'ready');
  `,
    getMirrorDatabaseUrl(),
  );

  const row = rows[0] || [];
  return {
    programs: Number(row[0] || 0),
    activeStates: Number(row[1] || 0),
    missingStates: Number(row[2] || 0),
    documentsReady: Number(row[3] || 0),
    topicsReady: Number(row[4] || 0),
  };
}

function nullableText(value) {
  return value == null || value === "" ? "NULL" : textToSql(value);
}

function nullableNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "NULL";
}

function normalizeError(error) {
  return String(error?.message || error || "").slice(0, 1000);
}

module.exports = {
  finishSyncRun,
  loadProgramSyncStates,
  loadSyncCounters,
  markFullCatalogImported,
  markProgramImported,
  recordProgramSyncError,
  refreshProgramProcessingStatuses,
  startSyncRun,
};
