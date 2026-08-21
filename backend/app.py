import os
import json
import hashlib
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google import genai
from google.genai.errors import ServerError, ClientError
import numpy as np
from groq import AsyncGroq
from sentence_transformers import SentenceTransformer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

# ---------- Streaming + model fallback ----------
GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"]
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

AGE_PROFILES = {
    "kid":    "a curious 8-year-old. Use simple words, short sentences, and fun analogies (animals, toys, games). Avoid jargon entirely.",
    "teen":   "a 15-year-old. Be clear and engaging, use relatable analogies (games, social media, school), and it's okay to introduce real terminology if you briefly explain it.",
    "adult":  "a generally educated adult with no specialist background. Be clear, practical, and avoid unnecessary jargon, but don't oversimplify.",
    "expert": "a subject-matter expert. Use precise technical language, skip basic definitions, and focus on nuance, edge cases, and depth.",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KNOWLEDGE_DIR = os.path.join(BASE_DIR, "knowledge")
os.makedirs(KNOWLEDGE_DIR, exist_ok=True)

# ---------- Discover all domains in the knowledge/ folder ----------
domain_cache = {}  # domain_name -> {"chunks": [...], "embeddings": [...]}

def get_available_domains() -> list[str]:
    return [f[:-4] for f in os.listdir(KNOWLEDGE_DIR) if f.endswith(".txt")]

def get_file_hash(filepath: str) -> str:
    with open(filepath, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def load_domain(domain: str):
    if domain in domain_cache:
        return domain_cache[domain]  # already embedded, reuse
    filepath = os.path.join(KNOWLEDGE_DIR, f"{domain}.txt")
    cache_path = os.path.join(KNOWLEDGE_DIR, f"{domain}.embeddings.json")
    current_hash = get_file_hash(filepath)
    # Reuse cached embeddings if the source file hasn't changed
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            cached = json.load(f)
        if cached.get("hash") == current_hash:
            print(f"{domain}: loaded embeddings from cache (no API calls)")
            domain_cache[domain] = {"chunks": cached["chunks"], "embeddings": cached["embeddings"]}
            return domain_cache[domain]

    # No valid cache — compute fresh and save it
    chunks = load_chunks(filepath)
    print(f"{domain}: embedding {len(chunks)} chunks (fresh)")
    embeddings = embed_texts(chunks)

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump({"hash": current_hash, "chunks": chunks, "embeddings": embeddings}, f)

    domain_cache[domain] = {"chunks": chunks, "embeddings": embeddings}
    return domain_cache[domain]

# ---------- RAG setup: load, chunk, embed once at startup ----------
def load_chunks(filepath: str, chunk_size: int = 500) -> list[str]:
    print(f"Loading and chunking knowledge from {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    sentences = text.split(". ")
    chunks, current = [], ""
    print(f"Chunking into pieces of ~{chunk_size} characters...")
    print(f"Total sentences: {len(sentences)}")
    for sentence in sentences:
        if len(current) + len(sentence) < chunk_size:
            current += sentence + ". "
        else:
            chunks.append(current.strip())
            current = sentence + ". "
    if current:
        chunks.append(current.strip())
    return chunks

def get_embedding_model():
    global embedding_model
    if embedding_model is None:
        from sentence_transformers import SentenceTransformer
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return embedding_model

def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()

def cosine_similarity(a, b):
    print(f"Calculating cosine similarity between vectors of length {len(a)} and {len(b)}")
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def ensure_knowledge_file(path: str, default_content: str):
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(default_content)
        # ensure read + write permission for the owner (and read for others)
        os.chmod(path, os.stat.S_IRUSR | os.stat.S_IWUSR | os.stat.S_IRGRP | os.stat.S_IROTH)
        print(f"knowledge.txt not found — created a default one at {path}")

def retrieve_top_chunks(topic: str, domain:str, top_k: int = 3) -> list[str]:
    print(f"Retrieving top {top_k} chunks for topic: {topic}")
    data = load_domain(domain)
    topic_embedding = embed_texts([topic])[0]
    scores = [cosine_similarity(topic_embedding, emb) for emb in data["embeddings"]]
    ranked = sorted(zip(scores, data["chunks"]), key=lambda x: x[0], reverse=True)
    return [chunk for score, chunk in ranked[:top_k]]

# ---------- Prompt builder: RAG context + age tuning ----------
def build_prompt(topic: str, age_group: str, retrieved_chunks: list[str]) -> str:
    print(f"Building prompt for topic '{topic}' and age group '{age_group}' with {len(retrieved_chunks)} retrieved chunks.")
    profile = AGE_PROFILES.get(age_group, AGE_PROFILES["adult"])
    context = "\n\n".join(retrieved_chunks)
    return f"""Explain the topic below to {profile}

Use the context provided to ground your answer. If the context doesn't cover the topic, say so honestly rather than making something up.

Context:
{context}

Topic: {topic}

Keep it well-structured with short paragraphs, using markdown where it helps."""

class QuestionRequest(BaseModel):
    question: str
    age_group: str = "adult"  # "kid" | "teen" | "adult" | "expert"
    domain: str = "general"  # which knowledge file to search

async def generate_stream(req: QuestionRequest):
    retrieved_chunks = retrieve_top_chunks(req.question, req.domain)
    prompt = build_prompt(req.question, req.age_group, retrieved_chunks)
    for model_name in GEMINI_FALLBACKS:
        try:
            response = await client.aio.models.generate_content_stream(
                model=model_name,
                contents=prompt
            )
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
            return  # success — stop here, don't try the next model
        except (ServerError, ClientError) as e:
            print(f"{model_name} failed: {e}")
            continue
    # All Gemini models failed — fall back to Groq
    try:
        stream = await groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        print(f"stream: {stream}")
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception:
        yield "All models are currently unavailable. Please try again shortly."

@app.post("/ask")
async def ask_question(req: QuestionRequest):
    return StreamingResponse(generate_stream(req), media_type="text/plain")

@app.get("/domains")
def list_domains():
    return {"domains": get_available_domains()}