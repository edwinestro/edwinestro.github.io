# Azure Foundry Agent (edw) — Usage Guide

Goal: provide a convenient, documented way to invoke the Foundry agent `edw` from this repo.

Files added:
- `packages/agentcy/scripts/hey_copilot.py` — CLI that calls an agent and writes `edw_hello_world.txt` to repo root.
- `heyCopilot` — top-level executable wrapper (run `./heyCopilot speak`).

Auth and env vars
- `USER_ENDPOINT` (required): Foundry project endpoint (example):
  `https://<resource>.services.ai.azure.com/api/projects/<project>`
  - No default endpoint is stored in the repository. Set `USER_ENDPOINT` or pass `--endpoint` to the command.
- `AGENT_NAME` (optional): defaults to `edw`.
- `PROJECT_API_KEY` (optional): Foundry Project API key. Prefer DefaultAzureCredential instead (e.g., `az login`).

Examples
- Dry-run (no network call):

  ```bash
  ./heyCopilot speak --dry-run
  ```

- Sanity-check (no network; confirms imports/versions):

  ```bash
  ./heyCopilot sanity-check --debug
  ```

- Real call (writes `edw_hello_world.txt` in the repo root):

  ```bash
  export USER_ENDPOINT="https://<your-resource>.services.ai.azure.com/api/projects/<project>"
  ./heyCopilot speak --debug
  ```

The default prompt contains the phrase "Hello Xbox" as requested in the current task.

Notes
- Never commit API keys or secrets to the repo.
- Do not install Google Chrome (or any Chrome download from Google) as part of this workspace setup or automation.
- For every command run (terminal/task), always include a short human-readable explanation of what it does and why.
- If the agent doesn't exist or you want to update it, use the existing `packages/agentcy/scripts/foundry_hello_agent.py --create-or-update` flow.
- The script prints helpful troubleshooting hints if the call fails.
