# Copilot Instructions for Agentcy

> NOTE: This repository currently appears empty in the workspace. The guidance below is a concrete, actionable template tailored to help an AI coding agent get productive. If you add the codebase (or point me to the main source dirs), I will update these instructions to include exact file examples and commands.

1. Purpose
- Short: Help contributors and automated agents make safe, high-quality changes that match project conventions.
- This repo is minimal now; add top-level service dirs (e.g., `api/`, `web/`) and update this doc.

2. High-level architecture (what to look for)
- Common entrypoints to locate: `package.json`, `pyproject.toml`, `cmd/` or `bin/`, `Dockerfile`, `server/`, `main.go`, `src/index.*`.
- Identify boundaries: which folders represent independent services vs. shared libraries. Note runtime (Node/Python/Rust/etc.) from manifests.
- For the interactive feedback agent workflow: look for a front-end (GitHub Pages site under `docs/` or `gh-pages` branch), a lightweight backend or serverless endpoint (Netlify/Azure Functions), and any webhook/code that accepts feedback. Quick examples live in `examples/feedback_processor.py` (normalization + heuristics), `examples/feedback_api.py` (FastAPI receiver), and `examples/static/feedback_widget.js` (embeddable script).

3. Developer workflows & commands (what an agent should run)
- Prefer running local build/test commands found in manifest files. If none found, ask the user for the canonical build/test commands.
- Example placeholders (replace with real ones once discovered):
  - `npm install && npm test`
  - `pytest -q`
  - `go test ./...`
  - `docker build -t agentcy-api ./api`

4. Project-specific conventions to enforce
- Commit message format: ask user if they follow conventional commits or a custom style.
- Testing: prefer unit tests next to modules (e.g., `foo.test.js`, `test_foo.py`). If missing tests, create targeted unit tests covering new behavior.
- Linting & formatting: check for `.eslintrc`, `pyproject.toml` with `black/ruff`, or `golangci-lint` to follow project style.

5. Integration & external dependencies
- Look for `docker-compose.yml`, `terraform/`, or `.env.example` to identify services and external systems (DB, auth, queues).
- Note any third-party APIs referenced in source or config; prefer to mock them in unit tests and stub in integration tests.

6. PR guidance for AI changes
- Scope PRs narrowly: single behavior, single file/area when possible.
- Include tests that validate added behavior and a short README update when adding public features.
- Link to an issue or include a clear description and reproduction steps.

7. Files & places to check first
- Root manifests: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`.
- Test config: `.github/workflows/*`, `jest.config.js`, `tox.ini`, `pytest.ini`.
- CI files: `.github/workflows/*` to find test/build steps and required env vars.

8. Safety, security, and secrets
- Never add secrets to the repo. If a test needs credentials, use `env` or a local `secrets.example` file, and document how to get them.
- Prefer creating mocks or fixtures for calls that could cost money or leak data.

9. When uncertain, ask these targeted questions
- "Where is the main app entrypoint (path + command)?"
- "What are the canonical dev/test/build commands?"
- "Do you follow Conventional Commits or a different commit style?"
- "Which integrations need live credentials for integration tests?"

10. Updating these instructions
- If you add code, run the agent again to scan key files (manifests, CI, README) and I'll merge concrete examples into this file.

---
If you'd like, I can now:
- Scan the repository again after you add the source files, and produce a more specific version with exact commands and file examples.
- Or, if there are already files I can't access from this workspace, tell me where they live (path or branch) and I'll re-run the scan.

Please tell me which option you prefer or add the code files and I will update this file to reference concrete files and commands.