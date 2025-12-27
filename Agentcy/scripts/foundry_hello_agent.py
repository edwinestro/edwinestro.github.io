#!/usr/bin/env python3

"""Hello-world style connection test for an Azure AI Foundry (Azure AI Projects) Agent.

This is the Foundry equivalent of a simple OpenAI "hello world":
- Connects to your Foundry Project endpoint
- Invokes an existing Agent by name (default: "edw")
- Prints the agent's response

Auth:
- Preferred: DefaultAzureCredential (az login / VS Code Azure login / managed identity / service principal)
- Optional: PROJECT_API_KEY (Foundry Project API key)

Required env vars (or CLI args):
- USER_ENDPOINT: Foundry project endpoint, e.g. https://<resource>.services.ai.azure.com/api/projects/<project>

Optional env vars:
- AGENT_NAME (default: edw)
- PROJECT_API_KEY (optional)

If you need to create/update the agent version from this script, pass --create-or-update
and provide MODEL_DEPLOYMENT_NAME.

Examples:
  export USER_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"
  export AGENT_NAME="edw"
  python3 Agentcy/scripts/foundry_hello_agent.py --prompt "hello world"

  # Create/update an agent version first:
  export MODEL_DEPLOYMENT_NAME="<deployment>"
  python3 Agentcy/scripts/foundry_hello_agent.py --create-or-update
"""

from __future__ import annotations

import argparse
import os
import sys


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _require(value: str, name: str) -> str:
    if not value:
        raise SystemExit(f"Missing {name}. Set env var {name} or pass the CLI flag.")
    return value


def _get_credential(project_api_key: str):
    # Import lazily so the file is importable without azure deps.
    try:
        from azure.identity import DefaultAzureCredential

        try:
            from azure.core.credentials import AzureKeyCredential  # type: ignore
        except Exception:  # noqa: BLE001
            AzureKeyCredential = None  # type: ignore

    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            "Missing Azure dependencies. Install with: pip install -r Agentcy/requirements.txt"
        ) from exc

    if project_api_key:
        if AzureKeyCredential is None:
            raise SystemExit(
                "PROJECT_API_KEY is set but AzureKeyCredential is unavailable. "
                "Install azure-core or use DefaultAzureCredential instead."
            )
        return AzureKeyCredential(project_api_key)

    return DefaultAzureCredential()


def main() -> int:
    parser = argparse.ArgumentParser(description="Hello-world for a Foundry agent")
    parser.add_argument("--endpoint", default=_env("USER_ENDPOINT"), help="Foundry project endpoint (USER_ENDPOINT)")
    parser.add_argument("--agent", default=_env("AGENT_NAME", "edw") or "edw", help="Agent name (AGENT_NAME)")
    parser.add_argument(
        "--prompt",
        default="Say 'hello world' and confirm you're the agent named edw.",
        help="User prompt to send",
    )
    parser.add_argument(
        "--project-api-key",
        default=_env("PROJECT_API_KEY"),
        help="Foundry Project API key (PROJECT_API_KEY). Prefer DefaultAzureCredential.",
    )
    parser.add_argument(
        "--create-or-update",
        action="store_true",
        help="Create/update the agent version before invoking it (requires MODEL_DEPLOYMENT_NAME)",
    )
    parser.add_argument(
        "--model-deployment",
        default=_env("MODEL_DEPLOYMENT_NAME"),
        help="Model deployment name (MODEL_DEPLOYMENT_NAME) used only with --create-or-update",
    )

    args = parser.parse_args()

    endpoint = _require(args.endpoint.strip(), "USER_ENDPOINT/--endpoint")
    agent_name = _require(args.agent.strip(), "AGENT_NAME/--agent")

    if "<" in endpoint:
        raise SystemExit("Please replace placeholder values in USER_ENDPOINT")

    credential = _get_credential(args.project_api_key.strip())

    try:
        from azure.ai.projects import AIProjectClient
        from azure.ai.projects.models import PromptAgentDefinition
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            "Missing Azure AI Projects SDK. Install with: pip install -r Agentcy/requirements.txt"
        ) from exc

    try:
        project_client = AIProjectClient(endpoint=endpoint, credential=credential)

        # Optional: create/update agent version. This is useful if the agent doesn't exist yet.
        if args.create_or_update:
            model_deployment = _require(args.model_deployment.strip(), "MODEL_DEPLOYMENT_NAME/--model-deployment")
            if "<" in model_deployment:
                raise SystemExit("Please replace placeholder values in MODEL_DEPLOYMENT_NAME")

            agent = project_client.agents.create_version(
                agent_name=agent_name,
                definition=PromptAgentDefinition(
                    model=model_deployment,
                    instructions=(
                        "You are an assistant named 'edw'. "
                        "For test prompts, respond briefly and clearly."
                    ),
                ),
            )
            resolved_agent_name = agent.name
        else:
            resolved_agent_name = agent_name

        openai_client = project_client.get_openai_client()
        response = openai_client.responses.create(
            input=[{"role": "user", "content": args.prompt}],
            extra_body={"agent": {"name": resolved_agent_name, "type": "agent_reference"}},
        )

        print(response.output_text)
        return 0

    except Exception as exc:  # noqa: BLE001
        print("Foundry hello-agent call failed.")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error: {exc}")
        print()
        print("Common fixes:")
        print("- Confirm USER_ENDPOINT is the Foundry project endpoint (not the portal URL).")
        print("- Confirm AGENT_NAME exists in the project (or run with --create-or-update).")
        print("- Ensure your identity has access (try: az login).")
        print("- If using Service Principal, set AZURE_CLIENT_ID/AZURE_TENANT_ID/AZURE_CLIENT_SECRET.")
        print("- If using a project API key, set PROJECT_API_KEY (do not commit it).")
        return 2


if __name__ == "__main__":
    sys.exit(main())
