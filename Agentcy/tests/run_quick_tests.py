import os
import sys
import shutil
import tempfile
from pathlib import Path

# Ensure repo root is importable for scripts package
# Add Agentcy/ to sys.path so we can import scripts as a top-level module
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Provide lightweight fake azure modules so top-level imports succeed in test environment
import types
sys.modules.setdefault("azure", types.ModuleType("azure"))
sys.modules.setdefault("azure.ai", types.ModuleType("azure.ai"))
sys.modules.setdefault("azure.ai.projects", types.ModuleType("azure.ai.projects"))
sys.modules.setdefault("azure.ai.projects.models", types.ModuleType("azure.ai.projects.models"))
sys.modules.setdefault("azure.identity", types.ModuleType("azure.identity"))
sys.modules.setdefault("azure.core", types.ModuleType("azure.core"))
sys.modules.setdefault("azure.core.credentials", types.ModuleType("azure.core.credentials"))

from scripts import foundry_to_github_pr
from scripts import commit_aggregated_feedback


def test_foundry_disallowed_repo_fails():
    os.environ["USER_ENDPOINT"] = "https://example.invalid"
    os.environ["MODEL_DEPLOYMENT_NAME"] = "dummy-model"
    sys_argv = ["prog", "--repo", "bad/other", "--feedback", "x"]
    try:
        sys.argv = sys_argv
        foundry_to_github_pr.main()
    except SystemExit as e:
        if "ALLOWED_REPOS" in str(e):
            print("PASS: foundry disallowed repo check")
            return 0
        else:
            print("FAIL: unexpected exit message:", e)
            return 2
    print("FAIL: expected SystemExit")
    return 1


def test_commit_aggregated_feedback_dry_run_writes_preview(tmp_dir):
    tmp_dir = Path(tmp_dir)
    input_file = tmp_dir / "input.jsonl"
    input_file.write_text("line1\nline2\n", encoding="utf-8")

    sys_argv = [
        "prog",
        "--repo",
        "edwinestro/edwinestro.github.io",
        "--file",
        str(input_file),
        "--target-path",
        "feedback/all_feedback.jsonl",
        "--dry-run",
    ]
    sys.argv = sys_argv

    generated = Path(__file__).resolve().parents[1] / "generated"
    if generated.exists():
        shutil.rmtree(generated)

    rc = commit_aggregated_feedback.main()
    if rc != 0:
        print("FAIL: main returned", rc)
        return 3

    preview = generated / "commit_preview" / "feedback" / "all_feedback.jsonl"
    if not preview.exists():
        print("FAIL: preview not created")
        return 4

    if preview.read_text(encoding="utf-8") != input_file.read_text(encoding="utf-8"):
        print("FAIL: preview content mismatch")
        return 5

    meta = generated / "commit_preview" / "meta.json"
    if not meta.exists():
        print("FAIL: meta not found")
        return 6

    print("PASS: commit_aggregated_feedback dry-run preview created")
    return 0


if __name__ == "__main__":
    rc1 = test_foundry_disallowed_repo_fails()
    rc2 = test_commit_aggregated_feedback_dry_run_writes_preview(tempfile.mkdtemp(prefix="agentcy-test-"))
    if rc1==0 and rc2==0:
        print("ALL QUICK TESTS PASS")
        sys.exit(0)
    else:
        print("SOME QUICK TESTS FAILED", rc1, rc2)
        sys.exit(1)
