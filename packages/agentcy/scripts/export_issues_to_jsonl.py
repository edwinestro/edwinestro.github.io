"""Export labeled GitHub Issues to a single JSONL file."""

from __future__ import annotations

import argparse
import json
import os
from typing import List

from scripts.github_issues_to_pr import _list_feedback_issues, _parse_owner_repo


def export_issues_to_file(repo: str, token: str, label: str, limit: int, out_path: str) -> int:
    owner, name = _parse_owner_repo(repo)
    issues = _list_feedback_issues(owner, name, token, label=label, limit=limit)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for issue in issues:
            rec = {
                "number": issue.number,
                "title": issue.title,
                "body": issue.body,
                "url": issue.html_url,
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return len(issues)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--label", default="feedback")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--out", default="generated/all_feedback.jsonl")
    args = parser.parse_args()

    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        raise SystemExit("Missing env var: GITHUB_TOKEN")

    n = export_issues_to_file(args.repo, token, args.label, args.limit, args.out)
    print(f"Exported {n} issues to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
