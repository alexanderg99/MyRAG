"""
dataloader.py
─────────────
Samples chunks from ChromaDB and generates a grounded Q&A eval dataset
using Claude API. Outputs eval_dataset.json with 100 pairs.

Usage:
    python dataloader.py
    python dataloader.py --n_pairs 100 --output eval_dataset.json
    python dataloader.py --chroma_path ./chroma_db --collection rag_collection
"""

import os
import json
import random
import argparse
import time
from pathlib import Path

import chromadb
import anthropic
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

CHROMA_PATH      = os.getenv("CHROMA_DB_PATH", "./chroma_db")
COLLECTION_NAME  = os.getenv("CHROMA_COLLECTION", "rag_collection")
ANTHROPIC_KEY    = os.getenv("ANTHROPIC_API_KEY")
TARGET_PAIRS     = 100
SAMPLE_OVERHEAD  = 1.4   # sample 40% more chunks than needed, filter down to 100
MIN_CHUNK_WORDS  = 60    # skip chunks that are too short to generate good questions
MAX_RETRIES      = 3
RETRY_DELAY      = 2     # seconds between retries

# ── Prompt ────────────────────────────────────────────────────────────────────

GENERATION_PROMPT = """\
You are building an evaluation dataset for a RAG (Retrieval-Augmented Generation) system.

Given the following chunk of text from a document, generate ONE high-quality question and a grounded reference answer.

Rules:
- The question must be answerable ONLY using the provided chunk — not general knowledge
- The question must require reading comprehension, not just keyword lookup
- The question must NOT be a yes/no question
- The reference answer must be grounded strictly in the chunk — do not add outside information
- The reference answer should be 2-5 sentences
- Do not ask questions about page numbers, formatting, or metadata

Chunk:
<chunk>
{chunk}
</chunk>

Source: {source} (chunk {chunk_index})

Respond ONLY with valid JSON in this exact format, no preamble, no markdown:
{{
  "question": "...",
  "reference_answer": "...",
  "quality": "good" or "skip",
  "skip_reason": "..." (only if quality is skip, else null)
}}

Set quality to "skip" if: the chunk is a table of contents, index, bibliography, header/footer only, 
or too short/fragmented to generate a meaningful question.
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_all_chunks(chroma_path: str, collection_name: str) -> list[dict]:
    """Load all chunks from ChromaDB, return as list of dicts."""
    client = chromadb.PersistentClient(path=chroma_path)

    try:
        collection = client.get_collection(collection_name)
    except Exception:
        collections = client.list_collections()
        if not collections:
            raise RuntimeError(f"No collections found in ChromaDB at {chroma_path}")
        collection = client.get_collection(collections[0].name)
        print(f"[dataloader] Using collection: {collection.name}")

    total = collection.count()
    print(f"[dataloader] Found {total} chunks in collection '{collection.name}'")

    if total == 0:
        raise RuntimeError("Collection is empty — ingest a document first.")

    # Fetch all chunks (ChromaDB paginates at 1000 by default)
    results = collection.get(
        include=["documents", "metadatas"],
        limit=total
    )

    chunks = []
    for i, (doc, meta) in enumerate(zip(results["documents"], results["metadatas"])):
        chunks.append({
            "id": results["ids"][i],
            "text": doc,
            "source": meta.get("source", "unknown"),
            "page": meta.get("page", "?"),
            "chunk_index": meta.get("chunk_index", i),
        })

    return chunks


def filter_chunks(chunks: list[dict], min_words: int = MIN_CHUNK_WORDS) -> list[dict]:
    """Remove chunks that are too short or clearly not useful."""
    filtered = [c for c in chunks if len(c["text"].split()) >= min_words]
    print(f"[dataloader] {len(filtered)}/{len(chunks)} chunks passed word-count filter (>= {min_words} words)")
    return filtered


def generate_qa_pair(
    client: anthropic.Anthropic,
    chunk: dict,
    retries: int = MAX_RETRIES,
) -> dict | None:
    """Call Claude to generate a Q&A pair for a single chunk. Returns None on failure."""
    prompt = GENERATION_PROMPT.format(
        chunk=chunk["text"],
        source=chunk["source"],
        chunk_index=chunk["chunk_index"],
    )

    for attempt in range(retries):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            parsed = json.loads(raw)

            if parsed.get("quality") == "skip":
                return None

            if not parsed.get("question") or not parsed.get("reference_answer"):
                return None

            return {
                "question": parsed["question"],
                "reference_answer": parsed["reference_answer"],
                "source_chunk": chunk["text"],
                "source_doc": chunk["source"],
                "source_page": chunk["page"],
                "chunk_id": chunk["id"],
            }

        except (json.JSONDecodeError, KeyError) as e:
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
                continue
            print(f"  [!] Parse error on chunk {chunk['id']}: {e}")
            return None

        except anthropic.RateLimitError:
            wait = RETRY_DELAY * (attempt + 2)
            print(f"  [!] Rate limit — waiting {wait}s...")
            time.sleep(wait)
            continue

        except Exception as e:
            print(f"  [!] Unexpected error on chunk {chunk['id']}: {e}")
            return None

    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate eval Q&A dataset from ChromaDB")
    parser.add_argument("--n_pairs",     type=int,   default=TARGET_PAIRS,    help="Target number of Q&A pairs")
    parser.add_argument("--output",      type=str,   default="eval_dataset.json")
    parser.add_argument("--chroma_path", type=str,   default=CHROMA_PATH)
    parser.add_argument("--collection",  type=str,   default=COLLECTION_NAME)
    parser.add_argument("--seed",        type=int,   default=42)
    args = parser.parse_args()

    if not ANTHROPIC_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")

    random.seed(args.seed)
    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    # 1. Load + filter chunks
    all_chunks = load_all_chunks(args.chroma_path, args.collection)
    usable     = filter_chunks(all_chunks)

    # 2. Sample with overhead
    n_sample = min(len(usable), int(args.n_pairs * SAMPLE_OVERHEAD))
    sampled  = random.sample(usable, n_sample)
    print(f"[dataloader] Sampling {n_sample} chunks to generate ~{args.n_pairs} pairs")

    # 3. Generate Q&A pairs
    dataset  = []
    skipped  = 0

    for i, chunk in enumerate(sampled):
        if len(dataset) >= args.n_pairs:
            break

        print(f"  [{len(dataset)+1:>3}/{args.n_pairs}] chunk {i+1}/{n_sample} — {chunk['source']} p.{chunk['page']}", end=" ")

        pair = generate_qa_pair(anthropic_client, chunk)

        if pair is None:
            skipped += 1
            print("→ skipped")
        else:
            pair["pair_id"] = len(dataset) + 1
            dataset.append(pair)
            print("→ ok")

        # Polite pacing to avoid rate limits
        time.sleep(0.3)

    print(f"\n[dataloader] Generated {len(dataset)} pairs ({skipped} skipped/failed)")

    if len(dataset) < args.n_pairs:
        print(f"[!] Warning: only generated {len(dataset)} pairs — consider ingesting a longer document")

    # 4. Save
    output_path = Path(args.output)
    output_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False))
    print(f"[dataloader] Saved → {output_path.resolve()}")

    # 5. Preview
    print("\n── Sample pair ──────────────────────────────────────────────────")
    if dataset:
        sample = random.choice(dataset)
        print(f"Q: {sample['question']}")
        print(f"A: {sample['reference_answer']}")
        print(f"Source: {sample['source_doc']} p.{sample['source_page']}")


if __name__ == "__main__":
    main()