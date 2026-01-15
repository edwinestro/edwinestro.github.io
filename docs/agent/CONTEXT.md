# Workspace Context

Quick primer for Copilot/chat sessions.

## What this repo is
- Personal site + games + Agentcy (Azure AI Foundry integration).
- Default agent: `edw`. Configure your project endpoint via `USER_ENDPOINT` or `--endpoint`.

## Key paths
- Agent scripts: `packages/agentcy/scripts/`
  - `foundry_hello_agent.py` (basic call)
  - `hey_copilot.py` (CLI helper)
  - `foundry_smoke_test.py` (connectivity + agent create/update)
- Wrapper: `heyCopilot` (top-level executable)
- Docs: `docs/agent/AGENT_INSTRUCTIONS.md`
- Main site: `index.html` + `assets/css/home.css`
- Legacy games: `legacy/stringball-endpoint/`

## Common commands
- Use venv: `source .venv/bin/activate`
- Dry-run hello: `./heyCopilot speak --dry-run`
- Sanity-check (no network): `./heyCopilot sanity-check --debug`
- Real hello: `./heyCopilot speak --debug` (will prompt for PROJECT_API_KEY)
- Smoke test: `python packages/agentcy/scripts/foundry_smoke_test.py`

## Auth
- Preferred: DefaultAzureCredential (az login / VS Code Azure sign-in).
- Optional: PROJECT_API_KEY (prompted if missing).

## Outputs
- Agent write: `edw_hello_world.txt` in repo root.

## Tests
- `python3 -m pytest -q` (needs pytest installed)
- Quick check: `python3 -m py_compile packages/agentcy/scripts/hey_copilot.py`

## CI
- `.github/workflows/ci.yml` runs pytest with `packages/agentcy/requirements.txt`.
