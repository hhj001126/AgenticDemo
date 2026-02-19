import { api } from "./api";

// Re-export types
export interface StoredMcpServer {
  id: string;
  url: string;
  name?: string;
  status?: 'connected' | 'connecting' | 'failed' | 'disconnected';
  error?: string;
  addedAt?: number;
}

// API Methods
export async function getStoredMcpServers(): Promise<StoredMcpServer[]> {
    return api.get<StoredMcpServer[]>('/mcp/servers');
}

export async function addMcpServer(server: { url: string; name?: string }): Promise<StoredMcpServer> {
    const res = await api.post<StoredMcpServer>('/mcp/servers', server);
    return res;
}

export async function removeMcpServer(id: string): Promise<void> {
    await api.delete(`/mcp/servers/${id}`);
}

export async function updateMcpServer(id: string, updates: Partial<StoredMcpServer>): Promise<void> {
    await api.patch(`/mcp/servers/${id}`, updates);
}

// Connection Management
export async function connectMcpServer(id: string): Promise<void> {
    await api.post(`/mcp/servers/${id}/connect`, {});
}

export async function disconnectMcpServer(id: string): Promise<void> {
    await api.post(`/mcp/servers/${id}/disconnect`, {});
}

export async function testMcpServer(url: string): Promise<{ success: boolean; error?: string }> {
    return api.post<{ success: boolean; error?: string }>('/mcp/test', { url });
}

// Helper methods for the UI (compatible with previous interface)
// These now rely on the 'status' property returned by getStoredMcpServers()
export const getConnectedMcpIds = async (): Promise<string[]> => {
    const servers = await getStoredMcpServers();
    return servers.filter(s => s.status === 'connected' || s.status === 'connecting').map(s => s.id);
};

export const saveConnectedMcpIds = (ids: string[]) => {
    // No-op: backend manages enabled status/connections
};

export const getMcpServerState = (id: string) => {
    // UI should ideally use the status from the server object during render
    return undefined; 
};
export const getMcpServerError = (id: string) => undefined;

let listeners: (() => void)[] = [];
export const subscribeToMcpStateChange = (cb: () => void) => {
    listeners.push(cb);
    return () => { listeners = listeners.filter(l => l !== cb); };
};

export const notifyMcpConnectionsChanged = () => {
    listeners.forEach(cb => cb());
};
