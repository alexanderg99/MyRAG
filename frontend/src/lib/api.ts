import axios from "axios";
import type {
  UploadResponse,
  IngestRequest,
  IngestResponse,
  QueryResponse,
  DocumentItem,
  DecomposeResponse,
} from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// ─── Documents ────────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const { data } = await api.get<DocumentItem[]>("/documents");
  return data;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ─── Ingest ───────────────────────────────────────────────────────────────────

export async function ingestPdf(body: IngestRequest): Promise<IngestResponse> {
  const { data } = await api.post<IngestResponse>("/ingest", body);
  return data;
}

// ─── Query (single-shot RAG) ──────────────────────────────────────────────────

export async function queryRag(question: string): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>("/query", { question });
  return data;
}

// ─── Agent (query decomposition for complex questions) ────────────────────────

export async function queryAgent(question: string): Promise<DecomposeResponse> {
  const { data } = await api.post<DecomposeResponse>("/agent/decompose", { question });
  return data;
}
