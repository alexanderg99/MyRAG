"use client";

import { useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { queryRag, queryAgent, fetchDocuments } from "@/lib/api";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import type { ChatMessage } from "@/types";
import { Zap, Search } from "lucide-react";

export default function ChatPage() {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [loading, setLoading]     = useState(false);
  const [docCount, setDocCount]   = useState<number | null>(null);
  const [useAgent, setUseAgent]   = useState(false);

  useEffect(() => {
    fetchDocuments()
      .then((docs) => setDocCount(docs.length))
      .catch(() => setDocCount(0));
  }, []);

  const handleSubmit = useCallback(async (question: string) => {
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
        // Agent mode: decompose → sub-queries → synthesize
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
        // Standard RAG mode
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
      const errorMsg: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: "Something went wrong. Please check the backend is running.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [useAgent]);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-slate-100">Chat</h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            {docCount === null
              ? "Loading documents…"
              : docCount === 0
              ? "No documents ingested yet"
              : `${docCount} document${docCount === 1 ? "" : "s"} available`
            }
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Agent mode toggle */}
          <button
            onClick={() => setUseAgent((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              useAgent
                ? "bg-amber-400/10 border-amber-400/40 text-amber-400"
                : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            {useAgent ? (
              <Zap className="w-3.5 h-3.5" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {useAgent ? "Deep Research" : "Standard"}
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ChatWindow messages={messages} loading={loading} agentMode={useAgent} />

      {/* Input */}
      <div className="mt-4">
        <ChatInput
          onSubmit={handleSubmit}
          disabled={loading}
          placeholder={
            useAgent
              ? "Ask a complex question — the agent will break it down…"
              : "Ask a question about your documents…"
          }
        />
        <p className="text-slate-700 text-xs font-mono text-center mt-2">
          Enter to send · Shift+Enter for new line
          {useAgent && (
            <span className="text-amber-400/50"> · Deep Research mode — slower but handles multi-hop questions</span>
          )}
        </p>
      </div>

    </div>
  );
}
