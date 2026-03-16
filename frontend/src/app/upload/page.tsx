"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Check, Loader2, AlertCircle } from "lucide-react";
import { uploadPdf, ingestPdf, fetchDocuments } from "@/lib/api";
import { IngestionSocket } from "@/lib/websocket";
import type { ProgressMessage, DocumentItem } from "@/types";

type Stage = "idle" | "uploading" | "ingesting" | "done" | "error";

const STAGE_LABELS: Record<string, string> = {
  ocr: "Running OCR",
  loading: "Reading PDF",
  chunking: "Chunking",
  contextualizing: "Adding context",
  embedding: "Embedding",
  bm25: "Building search index",
  complete: "Complete",
  error: "Error",
};

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [useOcr, setUseOcr] = useState(false);
  const [useContext, setUseContext] = useState(false);
  const [progress, setProgress] = useState<ProgressMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const busy = stage === "uploading" || stage === "ingesting";

  useEffect(() => {
    fetchDocuments().then(setDocuments).catch(() => {});
  }, [stage]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      const file = accepted[0];
      setError(null);
      setProgress(null);

      try {
        setStage("uploading");
        const { filename, job_id } = await uploadPdf(file);

        setStage("ingesting");
        const socket = new IngestionSocket(job_id);
        await socket.connect(
          (msg) => setProgress(msg),
          () => setError("WebSocket disconnected")
        );

        await ingestPdf({
          filename,
          job_id,
          use_ocr: useOcr,
          contextualize: useContext,
        });

        socket.disconnect();
        setStage("done");
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : "Ingestion failed");
      }
    },
    [useOcr, useContext]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: busy,
  });

  return (
    <main className="flex gap-6 px-6 py-8 max-w-5xl mx-auto min-h-[calc(100vh-52px)]">
      {/* Left — upload area */}
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="font-serif text-xl text-slate-100 font-medium">
            Upload a document
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            PDF will be chunked, embedded, and indexed for hybrid search.
          </p>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3
            cursor-pointer transition-all select-none
            ${busy ? "opacity-40 cursor-not-allowed border-slate-800" : ""}
            ${isDragActive
              ? "border-amber-400/60 bg-amber-400/5"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/20 hover:bg-slate-800/40"
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload
            className={`w-8 h-8 ${isDragActive ? "text-amber-400" : "text-slate-600"}`}
          />
          <p className="text-slate-300 text-sm">
            {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF"}
          </p>
          <p className="text-slate-600 text-xs">or click to browse</p>
        </div>

        {/* Options */}
        <div className="flex gap-6">
          <Toggle label="OCR" hint="scanned docs" value={useOcr} onChange={setUseOcr} disabled={busy} />
          <Toggle label="Contextual chunks" value={useContext} onChange={setUseContext} disabled={busy} />
        </div>

        {/* Progress */}
        {stage === "uploading" && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
          </div>
        )}

        {stage === "ingesting" && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className={progress.stage === "error" ? "text-red-400" : "text-amber-400"}>
                {STAGE_LABELS[progress.stage] ?? progress.stage}
              </span>
              <span className="text-slate-500">{progress.pct}%</span>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.stage === "error"
                    ? "bg-red-500"
                    : progress.stage === "complete"
                    ? "bg-emerald-500"
                    : "bg-amber-400"
                }`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            {progress.detail && (
              <p className="text-slate-600 text-[10px] font-mono truncate">
                {progress.detail}
              </p>
            )}
          </div>
        )}

        {stage === "done" && (
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Ingestion complete
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
      </div>

      {/* Right — document list */}
      <div className="w-64 shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-600 mb-3">
          Ingested documents
        </p>
        <div className="space-y-2">
          {documents.length === 0 && (
            <p className="text-xs text-slate-700 font-mono">No documents yet</p>
          )}
          {documents.map((doc) => (
            <div
              key={doc.filename}
              className="p-3 rounded-lg border border-slate-800 bg-slate-800/30 flex gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {doc.filename}
                </p>
                <p className="text-[10px] font-mono text-slate-600 mt-0.5">
                  {doc.total_pages} pp · {doc.chunk_count} chunks
                </p>
                <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> Ready
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? "opacity-40" : ""}`}>
      <button
        type="button"
        onClick={() => !disabled && onChange(!value)}
        className={`w-8 h-[18px] rounded-full relative transition-colors ${
          value ? "bg-amber-400" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[14px]" : ""
          }`}
        />
      </button>
      <span className="text-xs font-mono text-slate-400">
        {label}
        {hint && <span className="text-slate-600"> ({hint})</span>}
      </span>
    </label>
  );
}
