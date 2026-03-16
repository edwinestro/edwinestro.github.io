"""AI-900 practice quiz runner (via Azure AI Foundry agent).

This asks 3 *practice* Azure AI Fundamentals questions (not copied exam items),
gets the agent's answers, and validates them against expected key points.

Requires env vars:
- USER_ENDPOINT
- MODEL_DEPLOYMENT_NAME

Optional:
- QUIZ_AGENT_NAME (defaults to 'ai900-tutor')

Auth:
- DefaultAzureCredential (recommended: `az login ... --scope https://ai.azure.com/.default`)
  OR set PROJECT_API_KEY (not recommended for chat).

Run:
  ./.venv/bin/python scripts/ai900_practice_quiz.py
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Callable, List

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.identity import DefaultAzureCredential

try:
    from azure.core.credentials import AzureKeyCredential  # type: ignore
except Exception:  # noqa: BLE001
    AzureKeyCredential = None  # type: ignore


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


def _credential():
    project_api_key = os.getenv("PROJECT_API_KEY", "").strip()
    if project_api_key:
        if AzureKeyCredential is None:
            raise SystemExit("PROJECT_API_KEY is set but AzureKeyCredential is unavailable")
        return AzureKeyCredential(project_api_key)
    return DefaultAzureCredential()


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


@dataclass
class Question:
    prompt: str
    check: Callable[[str], tuple[bool, str]]


def contains_all(answer: str, required_phrases: List[str]) -> tuple[bool, str]:
    a = _norm(answer)
    missing = [p for p in required_phrases if _norm(p) not in a]
    if missing:
        return False, f"Missing key points: {', '.join(missing)}"
    return True, "Contains required key points"


def q1_check(ans: str) -> tuple[bool, str]:
    # AI-900 fundamentals: difference between classification vs regression
    return contains_all(
        ans,
        [
            "classification",
            "categories" ,
            "regression",
            "numeric",
        ],
    )


def q2_check(ans: str) -> tuple[bool, str]:
    # Responsible AI principle: fairness/transparency/privacy/reliability etc.
    # We'll accept any 2 well-known principles + short meaning.
    a = _norm(ans)
    principles = [
        "fairness",
        "reliability",
        "safety",
        "privacy",
        "security",
        "inclusiveness",
        "transparency",
        "accountability",
    ]
    hits = [p for p in principles if p in a]
    if len(set(hits)) < 2:
        return False, "Expected at least 2 Responsible AI principles (e.g., fairness, transparency, privacy/security, accountability)"
    return True, f"Mentions principles: {', '.join(sorted(set(hits)))}"


def q3_check(ans: str) -> tuple[bool, str]:
    # Which Azure service for OCR/reading text in images? Azure AI Vision (Image Analysis / Read)
    a = _norm(ans)
    ok = ("azure ai vision" in a) or ("computer vision" in a) or ("vision" in a and "ocr" in a)
    if not ok:
        return False, "Expected Azure AI Vision / Computer Vision Read (OCR)"
    return True, "Correctly points to Azure AI Vision/Computer Vision OCR"


QUESTIONS = [
    Question(
        prompt=(
            "Practice Q1 (Azure AI Fundamentals): Explain the difference between classification and regression, "
            "and give one example of each. Keep it concise."
        ),
        check=q1_check,
    ),
    Question(
        prompt=(
            "Practice Q2 (Responsible AI): Name at least two Responsible AI principles used in Azure AI and briefly "
            "explain why they matter."
        ),
        check=q2_check,
    ),
    Question(
        prompt=(
            "Practice Q3 (Azure services): You need OCR to extract printed text from an image. "
            "Which Azure AI service/capability would you use and what is it commonly called?"
        ),
        check=q3_check,
    ),
]


def main() -> int:
    endpoint = _require_env("USER_ENDPOINT")
    model = _require_env("MODEL_DEPLOYMENT_NAME")
    quiz_agent_name = os.getenv("QUIZ_AGENT_NAME", "ai900-tutor").strip() or "ai900-tutor"

    project_client = AIProjectClient(endpoint=endpoint, credential=_credential())

    # Create a dedicated quiz agent so we don't overwrite your existing agent's personality.
    agent = project_client.agents.create_version(
        agent_name=quiz_agent_name,
        definition=PromptAgentDefinition(
            model=model,
            instructions=(
                "You are an Azure AI-900 tutor. Answer practice questions accurately and succinctly. "
                "If unsure, say so."
            ),
        ),
    )

    openai_client = project_client.get_openai_client()

    print(f"Using quiz agent: {agent.name}")
    print()

    for i, q in enumerate(QUESTIONS, start=1):
        response = openai_client.responses.create(
            input=[{"role": "user", "content": q.prompt}],
            extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
        )
        ans = (response.output_text or "").strip()
        ok, reason = q.check(ans)

        print(f"Q{i}: {q.prompt}")
        print(f"A{i}: {ans}")
        print(f"Validation: {'CORRECT' if ok else 'NEEDS FIX'} — {reason}")
        print("=" * 80)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
