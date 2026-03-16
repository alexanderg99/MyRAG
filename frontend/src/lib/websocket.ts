import type { ProgressMessage } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export type ProgressHandler = (msg: ProgressMessage) => void;
export type ErrorHandler = (err: Event) => void;

export class IngestionSocket {
  private ws: WebSocket | null = null;
  private jobId: string;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /** Connect and wait until the WebSocket is open before resolving. */
  connect(onMessage: ProgressHandler, onError?: ErrorHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}/ws/progress/${this.jobId}`);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ProgressMessage = JSON.parse(event.data);
          onMessage(msg);
        } catch {
          console.error("Failed to parse WebSocket message", event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket error", err);
        onError?.(err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
