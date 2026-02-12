import React, { useState, useCallback, useEffect } from "react";
import { Wrench, Package, Network, Link2, Unlink, Plus, Trash2, AlertCircle, Server, Zap, Loader2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { toolRegistryService } from "../../services/geminiService";
import {
  getStoredMcpServers,
  getConnectedMcpIds,
  saveConnectedMcpIds,
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
  getMcpServerState,
  getMcpServerError,
  subscribeToMcpStateChange,
  type StoredMcpServer,
} from "../../services/mcpService";
import { notifyMcpConnectionsChanged } from "./McpConnectionManager";
import type { RegistrySource } from "../../types";
import {
  PageContainer,
  Card,
  Button,
  Badge,
  Flex,
  Input,
  InputGroup,
  useConfirm,
} from "../ui";
import { cn } from "../../utils/classnames";

/** 常用 MCP 服务器地址（点击填入） */
const COMMON_MCP_URLS = [
  { label: "mcp-utils (本地)", url: "http://localhost:5201/mcp", desc: "npm run mcp:utils" },
  { label: "mcp-file-ops (本地)", url: "http://localhost:5202/mcp", desc: "npm run mcp:file-ops" },
  { label: "mcp-notes (本地)", url: "http://localhost:5203/mcp", desc: "npm run mcp:notes" },
  { label: "mcp-echo (本地)", url: "http://localhost:5204/mcp", desc: "npm run mcp:echo" },
  { label: "mcp-time (本地)", url: "http://localhost:5205/mcp", desc: "npm run mcp:time" },
  { label: "use-mcp Hono 示例 (本地)", url: "http://localhost:5101", desc: "clone use-mcp 后 pnpm dev" },
  { label: "MCP Inspector", url: "https://inspector.use-mcp.dev", desc: "官方 Inspector，可用于调试" },
];

/** 从 MCP 工具 id（mcp_<serverId>__<toolName>）解析出 serverId */
function getServerIdFromToolId(toolId: string): string | null {
  if (!toolId.startsWith("mcp_") || !toolId.includes("__")) return null;
  return toolId.slice(0, toolId.lastIndexOf("__")).replace(/^mcp_/, "");
}

interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  source: RegistrySource;
  blocking?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({
  id,
  name,
  description,
  source,
  blocking,
}) => (
  <Card
    padding="md"
    className={cn(
      "group transition-all duration-200",
      "hover:shadow-md hover:-translate-y-0.5",
      "hover:border-primary-100 border-border"
    )}
  >
    <Flex direction="col" gap={3}>
      <Flex justify="between" align="center">
        <Flex align="center" gap={3}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center shadow-subtle group-hover:shadow-sm transition-shadow">
            <Wrench size={18} className="text-primary-700" />
          </div>
          <div>
            <div className="font-bold text-text-secondary text-sm">{name || id}</div>
            <code className="text-[10px] text-text-muted font-mono opacity-80">{id}</code>
          </div>
        </Flex>
        <Flex align="center" gap={2}>
          <Badge
            variant={source === "builtin" ? "info" : source === "mcp" ? "success" : "muted"}
            size="md"
          >
            {source === "builtin" ? (
              <>
                <Package size={10} />
                内置
              </>
            ) : source === "mcp" ? (
              <>
                <Network size={10} />
                MCP
              </>
            ) : (
              "用户"
            )}
          </Badge>
          {blocking && (
            <Badge variant="warning" size="sm">
              阻塞
            </Badge>
          )}
        </Flex>
      </Flex>
      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{description}</p>
    </Flex>
  </Card>
);

export default function ToolsManagerPage() {
  const [tools, setTools] = useState<
    Array<{ id: string; tool: any; source: RegistrySource }>
  >([]);
  const [mcpServers, setMcpServers] = useState<StoredMcpServer[]>(() => getStoredMcpServers());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(() => new Set(getConnectedMcpIds()));
  const [serverStates, setServerStates] = useState<Record<string, "connecting" | "ready" | "failed">>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedBuiltin, setExpandedBuiltin] = useState(true);
  const [expandedMcpIds, setExpandedMcpIds] = useState<Set<string>>(new Set());

  const refreshTools = useCallback(() => {
    setTools(toolRegistryService.getAllWithSource());
  }, []);

  const refreshServers = useCallback(() => {
    setMcpServers(getStoredMcpServers());
  }, []);

  const confirm = useConfirm();

  useEffect(() => {
    refreshTools();
  }, [refreshTools, connectedIds]);

  useEffect(() => {
    const syncState = () => {
      const connected = getConnectedMcpIds();
      setServerStates((prev) => {
        const next = { ...prev };
        connected.forEach((id) => {
          next[id] = getMcpServerState(id) ?? "connecting";
        });
        return next;
      });
      setServerErrors((prev) => {
        const next = { ...prev };
        connected.forEach((id) => {
          const err = getMcpServerError(id);
          if (err) next[id] = err;
          else delete next[id];
        });
        return next;
      });
      refreshTools();
    };
    syncState();
    const unsub = subscribeToMcpStateChange(syncState);
    return unsub;
  }, [mcpServers, refreshTools]);

  const handleAddAndConnect = (url: string, name?: string) => {
    setAddError(null);
    try {
      const server = addMcpServer({ url, name });
      refreshServers();
      const next = new Set(connectedIds).add(server.id);
      setConnectedIds(next);
      saveConnectedMcpIds([...next]);
      notifyMcpConnectionsChanged();
      setShowAddModal(false);
      setAddUrl("");
      setAddName("");
    } catch (e: any) {
      setAddError(e.message ?? "添加失败");
    }
  };

  const handleAddOnly = (url: string, name?: string) => {
    setAddError(null);
    try {
      addMcpServer({ url, name });
      refreshServers();
      setShowAddModal(false);
      setAddUrl("");
      setAddName("");
    } catch (e: any) {
      setAddError(e.message ?? "添加失败");
    }
  };

  const handleConnect = (serverId: string) => {
    setServerErrors((prev) => {
      const next = { ...prev };
      delete next[serverId];
      return next;
    });
    const next = new Set(connectedIds).add(serverId);
    setConnectedIds(next);
    saveConnectedMcpIds([...next]);
    notifyMcpConnectionsChanged();
  };

  const handleDisconnect = (serverId: string) => {
    const next = new Set(connectedIds);
    next.delete(serverId);
    setConnectedIds(next);
    saveConnectedMcpIds([...next]);
    notifyMcpConnectionsChanged();
    setServerStates((prev) => {
      const n = { ...prev };
      delete n[serverId];
      return n;
    });
    setServerErrors((prev) => {
      const n = { ...prev };
      delete n[serverId];
      return n;
    });
    refreshTools();
  };

  const handleRetry = (serverId: string) => {
    handleDisconnect(serverId);
    setTimeout(() => handleConnect(serverId), 100);
  };

  const handleRemove = async (serverId: string) => {
    const server = mcpServers.find((s) => s.id === serverId);
    const label = server?.name || server?.url || "该 MCP";
    const ok = await confirm({
      title: "移除 MCP 服务器",
      message: `确定要移除「${label}」吗？移除后需重新添加才能再连接。`,
      danger: true,
      confirmText: "移除",
      cancelText: "取消",
    });
    if (!ok) return;
    if (connectedIds.has(serverId)) handleDisconnect(serverId);
    removeMcpServer(serverId);
    refreshServers();
    setExpandedMcpIds((prev) => {
      const next = new Set(prev);
      next.delete(serverId);
      return next;
    });
  };

  const handleOpenEdit = (s: StoredMcpServer) => {
    setEditingId(s.id);
    setEditName(s.name ?? "");
    setEditUrl(s.url);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    setEditError(null);
    try {
      updateMcpServer(editingId, { name: editName.trim() || undefined, url: editUrl.trim() });
      refreshServers();
      setShowEditModal(false);
      setEditingId(null);
      setEditName("");
      setEditUrl("");
      const wasConnected = connectedIds.has(editingId);
      if (wasConnected) {
        handleDisconnect(editingId);
        setTimeout(() => handleConnect(editingId), 100);
      }
    } catch (e: any) {
      setEditError(e.message ?? "保存失败");
    }
  };

  const toggleMcpExpanded = (serverId: string) => {
    setExpandedMcpIds((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  };

  // 按 MCP 分组：内置工具数组 + 每个 MCP 及其工具
  const builtinToolsList = tools.filter((t) => t.source === "builtin");
  const mcpToolsByServer = new Map<string, { server: StoredMcpServer; tools: typeof tools }>();
  for (const s of mcpServers) {
    const list = tools.filter((t) => t.source === "mcp" && getServerIdFromToolId(t.id) === s.id);
    mcpToolsByServer.set(s.id, { server: s, tools: list });
  }

  return (
    <PageContainer padding="lg">
      <Flex direction="col" gap={6}>
        {/* 页面头部：立体渐变块 */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl p-6",
            "bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700",
            "shadow-[0_4px_0_0_rgba(0,0,0,0.08),0_8px_24px_-4px_rgba(0,0,0,0.12)]",
            "border border-white/20"
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.25)_0%,_transparent_50%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/30" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_12px_rgba(0,0,0,0.15)] border border-white/30">
              <Zap size={28} className="text-white drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-display tracking-tight drop-shadow-sm">
                工具管理
              </h1>
              <p className="text-sm text-white/85 mt-0.5">
                内置工具 + MCP 接入。添加 MCP 后保存到列表，连接后其工具会注册到 Agent 供智能编排调用。
              </p>
            </div>
          </div>
        </div>

        {/* 工具与 MCP：卡片展示，每张卡片内展开工具明细 */}
        <div className="flex items-center justify-end mb-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setShowAddModal(true);
              setAddError(null);
            }}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            添加 MCP
          </Button>
        </div>

        <div className="space-y-4">
          {/* 内置工具卡片 */}
          <Card padding="none" className="border border-border shadow-subtle overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedBuiltin((b) => !b)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors",
                "bg-surface-muted/40 hover:bg-surface-muted/60 border-b border-border-muted"
              )}
            >
              <Flex align="center" gap={3}>
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Package size={20} className="text-primary-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">内置工具</h3>
                  <p className="text-xs text-text-muted">{builtinToolsList.length} 个工具，由 Agent 直接调用</p>
                </div>
              </Flex>
              {expandedBuiltin ? (
                <ChevronDown size={18} className="text-text-muted shrink-0" />
              ) : (
                <ChevronRight size={18} className="text-text-muted shrink-0" />
              )}
            </button>
            {expandedBuiltin && (
              <div className="p-4 pt-2 bg-surface/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {builtinToolsList.map(({ id, tool, source }) => (
                    <ToolCard
                      key={id}
                      id={id}
                      name={tool.definition?.name || id}
                      description={tool.definition?.description || ""}
                      source={source}
                      blocking={tool.blocking}
                    />
                  ))}
                </div>
                {builtinToolsList.length === 0 && (
                  <p className="text-sm text-text-muted py-4 text-center">暂无内置工具</p>
                )}
              </div>
            )}
          </Card>

          {/* 每个 MCP 一张卡片：连接状态、重连、编辑、删除，展开为工具明细 */}
          {mcpServers.map((s) => {
            const { tools: serverTools } = mcpToolsByServer.get(s.id) ?? { server: s, tools: [] };
            const isExpanded = expandedMcpIds.has(s.id);
            const isConnected = connectedIds.has(s.id);
            const state = serverStates[s.id];
            const err = serverErrors[s.id];
            return (
              <Card
                key={s.id}
                padding="none"
                className={cn(
                  "border overflow-hidden transition-all duration-200",
                  "border-border shadow-subtle",
                  err && "border-amber-200/60 bg-amber-50/20"
                )}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggleMcpExpanded(s.id)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-text-muted shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-text-muted shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-text-secondary text-sm">
                        {s.name || s.url}
                      </div>
                      <code className="text-xs text-text-muted truncate block mt-0.5">{s.url}</code>
                      {err && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50/80 border border-amber-200/60 px-3 py-2">
                          <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-800">
                            <div>{err}</div>
                            {err?.includes("Failed to fetch") && (
                              <div className="mt-1 text-[11px] text-amber-700/90">
                                常见原因：CORS、网络不可达、服务未启动（本地需 HTTP/SSE）
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                  <Flex align="center" gap={2} className="shrink-0 flex-wrap">
                    {isConnected ? (
                      <>
                        <Badge
                          variant={
                            state === "failed" ? "warning" : state === "connecting" ? "info" : "success"
                          }
                          size="sm"
                          className="gap-1"
                        >
                          {state === "connecting" ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              连接中
                            </>
                          ) : state === "failed" ? (
                            "失败"
                          ) : (
                            "已连接"
                          )}
                        </Badge>
                        {state === "failed" ? (
                          <Button variant="muted" size="sm" onClick={() => handleRetry(s.id)}>
                            重连
                          </Button>
                        ) : null}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDisconnect(s.id)}
                          className="gap-1"
                        >
                          <Unlink size={14} />
                          断开
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConnect(s.id)}
                        className="gap-1"
                      >
                        <Link2 size={14} />
                        连接
                      </Button>
                    )}
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(s);
                      }}
                      className="p-1.5 text-text-muted hover:text-primary"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(s.id);
                      }}
                      className="p-1.5 text-text-muted hover:text-rose-600"
                      title="移除"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Flex>
                </div>
                {isExpanded && (
                  <div className="border-t border-border-muted bg-surface-muted/30 px-4 py-3">
                    <div className="text-xs font-medium text-text-muted mb-2">工具明细（{serverTools.length}）</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {serverTools.map(({ id, tool, source }) => (
                        <ToolCard
                          key={id}
                          id={id}
                          name={tool.definition?.name || id}
                          description={tool.definition?.description || ""}
                          source={source}
                          blocking={tool.blocking}
                        />
                      ))}
                    </div>
                    {serverTools.length === 0 && (
                      <p className="text-sm text-text-muted py-2">
                        {isConnected ? "连接成功但未发现工具，或尚未加载完成" : "请先连接以加载工具"}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

        {mcpServers.length === 0 && (
          <Card padding="lg" className="border border-dashed border-border-muted bg-surface-muted/20">
            <p className="text-sm text-text-muted text-center py-4">暂无 MCP 服务器，点击「添加 MCP」开始。</p>
          </Card>
        )}
        </div>

        {/* 添加 MCP 弹窗 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <Card
              padding="none"
              className="max-w-lg w-full max-h-[90vh] overflow-hidden animate-modal-in shadow-lg border border-border"
            >
              <Flex direction="col" gap={2}>
                {/* 弹窗头部：传统样式 */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-border-muted bg-surface-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Network size={20} className="text-primary-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text font-display tracking-tight">添加 MCP 服务器</h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      保存后可在列表中连接，工具将注册到 Agent
                    </p>
                  </div>
                </div>
                <div className="py-4 px-6 overflow-y-auto flex-1">
                  <Flex direction="col" gap={2}>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-text-secondary block mb-1">
                        名称（可选）
                      </label>
                      <InputGroup>
                        <Input
                          placeholder="如：反馈 MCP、Git ingest"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                        />
                      </InputGroup>
                    </div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-text-secondary block mb-1">
                        MCP 服务器 URL（HTTP / SSE）
                      </label>
                      <InputGroup>
                        <Input
                          placeholder="https://your-mcp-server.com/sse 或 /mcp"
                          value={addUrl}
                          onChange={(e) => setAddUrl(e.target.value)}
                        />
                      </InputGroup>
                    </div>
                    <div className="mb-2">
                      <label className="text-sm font-medium text-text-secondary block mb-1">
                        常用地址（点击填入）
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {COMMON_MCP_URLS.map(({ label, url }) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setAddUrl(url)}
                            className={cn(
                              "text-left px-4 py-3 rounded-xl border transition-all duration-200 min-w-[180px]",
                              "bg-white border-border hover:border-primary-200 hover:bg-primary-50/50",
                              "hover:shadow-[0_2px_0_0_rgba(0,0,0,0.04)]",
                              addUrl === url && "border-primary bg-primary-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_0_rgba(0,0,0,0.06)] ring-1 ring-primary-200"
                            )}
                          >
                            <div className="font-medium text-text-secondary text-sm">{label}</div>
                            <code className="text-[11px] text-text-muted block mt-0.5 truncate max-w-[200px]">{url}</code>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-text-muted mt-4">
                        更多 MCP：<a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MCP Registry</a>、<a href="https://glama.ai/mcp/servers" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Glama 目录</a>（需支持 HTTP/SSE）
                      </p>
                    </div>
                    {addError && <p className="text-sm text-rose-600">{addError}</p>}
                    <Flex justify="end" gap={3}>
                      <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                        取消
                      </Button>
                      <Button
                        variant="muted"
                        onClick={() => handleAddOnly(addUrl.trim(), addName.trim() || undefined)}
                        disabled={!addUrl.trim()}
                      >
                        仅保存
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleAddAndConnect(addUrl.trim(), addName.trim() || undefined)}
                        disabled={!addUrl.trim()}
                        className="flex items-center gap-2"
                      >
                        <Link2 size={16} />
                        保存并连接
                      </Button>
                    </Flex>
                  </Flex>
                </div>
              </Flex>
            </Card>
          </div>
        )}

        {/* 编辑 MCP 弹窗 */}
        {showEditModal && editingId && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <Card
              padding="none"
              className="max-w-lg w-full max-h-[90vh] overflow-hidden animate-modal-in shadow-lg border border-border"
            >
              <Flex direction="col" gap={2}>
                <div className="flex items-center gap-3 px-6 py-5 border-b border-border-muted bg-surface-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Pencil size={20} className="text-primary-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text font-display tracking-tight">编辑 MCP 服务器</h2>
                    <p className="text-sm text-text-muted mt-0.5">修改名称或 URL 后保存</p>
                  </div>
                </div>
                <div className="py-4 px-6 overflow-y-auto flex-1">
                  <Flex direction="col" gap={2}>
                    <div>
                      <label className="text-sm font-medium text-text-secondary block mb-1">名称（可选）</label>
                      <InputGroup>
                        <Input
                          placeholder="如：文件读写、utils"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </InputGroup>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-secondary block mb-1">MCP 服务器 URL</label>
                      <InputGroup>
                        <Input
                          placeholder="https://your-mcp.com/mcp"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                        />
                      </InputGroup>
                    </div>
                    {editError && <p className="text-sm text-rose-600">{editError}</p>}
                    <Flex justify="end" gap={3}>
                      <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                        取消
                      </Button>
                      <Button variant="primary" onClick={handleSaveEdit} disabled={!editUrl.trim()}>
                        保存
                      </Button>
                    </Flex>
                  </Flex>
                </div>
              </Flex>
            </Card>
          </div>
        )}

      </Flex>
    </PageContainer>
  );
}
