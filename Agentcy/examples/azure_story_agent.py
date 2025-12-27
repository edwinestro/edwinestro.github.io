"""Small example demonstrating creating an agent and calling it.

Before running:
  pip install --pre "azure-ai-projects>=2.0.0b1"
  pip install azure-identity

Set up authentication (one option):
  export AZURE_CLIENT_ID=... \
         AZURE_TENANT_ID=... \
         AZURE_CLIENT_SECRET=...

Alternative authentication (Project API key):
    export PROJECT_API_KEY=...

Also set the `USER_ENDPOINT`, `AGENT_NAME` and `MODEL_DEPLOYMENT_NAME` variables below.
This script intentionally avoids committing any secrets.
"""

from os import getenv

from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition

try:
    # Optional: enable API-key auth if you prefer using a Foundry Project API key.
    from azure.core.credentials import AzureKeyCredential  # type: ignore
except Exception:  # noqa: BLE001
    AzureKeyCredential = None  # type: ignore


USER_ENDPOINT = getenv("USER_ENDPOINT") or "https://<your-resource>.services.ai.azure.com/api/projects/<project>"
AGENT_NAME = getenv("AGENT_NAME") or "story-agent"
MODEL_DEPLOYMENT_NAME = getenv("MODEL_DEPLOYMENT_NAME") or "<your-model-deployment>"
PROJECT_API_KEY = getenv("PROJECT_API_KEY") or ""


def main():
    if "<your-resource>" in USER_ENDPOINT or "<your-model-deployment>" in MODEL_DEPLOYMENT_NAME:
        raise SystemExit("Please set USER_ENDPOINT and MODEL_DEPLOYMENT_NAME environment variables before running.")

    if PROJECT_API_KEY.strip():
        if AzureKeyCredential is None:
            raise SystemExit(
                "PROJECT_API_KEY is set but AzureKeyCredential is unavailable. "
                "Install azure-core (usually included) or use DefaultAzureCredential instead."
            )
        credential = AzureKeyCredential(PROJECT_API_KEY.strip())
    else:
        credential = DefaultAzureCredential()

    project_client = AIProjectClient(endpoint=USER_ENDPOINT, credential=credential)

    # Create or bump agent version
    agent = project_client.agents.create_version(
        agent_name=AGENT_NAME,
        definition=PromptAgentDefinition(
            model=MODEL_DEPLOYMENT_NAME,
            instructions=(
                "You are a storytelling agent. You craft engaging one-line stories "
                "based on user prompts and context."
            ),
        ),
    )

    print(f"Created/updated agent: {agent.name} (version: {agent.version})")

    openai_client = project_client.get_openai_client()

    response = openai_client.responses.create(
        input=[{"role": "user", "content": "Tell me a one line story"}],
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )

    print("Response output:\n", response.output_text)


if __name__ == "__main__":
    main()
