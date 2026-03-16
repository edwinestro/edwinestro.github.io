# Project Best Practices Guide (Current 2025 State)

Author: Edwin Isaac Estrada Rodriguez  
Reference: https://comuniwasd.github.io

---
## 1. Updated Project Philosophy
A bilingual, low‑friction personal platform highlighting:
- Salesforce / Cloud Architecture & Reliability Engineering
- Leadership, Community Building, Mini‑Game & Esports Creation

Principles:
- Small, composable vanilla JS (no framework lock‑in)
- Content + presentation split (data/i18n objects → DOM render)
- Accessibility as default; progressive enhancement only adds polish
- Performant visual delight (GPU‑friendly transitions, lightweight canvas)
- Clear licensing boundary (code vs authored content)
- Iterative evolution (archive older versions for traceability)

---
## 2. Current High‑Level Structure
```
root/
  index.html            # Landing (2 role tiles + sections + footer effects)
  games.html            # Interactive games hub (bilingual)
  cv.html               # CV (separate page)
  main.js (if legacy)   # Legacy script (migrate pieces into modular form eventually)
  assets/
    css/                # Future extracted styles
    js/                 # Future modular JS (planned refactor target)
    images/             # Images (optimize -> webp/avif over time)
  components/ (legacy v1.0 experiments)
  Games/                # Individual game scripts (legacy naming)
  archive/              # Historical 1.0 / 2.0 snapshots
  docs/ (or root docs)  # Guidance docs
  BEST_PRACTICES.md
  PROMPTS_TUNING.md
```
Refactor direction: migrate inline script logic into `assets/js/` modules gradually (`i18n.js`, `roles.js`, `effects.js`, `contact.js`, `games-i18n.js`).

---
## 3. Active Sections & Ownership
| Section | Purpose | Source of Truth | i18n Coverage |
|---------|---------|-----------------|---------------|
| Role Tiles (2) | Brand & capability snapshot | Inline `i18n` object | Yes |
| Details Panel | Dynamic strengths & focus (Education & References REMOVED) | `i18n` strengths/focus arrays | Yes |
| Education & Continuous Learning | Deep skill timeline | Static HTML (pending i18n) | No (planned) |
| Contact | Lead capture + fast channels | Form markup + JS | Partially (messages) |
| Subscription Modal | Email capture teaser | JS (localStorage gate) | No (planned) |
| Footer (Twinkle + Progress) | Ambient identity + navigation + license | HTML + canvas script | License text i18n |
| Games Page | Launchpad for cognitive mini‑games | `meta` + `pageI18n` objects | Yes |

---
## 4. HTML Standards (Still Apply)
- Landmark elements (`header`, `main`, `section`, `footer`)
- One `<h1>` per page; descending logical order
- Descriptive `alt` for meaningful imagery; decorative canvases `aria-hidden="true"`
- Buttons vs links: navigation → `<a>` / actions → `<button>`

---
## 5. CSS Approach (Inline → Modular Roadmap)
- Tokens in `:root` (`--accent`, `--panel` etc.) unify theming
- Prefer grid/flex + intrinsic sizing (avoid fixed heights)
- Animations: only `transform`, `opacity`; keep shadows static
- Consider future extraction: `base.css`, `layout.css`, `components.css`, `utilities.css`, `effects.css`
- Future: add `@media (prefers-reduced-motion)` to reduce parallax / fade interval

---
## 6. JavaScript Architecture (Current Patterns)
Core functions in `index.html`:
- `setLang(code)` → toggles active language; re-renders tiles + panel
- `updateTiles()` → syncs tile headings, tagline, summary, buttons
- `updatePanel(role)` → renders strengths & focus (education/links removed)
- `activate(tile)` → sets active tile + parallax binding
- Esports image rotator (interval fade between two images)
- Contact form handler (validation + async POST + feedback states)
- WhatsApp CTA (preset; planned dynamic message template)
- Subscription modal gating (localStorage `subHide`)
- Twinkle canvas animation + scroll progress bar

Refactor target modules:
```
assets/js/
  i18n-core.js       // export i18n object
  roles.js           // tile activation + parallax
  contact.js         // form + whatsapp logic
  subscribe.js       // modal gating
  effects.js         // twinkle + scroll progress + image rotation
  lang.js            // setLang + DOM mapping
```
Use IIFE removal + `type="module"` once split.

---
## 7. i18n Strategy
Structure example:
```js
const i18n = {
  en: { coder: { ... }, esports: { ... }, strengthsTitle: 'Core Strengths', ... },
  es: { coder: { ... }, esports: { ... }, strengthsTitle: 'Fortalezas Clave', ... }
};
```
Guidelines:
- Keep only referenced keys (remove orphaned `education`, `links` arrays when panel no longer displays them)
- When adding a new UI label: add to BOTH `en` and `es` in alphabetical/section order
- Avoid embedding HTML in strings (pure text + minimal punctuation)
- Meta description MUST drop deprecated roles (Chef, Construction) → reflect current dual focus
- Provide a translation checklist before commit:
```
[ ] Added key to en
[ ] Added key to es
[ ] Render function updated
[ ] Fallback safe (no runtime undefined)
```
Future: migrate to `assets/js/i18n/*.js` per page.

---
## 8. Accessibility
- Tiles: `tabindex="0"`, `aria-expanded` reflects active
- Language switch: `aria-pressed` on buttons
- Details panel: `aria-live="polite"` for content swap
- Form feedback: `aria-live="polite"` low interruption
- Modal: `role="dialog"`, `aria-modal="true"` (future improvement: focus trap + ESC close)
- Ensure color contrast (accent gradients vs dark backgrounds) ≥ 4.5:1 for text

---
## 9. Performance Practices
Implemented:
- Limited DOM writes during language switch (batch innerHTML updates per list)
- Canvas starfield uses small object pool (70 stars)
Needed Improvements:
- Cache busting: append version query (`?v=2025.09`) to changed assets or hash filenames
- Image optimization: convert large JPEGs to WebP / AVIF + `<picture>`
- Throttle parallax `mousemove` (e.g. requestAnimationFrame guard) if expanding effect list
- Idle tasks: defer subscription modal open via `setTimeout` (OK) or `requestIdleCallback` where supported
- Preload only images actually used (remove legacy chef preload)

---
## 10. Contact & Conversion Guidelines
- Required fields: name, email, message
- Regex email validation (simple pattern – acceptable for client)
- Show state labels: default → sending → sent (timeout resets)
- WhatsApp CTA future enhancement: build message from form fields:
```
Name: <Name>
Focus: <Selected>
Msg: <First 140 chars of message>
```
- Do not send full sensitive content via WhatsApp (truncate)

---
## 11. Licensing Boundary
Display string (bilingual):
- Code: MIT License
- Authored content (text / narrative / images unless explicitly marked) © year Edwin Estrada – All rights reserved.
When adding new AI‑generated text: human review & adapt before publishing.

---
## 12. Games Page Pattern
- Separate `pageI18n` for top-level labels (title, subtitle, meta)
- `meta` object for each game: `{ id, en: { title, desc }, es: { title, desc } }`
- `setLang()` rewrites card text + `<meta name="description">`
- Game mount pattern: factory returns `{ destroy }` so switching cleans intervals/timeouts

---
## 13. Visual Effects Guidelines
| Effect | Constraints | Notes |
|--------|------------|-------|
| Conic gradient border | Only active tile | Keep animation linear, 7s loop |
| Image parallax | Only active tile; scale ≤ 1.06 | Throttle via rAF if expanded |
| Image rotator | 2 images / 4s | Fade with opacity (no layout shift) |
| Twinkle footer | ≤ 70 particles | Random opacity modulation only |
| Scroll progress | Passive scroll listener | Width calc uses doc height |

---
## 14. Future Backlog (Prioritized)
1. Extract JS modules + `type="module"` deployment
2. Full i18n for Education, Contact, Subscription
3. Dynamic WhatsApp message builder
4. Cache busting version util
5. Focus trap + ESC for subscription modal
6. Replace meta description (remove legacy chef / construction terms)
7. Lighthouse & Axe audits (document baseline scores)
8. Add structured data (JSON‑LD Person + sameAs links)
9. Deploy image compression pipeline (GitHub Action optional)
10. Optional PWA (manifest + offline fallback for index & cv)

---
## 15. Commit Message Conventions
Format: `<type>(scope): description`
Types: `feat`, `fix`, `refactor`, `content`, `i18n`, `perf`, `a11y`, `chore`.
Examples:
- `feat(contact): add whatsapp cta button`
- `i18n(roles): update salesforce experience to 4 years`
- `refactor(panel): remove education & references lists`

---
## 16. Quality Gate (Pre‑Push Checklist)
```
[ ] No console errors
[ ] setLang() swaps all visible bilingual strings
[ ] License string correct in both languages
[ ] Contact form submit + error paths tested
[ ] Modal open/close sequence stable (no orphan focus)
[ ] Images load (no 404) & alt text sane
[ ] Meta description reflects current roles
[ ] Scroll progress & twinkle not impacting FPS (Performance tab spot check)
```

---
## 17. Deleting or Deprecating Features
Process:
1. Remove DOM markup
2. Remove related query selectors & function references
3. Purge unused i18n keys
4. Update BEST_PRACTICES (this file) to reflect change
5. Commit with `refactor/remove(feature): rationale`

---
## 18. Safety / Integrity
- Always add `rel="noopener"` on external links (already followed)
- Validate any future user-generated HTML (none currently)
- Keep dependency footprint near zero (security surface small)

---
## 19. Metrics (Lightweight Manual)
- Interaction: count `mouseenter` on active tile in console profiling (future hook)
- Conversion: manual tally of form submissions (Formspree dashboard)

---
## 20. Evolution Cadence
- Monthly: translation completeness pass
- Quarterly: performance + a11y audits
- Biannual: design refresh / imagery rotation review

---
## 21. Rapid Task Onboarding (New Contributor)
1. Read this file
2. Inspect `i18n` object & match DOM selectors
3. Run through both languages verifying text parity
4. Identify any hardcoded English strings → flag for i18n
5. Add or adjust feature using patterns above

---
## 22. The Unsupervised Game (Hybrid Evolution Anchor)
Purpose: Acts as a synthesis sandbox combining mechanics from other mini‑games (sequence recall, spatial mapping, timed reaction pulses, adaptive pacing). Serves as a continuous improvement target: any enhancement to any other game should inspire an iterate‑and‑merge pass here.

Core Principles:
- Hybridization: incorporate at least 2 distinct mechanic families (e.g., sequence + timed pulse) per iteration.
- Adaptive Difficulty: dynamic timing windows / sequence growth tied to accuracy streak.
- Non‑Blocking Feedback: positive reinforcement flashes & subtle error states; avoid hard resets unless repeated failure.
- Minimal State Coupling: preserves own state machine; imports only generic helpers (future `utils/helpers.js`).

Iteration Policy:
Whenever another game is modified (new effect, pacing adjustment, accessibility improvement, scoring model), perform a scoped evaluation:
1. Can this mechanic enrich Unsupervised without cognitive overload?
2. If yes, add behind a level threshold or adaptive trigger.
3. Update BEST_PRACTICES section 22 with summary of the merged enhancement.
4. Keep code self‑documented (inline comments for new mechanic blocks).

Internationalization:
- All new labels added to both languages immediately.
- Keep instruction text concise (< 140 chars per language if possible).

Telemetry Ideas (future):
- Track average decision latency between sequence tiles.
- Count bonus pulse click rate vs spawns.

Accessibility Considerations:
- ARIA labels for pulse element (`aria-label="Pulse bonus"`).
- Color + motion alternatives (add reduced motion path later).

Refactor Targets:
- Extract sequence generator & pulse spawner into reusable utilities for potential cross‑game reuse.

---
Use this as a living guide. Update immediately after structural or i18n-affecting changes.
