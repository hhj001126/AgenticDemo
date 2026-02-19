export type ToastType = "success" | "error" | "info";

export const toast = (message: string, type: ToastType = "info") => {
  const event = new CustomEvent("toast", {
    detail: { message, type },
  });
  window.dispatchEvent(event);
};

toast.success = (message: string) => toast(message, "success");
toast.error = (message: string) => toast(message, "error");
toast.info = (message: string) => toast(message, "info");
