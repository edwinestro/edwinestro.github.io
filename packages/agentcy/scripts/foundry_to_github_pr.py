"""Generate a GitHub PR from feedback using an Azure Foundry agent.

What it does:
1) Clones a target GitHub repo to a temporary workdir.
2) Calls an Azure Foundry agent to propose file contents (STRICT JSON).
3) Applies those file writes (constrained to an allowlist prefix).
4) Creates a git branch + commit.
5) Optionally pushes and opens a PR via GitHub REST API.

Safety:
- The agent never gets filesystem access.
- Repo context is shared as JSON (tree + optional small files).
- This script enforces path allowlists and blocks secret-ish paths.
- Use --dry-run to only write outputs under generated/.

Required env vars (Foundry):
- USER_ENDPOINT
- MODEL_DEPLOYMENT_NAME

Auth (Foundry): DefaultAzureCredential OR PROJECT_API_KEY

Required env vars (GitHub) when NOT using --dry-run:
- GITHUB_TOKEN (fine-grained token with repo contents read/write + PRs)

Typical usage (dry-run patch proposal only):
  USER_ENDPOINT=... MODEL_DEPLOYMENT_NAME=... \
    python3 scripts/foundry_to_github_pr.py \
      --repo edwinestro/edwinestro.github.io \
      --base main \
      --allow-prefix ./ \
      --feedback "Add a clearer controls section and fix typo on home page" \
      --dry-run

Then inspect generated/pr_proposal.json.

To actually open a PR:
  export GITHUB_TOKEN=...  # do NOT commit
  python3 scripts/foundry_to_github_pr.py ...
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

# Azure SDK imports are done lazily in propose_changes_via_agent/_get_credential
# so the module can be imported without azure deps installed.
AzureKeyCredential = None


REPO_ROOT = Path(__file__).resolve().parents[3]
GENERATED_DIR = REPO_ROOT / "generated"

# Allowed repos for safety. When not using --dry-run the target must be in this set
ALLOWED_REPOS = {"edwinestro/edwinestro.github.io"}


@dataclass
class ProposedChange:
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
    if lowered.startswith(".git/"):
        return True
    if "secret" in lowered or "token" in lowered or "key" in lowered:
        return True
    return False


def _validate_rel_path(rel_path: str, allow_prefix: str) -> None:
    if not rel_path or rel_path.startswith("/") or re.match(r"^[A-Za-z]:\\", rel_path):
        raise SystemExit(f"Invalid path (must be repo-relative): {rel_path}")
    if ".." in Path(rel_path).parts:
        raise SystemExit(f"Invalid path (no '..' allowed): {rel_path}")
    if _is_probably_secret_path(rel_path):
        raise SystemExit(f"Refusing to write secret-ish path: {rel_path}")

    normalized_allow = allow_prefix.replace("\\", "/")
    if normalized_allow and not normalized_allow.endswith("/"):
        normalized_allow += "/"

    normalized_rel = rel_path.replace("\\", "/")
    if normalized_allow and not normalized_rel.startswith(normalized_allow):
        raise SystemExit(f"Path not allowed by policy: {rel_path}. Allowed prefix: {allow_prefix}")


def _iter_repo_files_for_tree(root: Path) -> Iterable[str]:
    for path in root.rglob("*"):
        if path.is_dir():
            continue
        rel = path.relative_to(root).as_posix()
        if rel.startswith(".git/"):
            continue
        if rel.startswith(".venv/"):
            continue
        if _is_probably_secret_path(rel):
            continue
        yield rel


def _read_small_text_files(root: Path, max_bytes: int = 50_000, max_files: int = 80) -> list[dict]:
    out: list[dict] = []
    for rel in list(_iter_repo_files_for_tree(root))[: max_files * 6]:
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


def _get_credential():
    project_api_key = os.getenv("PROJECT_API_KEY", "").strip()
    if project_api_key:
        if AzureKeyCredential is None:
            raise SystemExit(
                "PROJECT_API_KEY is set but AzureKeyCredential is unavailable. "
                "Install azure-core or use DefaultAzureCredential."
            )
        return AzureKeyCredential(project_api_key)
    # Prefer Azure CLI credential when available (user ran `az login`).
    try:
        from azure.identity import AzureCliCredential

        return AzureCliCredential()
    except Exception:
        return DefaultAzureCredential()


def _run_git(args: list[str], cwd: Path) -> None:
    # Keep output quiet to avoid leaking tokenized URLs.
    result = subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        raise SystemExit(f"git {' '.join(args)} failed\nstdout: {stdout}\nstderr: {stderr}")


def _github_api_request(method: str, url: str, token: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method.upper(),
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def _build_agent_context(repo_dir: Path, share_files: bool) -> str:
    tree = sorted(_iter_repo_files_for_tree(repo_dir))
    context: dict = {
        "repo": repo_dir.name,
        "tree": tree,
    }
    if share_files:
        context["files"] = _read_small_text_files(repo_dir)
    return json.dumps(context, ensure_ascii=False)


def propose_changes_via_agent(
    *,
    repo_context_json: str,
    feedback_text: str,
    allow_prefix: str,
    agent_name: str,
    model_deployment_name: str,
    endpoint: str,
) -> dict:
    # Import Azure SDK lazily so the module can be imported without requiring azure packages
    try:
        from azure.ai.projects import AIProjectClient
        from azure.ai.projects.models import PromptAgentDefinition
        from azure.identity import DefaultAzureCredential
        try:
            from azure.core.credentials import AzureKeyCredential  # type: ignore
        except Exception:
            pass
    except Exception as e:
        raise SystemExit(
            "Missing required Azure packages (azure.ai.projects, azure.identity). Install them to run this command."
        ) from e

    credential = _get_credential()
    project_client = AIProjectClient(endpoint=endpoint, credential=credential)

    agent = project_client.agents.create_version(
        agent_name=agent_name,
        definition=PromptAgentDefinition(
            model=model_deployment_name,
            instructions=(
                "You are an assistant that prepares small, reviewable website edits.\n"
                "Return STRICT JSON ONLY, no markdown fences, no commentary.\n"
                "Schema:\n"
                "{\n"
                "  \"pr_title\": string,\n"
                "  \"pr_body\": string,\n"
                "  \"commit_message\": string,\n"
                "  \"files\": [{\"path\": string, \"content\": string}]\n"
                "}\n"
                f"Policy: You may ONLY modify/create files under prefix: {allow_prefix}\n"
                "Do not touch secrets, keys, tokens, or CI configs unless explicitly asked.\n"
                "Prefer minimal changes; if unsure, change fewer files."
            ),
        ),
    )

    prompt = (
        "Task: Given user feedback, propose minimal website changes.\n"
        "- Keep changes small and easy to review.\n"
        "- If the feedback mentions a typo, fix it.\n"
        "- If the feedback asks for clarity, add a short section or tweak copy.\n"
        "- Only output JSON per schema.\n\n"
        "User feedback:\n"
        + feedback_text.strip()
        + "\n\nRepo context (JSON):\n"
        + repo_context_json
    )

    openai_client = project_client.get_openai_client()
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

    if not isinstance(payload, dict) or "files" not in payload:
        raise SystemExit("Agent JSON must be an object containing a 'files' array")

    if not isinstance(payload.get("files"), list):
        raise SystemExit("Agent JSON 'files' must be an array")

    return payload


def _apply_proposed_files(repo_dir: Path, allow_prefix: str, files: list[dict]) -> list[str]:
    written: list[str] = []
    for item in files:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        content = item.get("content")
        if not isinstance(path, str) or not isinstance(content, str):
            continue

        rel = path.replace("\\", "/")
        _validate_rel_path(rel, allow_prefix=allow_prefix)

        abs_path = repo_dir / rel
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_text(content, encoding="utf-8")
        written.append(rel)

    if not written:
        raise SystemExit("Agent proposal contained no valid file writes")
    return written


def _default_branch_name() -> str:
    return time.strftime("agent/feedback-%Y%m%d-%H%M%S")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="Target GitHub repo as owner/name")
    parser.add_argument("--base", default="main", help="Base branch (default: main)")
    parser.add_argument(
        "--allow-prefix",
        default="./",
        help="Repo-relative prefix the agent is allowed to modify (default: ./)",
    )
    parser.add_argument(
        "--agent-name",
        default="site-change-proposer",
        help="Foundry agent name (default: site-change-proposer)",
    )
    parser.add_argument("--feedback", help="Feedback text")
    parser.add_argument("--feedback-file", help="Path to a text file containing feedback")
    parser.add_argument(
        "--share-files",
        action="store_true",
        help="Share small file contents with agent (more accurate, more data shared)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not push or open PR; write proposal JSON to generated/ only",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirm making real changes and opening PRs (required for non-dry-run)",
    )
    args = parser.parse_args()

    feedback_text = (args.feedback or "").strip()
    if args.feedback_file:
        feedback_text = Path(args.feedback_file).read_text(encoding="utf-8").strip()
    if not feedback_text:
        raise SystemExit("Provide --feedback or --feedback-file")

    endpoint = _require_env("USER_ENDPOINT")
    model_deployment = _require_env("MODEL_DEPLOYMENT_NAME")

    owner_repo = args.repo.strip()
    if "/" not in owner_repo:
        raise SystemExit("--repo must be formatted as owner/name")

    allow_prefix = args.allow_prefix.strip()
    if allow_prefix in {".", "./"}:
        allow_prefix = ""  # empty means repo root allowed
    allow_prefix = allow_prefix.replace("\\", "/")
    if allow_prefix and not allow_prefix.endswith("/"):
        allow_prefix += "/"

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    # Safety: enforce allowed repo list and require explicit confirmation for non-dry-run
    if not args.dry_run:
        allowed_env = os.getenv("ALLOWED_REPOS", "").strip()
        allowed_set = {r.strip().lower() for r in allowed_env.split(",") if r.strip()} if allowed_env else ALLOWED_REPOS
        if owner_repo.lower() not in allowed_set:
            raise SystemExit(f"Target repo {owner_repo} not in ALLOWED_REPOS")
        if not args.confirm:
            raise SystemExit("Non-dry-run requires --confirm flag to proceed")

    if args.dry_run:
        # Use a temp clone anyway to build accurate context without touching local dirs.
        work_dir = Path(tempfile.mkdtemp(prefix="agentcy-site-"))
        try:
            repo_dir = work_dir / "repo"
            clone_url = f"https://github.com/{owner_repo}.git"
            _run_git(["clone", "--depth", "1", "--branch", args.base, clone_url, str(repo_dir)], cwd=work_dir)

            repo_context = _build_agent_context(repo_dir, share_files=args.share_files)
            proposal = propose_changes_via_agent(
                repo_context_json=repo_context,
                feedback_text=feedback_text,
                allow_prefix=(allow_prefix or "./"),
                agent_name=args.agent_name,
                model_deployment_name=model_deployment,
                endpoint=endpoint,
            )

            out_path = GENERATED_DIR / "pr_proposal.json"
            out_path.write_text(json.dumps(proposal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"Dry run: wrote proposal to {out_path.as_posix()}")
            return 0
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    token = _require_env("GITHUB_TOKEN")

    work_dir = Path(tempfile.mkdtemp(prefix="agentcy-site-"))
    try:
        repo_dir = work_dir / "repo"
        # Use token for clone to support private repos; avoid printing the URL.
        clone_url = f"https://x-access-token:{token}@github.com/{owner_repo}.git"
        _run_git(["clone", "--depth", "1", "--branch", args.base, clone_url, str(repo_dir)], cwd=work_dir)

        repo_context = _build_agent_context(repo_dir, share_files=args.share_files)
        proposal = propose_changes_via_agent(
            repo_context_json=repo_context,
            feedback_text=feedback_text,
            allow_prefix=(allow_prefix or "./"),
            agent_name=args.agent_name,
            model_deployment_name=model_deployment,
            endpoint=endpoint,
        )

        pr_title = (proposal.get("pr_title") or "Feedback-driven site update").strip()
        pr_body = (proposal.get("pr_body") or "Automated suggestion from feedback.").strip()
        commit_message = (proposal.get("commit_message") or pr_title).strip()
        files = proposal.get("files")

        written = _apply_proposed_files(repo_dir, allow_prefix=allow_prefix, files=files)

        branch = _default_branch_name()
        _run_git(["checkout", "-b", branch], cwd=repo_dir)
        _run_git(["add", "-A"], cwd=repo_dir)
        _run_git(["commit", "-m", commit_message], cwd=repo_dir)

        # Push using token-auth remote; keep quiet.
        _run_git(["push", "-u", "origin", branch], cwd=repo_dir)

        owner, repo = owner_repo.split("/", 1)
        pr = _github_api_request(
            "POST",
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            token,
            {"title": pr_title, "head": branch, "base": args.base, "body": pr_body},
        )

        url = pr.get("html_url") or "(no url returned)"
        print("Opened PR:")
        print(url)
        print("Changed files:")
        for p in written:
            print(f"- {p}")
        return 0

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
