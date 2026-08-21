# Adaptive RAG Explainer — Backend

FastAPI backend powering the Adaptive RAG Explainer app. Handles document chunking, embeddings, retrieval, prompt construction, and streaming LLM responses with multi-provider fallback.

## How it works

1. On first load (or when a knowledge file changes), each `.txt` file in `knowledge/` is chunked and embedded via the Gemini Embedding API. Results are cached to `knowledge/<domain>.embeddings.json` so restarts don't re-embed unchanged files.
2. When a request comes in, the topic is embedded and compared (cosine similarity) against the relevant domain's cached chunk embeddings.
3. The top-matching chunks are inserted into a prompt, along with age-group-specific tone instructions.
4. The prompt is sent to Gemini, streaming the response back. If Gemini is rate-limited or overloaded, the app automatically retries with other Gemini models, then falls back to Groq.

## Setup

```bash
pip install -r requirements.txt
```

Create a `.env` file in this folder:
GEMINI_API_KEY=your-key-here
GROQ_API_KEY=your-key-here

Run locally:

```bash
uvicorn app:app --reload
```

Server runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

## Adding a new knowledge domain

Drop a new `.txt` file into `knowledge/` — no code changes needed. It's auto-discovered and appears as a selectable domain the next time `/domains` is called. The first request against a new file triggers embedding; every request after that uses the cached `.embeddings.json`.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/domains` | GET | Lists available knowledge domains |
| `/explain-stream` | POST | Streams an age-tuned, retrieval-grounded explanation |

**Request body for `/explain-stream`:**
```json
{
  "topic": "how vaccines work",
  "age_group": "kid",
  "domain": "earth-science"
}
```

## Deployment notes

- Deployed as a Render **Web Service** (not Static Site — this is a running Python server, not static files)
- Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Root/base directory: `backend` (this is a monorepo)
- Set `GEMINI_API_KEY` and `GROQ_API_KEY` as environment variables in Render's dashboard, not committed to the repo
- Embeddings are pre-computed locally and committed (`knowledge/*.embeddings.json`) rather than generated on the server, to avoid heavy runtime dependencies and free-tier memory limits — if you add/change a knowledge file, regenerate and commit its cache locally before deploying

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Gemini chat + embeddings |
| `GROQ_API_KEY` | Yes | Fallback chat completions when Gemini is unavailable |