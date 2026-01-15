import json
from pathlib import Path

from scripts.export_issues_to_jsonl import export_issues_to_file
from scripts.github_issues_to_pr import Issue


def test_export_issues_to_file(tmp_path, monkeypatch):
    sample = [
        Issue(number=1, title="Typo", body="Fix spelling", html_url="https://x/1"),
        Issue(number=2, title="Controls", body="Add WASD info", html_url="https://x/2"),
    ]

    def fake_list(owner, name, token, label, limit):
        assert owner == "a"
        assert name == "b"
        return sample

    monkeypatch.setattr("scripts.export_issues_to_jsonl._list_feedback_issues", fake_list)

    out = tmp_path / "out.jsonl"
    n = export_issues_to_file("a/b", "token", "feedback", 10, str(out))
    assert n == 2
    lines = out.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["number"] == 1
    assert first["title"] == "Typo"
