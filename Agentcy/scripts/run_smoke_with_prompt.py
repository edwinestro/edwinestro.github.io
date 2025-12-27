"""Wrapper to run the Foundry smoke test with optional interactive Project API Key input.

Usage:
  ./.venv/bin/python Agentcy/scripts/run_smoke_with_prompt.py [--endpoint ENDPOINT] [--model MODEL] [--no-prompt]

Behavior:
- Prompts interactively for PROJECT_API_KEY (secret) unless --no-prompt is supplied.
- If no key is supplied, it will rely on DefaultAzureCredential (e.g., `az login`).
- Runs Agentcy/scripts/foundry_smoke_test.py and prints output.
"""
from __future__ import annotations

import argparse
import getpass
import os
import shlex
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SMOKE = REPO_ROOT / "Agentcy" / "scripts" / "foundry_smoke_test.py"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", help="Foundry project endpoint (USER_ENDPOINT)")
    parser.add_argument("--model", help="MODEL_DEPLOYMENT_NAME")
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="Do not prompt for PROJECT_API_KEY; use DefaultAzureCredential (az login) or env vars",
    )
    args = parser.parse_args()

    endpoint = args.endpoint or os.getenv("USER_ENDPOINT") or ""
    model = args.model or os.getenv("MODEL_DEPLOYMENT_NAME") or ""

    if not endpoint:
        endpoint = input("USER_ENDPOINT (Foundry project endpoint): ").strip()
    if not model:
        model = input("MODEL_DEPLOYMENT_NAME (deployment name): ").strip()

    project_api_key = os.getenv("PROJECT_API_KEY", "").strip()

    if not args.no_prompt and not project_api_key:
        use_key = input("Would you like to provide a Foundry PROJECT_API_KEY? [y/N]: ").strip().lower()
        if use_key in {"y", "yes"}:
            project_api_key = getpass.getpass("PROJECT_API_KEY (input hidden): ").strip()
            if project_api_key:
                print("Captured PROJECT_API_KEY (not printed). Will use it for this run.")

    env = dict(os.environ)
    env["USER_ENDPOINT"] = endpoint
    env["MODEL_DEPLOYMENT_NAME"] = model
    if project_api_key:
        env["PROJECT_API_KEY"] = project_api_key

    cmd = [sys.executable, str(SMOKE)]
    print("Running:", " ".join(shlex.quote(p) for p in cmd))
    print("(Using DefaultAzureCredential if PROJECT_API_KEY is not provided.)")

    try:
        result = subprocess.run(cmd, cwd=str(REPO_ROOT), env=env, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        print("Smoke test timed out after 120s. The Foundry endpoint may be slow.")
        return 2

    print("--- STDOUT ---")
    print(result.stdout)
    print("--- STDERR ---")
    print(result.stderr)

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
