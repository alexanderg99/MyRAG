"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { queryRag, queryAgent, fetchDocuments } from "@/lib/api";
import {
  Send,
  User,
  Bot,
  Loader2,
  Zap,
  Search,
  ChevronRight,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import type { ChatMessage, SourceItem, SubQuestion } from "@/types";

// ── Inline citation renderer ─────────────────────────────────────────────────

function renderWithCitations(
  text: string,
  sources: SourceItem[],
  onCiteHover: (idx: number | null) => void
) {
  // Insert citation markers: match [1], [2], etc. or auto-add based on source count
  // For now, we auto-append citations at paragraph ends based on source order
  const paragraphs = text.split("\n\n").filter(Boolean);

  return paragraphs.map((para, pi) => (
    <p key={pi} className="text-[13px] text-slate-300 leading-[1.75] mb-2.5">
      {para}
      {pi < sources.length && (
        <span
          className="cite ml-1"
          onMouseEnter={() => onCiteHover(pi)}
          onMouseLeave={() => onCiteHover(null)}
        >
          {pi + 1}
        </span>
      )}
    </p>
  ));
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({
  source,
  index,
  highlighted,
}: {
  source: SourceItem;
  index: number;
  highlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
        highlighted
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-slate-800 bg-slate-800/30 hover:border-slate-700"
      }`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono font-semibold text-blue-400 mt-0.5">
          [{index + 1}]
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-300 truncate">
            {source.source}
          </p>
          <p className="text-[10px] font-mono text-slate-600">p. {source.page}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-600 shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />
        )}
      </div>
      {expanded && (
        <p className="text-[10px] text-slate-500 leading-relaxed mt-2 font-mono whitespace-pre-wrap">
          {source.content.slice(0, 300)}
          {source.content.length > 300 && "…"}
        </p>
      )}
    </div>
  );
}

// ── Thinking panel (deep research) ───────────────────────────────────────────

function ThinkingPanel({ subQuestions }: { subQuestions: SubQuestion[] }) {
  return (
    <div className="mb-3 p-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.03]">
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400/80 mb-2">
        <Zap className="w-3 h-3" />
        Deep Research — {subQuestions.length} sub-queries
      </div>
      <div className="space-y-1.5">
        {subQuestions.map((sq, i) => (
          <div key={i} className="flex items-start gap-2">
            <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-slate-400">{sq.question}</p>
              <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                {sq.answer.slice(0, 120)}
                {sq.answer.length > 120 && "…"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main chat page ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [useAgent, setUseAgent] = useState(false);
  const [hoveredCite, setHoveredCite] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchDocuments()
      .then((docs) => setDocCount(Array.isArray(docs) ? docs.length : 0))
      .catch(() => setDocCount(0));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      if (useAgent) {
        const result = await queryAgent(question);
        const assistantMsg: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: result.final_answer,
          sources: result.total_sources,
          sub_questions: result.sub_questions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const { answer, sources } = await queryRag(question);
        const assistantMsg: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: answer,
          sources,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content: "Something went wrong. Check the backend is running.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, useAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  // Get the last assistant message's sources for the panel
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const panelSources = lastAssistant?.sources ?? [];

  return (
    <main className="flex h-[calc(100vh-52px)] max-w-6xl mx-auto">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
          <div>
            <h1 className="font-serif text-base text-slate-100 font-medium">Chat</h1>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {docCount === null
                ? "Loading…"
                : docCount === 0
                ? "No documents ingested"
                : `${docCount} document${docCount === 1 ? "" : "s"} available`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseAgent((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                useAgent
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                  : "bg-transparent border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600"
              }`}
            >
              {useAgent ? <Zap className="w-3 h-3" /> : <Search className="w-3 h-3" />}
              {useAgent ? "Deep Research" : "Standard"}
            </button>

            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] font-mono text-slate-700 hover:text-slate-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex items-center justify-center h-full text-slate-700 text-xs font-mono">
              Ask a question about your documents.
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="shrink-0 mt-1">
                {msg.role === "user" ? (
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                    <User className="w-3 h-3 text-slate-500" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                    <Bot className="w-3 h-3 text-amber-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-slate-600 mb-1.5">
                  {msg.role === "user" ? "You" : "Assistant"}
                  <span className="ml-2 text-slate-800">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>

                {/* Deep research thinking */}
                {msg.sub_questions && msg.sub_questions.length > 0 && (
                  <ThinkingPanel subQuestions={msg.sub_questions} />
                )}

                {/* Answer with inline citations */}
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 ? (
                  renderWithCitations(msg.content, msg.sources, setHoveredCite)
                ) : (
                  <p className="text-[13px] text-slate-300 leading-[1.75] whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3 h-3 text-amber-400" />
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-xs mt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="font-mono text-[11px]">
                  {useAgent ? "Decomposing and researching…" : "Thinking…"}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-slate-800/60">
          <div className="flex items-end gap-2 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-amber-400/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              disabled={loading}
              placeholder={
                useAgent
                  ? "Ask a complex question — the agent will decompose it…"
                  : "Ask a question about your documents…"
              }
              rows={1}
              className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 text-sm resize-none outline-none leading-relaxed disabled:opacity-40"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="shrink-0 p-1.5 rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-800 text-[10px] font-mono text-center mt-2">
            Enter to send · Shift+Enter for new line
            {useAgent && (
              <span className="text-amber-400/40">
                {" "}· Deep Research — slower but handles multi-hop
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Sources panel (right) */}
      {panelSources.length > 0 && (
        <div className="w-56 border-l border-slate-800/60 p-4 overflow-y-auto shrink-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-600 mb-3">
            Sources
          </p>
          <div className="space-y-2">
            {panelSources.map((src, i) => (
              <SourceCard
                key={i}
                source={src}
                index={i}
                highlighted={hoveredCite === i}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
