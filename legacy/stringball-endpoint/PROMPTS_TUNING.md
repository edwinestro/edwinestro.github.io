# Prompt & Content Tuning Guide (Bilingual Platform)

Goal: Generate consistent, concise, bilingual (EN/ES) content that matches current two‑role focus (Salesforce / Architecture + Leadership & Mini‑Games) without reintroducing deprecated roles (Chef, Construction tile) into active UI.

---
## 1. Core Identity Vocabulary
EN Keywords:
- Salesforce developer, scalable architecture, reliability, testing experience
- Community leadership, mini‑game prototyping, UX feedback loops, accessibility
ES Keywords:
- Desarrollador Salesforce, arquitectura escalable, confiabilidad, experiencia en pruebas
- Liderazgo comunitario, prototipos de mini‑juegos, bucles de retroalimentación UX, accesibilidad
Tone: professional, concise, confident, collaborative.
Avoid: overly salesy adjectives, deprecated roles unless historically contextual.

---
## 2. Role Summaries Template
EN Template:
```
<Years> as Salesforce developer with testing experience. <Key capability sentence>. <Integration/optimization or leadership note>.
```
ES Template:
```
<Years> como desarrollador Salesforce con experiencia en pruebas. <Frase de capacidad clave>. <Nota de integración/optimización o liderazgo>.
```

Mini‑Games / Leadership EN:
```
Community building, web mini‑games, motivational leadership and interactive experiences.
```
Mini‑Games / Leadership ES:
```
Construcción de comunidad, mini‑juegos web, liderazgo motivacional y experiencias interactivas.
```

---
## 3. Bilingual Entry Checklist
When adding a new string:
```
[ ] Add English key
[ ] Add Spanish key
[ ] Keys identical structure (no missing placeholders)
[ ] Updated render function uses the key
[ ] Page tested switching EN ↔ ES (no stale text)
```

---
## 4. Safe Prompt Patterns
Generate Strengths (EN):
```
List 3 concise strengths (2–3 words each) for a senior Salesforce developer focusing on <focus areas>. No punctuation at end.
```
(ES):
```
Enumera 3 fortalezas concisas (2–3 palabras cada una) para un desarrollador senior Salesforce enfocado en <áreas>. Sin punto final.
```

Generate Focus Areas (EN):
```
Provide 3 current focus items (2–4 words each) prioritizing scalability, reliability, automation. No verbs starting with -ing.
```
(ES):
```
Proporciona 3 enfoques actuales (2–4 palabras) priorizando escalabilidad, confiabilidad, automatización. Sin gerundios.
```

Game Descriptor (EN):
```
One sentence (max 14 words) describing a simple cognitive web mini‑game about <mechanic>. Neutral tone.
```
(ES):
```
Una oración (máx 14 palabras) describiendo un mini‑juego web cognitivo sobre <mecánica>. Tono neutro.
```

---
## 5. Meta Description Template
EN:
```
Salesforce architecture & mini‑game creation. 4 years Salesforce development with testing, community leadership.
```
ES:
```
Arquitectura Salesforce y creación de mini‑juegos. 4 años desarrollo Salesforce con pruebas y liderazgo comunitario.
```
Target ≤ 155 chars. Do not mention removed roles.

---
## 6. WhatsApp Message Assembly (Future)
EN Pattern:
```
Hi Edwin – Name: <name> | Focus: <focus or "General"> | Msg: <first 120 chars>
```
ES Pattern:
```
Hola Edwin – Nombre: <name> | Enfoque: <focus or "General"> | Msg: <primeros 120 chars>
```
Trim newline usage (single line) to maximize mobile preview clarity.

---
## 7. Style Constraints
- No trailing periods for list items.
- Sentence case (capitalize first letter, rest natural) for summaries.
- Avoid duplicate wording between strengths and focus arrays.
- Maximum list length (panel): 3 strengths, 3 focus items (enforced visually).

---
## 8. Change Control for Prompts
When updating any template:
```
1. Edit PROMPTS_TUNING.md
2. Run through each role in EN/ES verifying consistency
3. Regenerate only impacted keys (do not rewrite stable sections)
4. Commit with: docs(prompts): refine <area> template
```

---
## 9. Red Flags to Reject
- Chef / Construction resurfacing in active meta or summaries
- Overclaiming (e.g., "world-class", "unparalleled")
- Long paragraphs (> 2 sentences) in summaries
- English punctuation left inside Spanish localization

---
## 10. Quick Regeneration Flow
```
1. Identify target (strengths | focus | summary | meta)
2. Pick proper template & language
3. Generate draft
4. Manual edit for brevity + tone
5. Insert into i18n.en / i18n.es
6. Test toggle
```

---
## 11. Future Extension
Add game-specific prompt templates for difficulty scaling, accessibility hints, and tutorial copy once more games are added.

---
## 12. The Unsupervised Game Prompt Policy
This hybrid title combines mechanics (sequence recall + spatial mapping + timed reaction pulses). Any future improvement to another game (visual effect, scoring tweak, accessibility enhancement) should trigger an evaluation for mirrored or adapted integration here.

When adding a new mechanic:
EN Prompt Template:
```
Describe in <=18 words an additional hybrid mechanic merging <existing mechanic A> with <new mechanic B> emphasizing cognitive variety without overload.
```
ES Prompt Template:
```
Describe en <=18 palabras una mecánica híbrida que combine <mecánica A> con <mecánica B> enfatizando variedad cognitiva sin sobrecarga.
```
Acceptance Checklist:
```
[ ] Mechanic adds a distinct cognitive demand (timing / memory / spatial / inhibition)
[ ] Clear minimal instruction (< 110 chars EN & ES)
[ ] Difficulty scales (time window, sequence length, distractor speed)
[ ] Accessible fallback (reduced motion or alternative cue)
[ ] i18n keys updated (en + es)
```
Scoring Extension Pattern:
```
Base points = sequenceLength * 2
Bonus pulse = +2 (adjustable)
Streak multiplier (optional future): 1 + floor(consecutivePerfect / 5)*0.2
```
Do not add RNG-heavy penalties; focus on rewarding precision & adaptive speed.
---

Keep this guide current; small, disciplined updates reduce churn in conversational requests.
