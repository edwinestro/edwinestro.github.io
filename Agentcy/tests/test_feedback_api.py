import sys
from pathlib import Path

from fastapi.testclient import TestClient

# Ensure Agentcy/ is on sys.path so `examples.*` imports resolve when running from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from examples.feedback_api import app


client = TestClient(app)


def test_post_feedback():
    payload = {"thumbs_up": False, "app": "thermal-drift", "description": "There's a typo on level 2: 'Draagon'"}
    r = client.post("/feedback", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)
    assert data["suggestions"][0]["category"] == "easy" or data["suggestions"][0]["confidence"] >= 0.5


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_cloud_save_requires_config(monkeypatch):
    monkeypatch.delenv("GITHUB_ISSUES_REPO", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    r = client.post("/save", json={"app": "science-lab", "kind": "progress", "payload": {"level": 1}})
    # Missing repo => server misconfigured
    assert r.status_code in {500, 503}


def test_cloud_list_requires_repo(monkeypatch):
    monkeypatch.delenv("GITHUB_ISSUES_REPO", raising=False)
    r = client.get("/cloud/issues")
    assert r.status_code == 500
