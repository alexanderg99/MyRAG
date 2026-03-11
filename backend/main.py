"""
main.py — FastAPI application, all routes.
"""

import os
import uuid
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingestion import ingest_pdf, list_ingested_documents
from rag_chain import RAGChain
from websocket_manager import manager

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PDF_STORAGE_PATH = os.getenv("PDF_STORAGE_PATH", "./storage/pdfs")
Path(PDF_STORAGE_PATH).mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App lifecycle — load RAGChain once at startup
# ---------------------------------------------------------------------------

rag_chain: RAGChain | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_chain
    print("Loading RAGChain…")
    rag_chain = RAGChain()
    print("RAGChain ready.")
    yield
    print("Shutting down.")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="RAG API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str

class SourceItem(BaseModel):
    content: str
    source: str
    page: int | None
    chunk_index: int | None

class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceItem]

class UploadResponse(BaseModel):
    filename: str
    job_id: str

class IngestRequest(BaseModel):
    filename: str
    job_id: str
    use_ocr: bool = False

class IngestResponse(BaseModel):
    filename: str
    pages: int
    chunks: int
    status: str

class DocumentItem(BaseModel):
    filename: str
    total_pages: int | str
    chunk_count: int

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """
    Save an uploaded PDF to storage/pdfs/.
    Returns the filename and a job_id to use for WebSocket progress tracking.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    job_id = str(uuid.uuid4())
    dest = Path(PDF_STORAGE_PATH) / file.filename

    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)

    return UploadResponse(filename=file.filename, job_id=job_id)


@app.post("/ingest", response_model=IngestResponse)
async def ingest(body: IngestRequest):
    """
    Trigger the ingestion pipeline for an already-uploaded PDF.
    Streams progress via WebSocket /ws/progress/{job_id}.
    """
    progress_fn = manager.progress_fn(body.job_id)

    try:
        result = await ingest_pdf(
            filename=body.filename,
            progress_fn=progress_fn,
            use_ocr=body.use_ocr,
        )
    except FileNotFoundError as e:
        await manager.send_error(body.job_id, str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await manager.send_error(body.job_id, str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return IngestResponse(**result)


@app.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    await manager.connect(websocket, job_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
    except Exception:
        manager.disconnect(websocket, job_id)


@app.post("/query", response_model=QueryResponse)
async def query(body: QueryRequest):
    """
    Run the full RAG pipeline and return the answer + source chunks.
    """
    if rag_chain is None:
        raise HTTPException(status_code=503, detail="RAG chain not initialised yet.")

    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    result = rag_chain.query(body.question)
    return QueryResponse(**result)


@app.get("/documents", response_model=list[DocumentItem])
async def documents():
    """
    List all documents that have been ingested into ChromaDB.
    """
    return list_ingested_documents()