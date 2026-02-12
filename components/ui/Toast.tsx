import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { cn } from "../../utils/classnames";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const TOAST_DURATION = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = "toast_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION);
    };
    window.addEventListener("toast", handler);
    return () => window.removeEventListener("toast", handler);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      </div>
    </>
  );
}

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon =
    item.type === "success"
      ? CheckCircle
      : item.type === "error"
        ? XCircle
        : Info;
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right-5 duration-300",
        item.type === "success" && "bg-emerald-50 border-emerald-200 text-emerald-800",
        item.type === "error" && "bg-rose-50 border-rose-200 text-rose-800",
        item.type === "info" && "bg-primary-50 border-primary-200 text-primary-800"
      )}
    >
      <Icon size={20} className="shrink-0" />
      <span className="text-sm font-medium">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 p-1 rounded hover:bg-black/5 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
