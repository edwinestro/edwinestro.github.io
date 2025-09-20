# Copilot Onboarding Instructions

(Keep this file under 2 pages; update when repo structure changes.)

## 1. Repository Summary
This repository is a lightweight static web project that serves interactive browser games (currently a ray‑cast 3D maze demo) plus supporting site UI. There is no build pipeline, bundler, package.json, or external runtime dependency: all logic is plain HTML/CSS/vanilla JavaScript executed directly in the browser. Your typical tasks will involve adding or modifying in‑page scripts, creating new HTML pages, refining the raycaster engine, or adjusting UI components.

## 2. High‑Level Technologies
- Languages: HTML5, CSS3, JavaScript (ES2017+ features OK; no transpilation step)
- Runtime: Modern desktop & mobile browsers (Chrome, Firefox, Edge, Safari). Assume ES modules and Pointer Lock APIs are available.
- No frameworks, build tools, or package managers in use.
- All assets are currently inline (no external textures / images). Performance is prioritized; the engine renders with a custom column raycaster.

## 3. Current Key Files (root directory)
- index.html – Landing page with promotional banner linking to maze game.
- games.html – (Partial / scaffold) earlier or alternate container for game logic; may hold legacy snippets.
- maze.html – Standalone full‑screen capable raycasting game (principal interactive logic).
- .github/copilot-instructions.md – This file.
(No other config/CI files present yet.)

If you add new scripts, prefer separate .js files only if code size or reuse justifies; otherwise stay consistent with current inline <script> type="module"> usage.

## 4. maze.html Architecture Overview
The raycasting engine inside maze.html performs:
1. Initialization: Canvas selection, HUD elements lookup, dynamic DPI resize.
2. Map creation: Procedurally builds a 24x24 character grid (# = wall, . = empty).
3. State object: Player position/angle, pitch, jump state, movement speeds, particle (projectile) list, timing & FPS counters.
4. Input handling:
   - Keyboard: WASD movement, Space jump, Escape toggles menu/pause.
   - Mouse: Pointer lock for yaw (horizontal) + adjustable pitch (vertical) with optional Y inversion.
5. Game loop: requestAnimationFrame -> delta time -> move() -> updateParticles() -> render().
6. Rendering steps:
   - Clear + sky gradient + floor gradient.
   - DDA raycaster per vertical column (column count = canvas width / pixelStep) computing perpendicular wall distance to avoid fisheye.
   - Column draw using fillRect (color shading by distance/side).
   - Particle billboards (simple distance & angle gating, fading alpha).
7. Fullscreen & responsiveness: Body class .playing hides header, stretches canvas to viewport; resizeForDPR adapts resolution for DPI up to 2x.
8. Overlay (start menu) is hidden by adding hidden-force class; game starts immediately.

## 5. Adding / Modifying Features
When adding features (e.g., enemies, textures, minimap):
- Keep the inner loop minimal: avoid per-column allocations; reuse variables.
- If adding textures, implement a small texture sampler (array or ImageData) and consider reducing column count or enabling a pixelStep > 1 to preserve FPS.
- For new UI toggles, update overlay menu and maintain keyboard ESC logic.
- For new input actions, add to keydown/keyup without blocking existing keys.

## 6. Performance Guidelines
- Maintain O(w) ray columns each frame; avoid nested dynamic allocations inside the per-column loop.
- pixelStep may be increased (e.g., 2) on low‑end devices if you implement an auto-scaler: detect FPS < threshold (e.g., 45) for several intervals and adjust.
- Avoid floating object churn (do not create new objects in the ray loop; use primitives).
- Limit array growth of state.shootParticles by capping (e.g., filter earlier or max length) if you add rapid-fire weapons.

## 7. Build / Run / Test / Lint Instructions
There is no formal build system. Actions:
- Run: Open maze.html (or index.html) directly in a browser (file:// or via a static server). Some browsers restrict pointer lock / fullscreen when loaded from file://. If pointer lock fails locally, run a simple static server:
  - Python 3: python3 -m http.server 8080
  - Node (if installed): npx serve .
  - Then visit http://localhost:8080/maze.html
- Bootstrap: None required.
- Install: Not applicable.
- Lint: No tooling configured. If adding one (ESLint/Prettier), document in this file.
- Tests: No test harness present. If you create tests later (e.g., Playwright for interaction), list the exact commands here and mark them as "always run before commit".

Always manually validate after changes:
1. Load index.html, verify banner link to maze.html works.
2. Start game: Confirm overlay disappears, fullscreen engages (if user allows), movement and mouse rotation function, ESC toggles pause (if implemented), and FPS updates.
3. Inspect console for errors (especially after resizing and pointer lock change events).
4. Stress test by holding movement + firing to catch performance regressions.

## 8. Common Failure Modes & Mitigations
| Symptom | Likely Cause | Fix |
| ------- | ------------ | --- |
| Black screen after Start | JavaScript runtime error (e.g., missing function) halts loop | Check console; ensure functions (enterFullscreen, render) defined before use. |
| Walls render overly wide or gaps appear | Incorrect pixelStep or failing to fillRect with correct width | Keep fillRect width = state.pixelStep (>=1). |
| Fisheye distortion | Using raw line distance instead of perpendicular distance | Continue using the perpendicular formula already present. |
| Pointer lock denied | Not initiated by user gesture or insecure origin | Ensure start/change triggered by click; run via http server not file:// if browser blocks. |
| FPS drop after feature addition | Extra allocations or complex per-column work | Move heavy logic outside the per-column loop; precompute; reduce column count (increase pixelStep). |

## 9. Extending Map / Content
Map is a simple array of strings. To add new tile types:
- Expand condition in rendering loop (tile==='#') to treat new solid markers (e.g., 'M').
- If adding interactive tiles, parse them post-generation into a data structure (e.g., portals list) to avoid scanning entire map every frame.

## 10. Accessibility & UI
- Overlay uses role="dialog" and aria-modal; when hiding it, aria attributes are removed. Maintain this pattern if altering overlay logic.
- Provide aria-labels on navigation anchors.
- Any new HUD elements should preserve pointer-events:none to avoid blocking canvas input.

## 11. Repository Layout Guidance
Expected future directories (create as needed):
- /assets/ for images, audio.
- /js/ for larger separated modules (e.g., raycast-engine.js, input.js) if code grows.
- /.github/workflows/ for CI (add future lint or deploy workflows). Update this file when those are introduced.

## 12. Coding Conventions
- Use const/let (no var).
- Keep functions small and pure where possible; side effects (DOM, canvas) localized.
- Prefer descriptive names: px, py (player pos), dir (yaw), pitch, jumpZ.
- Avoid global pollution: wrap new logic in IIFE or modules.
- Add comments above non-trivial math (e.g., DDA steps, perpendicular distance correction).

## 13. Adding Tests (Future Placeholder)
If/when tests are added, document:
- Setup commands (e.g., npm install)
- Test run command (npm test or playwright test)
- Required environment flags
Until then, manual validation stands in for tests.

## 14. CI / Deployment (Currently None)
No GitHub Actions. If you add workflows:
1. Place YAML under .github/workflows/
2. Document each workflow name, triggers, and required success criteria here.

## 15. Agent Operating Instructions
- TRUST this file first. Only search the codebase if required info is missing or appears outdated.
- DO NOT introduce external dependencies (e.g., large frameworks) unless explicitly requested.
- BEFORE submitting changes: Manually reason through performance impact on the render loop.
- WHEN modifying rendering: keep ray loop tight and avoid creating objects per iteration.
- ALWAYS update overlay / fullscreen / pointer lock logic consistently.
- If you add new files or directories, update this file with a concise summary.
- For broad refactors, ensure startGame(), stopGame(), resizeForDPR(), and render() remain coherent and free of circular dependencies.

## 16. Quick Reference (Checklist Before PR)
- Overlay hides on Start; header hidden in fullscreen mode.
- Movement + mouse look responsive (no inverted accidental yaw).
- No console errors or unhandled promise rejections.
- FPS label updates and no memory leak (particle list pruned).
- Resize events correctly re-scale canvas.

## 17. If Something Breaks
1. Open console: capture first error line.
2. Verify recent edit did not shadow a core function.
3. Re-run with minimal changes (comment out new logic) to isolate.
4. Revert to last known good rendering loop if corruption appears.

---
End of instructions. Update responsibly when architecture evolves. The agent should rely on this document and only perform additional searches if necessary.
