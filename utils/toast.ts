/** 触发 Toast 提示（可从任意层调用，包括 tool executor） */
export type ToastType = "success" | "error" | "info";

export function toast(message: string, type: ToastType = "success"): void {
  window.dispatchEvent(
    new CustomEvent("toast", { detail: { message, type } })
  );
}
