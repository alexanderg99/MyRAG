"use client";

import { useState, useCallback } from "react";
import { uploadPdf, ingestPdf } from "@/lib/api";
import { IngestionSocket } from "@/lib/websocket";
import UploadZone from "@/components/UploadZone";
import ProgressBar from "@/components/ProgressBar";
import Notification from "@/components/Notification";
import type { ProgressMessage } from "@/types";
import type { NotificationType } from "@/components/Notification";

type NotificationState = {
  type: NotificationType;
  message: string;
} | null;

type Stage = "idle" | "uploading" | "ingesting" | "done" | "error";

export default function UploadPage() {
  const [stage, setStage]             = useState<Stage>("idle");
  const [useOcr, setUseOcr]           = useState(false);
  const [progress, setProgress]       = useState<ProgressMessage | null>(null);
  const [notification, setNotification] = useState<NotificationState>(null);

  const busy = stage === "uploading" || stage === "ingesting";

  const handleFile = useCallback(async (file: File) => {
    try {
      // ── 1. Upload ──────────────────────────────────────────────────
      setStage("uploading");
      setProgress(null);
      console.log("1. uploading file...");
      const uploadResult = await uploadPdf(file);
      console.log("2. upload result", uploadResult);
      const { filename, job_id } = uploadResult;
      console.log("2. upload done", filename, job_id);

      setStage("ingesting");
      const socket = new IngestionSocket(job_id);
      console.log("3. socket created");
      await socket.connect(
        (msg) => setProgress(msg),
        () => setNotification({ type: "error", message: "WebSocket disconnected unexpectedly." })
      );
      console.log("4. socket connected, calling ingest...");
      await ingestPdf({ filename, job_id, use_ocr: useOcr });

      socket.disconnect();
      setStage("done");
      setNotification({
        type: "success",
        message: `"${filename}" ingested successfully.`,
      });
    } catch (err: unknown) {
      setStage("error");
      const message =
        err instanceof Error ? err.message : "Ingestion failed. Check backend logs.";
      setNotification({ type: "error", message });
    }
  }, [useOcr]);

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl text-slate-100 mb-1">Upload a document</h1>
        <p className="text-slate-500 text-sm">
          PDF will be chunked, embedded, and stored in your local vector database.
        </p>
      </div>

      <UploadZone onFileAccepted={handleFile} disabled={busy} />

      {/* OCR toggle */}
      <label className="flex items-center gap-3 cursor-pointer group w-fit">
        <div
          onClick={() => !busy && setUseOcr((v) => !v)}
          className={`w-9 h-5 rounded-full transition-colors relative ${
            useOcr ? "bg-amber-400" : "bg-slate-700"
          } ${busy ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              useOcr ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </div>
        <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors select-none font-mono">
          Use OCR <span className="text-slate-600">(for scanned books)</span>
        </span>
      </label>

      {/* Progress */}
      {stage === "uploading" && (
        <div className="space-y-1">
          <p className="text-xs font-mono text-slate-500">Uploading…</p>
        </div>
      )}
      {stage === "ingesting" && <ProgressBar progress={progress} />}

      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}
    </div>
  );
}
