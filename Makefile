.PHONY: dev serve venv copiping copiping-smoke copiping-connect games-db

# Keep existing site dev server behavior.
PORT ?= 5173

dev: serve

serve:
	python3 -m http.server $(PORT)

# Recreate Python environment on demand (kept out of git)
.venv/bin/python:
	python3 -m venv .venv
	./.venv/bin/python -m pip install --upgrade pip
	./.venv/bin/python -m pip install -r packages/agentcy/requirements.txt
	@if [ -f packages/agentcy/requirements-dev.txt ]; then ./.venv/bin/python -m pip install -r packages/agentcy/requirements-dev.txt; fi

venv: .venv/bin/python

# One command to collect Azure/GitHub details and optionally run:
# - Foundry smoke test
# - PR proposal dry-run
copiping:
	$(MAKE) venv
	./.venv/bin/python packages/agentcy/scripts/setup_wizard.py

# Just run the Foundry smoke test (expects env vars already set)
copiping-smoke:
	$(MAKE) venv
	./.venv/bin/python packages/agentcy/scripts/foundry_smoke_test.py

# Run Foundry smoke test with an optional interactive prompt for PROJECT_API_KEY
copiping-connect:
	$(MAKE) venv
	./.venv/bin/python packages/agentcy/scripts/run_smoke_with_prompt.py

# Update the Science Lab games database (Projects/data/games.json)
games-db:
	python3 tools/update_games_db.py
