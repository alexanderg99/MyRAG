// ── Ingestion ────────────────────────────────────────────────────────────────

export type IngestionStage =
  | "ocr"
  | "loading"
  | "chunking"
  | "contextualizing"
  | "embedding"
  | "bm25"
  | "complete"
  | "error";

export interface ProgressMessage {
  job_id: string;
  stage: IngestionStage;
  pct: number;
  detail: string;
}

export interface UploadResponse {
  filename: string;
  job_id: string;
}

export interface IngestRequest {
  filename: string;
  job_id: string;
  use_ocr?: boolean;
  contextualize?: boolean;
  chunk_strategy?: string;
}

export interface IngestResponse {
  filename: string;
  pages: number;
  chunks: number;
  status: string;
}

// ── Documents ────────────────────────────────────────────────────────────────

export interface DocumentItem {
  filename: string;
  total_pages: number | string;
  chunk_count: number;
}

// ── Query ────────────────────────────────────────────────────────────────────

export interface SourceItem {
  content: string;
  source: string;
  page: number | null;
  chunk_index: number | null;
}

export interface QueryResponse {
  answer: string;
  sources: SourceItem[];
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface SubQuestion {
  question: string;
  answer: string;
  sources: SourceItem[];
}

export interface DecomposeResponse {
  question: string;
  sub_questions: SubQuestion[];
  final_answer: string;
  total_sources: SourceItem[];
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  sub_questions?: SubQuestion[];
  timestamp: Date;
}
