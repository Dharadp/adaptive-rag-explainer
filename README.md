# Adaptive RAG Explainer

A full-stack Retrieval-Augmented Generation app that explains any topic from your own knowledge base — tuned to the asker's age group, from Kid to Expert.

Pick a topic domain (e.g. Earth Science, RAG Concepts), choose an age level, and get a streamed, grounded explanation built from retrieved context instead of guesswork — with automatic fallback across multiple LLM providers when one is unavailable.

## Features

- **Retrieval-Augmented Generation** — answers are grounded in your own `.txt`/domain files, not just the model's training data
- **Age-tuned explanations** — the same topic is explained differently for a Kid, Teen, Adult, or Expert
- **Multi-domain knowledge base** — auto-discovers topic files, no code changes needed to add a new domain
- **Streaming responses** — answers appear word-by-word instead of a blocking wait
- **Multi-provider fallback** — tries multiple Gemini models, then falls back to Groq if all are unavailable
- **Cached embeddings** — knowledge is embedded once and cached to disk, not recomputed on every restart

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, react-markdown |
| Backend | FastAPI, Python (async) |
| LLM | Google Gemini API, Groq (fallback) |
| Embeddings | Gemini Embedding API |
| Retrieval | Cosine similarity over cached vector embeddings |

## Project structure
adaptive-rag-explainer/
├── backend/ # FastAPI server, RAG pipeline, LLM integration
├── frontend/ # React UI
├── netlify.toml # frontend deploy config
└── README.md


## Getting started

See [`backend/README.md`](./backend/README.md) and [`frontend/README.md`](./frontend/README.md) for setup instructions specific to each half.

Quick version:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## What I learned building this

This project was built as a hands-on way to learn Retrieval-Augmented Generation end-to-end — from chunking and embeddings, to cosine similarity search, to prompt construction, to handling real production concerns like streaming responses, provider rate limits, and graceful fallback when a model is unavailable.

## Live demo

- Frontend: [[EXPLAIN IT TO ME | Frontend](https://adaptive-rag-explainer.netlify.app/)] 
- Backend API: [[EXPLAIN IT TO ME | Backend](https://adaptive-rag-explainer.onrender.com)]
- **Adaptive RAG Explainer demo**


https://github.com/user-attachments/assets/d72fa7f9-1420-4b30-9bc3-2d1ba10ff993
