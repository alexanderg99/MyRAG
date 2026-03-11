"""
websocket_manager.py — WebSocket connection manager for real-time progress streaming.
Tracks active connections and broadcasts progress updates during ingestion.
"""

import asyncio
import json
from fastapi import WebSocket


class WebSocketManager:
    """
    Manages active WebSocket connections, keyed by job_id.
    Each ingestion job gets its own job_id so multiple clients
    can track different uploads simultaneously.
    """

    def __init__(self) -> None:
        # job_id -> list of active WebSocket connections
        self.active: dict[str, list[WebSocket]] = {}

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket, job_id: str) -> None:
        await websocket.accept()
        if job_id not in self.active:
            self.active[job_id] = []
        self.active[job_id].append(websocket)

    def disconnect(self, websocket: WebSocket, job_id: str) -> None:
        if job_id in self.active:
            self.active[job_id].remove(websocket)
            if not self.active[job_id]:
                del self.active[job_id]

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------

    async def send(self, job_id: str, stage: str, pct: int, detail: str = "") -> None:
        """
        Send a progress update to all clients watching job_id.

        Payload shape (matches what the frontend ProgressBar expects):
            {
                "job_id":  "abc123",
                "stage":   "chunking",   # loading | chunking | embedding | complete | error
                "pct":     40,           # 0–100
                "detail":  "Created 312 chunks from 48 pages"
            }
        """
        if job_id not in self.active:
            return

        payload = json.dumps({
            "job_id": job_id,
            "stage":  stage,
            "pct":    pct,
            "detail": detail,
        })

        dead: list[WebSocket] = []
        for ws in self.active[job_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        # Clean up any connections that dropped mid-stream
        for ws in dead:
            self.disconnect(ws, job_id)

    async def send_error(self, job_id: str, message: str) -> None:
        await self.send(job_id, stage="error", pct=0, detail=message)

    # ------------------------------------------------------------------
    # Progress callback factory
    # ------------------------------------------------------------------

    def progress_fn(self, job_id: str):
        """
        Returns an async callable matching ingestion.py's ProgressFn signature:
            await fn(stage, pct, detail)

        Usage in main.py:
            await ingest_pdf(filename, progress_fn=manager.progress_fn(job_id))
        """
        async def _fn(stage: str, pct: int, detail: str = "") -> None:
            await self.send(job_id, stage, pct, detail)
        return _fn


# ---------------------------------------------------------------------------
# Singleton — imported and shared by main.py
# ---------------------------------------------------------------------------

manager = WebSocketManager()