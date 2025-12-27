.PHONY: dev serve

# One-command local server for this static site.
# Usage: make dev
# Then open: http://localhost:5173

PORT ?= 5173

# "dev" is the single command you run.
dev: serve

# Uses Python's built-in static file server (no installs).
serve:
	python3 -m http.server $(PORT)
