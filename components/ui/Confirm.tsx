/**
 * 全局二次确认弹窗：替代 window.confirm，统一删除/移除等操作的确认 UI
 * 支持平滑展开/关闭动画、紧凑间距、丰富按钮样式、防重复点击与键盘操作
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { Flex } from "./Flex";
import { cn } from "../../utils/classnames";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message: string;
  /** 危险操作（如删除）时为 true，确定按钮使用 danger 样式 */
  danger?: boolean;
  confirmText?: string;
  cancelText?: string;
}

type ConfirmResolve = (value: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const confirmFn = useContext(ConfirmContext);
  if (!confirmFn) throw new Error("useConfirm must be used within ConfirmProvider");
  return confirmFn;
}

interface ConfirmProviderProps {
  children: React.ReactNode;
}

const CLOSE_DURATION = 200;

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "",
    message: "",
    danger: false,
    confirmText: "确定",
    cancelText: "取消",
  });
  const [confirming, setConfirming] = useState(false);
  const resolveRef = useRef<ConfirmResolve | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions({
        title: opts.title,
        message: opts.message,
        danger: opts.danger ?? false,
        confirmText: opts.confirmText ?? "确定",
        cancelText: opts.cancelText ?? "取消",
      });
      setClosing(false);
      setConfirming(false);
      setOpen(true);
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    if (closeTimerRef.current) return;
    setClosing(true);
    if (value) setConfirming(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setConfirming(false);
      resolveRef.current?.(value);
      resolveRef.current = null;
      closeTimerRef.current = null;
    }, CLOSE_DURATION);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose(false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleClose(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm",
            closing ? "animate-overlay-out" : "animate-overlay-in"
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={() => handleClose(false)}
        >
          <div
            role="presentation"
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <Card
              padding="md"
              className={cn(
                "shadow-xl border border-border",
                closing ? "animate-modal-out" : "animate-modal-in"
              )}
            >
            <Flex direction="col" gap={3}>
              <div className="flex items-start gap-3">
                {options.danger && (
                  <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-rose-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 id="confirm-title" className="text-base font-bold text-text">
                    {options.title}
                  </h2>
                  <p className="text-sm text-text-muted mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {options.message}
                  </p>
                </div>
              </div>
              <Flex justify="end" gap={2} className="pt-0.5">
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    "border border-border-muted bg-surface text-text-secondary",
                    "hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-700",
                    "active:scale-[0.98]"
                  )}
                >
                  {options.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => handleClose(true)}
                  disabled={confirming}
                  className={cn(
                    "px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    "shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none",
                    options.danger
                      ? "bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md"
                      : "bg-primary-700 text-white hover:bg-primary hover:shadow-md"
                  )}
                >
                  {options.confirmText}
                </button>
              </Flex>
            </Flex>
          </Card>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
