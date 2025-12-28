# Copilot instructions (workspace)

## Effort level
- Default to **MEDIUM effort**.
  - Not minimal.
  - Not exhaustive.
  - Prefer a short plan + the smallest correct set of edits.

## Command transparency
- Before **every** terminal command or VS Code task, include a one-line explanation of what it does and why.

## Safety / policies
- Do **not** install Google Chrome (or any Chrome download from Google) for this workspace.
- Prefer existing system browsers and existing installed tooling.

## Engineering preferences
- Keep static pages build-free when possible.
- When removing large generated folders, also update `.gitignore` and provide a short “how to reinstall” note.

## Quality Layer Model (for every game change)
Goal: every build ships as **playable, understandable, and durable**—even when it’s “just a prototype.”

**01 · Comprehension (Clarity)**
- The UI teaches itself: obvious next action, visible state, minimal friction.
- Accessible by default (contrast, keyboard, motion-safe, readable typography).
- “No manual needed” energy: labels beat lore, feedback beats guessing.

**02 · Execution (Craft)**
- Works on any screen (mobile → ultrawide) with intentional layout breakpoints.
- Fast and stable: predictable frame time, lightweight assets, graceful degradation.
- Modular architecture: small surfaces, clear ownership, refactor-safe.

**03 · Integrity (Trust)**
- Secure-by-default: least privilege, no secrets in repo, safe input handling.
- Privacy-first: collect only what’s needed, explain why, allow deletion/export.
- Resilient operations: sensible error handling, retries, timeouts, offline-aware UX.

**04 · Evidence (Measurement)**
- Every feature has a measurable outcome (win/lose, completion, retention, error rate).
- Events are consistent and human-auditable (logs + dashboards, not mystery metrics).
- Iteration-ready: experiments are easy to run, compare, and roll back.

## Games: priority rule
When modifying any game, **prioritize playability and gameplay first**:
- Do not break the core loop (start → play → feedback → end/restart).
- Prefer a smaller change that keeps the game fun and responsive over a bigger refactor.
- If adding UI/telemetry, keep it non-blocking and optional.
- Always preserve controls and performance; avoid stutter/regressions.
