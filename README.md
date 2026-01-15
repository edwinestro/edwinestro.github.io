# Edwin Estro — Gaming AI Development

## About
- Hi, I'm @edwinestro.
- I'm an Azure Developer crafting cold, trusted UIs.
- I'm currently exploring Azure AI, DevOps, and secure cloud patterns.
- I'm looking to collaborate on future technology projects that benefit humanity as a whole.
- Send me an email to: "edwin.estro@me.com"

## Repo layout (source of truth)
This repository is a GitHub Pages site plus a few supporting tools.

- Site entrypoint: `index.html`
- Site assets: `assets/`
- Main games + hubs: `Projects/`
- Preserved legacy pages/builds: `legacy/`

## Tooling / automation
- Python tooling (Azure Foundry / Agent workflows): `packages/agentcy/`
- Top-level CLI wrapper: `heyCopilot` (runs the Agentcy CLI)
- Repo utilities: `tools/`
- Tests: `tests/` and `packages/agentcy/tests/`

## Local dev
- Static site server: `make serve` (defaults to port 5173)
- Python env + tools: `make venv`
