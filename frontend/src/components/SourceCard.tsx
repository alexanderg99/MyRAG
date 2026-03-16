"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { SourceItem } from "@/types";

interface SourceCardProps {
  source: SourceItem;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-700 rounded-md bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/40 transition-colors"
      >
        <span className="text-amber-400 font-mono text-xs shrink-0">
          [{index + 1}]
        </span>
        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-slate-300 font-mono text-xs truncate flex-1">
          {source.source}
        </span>
        {source.page && (
          <span className="text-slate-500 font-mono text-xs shrink-0">
            p.{source.page}
          </span>
        )}
        {expanded
          ? <ChevronUp   className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        }
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700">
          <p className="text-slate-400 text-xs leading-relaxed font-mono whitespace-pre-wrap">
            {source.content}
          </p>
        </div>
      )}
    </div>
  );
}
