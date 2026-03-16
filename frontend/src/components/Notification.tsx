"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

export type NotificationType = "success" | "error";

interface NotificationProps {
  type: NotificationType;
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function Notification({
  type,
  message,
  onDismiss,
  autoDismissMs = 5000,
}: NotificationProps) {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (!autoDismissMs) return;
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for fade-out
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onDismiss]);

  const isSuccess = type === "success";

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50 flex items-start gap-3
        px-4 py-3 rounded-lg shadow-2xl border max-w-sm
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
        ${isSuccess
          ? "bg-slate-800 border-emerald-500/30 text-emerald-300"
          : "bg-slate-800 border-red-500/30 text-red-300"
        }
      `}
    >
      {isSuccess
        ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
        : <XCircle    className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
      }
      <p className="text-sm leading-snug flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
