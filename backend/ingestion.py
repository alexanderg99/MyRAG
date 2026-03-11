"""
ingestion.py — PDF loading, semantic chunking, embedding, ChromaDB storage.
Sends real-time progress updates via a WebSocketManager instance.

OCR support: pass use_ocr=True to ingest_pdf() for scanned PDFs.
OCRmyPDF adds a searchable text layer to the PDF first, then the
normal PyMuPDF pipeline runs on the result unchanged.
"""

import os
import shutil
import tempfile
import fitz  # PyMuPDF
from pathlib import Path
from typing import Callable

import ocrmypdf

from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
PDF_STORAGE_PATH = os.getenv("PDF_STORAGE_PATH", "./storage/pdfs")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# SemanticChunker breakpoint sensitivity (options: "percentile", "standard_deviation", "interquartile")
BREAKPOINT_THRESHOLD_TYPE = "percentile"


# ---------------------------------------------------------------------------
# Embedding model (singleton — loaded once at import time)
# ---------------------------------------------------------------------------

_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    return _embeddings


# ---------------------------------------------------------------------------
# PDF parsing
# ---------------------------------------------------------------------------

def load_pdf(pdf_path: str) -> list[Document]:
    """
    Parse a PDF with PyMuPDF. Returns one Document per page,
    with metadata: source filename and page number.
    """
    docs: list[Document] = []
    pdf_path = Path(pdf_path)

    with fitz.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf, start=1):
            text = page.get_text()
            if text.strip():  # skip blank pages
                docs.append(Document(
                    page_content=text,
                    metadata={
                        "source": pdf_path.name,
                        "page": page_num,
                        "total_pages": len(pdf),
                    }
                ))

    return docs


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def ocr_pdf(pdf_path: str) -> str:
    """
    Run OCRmyPDF on a scanned PDF and return the path to a new
    temporary PDF with a searchable text layer added.

    The original file is never modified. The caller is responsible
    for cleaning up the temp file when done.

    OCRmyPDF handles:
        - deskewing crooked pages
        - auto-rotating misrotated pages
        - multi-core processing
        - preserving original image quality
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()

    ocrmypdf.ocr(
        pdf_path,
        tmp.name,
        deskew=True,
        rotate_pages=True,
        jobs=4,               # use 4 CPU cores
        skip_text=True,       # skip pages that already have a text layer
        progress_bar=False,   # suppress CLI progress bar (we have our own)
    )

    return tmp.name


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_documents(docs: list[Document]) -> list[Document]:
    """
    Semantically chunk a list of Documents.
    SemanticChunker splits at meaning boundaries rather than fixed character counts.
    Metadata from each source page is preserved on every resulting chunk.
    """
    embeddings = get_embeddings()
    splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type=BREAKPOINT_THRESHOLD_TYPE,
    )

    chunks: list[Document] = []
    for doc in docs:
        split = splitter.create_documents(
            texts=[doc.page_content],
            metadatas=[doc.metadata],
        )
        chunks.extend(split)

    return chunks


# ---------------------------------------------------------------------------
# Vector store helpers
# ---------------------------------------------------------------------------

def get_vectorstore() -> Chroma:
    """Return the persistent ChromaDB vectorstore (read-only, for querying)."""
    return Chroma(
        persist_directory=CHROMA_DB_PATH,
        embedding_function=get_embeddings(),
    )


def _add_chunks_to_chroma(chunks: list[Document]) -> None:
    """
    Upsert chunks into ChromaDB. Uses the (source, page, chunk_index)
    triple as a stable ID so re-ingesting the same PDF is idempotent.
    """
    # Build stable IDs
    ids: list[str] = []
    for i, chunk in enumerate(chunks):
        source = chunk.metadata.get("source", "unknown")
        page = chunk.metadata.get("page", 0)
        ids.append(f"{source}::page{page}::chunk{i}")

    # Add chunk_index to metadata for display later
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = i

    vectorstore = Chroma(
        persist_directory=CHROMA_DB_PATH,
        embedding_function=get_embeddings(),
    )
    vectorstore.add_documents(documents=chunks, ids=ids)


# ---------------------------------------------------------------------------
# Progress callback type
# ---------------------------------------------------------------------------

# A simple async callable: progress_fn(stage: str, pct: int, detail: str)
ProgressFn = Callable[[str, int, str], None]


# ---------------------------------------------------------------------------
# Main ingestion entry point
# ---------------------------------------------------------------------------

async def ingest_pdf(
    filename: str,
    progress_fn: ProgressFn | None = None,
    use_ocr: bool = False,
) -> dict:
    """
    Full ingestion pipeline for a single PDF already saved to PDF_STORAGE_PATH.

    Args:
        filename:    Name of the PDF file inside PDF_STORAGE_PATH.
        progress_fn: Async callable for real-time progress updates.
                     Signature: await progress_fn(stage, pct, detail)
                     Pass None to run silently.
        use_ocr:     Set True for scanned PDFs. OCRmyPDF will add a
                     searchable text layer before the normal pipeline runs.

    Stages and approximate progress percentages (without OCR):
        0%   — start
        10%  — PDF loaded
        40%  — chunking complete
        90%  — embeddings written to ChromaDB
        100% — done

    With OCR enabled, an extra stage runs first (0% → 20%),
    and subsequent stages are shifted accordingly.
    """

    async def _send(stage: str, pct: int, detail: str = "") -> None:
        if progress_fn:
            await progress_fn(stage, pct, detail)

    pdf_path = Path(PDF_STORAGE_PATH) / filename
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    ocr_tmp_path: str | None = None

    try:
        # ── Stage 0 (optional): OCR ────────────────────────────────────────
        if use_ocr:
            await _send("ocr", 0, f"Running OCR on {filename} — this may take several minutes…")
            ocr_tmp_path = ocr_pdf(str(pdf_path))
            load_path = ocr_tmp_path
            await _send("ocr", 20, "OCR complete, extracting text…")
        else:
            load_path = str(pdf_path)

        # ── Stage 1: Load PDF ──────────────────────────────────────────────
        start_pct = 20 if use_ocr else 0
        await _send("loading", start_pct, f"Opening {filename}")
        docs = load_pdf(load_path)
        page_count = len(docs)
        await _send("loading", start_pct + 10, f"Loaded {page_count} pages")

        if page_count == 0:
            raise ValueError(f"No readable text found in {filename}")

        # ── Stage 2: Semantic chunking ─────────────────────────────────────
        chunk_start = 35 if use_ocr else 15
        await _send("chunking", chunk_start, "Starting semantic chunking…")
        chunks = chunk_documents(docs)
        chunk_count = len(chunks)
        await _send("chunking", chunk_start + 15, f"Created {chunk_count} chunks from {page_count} pages")

        # ── Stage 3: Embed + store ─────────────────────────────────────────
        embed_start = 55 if use_ocr else 45
        await _send("embedding", embed_start, "Embedding chunks and writing to ChromaDB…")

        BATCH_SIZE = 50
        total_batches = max(1, (chunk_count + BATCH_SIZE - 1) // BATCH_SIZE)

        for batch_num in range(total_batches):
            start = batch_num * BATCH_SIZE
            end = min(start + BATCH_SIZE, chunk_count)
            batch = chunks[start:end]

            _add_chunks_to_chroma(batch)

            batch_pct = embed_start + int((batch_num + 1) / total_batches * (90 - embed_start))
            await _send(
                "embedding",
                batch_pct,
                f"Embedded chunks {end}/{chunk_count}",
            )

        # ── Stage 4: Done ──────────────────────────────────────────────────
        await _send("complete", 100, f"Ingestion complete — {chunk_count} chunks stored")

        return {
            "filename": filename,
            "pages": page_count,
            "chunks": chunk_count,
            "status": "success",
        }

    finally:
        # Always clean up the OCR temp file
        if ocr_tmp_path and Path(ocr_tmp_path).exists():
            Path(ocr_tmp_path).unlink()


# ---------------------------------------------------------------------------
# Document listing helper (used by GET /documents)
# ---------------------------------------------------------------------------

def list_ingested_documents() -> list[dict]:
    """
    Return a deduplicated list of documents stored in ChromaDB,
    grouped by source filename.
    """
    vectorstore = get_vectorstore()
    collection = vectorstore._collection  # access underlying chromadb collection
    results = collection.get(include=["metadatas"])

    seen: dict[str, dict] = {}
    for meta in results["metadatas"]:
        source = meta.get("source", "unknown")
        if source not in seen:
            seen[source] = {
                "filename": source,
                "total_pages": meta.get("total_pages", "?"),
                "chunk_count": 1,
            }
        else:
            seen[source]["chunk_count"] += 1

    return list(seen.values())