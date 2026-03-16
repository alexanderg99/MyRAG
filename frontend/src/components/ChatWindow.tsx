"use client";

import { useEffect, useRef } from "react";
import { Bot, User, Loader2, Zap, ChevronRight } from "lucide-react";
import SourceCard from "./SourceCard";
import type { ChatMessage } from "@/types";

interface ChatWindowProps {
  messages: ChatMessage[];
  loading?: boolean;
  agentMode?: boolean;
}

export default function ChatWindow({ messages, loading, agentMode }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm font-mono">
        No messages yet. Ask a question below.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-3">
          {/* Avatar */}
          <div className="shrink-0 mt-1">
            {msg.role === "user" ? (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-slate-400" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-amber-400" />
              </div>
            )}
          </div>

          {/* Bubble */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-slate-500 mb-1">
              {msg.role === "user" ? "You" : "Assistant"}
              <span className="ml-2 text-slate-700">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>

            {/* Sub-questions (agent decomposition) */}
            {msg.sub_questions && msg.sub_questions.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400/70">
                  <Zap className="w-3 h-3" />
                  <span>Decomposed into {msg.sub_questions.length} sub-questions</span>
                </div>
                {msg.sub_questions.map((sq, i) => (
                  <div
                    key={i}
                    className="border border-slate-700/50 rounded-lg bg-slate-800/30 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-amber-400/50 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-slate-400 mb-1">
                          {sq.question}
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {sq.answer}
                        </p>
                        {sq.sources && sq.sources.length > 0 && (
                          <p className="text-xs font-mono text-slate-600 mt-1">
                            Sources: {sq.sources.map((s) => `p.${s.page}`).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs font-mono text-slate-600 uppercase tracking-wider mt-2">
                  Synthesized Answer
                </p>
              </div>
            )}

            {/* Main answer */}
            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-mono text-slate-600 uppercase tracking-wider">
                  Sources
                </p>
                {msg.sources.map((src, i) => (
                  <SourceCard key={i} source={src} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {loading && (
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0 mt-1">
            <Bot className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-mono text-xs">
              {agentMode ? "Decomposing and researching…" : "Thinking…"}
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
