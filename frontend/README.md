# Adaptive RAG Explainer — Frontend

React (Vite) frontend for the Adaptive RAG Explainer app. Lets users pick a topic, a knowledge domain, and an age group, then streams back a tuned, grounded explanation from the backend.

## Features

- **Age selector** — a slider (Kid → Teen → Adult → Expert) that visibly tunes how the explanation is written
- **Domain picker** — dynamically loaded from the backend's `/domains` endpoint, so new knowledge domains show up automatically with no frontend changes
- **Streaming UI** — renders the model's response as it streams in, word by word, instead of a blocking spinner
- **Markdown + math rendering** — formatted answers (bold, lists, headers) render properly, including LaTeX math notation via KaTeX
- **Model transparency** — shows which model actually answered (e.g. Gemini vs. Groq fallback), so it's visible when a fallback kicked in
- **Skeleton loading state** — shown only during the gap between submitting and the first streamed chunk arriving

## Tech stack

- React + Vite
- `react-markdown` + `remark-math` + `rehype-katex` for formatted, math-aware rendering

## Setup

```bash
npm install
```

Create a `.env` file in this folder:
VITE_API_URL=http://localhost:8000

Run locally:

```bash
npm run dev
```

App runs at `http://localhost:5173` by default.

## Build for production

```bash
npm run build
```

Outputs to `dist/`.

## Deployment notes

- Deployed on Netlify as part of a monorepo
- Netlify config lives in the **repo root** (`netlify.toml`), not this folder — Netlify requires it there to correctly resolve the `base` directory setting
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist` (relative to the base directory)
- Set `VITE_API_URL` as an environment variable in Netlify's dashboard, pointing to the deployed backend's URL (not `localhost`)

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Yes | Base URL of the backend API (local or deployed) |

## Notes on connecting to the backend

The backend must have this frontend's deployed URL listed in its CORS `allow_origins` — see [`backend/README.md`](../backend/README.md) for that configuration.