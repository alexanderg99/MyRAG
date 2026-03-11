import json
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_experimental.text_splitter import SemanticChunker
from datasets import load_dataset

HOTPOT_CHROMA_PATH = "./hotpot_chroma_db"

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

print("Loading HotpotQA from RAGBench...")
ds = load_dataset("rungalileo/ragbench", "hotpotqa", split="test[:50]")

# Extract all unique documents across all 50 samples
all_docs = []
seen = set()

for row in ds:
    for doc_text in row["documents"]:
        if doc_text not in seen:
            seen.add(doc_text)
            all_docs.append({
                "text": doc_text,
                "question": row["question"],  # which question this doc belongs to
            })

print(f"Total unique documents: {len(all_docs)}")

# Chunk them
chunker = SemanticChunker(
    embeddings,
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95
)

raw_texts = [d["text"] for d in all_docs]
metadatas = [{"question": d["question"]} for d in all_docs]

chunks = chunker.create_documents(raw_texts, metadatas=metadatas)
print(f"Total chunks: {len(chunks)}")

# Store in separate ChromaDB
vectorstore = Chroma.from_documents(
    chunks,
    embeddings,
    persist_directory=HOTPOT_CHROMA_PATH
)
print(f"HotpotQA vectorstore built and saved to {HOTPOT_CHROMA_PATH}")

# Save eval dataset too
eval_samples = []
for row in ds:
    eval_samples.append({
        "question": row["question"],
        "expected_answer": row["response"],
        "contexts": row["documents"],
        "baseline_faithfulness": row.get("ragas_faithfulness"),
        "baseline_context_relevance": row.get("ragas_context_relevance"),
    })

with open("eval_dataset.json", "w") as f:
    json.dump(eval_samples, f, indent=2)

print(f"Saved {len(eval_samples)} eval samples to eval_dataset.json")