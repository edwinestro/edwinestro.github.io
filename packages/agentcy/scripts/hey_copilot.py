#!/usr/bin/env python3
"""Lightweight CLI that calls a Foundry agent and writes a hello-world file to the repo root.

Usage:
  # dry-run (no network calls)
    python3 packages/agentcy/scripts/hey_copilot.py speak --dry-run

  # real call (ensure USER_ENDPOINT + auth are set):
  export USER_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"
    python3 packages/agentcy/scripts/hey_copilot.py speak

The top-level repo also gets a convenience wrapper script `heyCopilot` so you can run:
  ./heyCopilot speak

Notes:
- Auth: DefaultAzureCredential (recommended) or set PROJECT_API_KEY as an env var.
- The script writes `edw_hello_world.txt` in the repo root containing the agent's response.
"""
from __future__ import annotations

import argparse
import getpass
import logging
import os
import pathlib
import platform
import sys
import time
import traceback
from typing import Optional

# Repo root is three levels up from this file: packages/agentcy/scripts/hey_copilot.py
REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
OUTFILE = REPO_ROOT / "edw_hello_world.txt"
# No default endpoint stored in the repo; set USER_ENDPOINT or pass --endpoint.
DEFAULT_ENDPOINT = ""  # placeholder, override via env or CLI


def _setup_logging(debug: bool) -> None:
    if not debug:
        return
    logging.basicConfig(
        level=logging.DEBUG,
        format="[%(levelname)s] %(name)s: %(message)s",
    )
    # Keep logs safe: we enable general SDK debug categories, but do not print secrets ourselves.
    logging.getLogger("azure").setLevel(logging.DEBUG)
    logging.getLogger("azure.identity").setLevel(logging.DEBUG)
    logging.getLogger("azure.core").setLevel(logging.DEBUG)


def _now() -> float:
    return time.monotonic()


def _fmt_duration(start: float) -> str:
    return f"{(_now() - start):.2f}s"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _get_credential(project_api_key: str):
    try:
        from azure.identity import DefaultAzureCredential

        try:
            from azure.core.credentials import AzureKeyCredential  # type: ignore
        except Exception:  # noqa: BLE001
            AzureKeyCredential = None  # type: ignore

    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            "Missing Azure dependencies. Install with: pip install -r packages/agentcy/requirements.txt"
        ) from exc

    if project_api_key:
        if AzureKeyCredential is None:
            raise SystemExit(
                "PROJECT_API_KEY is set but AzureKeyCredential is unavailable. "
                "Install azure-core or use DefaultAzureCredential instead."
            )
        return AzureKeyCredential(project_api_key)

    return DefaultAzureCredential()


def _require(value: str, name: str) -> str:
    if not value:
        raise SystemExit(f"Missing {name}. Set env var {name} or pass the CLI flag.")
    return value


def run_speak(
    endpoint: str,
    agent_name: str,
    prompt: str,
    project_api_key: str,
    dry_run: bool,
    debug: bool,
) -> int:
    if not endpoint and not dry_run:
        try:
            endpoint = input("USER_ENDPOINT (Foundry project endpoint): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nCancelled.")
            return 130

    if debug:
        print("Debug: environment")
        print(f"- python: {sys.executable}")
        print(f"- python_version: {platform.python_version()}")
        print(f"- platform: {platform.platform()}")
        print(f"- endpoint: {endpoint or '(not set)'}")
        print(f"- agent: {agent_name}")
        print(f"- outfile: {OUTFILE}")

    if dry_run:
        print("Dry-run: would call Foundry agent with:")
        print(f"  endpoint: {endpoint or '(not required for dry-run)'}")
        print(f"  agent: {agent_name}")
        print(f"  prompt: {prompt}")
        print(f"  outfile: {OUTFILE}")
        return 0

    endpoint = _require(endpoint, "USER_ENDPOINT/--endpoint")

    if not project_api_key:
        try:
            project_api_key = getpass.getpass(
                "PROJECT_API_KEY (blank to use DefaultAzureCredential): "
            ).strip()
        except (KeyboardInterrupt, EOFError):
            print("\nCancelled.")
            return 130

    # VS Code terminals sometimes end up with a stray backslash pasted.
    if project_api_key == "\\":
        project_api_key = ""

    start = _now()
    print("Loading Azure credentials (may take a few seconds on first run)...")
    if debug:
        print(f"Debug: auth_mode={'PROJECT_API_KEY' if project_api_key else 'DefaultAzureCredential'}")

    try:
        credential = _get_credential(project_api_key)
    except KeyboardInterrupt:
        print("\nCancelled.")
        return 130
    except Exception as exc:  # noqa: BLE001
        print("Failed while constructing credentials.")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error: {exc}")
        if debug:
            print("--- traceback ---")
            print(traceback.format_exc())
        return 2

    if debug:
        print(f"Debug: credential_ready in {_fmt_duration(start)}")

    try:
        print("Loading Azure AI Projects client...")
        from azure.ai.projects import AIProjectClient
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            "Missing Azure AI Projects SDK. Install with: pip install -r packages/agentcy/requirements.txt"
        ) from exc

    try:
        call_start = _now()
        print("Connecting to Foundry project and invoking agent...")
        project_client = AIProjectClient(endpoint=endpoint, credential=credential)
        openai_client = project_client.get_openai_client()

        response = openai_client.responses.create(
            input=[{"role": "user", "content": prompt}],
            extra_body={"agent": {"name": agent_name, "type": "agent_reference"}},
        )

        text = (response.output_text or "").strip()
        if not text:
            raise SystemExit("Agent returned empty output")

        OUTFILE.write_text(text + "\n", encoding="utf-8")
        print(f"Wrote: {OUTFILE}")
        if debug:
            print(f"Debug: call_completed in {_fmt_duration(call_start)}")
        return 0

    except KeyboardInterrupt:
        print("\nCancelled.")
        return 130
    except Exception as exc:  # noqa: BLE001
        print("heyCopilot failed to call Foundry agent.")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error: {exc}")
        if debug:
            print("--- traceback ---")
            print(traceback.format_exc())
        print()
        print("Common fixes:")
        print("- Confirm USER_ENDPOINT is the Foundry project endpoint (not the portal URL).")
        print("- Ensure AGENT_NAME exists or use --agent to set the agent name.")
        print("- Ensure your identity has access (try: az login).")
        print("- If using a project API key, set PROJECT_API_KEY (do not commit it).")
        return 2


def run_sanity_check(debug: bool) -> int:
    """Validate imports and print versions without calling the network."""
    if debug:
        print("Debug: sanity-check")
        print(f"- python: {sys.executable}")
        print(f"- python_version: {platform.python_version()}")

    try:
        import azure.core  # noqa: F401
        import azure.identity  # noqa: F401
        import azure.ai.projects  # noqa: F401
        import openai  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        print("Sanity check failed: unable to import required packages.")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error: {exc}")
        if debug:
            print("--- traceback ---")
            print(traceback.format_exc())
        return 2

    # Best-effort version printing
    try:
        from importlib.metadata import version

        print("OK: imports")
        print(f"- azure-core: {version('azure-core')}")
        print(f"- azure-identity: {version('azure-identity')}")
        print(f"- azure-ai-projects: {version('azure-ai-projects')}")
        print(f"- openai: {version('openai')}")
    except Exception:
        print("OK: imports (versions unavailable)")

    print("OK: ready to run: ./heyCopilot speak")
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="hey_copilot", description="Simple Foundry agent helper")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("speak", help="Invoke the agent and write a hello file")
    sp.add_argument("--debug", action="store_true", help="Enable verbose debug output (safe: no secrets printed)")
    sp.add_argument(
        "--endpoint",
        default=_env("USER_ENDPOINT", DEFAULT_ENDPOINT),
        help="Foundry project endpoint (USER_ENDPOINT)",
    )
    sp.add_argument("--agent", default=_env("AGENT_NAME", "edw") or "edw", help="Agent name (AGENT_NAME)")
    sp.add_argument(
        "--prompt",
        default="Hello Xbox — say hello and confirm you are agent 'edw' in one short line.",
        help="Prompt to send to the agent",
    )
    sp.add_argument("--project-api-key", default=_env("PROJECT_API_KEY"), help="Foundry Project API key (optional)")
    sp.add_argument("--dry-run", action="store_true", help="Don't call network; just show what would happen")

    sc = sub.add_parser("sanity-check", help="Validate imports/versions (no network)")
    sc.add_argument("--debug", action="store_true", help="Enable verbose debug output")

    args = parser.parse_args(argv)

    debug = bool(getattr(args, "debug", False))
    _setup_logging(debug)

    if args.cmd == "speak":
        return run_speak(args.endpoint, args.agent, args.prompt, args.project_api_key, args.dry_run, debug)

    if args.cmd == "sanity-check":
        return run_sanity_check(debug)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())