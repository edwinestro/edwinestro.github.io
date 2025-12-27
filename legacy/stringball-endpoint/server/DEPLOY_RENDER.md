# Deploy leaderboard API (free) on Render

This project is a static GitHub Pages site plus a Node.js leaderboard API.
GitHub Pages cannot run Node, so you must deploy the API separately.

## What you get

- Public API for score submissions/reads
- Excel-backed storage (`leaderboard.xlsx`)
- Optional GitHub sync: when a player achieves **#1**, the server commits the updated Excel + JSON snapshot back into your repo.

## Render setup (Web Service)

1. Create an account at https://render.com
2. New → **Web Service**
3. Connect your GitHub repo (the one that hosts `edwinestro.github.io`)
4. Configure:
   - **Root Directory**: `legacy/stringball-endpoint/server`
   - **Build Command**: `npm ci`
   - **Start Command**: `node index.js`
   - **Instance Type**: Free

## Environment variables

Required (public usage):

- `ALLOWED_ORIGINS=https://edwinestro.github.io`

Optional (commit leaderboard back into GitHub on wins):

- `GITHUB_SYNC_ON_WIN=1`
- `GITHUB_TOKEN=...` (fine-grained PAT with **Contents: Read/Write** for this repo)
- `GITHUB_OWNER=edwinestro`
- `GITHUB_REPO=edwinestro.github.io`
- `GITHUB_BRANCH=main` (or `master`)
- `GITHUB_XLSX_PATH=Projects/games/thermal-drift/leaderboard.xlsx`
- `GITHUB_JSON_PATH=Projects/games/thermal-drift/leaderboard.json`

## Point the game to your deployed API

Open your game with:

`https://edwinestro.github.io/Projects/games/thermal-drift/index.html?api=https://YOUR-RENDER-URL`

The game stores that URL in `localStorage` so the query param is only needed once.
