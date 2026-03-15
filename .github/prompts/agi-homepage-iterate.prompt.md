---
mode: agent
description: "Iterate on the AGI 3D homepage sphere — analyze touch behavior evidence and improve adaptive response."
tools:
  - replace_string_in_file
  - multi_replace_string_in_file
  - read_file
  - grep_search
  - semantic_search
  - file_search
  - list_dir
  - run_in_terminal
  - get_errors
  - screenshot_page
  - navigate_page
  - read_page
---

# AGI Homepage Iteration Prompt

Continue the AGI homepage work from the current repo state.

## Required Context — Read First

1. Read `docs/agent/TOUCH_TRACE_AGI_ARCHITECTURE.md` — this is the master design doc.
2. Read the current `index.html` inline `<script type="module">` section to understand the live runtime.

## Current Scene State

- **Latest touch trace session id**: `{{traceSessionId}}` (use `no-trace-session-yet` if none)
- **Current texture profile**: `{{textureProfile}}` (default: `human-head`)
- **Current custom blend**: `{{customBlend}}` (default: `50%`)
- **Current unsupervised layer**: `{{unsupervisedLayer}}` (default: `40%`)
- **Recorded event count**: `{{eventCount}}` (default: `0`)
- **Exported trace files**: check `~/Documents/agi-touch-*.json` if any exist.

## Iteration Steps

### Step 1 — Analyze Touch Behavior Evidence

If a trace session id is provided and files exist at `~/Documents/agi-touch-*.json`:
1. Read the most recent trace file(s).
2. Summarize: event count, duration, touch zones hit, cadence, aggression/care ratio, entropy trajectory.
3. Identify the dominant interaction style (e.g., Gentle Trust, Rhythmic Probing, Percussive Curiosity, Overdrive).

If no trace exists yet:
1. Note this and work from the architecture doc + current code state.
2. Focus on strengthening the existing working memory and reaction system.

### Step 2 — Improve Adaptive AGI Behavior

Make targeted edits in `index.html` to improve the sphere's response. Priority areas:

1. **Working memory** (`workingMemory` object) — ensure trust, stress, curiosity, fatigue, playfulness, avoidance, attachment, coherence, and vigilance are being meaningfully accumulated and decayed.
2. **Feature extraction** (`liveFeatures` object) — ensure tap cadence, drag intent, aggression, care, curiosity, persistence, recovery, percussive bias, rhythm, soothing, revisit, boundary respect, and novelty are computed from real interaction data.
3. **Reaction policy** (`applyTraitsToMaterial`, `updateEntityMotion`, `updateGazeLayer`) — ensure the sphere's motion, surface, and attention respond to working memory state, not just hardcoded thresholds.
4. **Poke pattern recognition** (`pokePatterns`, `registerPokePattern`, `updatePokeEffects`) — ensure rapid taps, rhythm locks, mega bursts, and gentle combos trigger cool visual effects.
5. **Unsupervised layer** — make it reflect latent interaction state (calm = broad coherent halos, overstimulation = fragmented jitter).

### Step 3 — Preserve Stability

- Do NOT break the core loop: `animate()` → `breathe()` → `updateEntityMotion()` → `render()`.
- Do NOT break the tracker: `recordTouchTrace()`, start/stop/save buttons.
- Do NOT break texture switching or the HUD.
- Test by reloading the browser page and confirming no console errors.

### Step 4 — Report What Changed

After making edits, provide a brief summary:
1. What was changed and why.
2. What evidence (from traces or architecture doc) the change responds to.
3. What the user should try to see the difference.
4. What the next iteration should focus on.

## Key File Locations

| What | Where |
|------|-------|
| Homepage + all 3D code | `index.html` (inline `<script type="module">`) |
| Architecture doc | `docs/agent/TOUCH_TRACE_AGI_ARCHITECTURE.md` |
| Touch trace files | `~/Documents/agi-touch-*.json` |
| Copilot workspace rules | `.github/copilot-instructions.md` |
| This prompt | `.github/prompts/agi-homepage-iterate.prompt.md` |

## Anti-Patterns

- Do NOT add new npm dependencies or build steps. The homepage is a single static HTML file.
- Do NOT refactor the entire file. Make surgical, targeted edits.
- Do NOT add speculative features. Improve what exists based on evidence.
- Do NOT remove existing features to "simplify." Additive and corrective changes only.
