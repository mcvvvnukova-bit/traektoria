# Codex Agent Guide

## Project Snapshot

Traektoria51 Bot is a CommonJS Node.js service for Telegram, MAX, web-chat,
Alice, and Mattermost flows that recommend PFDO programs for children in the
Murmansk region. The repository also contains an offline
`services/program-topic-extractor` pipeline for parsing PFDO program documents.

## Runtime

- Use Node.js 26 when available. Node.js 22+ should also work for normal tests.
- Install root dependencies with `npm ci`.
- Python is only needed for document extraction helpers. The Codex Cloud setup
  script creates a venv and sets `TOPIC_EXTRACTOR_PYTHON_BIN` for `pypdf`.
- PostgreSQL is required only for live database import/sync flows. Most unit
  tests do not require a live database.

## Default Checks

Run this before finishing code changes unless the task is docs-only:

```bash
npm test
```

For database-related work, run the smallest relevant script against a disposable
or staging database. Do not point Codex at production databases unless the issue
explicitly says to do so and the credentials are already configured for that
purpose.

## Environment And Secrets

- Never commit `.env` or real tokens. Use `.env.example` for variable names.
- Keep bot transports disabled during automated checks unless the task is about
  that transport:
  - `TELEGRAM_ENABLED=false`
  - `MAX_ENABLED=false`
  - `ALICE_ENABLED=false`
  - `MATTERMOST_ENABLED=false`
  - `TELEGRAM_WEBHOOK_REGISTER=false`
  - `MAX_WEBHOOK_REGISTER=false`
- Keep LLM calls off by default in CI/Codex tasks:
  - `LLM_ENABLED=false`
  - `LOCAL_LLM_ENABLED=false`
  - `SCENARIO1_LLM_ONLY=false`
- If an issue requires LLM/API behavior, prefer mocked tests first. Use real API
  keys only when the Linear issue explicitly asks for an integration check.

## Working Rules

- Keep changes scoped to the Linear issue. Avoid broad refactors unless they are
  necessary for the requested behavior.
- Do not edit generated artifacts under `outputs/`, `render_*`, or `figma_*`
  unless the issue explicitly targets those assets.
- Preserve existing Russian user-facing copy unless the issue asks to rewrite it.
- For parser fixes, start with the relevant tests in `test/calendar-topics*.test.js`
  or `test/parser-updater-*.test.js`, then run the full `npm test`.
- For bot flow changes, include or update focused tests under `test/*.test.js`.

## Linear And Pull Requests

- Treat the Linear issue description and comments as the source of task scope.
- Mention the Linear issue ID in branch/PR titles when possible.
- In the final summary, include changed areas, verification commands, and any
  remaining setup needed outside the repo.
