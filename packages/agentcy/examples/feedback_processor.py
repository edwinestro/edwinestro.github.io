"""Small feedback normalization and categorization utilities.

This is an offline processor that takes raw user feedback and returns a
list of structured suggestions with a difficulty label (easy/medium/hard)
and a confidence score. The heuristics are intentionally simple — they
are a starting point you can iterate on and replace with an LLM-based
pipeline later.
"""
from __future__ import annotations

import re
from typing import List, Dict


def normalize_text(text: str) -> str:
    """Normalize whitespace and fix common punctuation spacing."""
    if not text:
        return ""
    s = text.strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([.,!?;:])", r"\1", s)
    return s


def categorize(text: str) -> str:
    """Heuristic categorization into 'easy', 'medium', 'hard'."""
    t = text.lower()
    easy_keywords = ["typo", "spelling", "grammar", "fix text", "small bug", "ui", "ux", "minor"]
    medium_keywords = ["new level", "more levels", "sound", "music", "leaderboard", "save", "multiplayer", "settings"]
    hard_keywords = ["rewrite", "new engine", "rework", "backend", "architecture", "scale", "refactor"]

    for kw in easy_keywords:
        if kw in t:
            return "easy"
    for kw in medium_keywords:
        if kw in t:
            return "medium"
    for kw in hard_keywords:
        if kw in t:
            return "hard"
    # fallback: length-based heuristic
    if len(t) < 60:
        return "easy"
    if len(t) < 200:
        return "medium"
    return "hard"


def process_feedback(raw: str) -> List[Dict]:
    """Return a list of suggestion dicts with normalized text, category and confidence.

    Currently returns a single suggestion per input string. Later this can split
    multi-suggestions, apply LLM paraphrasing, or call an external classifier.
    """
    s = normalize_text(raw)
    if not s:
        return []
    cat = categorize(s)
    # Confidence heuristic: shorter/clearer suggestions get higher confidence
    conf = max(0.5, min(0.99, 1.0 - (len(s) / 1000)))
    return [{"text": s, "category": cat, "confidence": round(conf, 2)}]


if __name__ == "__main__":
    examples = [
        "There's a typo on level 2: 'Draagon' instead of 'Dragon'.",
        "Please add more levels and a leaderboard so I can compete",
        "Completely rewrite the networking to support 1000 players",
    ]
    for e in examples:
        print(process_feedback(e))
