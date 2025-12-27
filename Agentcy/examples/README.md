Azure story-agent example

How to run

1. Create a virtualenv and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt
```

2. Set authentication and example variables (one option is Service Principal env vars):

```bash
export AZURE_CLIENT_ID=...
export AZURE_TENANT_ID=...
export AZURE_CLIENT_SECRET=...
export USER_ENDPOINT="https://<your-resource>.services.ai.azure.com/api/projects/<project>"
export AGENT_NAME="story-agent"
export MODEL_DEPLOYMENT_NAME="<your-model-deployment>"
```

Alternative auth (Project API key):

```bash
export PROJECT_API_KEY="<your-project-api-key>"
```

3. Run the example:

```bash
python3 azure_story_agent.py
```

Feedback API

1. Install dependencies (see above).

```bash
pip install -r ../requirements.txt
```

2. Run the feedback API locally:

```bash
uvicorn examples.feedback_api:app --reload --port 8000
```

3. Open the widget example in a browser:

```bash
open examples/static/feedback_widget_example.html
```

Notes
- The feedback endpoint is intended for local testing or to be deployed behind a simple host (Cloud Run, Azure Static Web Apps + Functions, etc.).
- The widget is a tiny embeddable script; in production you should restrict CORS and add bot/spam protections.
- Do not add secrets to the repository. Use environment variables or cloud-managed identities.
