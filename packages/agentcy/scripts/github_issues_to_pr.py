"""Turn GitHub Issues (feedback) into a Foundry-generated PR.

This is the missing glue for the loop:
- Players submit feedback as GitHub Issues (manually or via the widget 'github-issue' mode).
- This script fetches open issues with a label (default: feedback), summarizes them into a single
  feedback prompt, and opens a PR against the target repo using Foundry.

It is designed to run locally OR in GitHub Actions.

Env vars:
- USER_ENDPOINT
- MODEL_DEPLOYMENT_NAME
- GITHUB_TOKEN (PAT with access to the target repo; required unless using --dry-run)

Optional:
- PROJECT_API_KEY (if using Foundry Project API key auth)

Usage (dry-run proposal only):
  USER_ENDPOINT=... MODEL_DEPLOYMENT_NAME=... \
    python3 scripts/github_issues_to_pr.py \
      --repo edwinestro/edwinestro.github.io \
      --label feedback \
      --dry-run

Usage (open PR):
  export GITHUB_TOKEN=...  # do NOT commit
  python3 scripts/github_issues_to_pr.py --repo edwinestro/edwinestro.github.io --label feedback

After opening a PR, the script comments on the included issues and adds the label `in-pr`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class Issue:
    number: int
    title: str
    body: str
    html_url: str


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


def _github_request(method: str, url: str, token: str, payload: dict | None = None) -> Any:
    data = None
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, method=method.upper(), headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else None


def _parse_owner_repo(repo: str) -> tuple[str, str]:
    repo = repo.strip().rstrip("/")
    if repo.startswith("https://github.com/"):
        repo = repo[len("https://github.com/") :]
    if repo.count("/") != 1:
        raise SystemExit("--repo must be owner/repo or a https://github.com/owner/repo URL")
    owner, name = repo.split("/", 1)
    return owner, name


def _list_feedback_issues(owner: str, repo: str, token: str, label: str, limit: int) -> list[Issue]:
    # List issues (not PRs) that are open and match the label.
    # GitHub returns PRs in this endpoint too; filter out items with 'pull_request'.
    query = {
        "state": "open",
        "labels": label,
        "per_page": str(min(100, max(1, limit))),
        "sort": "created",
        "direction": "asc",
    }
    url = f"https://api.github.com/repos/{owner}/{repo}/issues?{urllib.parse.urlencode(query)}"
    data = _github_request("GET", url, token)

    issues: list[Issue] = []
    for item in data or []:
        if not isinstance(item, dict):
            continue
        if "pull_request" in item:
            continue
        labels = item.get("labels") or []
        try:
            label_names = {str(l.get("name") or "").strip().lower() for l in labels if isinstance(l, dict)}
        except Exception:
            label_names = set()
        if "in-pr" in label_names:
            continue
        number = int(item.get("number"))
        title = str(item.get("title") or "").strip()
        body = str(item.get("body") or "").strip()
        html_url = str(item.get("html_url") or "").strip()
        if not title and not body:
            continue
        issues.append(Issue(number=number, title=title, body=body, html_url=html_url))
        if len(issues) >= limit:
            break

    return issues


def _build_feedback_text(issues: list[Issue]) -> str:
    parts: list[str] = []
    parts.append("You are improving a GitHub Pages site based on user feedback issues.")
    parts.append("Use the issues below as the source of truth.")
    parts.append("If multiple issues conflict, pick the smallest safe change.")
    parts.append("")

    for issue in issues:
        parts.append(f"Issue #{issue.number}: {issue.title}")
        if issue.body:
            parts.append(issue.body)
        parts.append(f"URL: {issue.html_url}")
        parts.append("---")

    return "\n".join(parts).strip() + "\n"


def _comment_on_issue(owner: str, repo: str, token: str, issue_number: int, comment: str) -> None:
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments"
    _github_request("POST", url, token, {"body": comment})


def _add_labels(owner: str, repo: str, token: str, issue_number: int, labels: list[str]) -> None:
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/labels"
    _github_request("POST", url, token, {"labels": labels})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="Target repo: owner/repo or https://github.com/owner/repo")
    parser.add_argument("--label", default="feedback", help="Label used to select feedback issues")
    parser.add_argument("--limit", type=int, default=5, help="Max issues to include in one PR")
    parser.add_argument("--base", default="main", help="Base branch (default: main)")
    parser.add_argument(
        "--allow-prefix",
        default="./",
        help="Repo-relative prefix the agent is allowed to modify (default: ./)",
    )
    parser.add_argument(
        "--share-files",
        action="store_true",
        help="Share small file contents with agent (more accurate, more data shared)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only generate generated/pr_proposal.json (no push/PR).",
    )
    args = parser.parse_args()

    owner, name = _parse_owner_repo(args.repo)

    endpoint = _require_env("USER_ENDPOINT")
    model_deployment = _require_env("MODEL_DEPLOYMENT_NAME")

    # For listing issues we also need a token.
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        raise SystemExit("Missing env var: GITHUB_TOKEN (required to read issues)")

    issues = _list_feedback_issues(owner, name, token, label=args.label, limit=args.limit)
    if not issues:
        print(f"No open issues found with label '{args.label}'.")
        return 0

    feedback_text = _build_feedback_text(issues)

    # Call the existing PR creator.
    # We invoke it as a module/script to avoid duplicating logic.
    import subprocess
    import sys

    cmd = [
        sys.executable,
        "scripts/foundry_to_github_pr.py",
        "--repo",
        f"{owner}/{name}",
        "--base",
        args.base,
        "--allow-prefix",
        args.allow_prefix,
        "--feedback",
        feedback_text,
    ]
    if args.share_files:
        cmd.append("--share-files")
    if args.dry_run:
        cmd.append("--dry-run")

    env = os.environ.copy()
    env["USER_ENDPOINT"] = endpoint
    env["MODEL_DEPLOYMENT_NAME"] = model_deployment

    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()

    if result.returncode != 0:
        raise SystemExit(f"PR generation failed.\nSTDOUT:\n{stdout}\n\nSTDERR:\n{stderr}")

    print(stdout)

    if args.dry_run:
        return 0

    # Try to find the PR URL in output.
    pr_url = ""
    for line in stdout.splitlines():
        if re.match(r"^https://github.com/.+/pull/\d+", line.strip()):
            pr_url = line.strip()
            break

    if not pr_url:
        # Non-fatal.
        pr_url = "(PR created; URL not detected in output)"

    comment = (
        "Thanks for the feedback! I opened a PR to address this:\n\n"
        f"{pr_url}\n\n"
        "If this PR doesn't fully cover your report, please add details in a comment."
    )

    for issue in issues:
        try:
            _comment_on_issue(owner, name, token, issue.number, comment)
            _add_labels(owner, name, token, issue.number, ["in-pr"])
        except Exception:
            # Non-fatal; PR is the main deliverable.
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
