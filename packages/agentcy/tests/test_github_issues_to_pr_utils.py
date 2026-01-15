import pytest

from scripts.github_issues_to_pr import _parse_owner_repo, _build_feedback_text, Issue


def test_parse_owner_repo_accepts_owner_repo():
    assert _parse_owner_repo("a/b") == ("a", "b")


def test_parse_owner_repo_accepts_github_url():
    assert _parse_owner_repo("https://github.com/a/b") == ("a", "b")


def test_parse_owner_repo_rejects_invalid():
    with pytest.raises(SystemExit):
        _parse_owner_repo("nope")


def test_build_feedback_text_contains_issue_numbers():
    issues = [
        Issue(number=1, title="Typo", body="Fix spelling", html_url="https://x/1"),
        Issue(number=2, title="Controls", body="Add WASD info", html_url="https://x/2"),
    ]
    text = _build_feedback_text(issues)
    assert "Issue #1" in text
    assert "Issue #2" in text
    assert "Fix spelling" in text
    assert "Add WASD" in text
