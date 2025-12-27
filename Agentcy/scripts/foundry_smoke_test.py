"""Azure Foundry / Azure AI Projects smoke test.

Goal: verify that credentials + endpoint are correct and that we can
create/update an agent version and get a response.

Usage:
  # 1) Install deps
  pip install -r requirements.txt

  # 2) Export env vars (see .env.example)
  export USER_ENDPOINT="https://.../api/projects/..."
  export MODEL_DEPLOYMENT_NAME="..."
  export AGENT_NAME="story-agent"

  # 3) Auth options
  #    - DefaultAzureCredential (recommended): az login, VS Code Azure login,
  #      Managed Identity, or Service Principal env vars.

  python scripts/foundry_smoke_test.py

Notes:
- This script prints actionable error hints but never prints secrets.
"""

from __future__ import annotations

import os
import sys

from azure.identity import DefaultAzureCredential
try:
    from azure.identity import AzureCliCredential
except Exception:  # noqa: BLE001
    AzureCliCredential = None  # type: ignore
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition

try:
    # Optional: enable API-key auth if the SDK supports AzureKeyCredential.
    from azure.core.credentials import AzureKeyCredential  # type: ignore
except Exception:  # noqa: BLE001
    AzureKeyCredential = None  # type: ignore


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing env var: {name}. See .env.example")
    return value


def main() -> int:
    endpoint = _require_env("USER_ENDPOINT")
    agent_name = os.getenv("AGENT_NAME", "story-agent").strip() or "story-agent"
    model_deployment = _require_env("MODEL_DEPLOYMENT_NAME")
    project_api_key = os.getenv("PROJECT_API_KEY", "").strip()

    if "<" in endpoint or "<" in model_deployment:
        raise SystemExit("Please replace placeholder values in USER_ENDPOINT / MODEL_DEPLOYMENT_NAME")

    try:
        print("Connecting to Foundry project...")
        if project_api_key:
            if AzureKeyCredential is None:
                raise SystemExit(
                    "PROJECT_API_KEY is set but AzureKeyCredential is unavailable. "
                    "Install azure-core or use DefaultAzureCredential instead."
                )
            credential = AzureKeyCredential(project_api_key)
        else:
            # Prefer Azure CLI credential when user already ran `az login`.
            # This avoids DefaultAzureCredential trying Managed Identity / other providers that can time out.
            if AzureCliCredential is not None:
                credential = AzureCliCredential()
            else:
                credential = DefaultAzureCredential()

        project_client = AIProjectClient(endpoint=endpoint, credential=credential)

        print("Creating/updating agent version...")
        agent = project_client.agents.create_version(
            agent_name=agent_name,
            definition=PromptAgentDefinition(
                model=model_deployment,
                instructions=(
                    "You are a storytelling agent. You craft engaging one-line stories "
                    "based on user prompts and context."
                ),
            ),
        )

        print(f"OK: created/updated agent '{agent.name}' (version: {getattr(agent, 'version', 'unknown')})")

        print("Calling Responses API...")
        openai_client = project_client.get_openai_client()
        response = openai_client.responses.create(
            input=[{"role": "user", "content": "Say 'connected' in one line."}],
            extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
        )

        print("OK: got response:")
        print(response.output_text)
        return 0

    except Exception as exc:  # noqa: BLE001
        print("Foundry smoke test failed.")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error: {exc}")
        print()
        print("Common fixes:")
        print("- Confirm USER_ENDPOINT is the Foundry project endpoint (not the portal URL).")
        print("- Confirm MODEL_DEPLOYMENT_NAME matches an existing deployment name.")
        print("- Ensure your identity has access to the Foundry project/resource.")
        print("- If using a project API key, set PROJECT_API_KEY (do not commit it).")
        print("- If using Service Principal, set AZURE_CLIENT_ID/AZURE_TENANT_ID/AZURE_CLIENT_SECRET.")
        print("- If using interactive auth, run: az login")
        return 2


if __name__ == "__main__":
    sys.exit(main())
