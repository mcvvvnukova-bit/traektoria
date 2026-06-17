# PFDO Program Sync Design

## Context

The service uses a local PostgreSQL mirror of PFDO data for recommendations and the scenario 3 deep trajectory flow. The current update path is a manual chain of scripts:

1. `scripts/import-pfdo-mirror.js`
2. `scripts/download-pfdo-program-documents.js`
3. `scripts/import-pfdo-calendar-topics.js`
4. `scripts/build-pfdo-topic-analytics.js`

This works for planned refreshes, but it has two gaps:

- there is no explicit sync state that explains when a program was seen, changed, or processed;
- if a user sends a PFDO link for a program that is absent from the local mirror, the bot cannot recover during the conversation.

## Goal

Program updates from PFDO must reach the trajectory service database predictably:

- nightly full sync keeps the local mirror aligned with the PFDO catalog;
- scenario 3 can import a missing program by direct PFDO program ID lookup;
- downstream document and topic work is visible through explicit statuses.

## Recommended Architecture

Use a pragmatic first version: no external queue and no new worker service.

The implementation adds:

- `pfdo_sync_runs` for sync run audit records;
- `pfdo_program_sync_state` for per-program catalog/detail/document/topic status;
- `scripts/sync-pfdo-programs.js` as the nightly orchestrator;
- `ensurePfdoProgramImported(programId)` for on-demand PFDO imports from bot flows.

## Data Flow

### Nightly Full Sync

1. Start a `full` sync run.
2. Run the existing full PFDO mirror import.
3. Mark all current `pfdo_programs` rows as seen and compare payload hashes with the previous sync state.
4. Run document download.
5. Run calendar-topic extraction, which also refreshes topic analytics.
6. Refresh document/topic statuses in `pfdo_program_sync_state`.
7. Finish the sync run with counters or error details.

### On-Demand Program Import

1. Scenario 3 parses user PFDO links and queries local `pfdo_programs`.
2. For missing IDs, the bot calls PFDO `/public/programs/{id}` directly.
3. The returned detail payload is upserted into `pfdo_programs` and related tables.
4. The sync state marks the program as seen through `on_demand`, with document/topic statuses set to `pending`.
5. Scenario 3 reloads the program from the mirror and continues. If topics are not ready yet, the user-facing text says that the topic classification is still being prepared.

## Status Model

`pfdo_program_sync_state` keeps:

- `catalog_status`: `active`, `missing`;
- `document_status`: `pending`, `ready`, `missing`, `error`;
- `topics_status`: `pending`, `ready`, `missing`, `error`;
- search and detail payload hashes;
- last seen/detail/document/topic timestamps;
- last error text.

The hashes are used to detect changed PFDO payloads and mark downstream stages pending.

## Operations

Production should run `node scripts/sync-pfdo-programs.js` from a systemd timer once per night. Manual recovery can run the same command.

On-demand imports are intentionally lightweight: they make the card visible immediately, but heavy document and topic work can complete during the next sync unless a later implementation adds a background job runner.

## Acceptance Criteria

- A missing PFDO program that exists in `/public/programs/{id}` can be inserted without truncating the mirror.
- Scenario 3 does not fail only because a user-provided program ID is absent from the local mirror.
- A nightly sync run leaves an auditable row in `pfdo_sync_runs`.
- Per-program sync state shows whether documents and topics are ready or pending.
