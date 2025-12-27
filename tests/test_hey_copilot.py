import subprocess
import sys
import os

REPO_ROOT = os.path.dirname(os.path.dirname(__file__))
HEY = os.path.join(REPO_ROOT, "heyCopilot")


def test_dry_run():
    # Ensure dry-run exits with code 0 and prints expected outline
    proc = subprocess.run([HEY, "speak", "--dry-run"], capture_output=True, text=True)
    assert proc.returncode == 0
    assert "Dry-run" in proc.stdout


if __name__ == "__main__":
    raise SystemExit(test_dry_run())
