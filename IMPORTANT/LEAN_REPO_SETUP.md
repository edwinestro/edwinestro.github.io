# Lean repo setup (after cleanup)

This repo was intentionally cleaned to remove installable/derivable artifacts (virtualenvs, node_modules, caches) to reduce file count and keep GitHub Pages lean.

## What was removed
- `**/.venv/` (Python virtual environments)
- `**/node_modules/` (Node dependencies)
- Python caches: `__pycache__/`, `.pytest_cache/`, `*.pyc`

These can always be recreated.

## Recreate dependencies (when needed)

### Agentcy (Python)
From repo root:

```bash
python3 -m venv Agentcy/.venv
source Agentcy/.venv/bin/activate
pip install -r Agentcy/requirements.txt
# optional dev tooling
pip install -r Agentcy/requirements-dev.txt
```

### Legacy Leaderboard API (Node)
The VS Code task **Start Leaderboard API (Excel)** now runs `npm install` automatically if needed.

Manual install:

```bash
cd legacy/stringball-endpoint/server
npm install
npm start
```

## Design note
The homepage + Science Lab 5.2 are built as static assets and do not require any installs.
