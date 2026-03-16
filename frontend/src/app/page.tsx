import Link from "next/link";
import { Upload, MessageSquare, ArrowRight, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col gap-16 pt-8">

      {/* Hero */}
      <div className="space-y-4 max-w-xl">
        <p className="text-amber-400 font-mono text-xs tracking-widest uppercase">
          RAG + Agentic AI Platform
        </p>
        <h1 className="font-serif text-4xl leading-tight text-slate-100">
          Research your<br />documents.
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Upload PDFs, ingest them with hybrid search indexing,
          and ask questions — from simple lookups to complex multi-hop
          analysis. Powered by BM25 + semantic retrieval, CrossEncoder
          reranking, and an agentic query decomposition layer.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/upload"
          className="group border border-slate-700 hover:border-amber-400/40 rounded-xl p-6 bg-slate-800/40 hover:bg-slate-800/70 transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Upload className="w-5 h-5 text-amber-400" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h2 className="font-serif text-lg text-slate-100 mb-1">Upload</h2>
          <p className="text-slate-500 text-sm">
            Add PDF documents and run the ingestion pipeline with
            chunking, embedding, and BM25 indexing.
          </p>
        </Link>

        <Link
          href="/chat"
          className="group border border-slate-700 hover:border-amber-400/40 rounded-xl p-6 bg-slate-800/40 hover:bg-slate-800/70 transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h2 className="font-serif text-lg text-slate-100 mb-1">Chat</h2>
          <p className="text-slate-500 text-sm">
            Ask questions with source citations. Toggle Deep Research
            mode for complex multi-hop analysis.
          </p>
        </Link>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2">
        {[
          "Hybrid BM25 + Semantic Search",
          "CrossEncoder Reranking",
          "Chain-of-Thought Prompting",
          "Query Decomposition Agent",
          "MCP Server",
          "OCR Support",
          "WebSocket Progress",
          "Docker Compose",
        ].map((feature) => (
          <span
            key={feature}
            className="px-3 py-1 rounded-full text-xs font-mono text-slate-400 border border-slate-700 bg-slate-800/40"
          >
            {feature}
          </span>
        ))}
      </div>

    </div>
  );
}
