"""Commit the aggregated feedback file into the target site repo and open a PR.

Usage (run in CI with SITE_GITHUB_TOKEN):
  python3 scripts/commit_aggregated_feedback.py --repo owner/name --file generated/all_feedback.jsonl --target-path feedback/all_feedback.jsonl
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
import json

from scripts.foundry_to_github_pr import _run_git, _github_api_request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--target-path", required=True)
    parser.add_argument("--base", default="main")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Write a local preview under generated/ without pushing",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirm making real changes and opening PRs (required for non-dry-run)",
    )
    args = parser.parse_args()

    owner_repo = args.repo.strip()
    if "/" not in owner_repo:
        raise SystemExit("--repo must be formatted as owner/name")

    # Allowed repos safety
    ALLOWED_REPOS = {"edwinestro/edwinestro.github.io"}
    if not args.dry_run:
        allowed_env = os.getenv("ALLOWED_REPOS", "").strip()
        allowed_set = {r.strip().lower() for r in allowed_env.split(",") if r.strip()} if allowed_env else ALLOWED_REPOS
        if owner_repo.lower() not in allowed_set:
            raise SystemExit(f"Target repo {owner_repo} not in ALLOWED_REPOS")
        if not args.confirm:
            raise SystemExit("Non-dry-run requires --confirm flag to proceed")

    if args.dry_run:
        GENERATED_DIR = Path(__file__).resolve().parents[1] / "generated"
        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        preview_dir = GENERATED_DIR / "commit_preview"
        preview_dir.mkdir(parents=True, exist_ok=True)

        content = Path(args.file).read_text(encoding="utf-8")
        preview_target = preview_dir / args.target_path
        preview_target.parent.mkdir(parents=True, exist_ok=True)
        preview_target.write_text(content, encoding="utf-8")

        meta = {"repo": args.repo, "target_path": args.target_path}
        (preview_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Dry run: wrote preview to {preview_target.as_posix()}")
        return 0

    token = os.getenv("SITE_GITHUB_TOKEN", "").strip()
    if not token:
        raise SystemExit("Missing env var: SITE_GITHUB_TOKEN")

    work_dir = Path(tempfile.mkdtemp(prefix="agentcy-commit-"))
    try:
        repo_dir = work_dir / "repo"
        clone_url = f"https://x-access-token:{token}@github.com/{args.repo}.git"
        _run_git(["clone", "--depth", "1", "--branch", args.base, clone_url, str(repo_dir)], cwd=work_dir)

        target = repo_dir / args.target_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(args.file, str(target))

        branch = f"agent/aggregate-feedback-{os.getpid()}"
        _run_git(["checkout", "-b", branch], cwd=repo_dir)
        _run_git(["add", "-A"], cwd=repo_dir)
        _run_git(["commit", "-m", "Update aggregated feedback file"], cwd=repo_dir)
        _run_git(["push", "-u", "origin", branch], cwd=repo_dir)

        owner, name = args.repo.split("/", 1)
        pr = _github_api_request(
            "POST",
            f"https://api.github.com/repos/{owner}/{name}/pulls",
            token,
            {"title": "Update aggregated feedback file", "head": branch, "base": args.base, "body": "Automated update of aggregated feedback."},
        )
        print(pr.get("html_url") or "(no url)")
        return 0
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
