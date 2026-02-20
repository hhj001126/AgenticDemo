/**
 * 前端 API 层：统一调用 Go 后端 REST 与 text/event-stream
 */

const API_BASE = '/api';

export const api = {
  async createSession(): Promise<{ sessionId: string }> {
    const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async listSessions(): Promise<Array<{ sessionId: string; title: string; lastUpdated: number }>> {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getActiveSession(): Promise<{ sessionId: string }> {
    const res = await fetch(`${API_BASE}/sessions/active`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async switchSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/active`, { method: 'PUT' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateSessionTitle(sessionId: string, title: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async clearSessionContent(sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/clear`, { method: 'PUT' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async appendKnowledgeChunks(
    sessionId: string,
    chunks: Array<{ content: string; summary: string; boundaryReason: string }>
  ): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/chunks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 获取全部工具启用状态（含 MCP），用于一次性拉取 */
  async getToolEnableState(): Promise<{ enabled: Record<string, boolean> }> {
    const res = await fetch(`${API_BASE}/tools?state=1`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 获取工具列表（内置工具） */
  async listTools(): Promise<{ tools: Array<{ id: string; name: string; description: string; blocking: boolean; enabled: boolean; source: string }> }> {
    const res = await fetch(`${API_BASE}/tools`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 获取单个工具 */
  async getTool(id: string): Promise<{ id: string; name: string; description: string; blocking: boolean; enabled: boolean; source: string }> {
    const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 设置工具启用状态 */
  async setToolEnabled(id: string, enabled: boolean): Promise<{ id: string; enabled: boolean }> {
    const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 获取 MCP 服务器列表 */
  async listMcpServers(): Promise<Array<{ id: string; name?: string; url: string }>> {
    const res = await fetch(`${API_BASE}/mcp/servers`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 添加 MCP 服务器 */
  async addMcpServer(url: string, name?: string): Promise<{ id: string; name?: string; url: string }> {
    const res = await fetch(`${API_BASE}/mcp/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 更新 MCP 服务器 */
  async updateMcpServer(id: string, updates: { name?: string; url?: string }): Promise<{ id: string; name?: string; url: string }> {
    const res = await fetch(`${API_BASE}/mcp/servers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 删除 MCP 服务器 */
  async deleteMcpServer(id: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/mcp/servers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 触发 MCP 服务器可用性检查 */
  async checkMcpServer(id: string): Promise<{ id: string; status: string; error?: string; toolsCount?: number }> {
    const res = await fetch(`${API_BASE}/mcp/servers/${encodeURIComponent(id)}/check`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 获取 MCP 服务器状态 */
  async getMcpServerStatus(
    id: string
  ): Promise<{ id: string; status: string; lastCheckAt?: number; lastError?: string; toolsCount?: number }> {
    const res = await fetch(`${API_BASE}/mcp/servers/${encodeURIComponent(id)}/status`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * 流式对话：POST /chat/stream，消费 text/event-stream
   */
  async chatStream(
    sessionId: string,
    message: string,
    params: {
      resumePlan?: unknown;
      isApprovalConfirmed?: boolean;
      planMsgId?: string;
      options?: { mode?: string; industry?: string };
    },
    callbacks: {
      onText: (content: string) => void;
      onThinking?: (step: Record<string, unknown>) => void;
      onPlanProposed?: (plan: Record<string, unknown>) => void;
      onChartData?: (data: Record<string, unknown>) => void;
      onFilesWritten?: (paths: string[]) => void;
      onPlanStepUpdate?: (data: { msgId?: string; stepId?: string; status?: string }) => void;
      onToast?: (message: string) => void;
      onDone?: () => void;
      onError?: (message: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, params }),
      signal,
    });
    if (!res.ok) throw new Error(await res.text());
    if (!res.body) throw new Error('No response body');

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const lines = part.split('\n');
        let eventType = '';
        let dataStr = '{}';
        for (const line of lines) {
          if (line.startsWith('event:')) eventType = line.replace('event:', '').trim();
          if (line.startsWith('data:')) dataStr = line.replace('data:', '').trim();
        }
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(dataStr || '{}') as Record<string, unknown>;
        } catch {
          data = { raw: dataStr };
        }
        switch (eventType) {
          case 'text':
            callbacks.onText((data.content as string) ?? '');
            break;
          case 'thinking':
            if (callbacks.onThinking && data.step)
              callbacks.onThinking(data.step as Record<string, unknown>);
            break;
          case 'plan':
            if (callbacks.onPlanProposed && data.plan)
              callbacks.onPlanProposed(data.plan as Record<string, unknown>);
            break;
          case 'chart':
            if (callbacks.onChartData && data.data)
              callbacks.onChartData(data.data as Record<string, unknown>);
            break;
          case 'files':
            if (callbacks.onFilesWritten && Array.isArray(data.paths))
              callbacks.onFilesWritten(data.paths as string[]);
            break;
          case 'planUpdate':
            if (callbacks.onPlanStepUpdate)
              callbacks.onPlanStepUpdate(data as { msgId?: string; stepId?: string; status?: string });
            break;
          case 'toast':
            if (callbacks.onToast && typeof data.message === 'string')
              callbacks.onToast(data.message);
            break;
          case 'done':
            callbacks.onDone?.();
            break;
          case 'error':
            callbacks.onError?.((data.message as string) ?? 'Unknown error');
            break;
        }
      }
    }
    callbacks.onDone?.();
  },
};
