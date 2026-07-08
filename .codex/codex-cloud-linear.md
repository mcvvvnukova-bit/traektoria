# Codex Cloud + Linear Setup

Use these values in ChatGPT/Codex settings for the cloud environment that should
service Linear issues for this repository.

## Environment

- Name: `traektoria-linear-agent`
- Repository: `mcvvvnukova-bit/traektoria`
- Default branch: `main`
- Runtime image: default `universal`
- Node.js package version: Node.js 26 if available; otherwise Node.js 22 LTS+
- Agent internet access: limited or unrestricted if the issue requires web/API
  research; otherwise default/off is fine for local code tasks

## Setup Script

```bash
bash .codex/cloud-setup.sh
```

## Maintenance Script

```bash
bash .codex/cloud-maintenance.sh
```

## Recommended Environment Variables

These are safe defaults for coding tasks and tests:

```bash
TELEGRAM_ENABLED=false
TELEGRAM_WEBHOOK_REGISTER=false
MAX_ENABLED=false
MAX_WEBHOOK_REGISTER=false
ALICE_ENABLED=false
MATTERMOST_ENABLED=false
LLM_ENABLED=false
LOCAL_LLM_ENABLED=false
SCENARIO1_LLM_ONLY=false
PFDO_OPERATOR_ID=37
PFDO_PORTAL_BASE=https://51.pfdo.ru
PFDO_API_BASE=https://api.pfdo.ru/v2
PSQL_BIN=psql
```

Add live credentials only for tasks that need them. Prefer staging credentials
for `DATABASE_URL`, `PFDO_MIRROR_DATABASE_URL`, bot tokens, and LLM API keys.
Codex Cloud secrets are available to setup scripts only, so do not rely on
secrets being present during the agent phase.

## Linear

The Linear workspace already has a `Codex` user and the team
`MC.VVVnukova`. Issue `MCV-5` is delegated to Codex and is a good smoke test
after the environment is selected for the repo map.

When a Linear issue is ambiguous about the repository, comment with:

```text
@Codex please run this in mcvvvnukova-bit/traektoria
```
