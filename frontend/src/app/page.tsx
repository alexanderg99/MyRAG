import Link from "next/link";

const features = [
  { icon: "🔍", title: "Hybrid search", desc: "BM25 keyword + semantic embedding with reciprocal rank fusion" },
  { icon: "⚡", title: "Deep research", desc: "Query decomposition agent breaks complex questions into sub-queries" },
  { icon: "📑", title: "Source citations", desc: "Inline numbered references with page-level attribution" },
  { icon: "🧠", title: "Chain-of-thought", desc: "Step-by-step reasoning for inference and interpretation" },
  { icon: "🛡️", title: "Abstention gate", desc: "Knows when to say 'I don't know' instead of hallucinating" },
  { icon: "🔌", title: "MCP server", desc: "Use as a tool from Claude Desktop, Cursor, or any MCP client" },
];

const pills = [
  "FastAPI", "Next.js", "ChromaDB", "Ollama", "CrossEncoder",
  "Docker", "OCRmyPDF", "WebSocket", "Claude API",
];

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center px-6 py-16 min-h-[calc(100vh-52px)]">
      <p className="text-amber-400 font-mono text-[10px] tracking-[0.2em] uppercase mb-4">
        RAG + Agentic AI Platform
      </p>

      <h1 className="font-serif text-3xl sm:text-4xl text-center text-slate-100 font-medium leading-tight mb-3 max-w-md">
        Research your documents with AI.
      </h1>

      <p className="text-slate-500 text-sm text-center leading-relaxed max-w-lg mb-8">
        Upload PDFs, ingest them with hybrid search indexing, and ask questions —
        from simple lookups to complex multi-hop analysis with source citations.
      </p>

      <div className="flex gap-3 mb-14">
        <Link
          href="/upload"
          className="px-5 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 transition-colors"
        >
          Upload a document
        </Link>
        <Link
          href="/chat"
          className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:border-slate-500 hover:text-slate-100 transition-all"
        >
          Start chatting
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl w-full mb-10">
        {features.map((f) => (
          <div
            key={f.title}
            className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:border-slate-700 transition-colors"
          >
            <div className="text-base mb-2">{f.icon}</div>
            <div className="text-xs font-medium text-slate-200 mb-1">{f.title}</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {pills.map((p) => (
          <span
            key={p}
            className="px-3 py-1 rounded-full text-[10px] font-mono text-slate-500 border border-slate-800 bg-slate-800/30"
          >
            {p}
          </span>
        ))}
      </div>
    </main>
  );
}
