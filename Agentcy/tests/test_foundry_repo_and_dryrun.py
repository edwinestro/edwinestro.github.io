import os
import sys
import json
from pathlib import Path
import tempfile
import shutil

import pytest

from scripts import foundry_to_github_pr
from scripts import commit_aggregated_feedback


def test_foundry_disallowed_repo_fails(monkeypatch, tmp_path):
    # Ensure Foundry env vars are present so checks proceed to allowed-repo check
    monkeypatch.setenv("USER_ENDPOINT", "https://example.invalid")
    monkeypatch.setenv("MODEL_DEPLOYMENT_NAME", "dummy-model")

    monkeypatch.setattr(sys, "argv", ["prog", "--repo", "bad/other", "--feedback", "x"])

    with pytest.raises(SystemExit) as exc:
        foundry_to_github_pr.main()
    assert "ALLOWED_REPOS" in str(exc.value)


def test_commit_aggregated_feedback_dry_run_writes_preview(tmp_path, monkeypatch):
    # create a temp input file
    input_file = tmp_path / "input.jsonl"
    input_file.write_text("line1\nline2\n", encoding="utf-8")

    # set argv
    monkeypatch.setenv("PYTHONWARNINGS", "ignore")
    monkeypatch.setattr(sys, "argv", [
        "prog",
        "--repo",
        "edwinestro/edwinestro.github.io",
        "--file",
        str(input_file),
        "--target-path",
        "feedback/all_feedback.jsonl",
        "--dry-run",
    ])

    # ensure generated dir is clean
    generated = Path(__file__).resolve().parents[1] / "generated"
    if generated.exists():
        shutil.rmtree(generated)

    # run
    rc = commit_aggregated_feedback.main()
    assert rc == 0

    # assert preview file exists
    preview = generated / "commit_preview" / "feedback" / "all_feedback.jsonl"
    assert preview.exists()
    assert preview.read_text(encoding="utf-8") == input_file.read_text(encoding="utf-8")

    meta = generated / "commit_preview" / "meta.json"
    assert meta.exists()
    meta_data = json.loads(meta.read_text(encoding="utf-8"))
    assert meta_data["repo"] == "edwinestro/edwinestro.github.io"
    assert meta_data["target_path"] == "feedback/all_feedback.jsonl"
