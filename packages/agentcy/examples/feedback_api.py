"""Small FastAPI app exposing a `/feedback` endpoint that uses
`examples.feedback_processor.process_feedback` to normalize and categorize
user feedback. This is intentionally minimal and suitable for local testing
or deployment to a simple host (Azure Functions, Cloud Run, etc.).
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from typing import Any, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from examples.feedback_processor import process_feedback


class FeedbackRequest(BaseModel):
    # New UX: thumbs up/down + optional description
    thumbs_up: Optional[bool] = None
    app: Optional[str] = None
    description: Optional[str] = None

    # Backward-compat (older clients)
    rating: Optional[int] = None
    feedback: Optional[str] = None

    user: Optional[str] = None
    page_url: Optional[str] = None


class Suggestion(BaseModel):
    text: str
    category: str
    confidence: float


class FeedbackResponse(BaseModel):
    suggestions: List[Suggestion]


class CloudSaveRequest(BaseModel):
    app: str
    kind: str = "progress"
    payload: dict[str, Any]
    user: Optional[str] = None
    page_url: Optional[str] = None


class CloudSaveResponse(BaseModel):
    issue_url: str
    issue_number: int


class CloudIssue(BaseModel):
    number: int
    title: str
    body: str
    labels: List[str]
    html_url: str
    created_at: Optional[str] = None


class CloudIssuesResponse(BaseModel):
    repo: str
    label: str
    items: List[CloudIssue]


app = FastAPI(title="Agentcy Feedback API")

# For demo purposes allow all origins; in production restrict this to your site
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"]
)


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _github_request(method: str, url: str, token: str | None, payload: dict | None = None) -> Any:
    data = None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, method=method.upper(), headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else None


def _github_issues_repo() -> str:
    repo = _env("GITHUB_ISSUES_REPO")
    if repo.count("/") != 1:
        raise HTTPException(status_code=500, detail="Server not configured: GITHUB_ISSUES_REPO must be owner/repo")
    return repo


def _github_token_optional() -> str | None:
    # Prefer the API-specific token, but fall back to a more generic name.
    return _env("GITHUB_TOKEN") or _env("SITE_GITHUB_TOKEN") or None


def _github_token_required() -> str:
    token = _github_token_optional()
    if not token:
        raise HTTPException(status_code=503, detail="Cloud persistence not configured: set GITHUB_TOKEN")
    return token


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/feedback", response_model=FeedbackResponse)
def post_feedback(req: FeedbackRequest):
    """Accept raw feedback and return structured suggestions."""
    description_text = (req.description or req.feedback or "").strip()
    suggestions = process_feedback(description_text)

    # Append to a single local file (JSONL). Useful for quick testing.
    # NOTE: on many free hosting tiers, local disk may be ephemeral.
    store_path = os.getenv("FEEDBACK_STORE_PATH", "data/feedback.jsonl").strip() or "data/feedback.jsonl"
    try:
        os.makedirs(os.path.dirname(store_path) or ".", exist_ok=True)
        record = {
            "ts": int(time.time()),
            "app": (req.app or "").strip() or None,
            "thumbs_up": req.thumbs_up,
            "description": description_text or None,
            "page_url": req.page_url,
        }
        if suggestions:
            record["category"] = suggestions[0].get("category")
            record["confidence"] = suggestions[0].get("confidence")
        with open(store_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        # Non-fatal: accepting feedback should still succeed.
        pass

    issue_url: Optional[str] = None
    issues_repo = _env("GITHUB_ISSUES_REPO")  # owner/repo
    github_token = _github_token_optional()
    if issues_repo and github_token:
        try:
            vote = "👍" if req.thumbs_up is True else ("👎" if req.thumbs_up is False else "❔")
            app_name = (req.app or "").strip() or "(unknown app)"
            title = f"Feedback: {vote} {app_name}"

            body_lines = [f"Vote: {vote}", f"App: {app_name}"]
            if req.page_url:
                body_lines.append(f"Page: {req.page_url}")
            if suggestions:
                body_lines.append(f"Category: {suggestions[0].get('category')} (confidence: {suggestions[0].get('confidence')})")
            body_lines.append("")
            body_lines.append("Description:")
            body_lines.append(description_text if description_text else "(none)")

            labels = ["feedback"]
            if req.thumbs_up is True:
                labels.append("thumbs-up")
            elif req.thumbs_up is False:
                labels.append("thumbs-down")
            if suggestions and suggestions[0].get("category") in {"easy", "medium", "hard"}:
                labels.append(str(suggestions[0].get("category")))

            payload = {
                "title": title,
                "body": "\n".join(body_lines),
                "labels": labels,
            }

            api_url = f"https://api.github.com/repos/{issues_repo}/issues"
            data = json.dumps(payload).encode("utf-8")
            request = urllib.request.Request(
                api_url,
                data=data,
                method="POST",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {github_token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(request, timeout=15) as resp:
                created = json.loads(resp.read().decode("utf-8"))
                issue_url = created.get("html_url")
        except Exception:
            # Non-fatal: API should still accept feedback even if issue creation fails.
            issue_url = None

    # Keep response schema stable for existing clients.
    # 'issue_url' is intentionally not part of the response model.
    out = {"suggestions": suggestions}
    if issue_url:
        out["issue_url"] = issue_url
    return out


@app.post("/save", response_model=CloudSaveResponse)
def cloud_save(req: CloudSaveRequest):
    """Persist arbitrary app data to GitHub Issues (cloud DB).

    This is intentionally simple: each save becomes one Issue with labels.
    It unblocks: online saving, Render deploys (ephemeral disk), and a cloud-backed dashboard.
    """
    repo = _github_issues_repo()
    token = _github_token_required()

    app_name = (req.app or "").strip()
    if not app_name:
        raise HTTPException(status_code=422, detail="app is required")
    kind = (req.kind or "progress").strip() or "progress"

    safe_user = (req.user or "").strip() or "anon"
    title = f"Save: {app_name} [{kind}] ({safe_user})"

    body_lines = [
        f"App: {app_name}",
        f"Kind: {kind}",
        f"User: {safe_user}",
    ]
    if req.page_url:
        body_lines.append(f"Page: {req.page_url}")
    body_lines.append("")
    body_lines.append("Payload (JSON):")
    body_lines.append("```json")
    body_lines.append(json.dumps(req.payload, ensure_ascii=False, sort_keys=True))
    body_lines.append("```")

    labels = ["cloud-save", f"app:{app_name}", f"kind:{kind}"]
    payload = {"title": title, "body": "\n".join(body_lines), "labels": labels}

    created = _github_request("POST", f"https://api.github.com/repos/{repo}/issues", token, payload)
    try:
        issue_url = str(created.get("html_url"))
        issue_number = int(created.get("number"))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unexpected GitHub response: {e}")

    return {"issue_url": issue_url, "issue_number": issue_number}


@app.get("/cloud/issues", response_model=CloudIssuesResponse)
def cloud_list_issues(label: str = "cloud-save", limit: int = 25):
    """Read Issues from GitHub (cloud DB) for dashboards.

    Works without a token for public repos (rate-limited). If a token is
    configured, it will use it.
    """
    repo = _github_issues_repo()
    token = _github_token_optional()

    limit = min(100, max(1, int(limit)))
    label = (label or "cloud-save").strip() or "cloud-save"

    query = {
        "state": "open",
        "labels": label,
        "per_page": str(limit),
        "sort": "created",
        "direction": "desc",
    }
    url = f"https://api.github.com/repos/{repo}/issues?{urllib.parse.urlencode(query)}"

    items = _github_request("GET", url, token, None)
    out: list[dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        if "pull_request" in item:
            continue
        labels = item.get("labels") or []
        label_names: list[str] = []
        for l in labels:
            if isinstance(l, dict) and l.get("name"):
                label_names.append(str(l.get("name")))

        out.append(
            {
                "number": int(item.get("number")),
                "title": str(item.get("title") or ""),
                "body": str(item.get("body") or ""),
                "labels": label_names,
                "html_url": str(item.get("html_url") or ""),
                "created_at": item.get("created_at"),
            }
        )

    return {"repo": repo, "label": label, "items": out}


if __name__ == "__main__":
    # Run locally: `uvicorn examples.feedback_api:app --reload --port 8000`
    import uvicorn

    uvicorn.run("examples.feedback_api:app", host="0.0.0.0", port=8000, reload=True)
