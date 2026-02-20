/**
 * MCP 连接桥接：将 MCP 工具注册到 registry，供 Supervisor 调用
 * 支持多服务器存储，每个服务器独立连接/断开
 */
import { Type } from "@google/genai";
import { toolRegistryService } from "./registry";

const STORAGE_KEY = "agent_mcp_servers";
const CONNECTED_IDS_KEY = "agent_mcp_connected_ids";
const MCP_PREFIX = "mcp_";

/** 持久化「已连接」的 MCP 服务器 ID，供应用级连接器与聊天侧共用 */
export function getConnectedMcpIds(): string[] {
  try {
    const raw = localStorage.getItem(CONNECTED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConnectedMcpIds(ids: string[]): void {
  localStorage.setItem(CONNECTED_IDS_KEY, JSON.stringify(ids));
}

/** 存储的 MCP 服务器项 */
export interface StoredMcpServer {
  id: string;
  url: string;
  name?: string;
  addedAt: number;
}

/** MCP 工具参数 schema */
interface McpToolSchema {
  type?: string;
  properties?: Record<string, { type?: string; description?: string; default?: unknown }>;
  required?: string[];
}

/** MCP 工具（use-mcp 返回结构，兼容 inputSchema 与 arguments） */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: McpToolSchema;
  arguments?: McpToolSchema;
}

/** 每个 MCP 服务器的连接状态 */
const serverConnections = new Map<
  string,
  { callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>; tools: McpTool[] }
>();

function genId(): string {
  return "mcp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 将 MCP inputSchema/arguments 转为 Gemini FunctionDeclaration parameters */
function mcpSchemaToGeminiParams(schema?: McpToolSchema): {
  type: typeof Type.OBJECT;
  properties: Record<string, any>;
  required?: string[];
} {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  const raw = schema?.properties ?? {};
  for (const [key, spec] of Object.entries(raw)) {
    const typeStr = (spec?.type ?? "string").toLowerCase();
    const typeVal =
      typeStr === "number"
        ? Type.NUMBER
        : typeStr === "boolean"
          ? Type.BOOLEAN
          : typeStr === "array"
            ? Type.ARRAY
            : typeStr === "object"
              ? Type.OBJECT
              : Type.STRING;
    properties[key] = { type: typeVal, description: (spec as any)?.description };
    if (schema?.required?.includes(key)) required.push(key);
  }
  return {
    type: Type.OBJECT,
    properties,
    required: required.length ? required : undefined,
  };
}

/** 注册指定 MCP 服务器的工具到 registry */
export function registerMcpTools(
  serverId: string,
  tools: McpTool[],
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>
): void {
  serverConnections.set(serverId, { callTool, tools });

  for (const t of tools) {
    const toolId = `${MCP_PREFIX}${serverId}__${t.name}`;
    const params = mcpSchemaToGeminiParams(t.inputSchema ?? t.arguments);
    const serverCallTool = callTool;
    toolRegistryService.register(
      toolId,
      {
        definition: {
          name: toolId,
          description: t.description ?? `MCP 工具: ${t.name}`,
          parameters: params,
        },
        executor: async (args) => {
          return serverCallTool(t.name, args);
        },
      },
      "mcp"
    );
  }
}

/** 注销指定 MCP 服务器的工具 */
export function unregisterMcpTools(serverId: string): void {
  const conn = serverConnections.get(serverId);
  if (!conn) return;
  for (const t of conn.tools) {
    const toolId = `${MCP_PREFIX}${serverId}__${t.name}`;
    toolRegistryService.unregister(toolId);
  }
  serverConnections.delete(serverId);
}

/** 注销所有 MCP 工具（兼容旧单服务器用法） */
export function unregisterAllMcpTools(): void {
  for (const serverId of serverConnections.keys()) {
    unregisterMcpTools(serverId);
  }
}

// --- 存储的 MCP 服务器列表 ---

const OLD_STORAGE_KEY = "agent_mcp_server_url";

/** 服务端返回的 MCP 服务器列表（由 ToolsManagerPage 从 api 拉取后注入，供 McpConnectionManager 使用） */
let serverListOverride: StoredMcpServer[] | null = null;
export function setMcpServersOverride(servers: StoredMcpServer[] | null): void {
  serverListOverride = servers;
}
export function getMcpServersOverride(): StoredMcpServer[] | null {
  return serverListOverride;
}

/** 获取 MCP 服务器列表，统一来自后端 API（由 ToolsManagerPage 拉取后通过 setMcpServersOverride 注入） */
export function getStoredMcpServers(): StoredMcpServer[] {
  if (serverListOverride !== null) return serverListOverride;
  return [];
}

/** 保存 MCP 服务器列表（已废弃，统一用后端 API） */
function saveMcpServers(servers: StoredMcpServer[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}

/** 规范化 URL 用于去重比较：trim、小写、去掉末尾斜杠 */
function normalizeUrlForDedup(u: string): string {
  return u.trim().toLowerCase().replace(/\/+$/, "") || "";
}

/** 添加 MCP 服务器到存储（按规范化 URL 去重） */
export function addMcpServer(server: Omit<StoredMcpServer, "id" | "addedAt">): StoredMcpServer {
  const url = server.url.trim();
  if (!url) throw new Error("URL 不能为空");
  const normalized = normalizeUrlForDedup(url);
  const existing = getStoredMcpServers();
  if (existing.some((s) => normalizeUrlForDedup(s.url) === normalized)) throw new Error("该 MCP 地址已存在");
  const item: StoredMcpServer = {
    id: genId(),
    url,
    name: server.name?.trim(),
    addedAt: Date.now(),
  };
  saveMcpServers([...existing, item]);
  return item;
}

/** 从存储中移除 MCP 服务器 */
export function removeMcpServer(id: string): void {
  const servers = getStoredMcpServers().filter((s) => s.id !== id);
  saveMcpServers(servers);
}

/** 更新 MCP 服务器（名称等）；若修改 URL 则按规范化 URL 去重 */
export function updateMcpServer(id: string, updates: Partial<Pick<StoredMcpServer, "name" | "url">>): void {
  const servers = getStoredMcpServers();
  if (updates.url !== undefined) {
    const newUrl = updates.url.trim();
    const normalized = normalizeUrlForDedup(newUrl);
    if (servers.some((s) => s.id !== id && normalizeUrlForDedup(s.url) === normalized))
      throw new Error("该 MCP 地址已被其他服务器使用");
  }
  const next = servers.map((s) => (s.id === id ? { ...s, ...updates } : s));
  saveMcpServers(next);
}

// --- 连接状态（供应用级连接器与工具页 UI 同步）---

type McpServerState = "connecting" | "ready" | "failed";
const serverStates = new Map<string, McpServerState>();
const serverErrors = new Map<string, string>();
let stateListeners: Array<() => void> = [];

function notifyStateChange(): void {
  stateListeners.forEach((cb) => cb());
}

export function getMcpServerState(serverId: string): McpServerState | undefined {
  return serverStates.get(serverId);
}

export function setMcpServerState(serverId: string, state: McpServerState): void {
  serverStates.set(serverId, state);
  notifyStateChange();
}

export function getMcpServerError(serverId: string): string | undefined {
  return serverErrors.get(serverId);
}

export function setMcpServerError(serverId: string, error: string | undefined): void {
  if (error === undefined) serverErrors.delete(serverId);
  else serverErrors.set(serverId, error);
  notifyStateChange();
}

export function subscribeToMcpStateChange(callback: () => void): () => void {
  stateListeners.push(callback);
  return () => {
    stateListeners = stateListeners.filter((c) => c !== callback);
  };
}
