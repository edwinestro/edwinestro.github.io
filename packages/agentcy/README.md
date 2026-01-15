Agentcy

This repo is an early scaffold for:
- A public game site (GitHub Pages)
- A feedback collection pipeline (widget + API)
- Optional Azure Foundry / Azure AI Projects agent integration

Quickstart (local)

1) Create a virtualenv and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2) Configure environment

Copy `.env.example` to `.env` and fill in values, then export them (example):

```bash
set -a
source .env
set +a
```

3) Connect to Azure Foundry (smoke test)

```bash
python3 scripts/foundry_smoke_test.py
```

Hello world (call an existing agent)

This is the smallest "does it talk to my agent?" check.

```bash
export USER_ENDPOINT="https://<your-resource>.services.ai.azure.com/api/projects/<project>"
export AGENT_NAME="edw"  # your agent name

python3 scripts/foundry_hello_agent.py --prompt "hello world"

# Or use the new convenience command:
./heyCopilot speak --dry-run    # dry-run first
./heyCopilot speak              # call agent and write edw_hello_world.txt
```

If the agent doesn't exist yet (or you want to update its definition), also set `MODEL_DEPLOYMENT_NAME` and run:

```bash
export MODEL_DEPLOYMENT_NAME="<your-model-deployment>"
python3 scripts/foundry_hello_agent.py --create-or-update
```

If you want to use a Project API key instead of interactive/service-principal auth,
set `PROJECT_API_KEY` in `.env` (never commit real keys).

Feedback API + widget demo

```bash
uvicorn examples.feedback_api:app --reload --port 8000
open examples/static/feedback_widget_example.html

Render deploy (quick testing)

- Start command: `uvicorn server.app:app --host 0.0.0.0 --port $PORT`
- Where to put tokens: Render dashboard → your service → Environment → add env vars (these are secrets)
	- `GITHUB_ISSUES_REPO=edwinestro/edwinestro.github.io`
	- `GITHUB_TOKEN=<fine-grained PAT with Issues:read/write on that repo>`
	- Optional local log file (JSONL): `FEEDBACK_STORE_PATH=data/feedback.jsonl`

Note: many free hosting tiers have ephemeral disk; `FEEDBACK_STORE_PATH` is great for testing, but for real persistence prefer GitHub Issues as the storage of record.

GitHub Issues feedback loop (recommended)

- Collection (player UX): players leave a 1–5 star rating plus an optional comment.
- Storage (behind the scenes): the feedback endpoint can create GitHub Issues server-side (so players do not need GitHub).
	- Configure the API with `GITHUB_ISSUES_REPO=owner/repo` and `GITHUB_TOKEN`.
- Processing: `scripts/github_issues_to_pr.py` (locally or via GitHub Actions) turns labeled issues into a Foundry-generated PR.

GitHub Action automation

This repo includes a scheduled workflow `.github/workflows/feedback_to_pr.yml`.
To enable it, add these repository secrets:

- `USER_ENDPOINT`
- `MODEL_DEPLOYMENT_NAME`
- One of:
	- `PROJECT_API_KEY` (Foundry Project API key)
	- OR configure `DefaultAzureCredential` style auth (service principal) and update the workflow.
- `SITE_GITHUB_TOKEN` (PAT with access to `edwinestro/edwinestro.github.io`)

Foundry → GitHub PR (from feedback)

Dry run (generate a proposal JSON without pushing anything):

```bash
USER_ENDPOINT="https://<your-resource>.services.ai.azure.com/api/projects/<project>" \
MODEL_DEPLOYMENT_NAME="<your-model-deployment>" \
python3 scripts/foundry_to_github_pr.py \
	--repo <owner>/<repo> \
	--base main \
	--allow-prefix ./ \
	--feedback "Fix the typo on the homepage and clarify controls" \
	--dry-run
```

This writes `generated/pr_proposal.json`.

To actually open a PR, set `GITHUB_TOKEN` (do not commit it) and re-run without `--dry-run`.
```

Notes
- Never commit secrets. Use env vars, GitHub Secrets, or Foundry secret storage.
