"""Call an Azure Foundry agent and apply a *constrained* set of file writes.

Safety model:
- The agent does NOT get filesystem access.
- We optionally share repo context as text.
- The agent must respond with strict JSON describing file writes.
- This script enforces an allowlist of writable paths.

Default behavior:
- Share repo tree (paths only), not full file contents.
- Only allow creating/updating files under `generated/`.

Env vars required:
- USER_ENDPOINT
- AGENT_NAME
- MODEL_DEPLOYMENT_NAME

Auth:
- DefaultAzureCredential (az login / SP env vars) OR PROJECT_API_KEY.

Usage:
  python3 scripts/foundry_agent_writer.py --hello

Optional:
  python3 scripts/foundry_agent_writer.py --hello --share-files
"""

from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.identity import DefaultAzureCredential

try:
    from azure.core.credentials import AzureKeyCredential  # type: ignore
except Exception:  # noqa: BLE001
    AzureKeyCredential = None  # type: ignore


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ALLOW_PREFIXES = ("generated/",)


@dataclass
class ProposedFile:
    path: str
    content: str


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


def _is_probably_secret_path(rel_path: str) -> bool:
    lowered = rel_path.lower()
    if lowered in {".env", ".env.local", ".env.production"}:
        return True
    if "secret" in lowered or "token" in lowered or "key" in lowered:
        return True
    return False


def _iter_repo_files_for_tree(root: Path) -> Iterable[str]:
    for path in root.rglob("*"):
        if path.is_dir():
            continue
        rel = path.relative_to(root).as_posix()
        if rel.startswith(".git/") or rel.startswith(".venv/"):
            continue
        if _is_probably_secret_path(rel):
            continue
        yield rel


def _read_small_text_files(root: Path, max_bytes: int = 40_000, max_files: int = 60) -> list[dict]:
    """Return a list of {path, content} for small files. Excludes .venv/.git and secret-ish names."""
    out: list[dict] = []
    for rel in list(_iter_repo_files_for_tree(root))[: max_files * 5]:
        if len(out) >= max_files:
            break
        p = root / rel
        if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar", ".gz", ".so"}:
            continue
        try:
            data = p.read_bytes()
        except Exception:
            continue
        if len(data) > max_bytes:
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        out.append({"path": rel, "content": text})
    return out


def _build_context(share_files: bool) -> str:
    tree = sorted(_iter_repo_files_for_tree(REPO_ROOT))
    context = {
        "repo_root": REPO_ROOT.name,
        "tree": tree,
    }
    if share_files:
        context["files"] = _read_small_text_files(REPO_ROOT)
    return json.dumps(context, ensure_ascii=False)


def _validate_rel_path(rel_path: str, allow_prefixes: tuple[str, ...]) -> None:
    if not rel_path or rel_path.startswith("/") or re.match(r"^[A-Za-z]:\\", rel_path):
        raise SystemExit(f"Invalid path (must be repo-relative): {rel_path}")
    if ".." in Path(rel_path).parts:
        raise SystemExit(f"Invalid path (no '..' allowed): {rel_path}")
    if not any(rel_path.startswith(prefix) for prefix in allow_prefixes):
        raise SystemExit(
            f"Path not allowed by policy: {rel_path}. Allowed prefixes: {', '.join(allow_prefixes)}"
        )


def _apply_files(files: list[ProposedFile], allow_prefixes: tuple[str, ...]) -> list[str]:
    written: list[str] = []
    for f in files:
        _validate_rel_path(f.path, allow_prefixes)
        abs_path = REPO_ROOT / f.path
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(f.content, encoding="utf-8")
        written.append(f.path)
    return written


def _get_credential():
    project_api_key = os.getenv("PROJECT_API_KEY", "").strip()
    if project_api_key:
        if AzureKeyCredential is None:
            raise SystemExit(
                "PROJECT_API_KEY is set but AzureKeyCredential is unavailable. "
                "Install azure-core or use DefaultAzureCredential."
            )
        return AzureKeyCredential(project_api_key)
    return DefaultAzureCredential()


def call_agent_and_write(share_files: bool, allow_prefixes: tuple[str, ...]) -> list[str]:
    endpoint = _require_env("USER_ENDPOINT")
    agent_name = _require_env("AGENT_NAME")
    model_deployment = _require_env("MODEL_DEPLOYMENT_NAME")

    credential = _get_credential()
    project_client = AIProjectClient(endpoint=endpoint, credential=credential)

    # Ensure agent exists (bumps version if needed)
    agent = project_client.agents.create_version(
        agent_name=agent_name,
        definition=PromptAgentDefinition(
            model=model_deployment,
            instructions=(
                "You are a code assistant.\n"
                'Return STRICT JSON ONLY with shape: {"files":[{"path":"generated/HELLO_WORLD.md","content":"..."}]}\n'
                f"Policy: you may ONLY write files under these prefixes: {', '.join(allow_prefixes)}\n"
                "Do not include markdown fences. Do not include explanations."
            ),
        ),
    )

    openai_client = project_client.get_openai_client()

    repo_context = _build_context(share_files=share_files)

    prompt = (
        "Task: Create a file generated/HELLO_WORLD.md with a short Hello World message for this project.\n"
        "Include: a title, one sentence about Azure Foundry being connected, and one sentence about feedback pipeline.\n"
        "Repo context (JSON):\n"
        + repo_context
    )

    response = openai_client.responses.create(
        input=[{"role": "user", "content": prompt}],
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )

    text = (response.output_text or "").strip()
    if not text:
        raise SystemExit("Agent returned empty output")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as e:
        raise SystemExit(f"Agent output was not valid JSON: {e}\nRaw output:\n{text}")

    raw_files = payload.get("files")
    if not isinstance(raw_files, list):
        raise SystemExit("Agent JSON must include a 'files' array")

    proposed: list[ProposedFile] = []
    for item in raw_files:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        content = item.get("content")
        if isinstance(path, str) and isinstance(content, str):
            proposed.append(ProposedFile(path=path, content=content))

    if not proposed:
        raise SystemExit("Agent JSON contained no valid files")

    return _apply_files(proposed, allow_prefixes=allow_prefixes)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hello", action="store_true", help="Create generated/HELLO_WORLD.md via agent")
    parser.add_argument(
        "--share-files",
        action="store_true",
        help="Share small file contents with agent (still excludes .venv/.git/.env and secret-ish names)",
    )
    args = parser.parse_args()

    if not args.hello:
        parser.print_help()
        return 2

    written = call_agent_and_write(share_files=args.share_files, allow_prefixes=DEFAULT_ALLOW_PREFIXES)
    print("Wrote files:")
    for p in written:
        print(f"- {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
