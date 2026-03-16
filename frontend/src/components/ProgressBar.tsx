"use client";

import type { IngestionStage, ProgressMessage } from "@/types";

const STAGE_LABELS: Record<IngestionStage, string> = {
  ocr:              "Running OCR",
  loading:          "Reading PDF",
  chunking:         "Chunking",
  contextualizing:  "Adding Context",
  embedding:        "Embedding",
  bm25:             "Building Search Index",
  complete:         "Complete",
  error:            "Error",
};

interface ProgressBarProps {
  progress: ProgressMessage | null;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  if (!progress) return null;

  const isError    = progress.stage === "error";
  const isComplete = progress.stage === "complete";

  const barColor = isError
    ? "bg-red-500"
    : isComplete
    ? "bg-emerald-500"
    : "bg-amber-400";

  const labelColor = isError
    ? "text-red-400"
    : isComplete
    ? "text-emerald-400"
    : "text-amber-400";

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className={labelColor}>
          {STAGE_LABELS[progress.stage] ?? progress.stage}
        </span>
        <span className="text-slate-400">{progress.pct}%</span>
      </div>

      <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${progress.pct}%` }}
        />
      </div>

      {progress.detail && (
        <p className="text-slate-500 text-xs font-mono truncate">
          {progress.detail}
        </p>
      )}
    </div>
  );
}
