---
title: feat: Add Mattermost interactive menu
type: feat
status: active
date: 2026-06-17
origin: docs/superpowers/specs/2026-06-17-mattermost-interactive-menu-design.md
---

# feat: Add Mattermost interactive menu

## Overview

Add Mattermost-native scenario entry with `/traektoria` slash command handling and interactive message buttons while preserving the existing numbered text fallback.

## Problem Frame

Mattermost currently reuses the common scenario runtime but presents Telegram inline keyboards as numbered text. Users need a discoverable slash command and clickable menu/buttons closer to Telegram behavior without forking the scenario engine.

## Requirements Trace

- R1. `/traektoria` and `/traektoria text|quiz|deep|wide|help` route into existing scenario commands.
- R2. Inline keyboards render as Mattermost interactive message attachments when `MATTERMOST_ACTION_SECRET` is configured.
- R3. Button callbacks map to existing Telegram-style `callback_data`.
- R4. Numbered text fallback remains available.
- R5. Beget production `.env` receives Mattermost secrets and service restart.

## Scope Boundaries

- No Mattermost plugin.
- No automatic Mattermost slash-command registration through admin APIs.
- No interactive dialogs/forms.

## Context & Research

### Relevant Code and Patterns

- `src/mattermost-transport.js` owns Mattermost WebSocket parsing and REST post/file upload.
- `src/index.js` owns shared scenario routing, HTTP endpoints, and existing callback handling.
- `src/telegram-menu.js` owns slash-like command parsing for `/text`, `/quiz`, `/deep`, `/wide`, `/help`.
- `test/mattermost-transport.test.js` and `test/telegram-menu.test.js` cover the nearest behavior.

### External References

- Mattermost message attachments via REST API use `props.attachments`: https://developers.mattermost.com/integrate/reference/message-attachments/
- Mattermost interactive messages send action callbacks to each action's `integration.url` with confidential `context`: https://developers.mattermost.com/integrate/plugins/interactive-messages/
- Mattermost custom slash commands support autocomplete and POST callbacks: https://developers.mattermost.com/integrate/slash-commands/

## Key Technical Decisions

- Use `props.attachments` on bot REST posts instead of webhooks so messages still come from the bot account.
- Store callback authentication in `MATTERMOST_ACTION_SECRET` context, separate from `MATTERMOST_TOKEN`.
- Keep slash auth separate via `MATTERMOST_SLASH_TOKEN`.
- Reconstruct Mattermost targets from callback/slash payloads and pass existing `callback_data` into `handleCallback`.

## Implementation Units

- [ ] **Unit 1: Mattermost interactive post formatting**

**Goal:** Generate Mattermost `props.attachments` with button actions from Telegram-style inline keyboards.

**Requirements:** R2, R4

**Dependencies:** None

**Files:**
- Modify: `src/mattermost-transport.js`
- Test: `test/mattermost-transport.test.js`

**Approach:**
- Keep `formatMattermostMessage` as fallback text formatter.
- Add a post builder that returns message plus optional `props.attachments`.
- Only include attachments when action URL and secret are configured.

**Test scenarios:**
- Happy path: inline keyboard plus action config creates button actions with callback context.
- Edge case: no action config keeps existing numbered text output.
- Edge case: checked labels strip the leading check mark in both fallback and button labels.

**Verification:**
- Mattermost transport tests prove both interactive and fallback formatting.

- [ ] **Unit 2: Mattermost slash/action HTTP endpoints**

**Goal:** Accept `/traektoria` slash callbacks and interactive button callbacks.

**Requirements:** R1, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `src/index.js`
- Test: `test/mattermost-integration.test.js`

**Approach:**
- Add default paths `/mattermost/slash` and `/mattermost/actions`.
- Validate `MATTERMOST_SLASH_TOKEN` for slash requests.
- Validate `MATTERMOST_ACTION_SECRET` for action requests.
- Convert payloads to Mattermost targets and route through existing `startScenarioFromCommand` / `handleCallback`.

**Test scenarios:**
- Happy path: empty slash text maps to `start`.
- Happy path: `quiz` slash text maps to `quiz`.
- Error path: invalid slash token returns unauthorized result.
- Happy path: action callback with valid secret reconstructs channel target and callback data.
- Error path: invalid action secret is rejected.

**Verification:**
- Endpoint helper tests cover parsing/auth/target reconstruction; integration logic remains on existing scenario handlers.

- [ ] **Unit 3: Config, docs, and production rollout**

**Goal:** Document required env vars and install secrets on Beget.

**Requirements:** R5

**Dependencies:** Units 1-2

**Files:**
- Modify: `.env.example`
- Modify: `deploy/env.production.example`
- Modify: `README.md`
- Modify: `docs/configuration-reference.md`
- Modify: `docs/deploy-runbook.md`

**Approach:**
- Add non-secret examples for action/slash paths and tokens.
- Update runbook with Mattermost slash command setup values.
- On Beget, update `/opt/telegram-bot/.env`, restart `traektoria51-bot`, and check health/logs.

**Test scenarios:**
- Test expectation: none for docs-only changes; runtime coverage comes from Units 1-2 and production health checks.

**Verification:**
- Production health shows Mattermost enabled and authenticated, or logs clearly show the remaining external setup gap.

## System-Wide Impact

- **Interaction graph:** Mattermost WebSocket, slash endpoint, and action endpoint all enter the same scenario runtime.
- **Error propagation:** Invalid secrets return 401/action error without affecting Telegram, MAX, web-chat, or Алиса.
- **State lifecycle risks:** Mattermost session keys remain `dm:<user_id>` and `channel:<channel_id>:user:<user_id>`.
- **Unchanged invariants:** Telegram/MAX/web callbacks and scenario state names stay unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Mattermost server cannot reach callback URL | Use public `https://bot.traektoria51.ru/mattermost/actions` and verify logs after button click. |
| Slash command not created or token missing | Keep `/start` and mention flow working; log missing token clearly. |
| Interactive buttons unsupported in a client | Preserve numbered text fallback. |

## Documentation / Operational Notes

- Mattermost admin must create `/traektoria` custom slash command and copy its token into `MATTERMOST_SLASH_TOKEN`.
- Button callbacks use our generated `MATTERMOST_ACTION_SECRET`, not a Mattermost-issued token.
