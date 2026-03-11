"""
rag_chain.py — RAG query pipeline as a self-contained class.
Wraps QueryExpander (RAG-Fusion + RRF) and Reranker (CrossEncoder)
then calls the local Ollama LLM for generation.
"""

import os
from langchain_core.prompts import PromptTemplate
from langchain_community.llms import Ollama
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

from query_expander import QueryExpander
from reranker import Reranker

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHROMA_DB_PATH  = os.getenv("CHROMA_DB_PATH",  "./chroma_db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL",  "all-MiniLM-L6-v2")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",     "gemma3:12b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL",  "http://ollama:11434")

RETRIEVAL_K  = int(os.getenv("RETRIEVAL_K",  "10"))   # docs per query variant
RERANKER_TOP = int(os.getenv("RERANKER_TOP", "5"))    # docs after reranking

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

RAG_PROMPT = PromptTemplate.from_template("""You are a helpful assistant. Answer the question using ONLY the context provided below.
If the answer cannot be found in the context, say "I don't know based on the provided documents."
Do not make up information.

Context:
{context}

Question: {question}

Answer:""")

# ---------------------------------------------------------------------------
# RAGChain
# ---------------------------------------------------------------------------

class RAGChain:
    """
    Full RAG pipeline:
        1. QueryExpander  — RAG-Fusion: generates 3 query variants, searches all 4,
                            merges with Reciprocal Rank Fusion
        2. Reranker       — CrossEncoder scores all fused docs, returns top_k
        3. Ollama LLM     — generates answer from reranked context
    """

    def __init__(self) -> None:
        print("Initialising RAGChain…")

        embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

        self.vectorstore = Chroma(
            persist_directory=CHROMA_DB_PATH,
            embedding_function=embeddings,
        )

        self.llm = Ollama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
        )

        self.expander = QueryExpander(
            llm=self.llm,
            vectorstore=self.vectorstore,
        )

        self.reranker = Reranker()

        print("RAGChain ready.")

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def query(self, question: str) -> dict:
        """
        Run the full RAG pipeline.

        Returns:
            {
                "answer":  str,
                "sources": [
                    {
                        "content":     str,   # chunk text
                        "source":      str,   # filename
                        "page":        int,
                        "chunk_index": int,
                    },
                    ...
                ]
            }
        """
        if not question.strip():
            return {"answer": "Please provide a question.", "sources": []}

        # ── 1. Retrieve via RAG-Fusion ─────────────────────────────────
        fused_docs = self.expander.retrieve(
            question,
            k=RETRIEVAL_K,
            top_n=RETRIEVAL_K,   # pass all fused docs to reranker
        )

        if not fused_docs:
            return {
                "answer": "I don't know based on the provided documents.",
                "sources": [],
            }

        # ── 2. Rerank ──────────────────────────────────────────────────
        reranked_docs = self.reranker.rerank(
            question,
            fused_docs,
            top_k=RERANKER_TOP,
        )

        # ── 3. Build context string ────────────────────────────────────
        context = "\n\n---\n\n".join(
            doc.page_content for doc in reranked_docs
        )

        # ── 4. Generate ────────────────────────────────────────────────
        prompt_text = RAG_PROMPT.format(context=context, question=question)
        answer = self.llm.invoke(prompt_text)

        # ── 5. Format sources for frontend ────────────────────────────
        sources = [
            {
                "content":     doc.page_content,
                "source":      doc.metadata.get("source",      "unknown"),
                "page":        doc.metadata.get("page",        None),
                "chunk_index": doc.metadata.get("chunk_index", None),
            }
            for doc in reranked_docs
        ]

        return {"answer": answer, "sources": sources}