#!/usr/bin/env python3
"""Update Projects/data/games.json with updatedAt timestamps.

Goal:
- Provide a simple, repo-local "database" for the Science Lab hub.
- Ensure each game entry has a stable updatedAt (ISO-8601) derived from the
  latest filesystem modification time of its sourcePath.
- Auto-discover new games in Projects/games/* that contain an index.html.

This is intentionally dependency-free.

Usage:
  python3 tools/update_games_db.py

It will update:
  Projects/data/games.json
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "Projects" / "data" / "games.json"
PROJECT_GAMES_DIR = REPO_ROOT / "Projects" / "games"


def _iso_from_epoch(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _latest_mtime(path: Path) -> Optional[float]:
    """Return latest mtime for a file or directory, or None if missing."""
    if not path.exists():
        return None

    if path.is_file():
        return path.stat().st_mtime

    latest: Optional[float] = None
    # Walk everything under the directory (including nested).
    for root, _dirs, files in os.walk(path):
        for fn in files:
            p = Path(root) / fn
            try:
                mt = p.stat().st_mtime
            except FileNotFoundError:
                continue
            latest = mt if latest is None else max(latest, mt)

    # If directory is empty, fall back to its own mtime
    if latest is None:
        latest = path.stat().st_mtime

    return latest


def _load_db() -> Dict[str, Any]:
    if not DB_PATH.exists():
        raise SystemExit(f"DB not found: {DB_PATH}")

    raw: Any = json.loads(DB_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit(f"Invalid DB schema in {DB_PATH}")

    data = cast(Dict[str, Any], raw)
    if "games" not in data or not isinstance(data["games"], list):
        raise SystemExit(f"Invalid DB schema in {DB_PATH}")
    return data


def _discover_project_games() -> List[Dict[str, Any]]:
    """Discover games in Projects/games/* that have index.html."""
    discovered: List[Dict[str, Any]] = []
    if not PROJECT_GAMES_DIR.exists():
        return discovered

    for child in sorted(PROJECT_GAMES_DIR.iterdir()):
        if not child.is_dir():
            continue
        if not (child / "index.html").exists():
            continue

        game_id = child.name
        # Minimal defaults; user can refine title/desc/badges later in games.json
        title = game_id.replace("-", " ").title()
        discovered.append(
            {
                "id": game_id,
                "title": title,
                "desc": "(Add description in Projects/data/games.json)",
                # NOTE: this href is relative to Projects/hubs/science-lab/
                "href": f"../../games/{game_id}/index.html",
                # Optional: thumbnail path relative to Projects/hubs/science-lab/
                "thumbnail": "assets/featured-science-lab-mock.svg",
                "badges": ["New"],
                "counted": True,
                "sourcePath": f"Projects/games/{game_id}",
                "updatedAt": None,
            }
        )

    return discovered


def _merge_discovered(db_games: List[Dict[str, Any]], discovered: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    by_id: Dict[str, Dict[str, Any]] = {}
    for g in db_games:
        gid = g.get("id")
        if isinstance(gid, str) and gid:
            by_id[gid] = g

    added = 0
    for g in discovered:
        gid = g["id"]
        if gid not in by_id:
            db_games.append(g)
            by_id[gid] = g
            added += 1

    return db_games, added


def _update_timestamps(db: Dict[str, Any]) -> int:
    updated = 0
    games_any = db.get("games")
    if not isinstance(games_any, list):
        return 0

    games_list = cast(List[Any], games_any)

    for item in games_list:
        if not isinstance(item, dict):
            continue

        g = cast(Dict[str, Any], item)

        src_any = g.get("sourcePath")
        if not isinstance(src_any, str) or not src_any:
            continue

        mt = _latest_mtime(REPO_ROOT / src_any)
        if mt is None:
            # If sourcePath missing, leave as-is.
            continue

        iso = _iso_from_epoch(mt)
        if g.get("updatedAt") != iso:
            g["updatedAt"] = iso
            updated += 1

    db["generatedAt"] = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")
    return updated


def main() -> None:
    db = _load_db()

    discovered = _discover_project_games()
    db["games"], added = _merge_discovered(db.get("games", []), discovered)

    updated = _update_timestamps(db)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DB_PATH.write_text(json.dumps(db, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Updated {DB_PATH}")
    if added:
        print(f"- Added {added} newly discovered game(s) from Projects/games/")
    print(f"- Updated timestamps for {updated} game(s)")


if __name__ == "__main__":
    main()
