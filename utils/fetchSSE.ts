/**
 * fetchSSE：封装 text/event-stream 响应，支持 POST 与 AbortController
 * 参考 LobeChat fetchSSE 事件格式，支持标准 SSE 协议
 */
import { fetchEventSource } from '@microsoft/fetch-event-source';

export interface FetchSSEOptions extends Omit<RequestInit, 'body'> {
  /** 请求体（JSON 等） */
  body?: Record<string, unknown> | string;
  /** 消息回调：event 为事件名，data 为解析后的 JSON */
  onMessage?: (event: string, data: unknown) => void;
  /** 完成回调 */
  onDone?: () => void;
  /** 错误回调 */
  onError?: (error: Error | { message: string; type?: string }) => void;
  /** 中止回调（用户取消） */
  onAbort?: () => void;
}

/**
 * 发起 SSE 请求并解析事件流
 * @returns 返回 AbortController，调用 abort() 可取消请求
 */
export function fetchSSE(url: string, options: FetchSSEOptions = {}): AbortController {
  const {
    method = 'POST',
    headers = {},
    body,
    signal: externalSignal,
    onMessage,
    onDone,
    onError,
    onAbort,
    ...rest
  } = options;

  const ctrl = new AbortController();
  const signal = externalSignal ?? ctrl.signal;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(typeof headers === 'object' && headers !== null ? (headers as Record<string, string>) : {}),
  };

  const requestBody = typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;

  fetchEventSource(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
    signal,
    openWhenHidden: true, // 页面切到后台时不关闭连接，避免 SSE 中断
    ...rest,
    onopen: async (response) => {
      if (!response.ok) {
        const text = await response.text();
        let errData: { message?: string; error?: string } = {};
        try {
          errData = JSON.parse(text);
        } catch {
          /* ignore */
        }
        const msg = errData.error ?? errData.message ?? `HTTP ${response.status}`;
        onError?.({ message: msg, type: 'HttpError' });
        throw new Error(msg);
      }
    },
    onmessage: (ev) => {
      const event = ev.event || 'message';
      let data: unknown;
      try {
        data = ev.data ? JSON.parse(ev.data) : {};
      } catch {
        data = ev.data ?? {};
      }
      onMessage?.(event, data);
    },
    onclose: () => {
      onDone?.();
    },
    onerror: (err) => {
      if (err?.name === 'AbortError') {
        onAbort?.();
        onDone?.();
        return;
      }
      onError?.(err instanceof Error ? err : { message: String(err), type: 'StreamError' });
      onDone?.();
      throw err; // 阻止默认重试
    },
  }).catch((e) => {
    if (e?.name !== 'AbortError') {
      onError?.(e instanceof Error ? e : { message: String(e), type: 'FetchError' });
    }
    onDone?.();
  });

  return ctrl;
}
