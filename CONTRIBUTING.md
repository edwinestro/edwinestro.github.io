# Contributing to Gaming AI Development

Thank you for your interest in contributing!

## Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/edwinestro/edwinestro.github.io.git
   cd edwinestro.github.io
   ```

2. **Local development**
   ```bash
   make serve        # Static site on port 5173
   make venv         # Python environment for tooling
   ```

## Project Structure

- `Projects/` — Games and hubs (main content)
- `legacy/` — Preserved older builds
- `packages/agentcy/` — Python automation/tooling
- `assets/` — Global site assets
- `tools/` — Utility scripts

## Code Style

- **JavaScript:** Follow ESLint rules (run `eslint "**/*.js"`)
- **HTML:** Semantic elements, proper `aria-` attributes
- **CSS:** Mobile-first, use CSS custom properties

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Keep changes focused and atomic
3. Test locally before submitting
4. Write clear commit messages (conventional commits preferred)
5. Ensure CI passes (lint + tests)

## Quality Layer Model

When modifying games, prioritize:
1. **Playability** — Core loop must work
2. **Clarity** — Self-guided UI, accessible
3. **Craft** — Responsive, performant
4. **Trust** — Secure, privacy-aware

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- For security issues, see [SECURITY.md](SECURITY.md)

## Questions?

Open a Discussion or email edwin.estro@me.com.
