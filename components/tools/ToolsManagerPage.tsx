import React, { useState, useCallback, useEffect, memo } from "react";
import { Wrench, Package, Network, Link2, Unlink, Plus, Trash2, AlertCircle, Zap, Loader2, ChevronRight, Pencil, RefreshCw, CheckCircle2 } from "lucide-react";
import { toolEnableService } from "../../services/toolEnableService";
import {
  getStoredMcpServers,
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
  connectMcpServer,
  disconnectMcpServer,
  testMcpServer,
  type StoredMcpServer,
} from "../../services/mcpService";
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
  Switch,
  Modal,
} from "../ui";
import { cn } from "../../utils/classnames";
import { toast } from "../../utils/toast";

/** 常用 MCP 服务器地址（点击填入） */
const COMMON_MCP_URLS = [
  { label: "mcp-utils (本地)", url: "http://localhost:5201/mcp", desc: "npm run mcp:utils" },
  { label: "mcp-file-ops (本地)", url: "http://localhost:5202/mcp", desc: "npm run mcp:file-ops" },
  { label: "mcp-notes (本地)", url: "http://localhost:5203/mcp", desc: "npm run mcp:notes" },
  { label: "mcp-echo (本地)", url: "http://localhost:5204/mcp", desc: "npm run mcp:echo" },
  { label: "mcp-time (本地)", url: "http://localhost:5205/mcp", desc: "npm run mcp:time" },
  { label: "youdu_mcp (本地)", url: "http://localhost:5206/mcp", desc: "npm run mcp:youdu" },
  { label: "use-mcp Hono 示例 (本地)", url: "http://localhost:5101", desc: "clone use-mcp 后 pnpm dev" },
  { label: "MCP Inspector", url: "https://inspector.use-mcp.dev", desc: "官方 Inspector，可用于调试" },
];

/** 从 MCP 工具 id（mcp_<serverId>__<toolName>）解析出 serverId */
function getServerIdFromToolId(toolId: string): string | null {
  if (!toolId.startsWith("mcp_") || !toolId.includes("__")) return null;
  return toolId.slice(0, toolId.lastIndexOf("__")).replace(/^mcp_/, "");
}

/** MCP 工具展示名：取 toolName 部分，便于阅读 */
function getToolDisplayName(id: string, fallback: string): string {
  if (id.startsWith("mcp_") && id.includes("__")) {
    return id.slice(id.lastIndexOf("__") + 2);
  }
  return fallback || id;
}

interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  source: RegistrySource;
  parameters?: any;
  blocking?: boolean;
  enabled?: boolean;
  onToggle?: () => void;
  onShowParams?: () => void;
}

const ToolCard = memo<ToolCardProps>(({
  id,
  name,
  description,
  source,
  parameters,
  blocking,
  enabled,
  onToggle,
  onShowParams,
}) => {
  const hasParams = parameters?.properties && Object.keys(parameters.properties).length > 0;

  return (
    <Card
      padding="none"
      className={cn(
        "group transition-all duration-200 border border-border shadow-subtle overflow-hidden flex flex-col h-full",
        "hover:shadow-md hover:border-primary-100",
        !enabled && "opacity-80"
      )}
    >
      <div className="p-4 flex-1">
        <Flex direction="col" gap={3}>
          <Flex justify="between" align="start">
            <Flex align="center" gap={3} className="min-w-0 flex-1">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-subtle transition-all shrink-0",
                enabled
                  ? "bg-gradient-to-br from-primary-50 to-primary-100 group-hover:shadow-sm"
                  : "bg-surface-muted"
              )}>
                <Wrench size={18} className={enabled ? "text-primary-700" : "text-text-muted"} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-text-secondary text-sm truncate" title={name || id}>
                  {name || id}
                </div>
                <code className="text-[10px] text-text-muted font-mono opacity-80 truncate block">
                  {id}
                </code>
              </div>
            </Flex>
            <Flex align="center" gap={3} className="shrink-0 pt-1">
              {blocking && (
                <Badge variant="warning" size="sm">阻塞</Badge>
              )}
              <Switch
                checked={!!enabled}
                onChange={onToggle}
                checkedChildren="开"
                unCheckedChildren="关"
              />
            </Flex>
          </Flex>
          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8 overflow-hidden">
            {description || "暂无描述"}
          </p>
        </Flex>
      </div>

      <div className="px-4 py-3 bg-surface-muted/30 border-t border-border-muted/50 flex items-center justify-between">
        <Badge
          variant={source === 'builtin' ? 'info' : 'success'}
          size="sm"
          className="bg-opacity-50"
        >
          {source === 'builtin' ? '内置' : 'MCP'}
        </Badge>

        {hasParams && (
          <button
            onClick={onShowParams}
            className="text-[11px] font-medium text-primary hover:text-primary-600 flex items-center gap-1 transition-colors"
          >
            详情
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </Card>
  );
});

type ToolsSubTab = "builtin" | "mcp" | "all";

interface ToolsManagerPageProps {
  /** 从 MCP 导航进入时默认展开 MCP 区域 */
  initialTab?: ToolsSubTab;
}

export default function ToolsManagerPage({ initialTab = "all" }: ToolsManagerPageProps) {
  const [tools, setTools] = useState<any[]>([]);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [mcpServers, setMcpServers] = useState<StoredMcpServer[]>([]);
  const [serverStates, setServerStates] = useState<Record<string, "connecting" | "ready" | "failed" | "disconnected">>({});

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [detailTool, setDetailTool] = useState<any | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [subTab, setSubTab] = useState<ToolsSubTab>(initialTab);
  const [expandedBuiltin, setExpandedBuiltin] = useState(initialTab !== "mcp");
  const [expandedMcpIds, setExpandedMcpIds] = useState<Set<string>>(new Set());

  const refreshData = useCallback(async () => {
    try {
      const [defs, enabled, servers] = await Promise.all([
        toolEnableService.getToolDefinitions(),
        toolEnableService.getAllTools(),
        getStoredMcpServers()
      ]);
      setTools(defs.map(d => ({
        id: d.name,
        tool: { definition: d },
        source: d.name.startsWith('mcp_') ? 'mcp' : 'builtin'
      })));
      setEnabledMap(enabled);
      setMcpServers(servers);

      const states: Record<string, any> = {};
      servers.forEach(s => {
        states[s.id] = s.status ?? 'disconnected';
      });
      setServerStates(states);
    } catch (e) {
      console.error("Failed to refresh data", e);
    }
  }, []);

  const confirm = useConfirm();

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 5000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const toggleTool = async (id: string) => {
    const next = !enabledMap[id];
    try {
      await toolEnableService.setToolEnabled(id, next);
      setEnabledMap(prev => ({ ...prev, [id]: next }));
      toast.success(next ? "工具已启用" : "工具已禁用");
    } catch (e) {
      console.error("Toggle failed", e);
      toast.error("切换失败");
    }
  };

  const handleAddAndConnect = async (url: string, name?: string) => {
    setAddError(null);
    try {
      const server = await addMcpServer({ url, name });
      await connectMcpServer(server.id);
      setAddUrl("");
      setAddName("");
      toast.success("添加成功并开始运行");
      refreshData();
    } catch (e: any) {
      setAddError(e.message ?? "添加失败");
      toast.error("详情见错误提示");
    }
  };

  const handleTestConnection = async (url: string) => {
    if (!url.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testMcpServer(url);
      setTestResult(res);
      if (res.success) toast.success("连接测试成功");
      else toast.error("连接测试失败");
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || "测试请求失败" });
      toast.error("连接测试错误");
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddOnly = async (url: string, name?: string) => {
    setAddError(null);
    try {
      await addMcpServer({ url, name });
      setShowAddModal(false);
      setAddUrl("");
      setAddName("");
      toast.success("已保存到列表");
      refreshData();
    } catch (e: any) {
      setAddError(e.message ?? "添加失败");
      toast.error("详情见错误提示");
    }
  };

  const handleConnect = async (serverId: string) => {
    try {
      await connectMcpServer(serverId);
      toast.info("已尝试发起连接");
      refreshData();
    } catch (e: any) {
      console.error("Connect failed", e);
      toast.error("连接异常");
    }
  };

  const handleDisconnect = async (serverId: string) => {
    try {
      await disconnectMcpServer(serverId);
      toast.info("已断开连接");
      refreshData();
    } catch (e: any) {
      console.error("Disconnect failed", e);
      toast.error("断开失败");
    }
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
    try {
      await removeMcpServer(serverId);
      toast.success("已成功移除");
      refreshData();
    } catch (e: any) {
      console.error("Remove failed", e);
      toast.error("移除失败");
    }
  };

  const handleOpenEdit = (s: StoredMcpServer) => {
    setEditingId(s.id);
    setEditName(s.name ?? "");
    setEditUrl(s.url);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setEditError(null);
    try {
      await updateMcpServer(editingId, { name: editName.trim() || undefined, url: editUrl.trim() });
      setShowEditModal(false);
      setEditingId(null);
      toast.success("配置已更新");
      refreshData();
    } catch (e: any) {
      setEditError(e.message ?? "保存失败");
      toast.error("保存失败");
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

  useEffect(() => {
    if (initialTab === "mcp" && mcpServers.length > 0 && expandedMcpIds.size === 0) {
      setExpandedMcpIds(new Set(mcpServers.map((s) => s.id)));
    }
  }, [initialTab, mcpServers, expandedMcpIds.size]);


  // 分组逻辑
  const builtinToolsList = tools.filter((t) => t.source === "builtin");
  const mcpToolsByServer = new Map<string, { server: StoredMcpServer; tools: typeof tools }>();
  for (const s of mcpServers) {
    const list = tools.filter((t) => t.source === "mcp" && getServerIdFromToolId(t.id) === s.id);
    mcpToolsByServer.set(s.id, { server: s, tools: list });
  }

  return (
    <PageContainer padding="lg">
      <Flex direction="col" gap={6}>
        {/* 头部展示 */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl p-6",
            "bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700",
            "shadow-xl border border-white/20"
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.25)_0%,_transparent_50%)]" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner">
              <Zap size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                工具管理
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                智能编排的核心基石。通过启用工具或接入 MCP 服务器来扩展 Agent 的能力边界。
              </p>
            </div>
          </div>
        </div>

        {/* 控制栏 */}
        <Flex justify="between" align="center">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-muted/60 border border-border-muted overflow-hidden">
            {(["builtin", "mcp", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  subTab === t ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-primary"
                )}
              >
                {t === "builtin" ? "内置" : t === "mcp" ? "MCP" : "全部"}
              </button>
            ))}
          </div>

          {(subTab === "mcp" || subTab === "all") && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setAddError(null);
                setShowAddModal(true);
              }}
              className="px-5 shadow-md hover:shadow-lg transition-all"
            >
              <Plus size={18} className="mr-1.5" />
              添加 MCP
            </Button>
          )}
        </Flex>

        <div className="space-y-4">
          {/* 内置工具 */}
          {(subTab === "builtin" || subTab === "all") && (
            <Card key="builtin-tools" padding="none" className="border border-border shadow-sm overflow-hidden bg-white">
              <button
                onClick={() => setExpandedBuiltin(!expandedBuiltin)}
                className="w-full flex items-center justify-between px-6 py-4 bg-surface-muted/20 hover:bg-surface-muted/40 transition-colors"
              >
                <Flex align="center" gap={3}>
                  <Package size={20} className="text-primary-600" />
                  <div className="text-left">
                    <span className="font-bold text-text-secondary">内置工具组</span>
                    <span className="ml-2 text-xs text-text-muted">{builtinToolsList.length} 个本地原子工具</span>
                  </div>
                </Flex>
                <div className={cn("transition-transform duration-200", expandedBuiltin ? "rotate-90" : "")}>
                  <ChevronRight size={18} />
                </div>
              </button>
              {expandedBuiltin && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-border-muted/50">
                  {builtinToolsList.map(({ id, tool, source }) => (
                    <ToolCard
                      key={id}
                      id={id}
                      name={getToolDisplayName(id, tool.definition?.name || id)}
                      description={tool.definition?.description || ""}
                      source={source}
                      parameters={tool.definition?.parameters}
                      blocking={tool.blocking}
                      enabled={enabledMap[id] ?? true}
                      onToggle={() => toggleTool(id)}
                      onShowParams={() => setDetailTool(tool.definition)}
                    />
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* MCP 服务器列表 */}
          {(subTab === "mcp" || subTab === "all") && (
            <>
              {mcpServers.map((s) => {
                const { tools: serverTools } = mcpToolsByServer.get(s.id) ?? { tools: [] };
                const isExpanded = expandedMcpIds.has(s.id);
                const status = serverStates[s.id];
                return (
                  <Card key={s.id} padding="none" className="border border-border shadow-sm overflow-hidden bg-white">
                    <div className="flex items-center justify-between p-4 bg-surface-muted/10">
                      <button
                        onClick={() => toggleMcpExpanded(s.id)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                        <div className={cn("transition-transform", isExpanded ? "rotate-90" : "")}>
                          <ChevronRight size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-text-secondary truncate">{s.name || s.url}</div>
                          <code className="text-[10px] text-text-muted font-mono">{s.url}</code>
                        </div>
                      </button>

                      <Flex align="center" gap={3}>
                        <Badge variant={status === 'ready' ? 'success' : status === 'connecting' ? 'info' : status === 'failed' ? 'warning' : 'muted'}>
                          {status === 'connecting' && <Loader2 size={10} className="animate-spin mr-1" />}
                          {status === 'ready' ? '就绪' : status === 'connecting' ? '连接中' : status === 'failed' ? '失败' : '未连接'}
                        </Badge>

                        {status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 px-2 text-amber-600 hover:bg-amber-50"
                            onClick={() => handleConnect(s.id)}
                            title="重试连接"
                          >
                            <RefreshCw size={14} />
                          </Button>
                        )}

                        <Switch
                          checked={status === 'ready' || status === 'connecting'}
                          onChange={(checked) => {
                            if (checked) handleConnect(s.id);
                            else handleDisconnect(s.id);
                          }}
                          size="sm"
                          checkedChildren="开"
                          unCheckedChildren="关"
                        />

                        <div className="h-4 w-px bg-border-muted mx-1" />

                        <Button variant="ghost" size="sm" className="p-1 px-2" onClick={() => handleOpenEdit(s)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" className="p-1 px-2 text-rose-500 hover:bg-rose-50" onClick={() => handleRemove(s.id)}><Trash2 size={14} /></Button>
                      </Flex>
                    </div>

                    {isExpanded && (
                      <div className="p-6 border-t border-border-muted/50 bg-surface-muted/5">
                        {s.error && (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-center">
                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                            <span className="text-xs text-amber-800 font-medium">{s.error}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {serverTools.map((t) => (
                            <ToolCard
                              key={t.id}
                              id={t.id}
                              name={getToolDisplayName(t.id, t.definition?.name || t.id)}
                              description={t.definition?.description || ""}
                              source={t.source}
                              parameters={t.tool?.definition?.parameters || t.definition?.parameters}
                              blocking={t.blocking}
                              enabled={enabledMap[t.id] ?? true}
                              onToggle={() => toggleTool(t.id)}
                              onShowParams={() => setDetailTool(t.tool?.definition || t.definition)}
                            />
                          ))}
                        </div>
                        {serverTools.length === 0 && (
                          <div className="text-center py-8 text-sm text-text-muted italic">
                            {status === 'ready' ? '暂无可用工具' : '请先连接以加载工具'}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </Flex>

      {/* Modals */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setTestResult(null); }}
        title="添加 MCP 服务器"
        footer={
          <>
            <Button variant="muted" onClick={() => handleTestConnection(addUrl)} disabled={!addUrl.trim() || isTesting}>
              {isTesting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              测试连接
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>取消</Button>
            <Button variant="muted" onClick={() => handleAddOnly(addUrl, addName)} disabled={!addUrl.trim()}>仅保存</Button>
            <Button variant="primary" onClick={() => handleAddAndConnect(addUrl, addName)} disabled={!addUrl.trim()}>保存并连接</Button>
          </>
        }
      >
        <Flex direction="col" gap={4}>
          {testResult && (
            <div className={cn(
              "p-3 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200",
              testResult.success ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
            )}>
              {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-xs font-medium">{testResult.success ? "连接测试成功，服务器响应正常。" : `连接测试失败: ${testResult.error}`}</span>
            </div>
          )}
          <div>
            <label className="text-sm font-bold text-text-secondary block mb-2">名称（可选）</label>
            <InputGroup>
              <Input placeholder="如：反馈 MCP、Git 工具" value={addName} onChange={e => setAddName(e.target.value)} />
            </InputGroup>
          </div>
          <div>
            <label className="text-sm font-bold text-text-secondary block mb-2">服务器 URL (HTTP/SSE)</label>
            <InputGroup>
              <Input placeholder="https://example.com/mcp" value={addUrl} onChange={e => setAddUrl(e.target.value)} />
            </InputGroup>
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">快捷地址</span>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_MCP_URLS.map(c => (
                <button key={c.url} onClick={() => setAddUrl(c.url)} className="text-left p-3 rounded-xl border border-border hover:border-primary-300 hover:bg-primary-50 transition-all group">
                  <div className="text-xs font-bold text-text-secondary group-hover:text-primary-700">{c.label}</div>
                  <div className="text-[10px] text-text-muted truncate mt-0.5">{c.url}</div>
                </button>
              ))}
            </div>
          </div>
          {addError && <p className="text-xs text-rose-500 font-medium">{addError}</p>}
        </Flex>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setTestResult(null); }}
        title="编辑 MCP 服务器"
        footer={
          <>
            <Button variant="muted" onClick={() => handleTestConnection(editUrl)} disabled={!editUrl.trim() || isTesting}>
              {isTesting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              测试连接
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>取消</Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={!editUrl.trim()}>保存变更</Button>
          </>
        }
      >
        <Flex direction="col" gap={4}>
          {testResult && (
            <div className={cn(
              "p-3 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200",
              testResult.success ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
            )}>
              {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-xs font-medium">{testResult.success ? "连接测试成功，服务器响应正常。" : `连接测试失败: ${testResult.error}`}</span>
            </div>
          )}
          <div>
            <label className="text-sm font-bold text-text-secondary block mb-2">名称</label>
            <InputGroup>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </InputGroup>
          </div>
          <div>
            <label className="text-sm font-bold text-text-secondary block mb-2">服务器 URL</label>
            <InputGroup>
              <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} />
            </InputGroup>
          </div>
          {editError && <p className="text-xs text-rose-500 font-medium">{editError}</p>}
        </Flex>
      </Modal>

      {/* Tool Details Modal */}
      <Modal
        isOpen={!!detailTool}
        onClose={() => setDetailTool(null)}
        title={detailTool ? `${detailTool.name} 详情` : "工具详情"}
        size="lg"
      >
        {detailTool && (
          <div className="space-y-6">
            <section>
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">基本说明</h4>
              <p className="text-sm text-text-secondary leading-relaxed bg-surface-muted/30 p-4 rounded-xl border border-border-muted/50">
                {detailTool.description || "暂无详细说明"}
              </p>
            </section>

            {detailTool.parameters?.properties && (
              <section>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">调用参数 (JSON Schema)</h4>
                <div className="space-y-4">
                  {Object.entries(detailTool.parameters.properties).map(([key, prop]: [string, any]) => (
                    <div key={key} className="flex flex-col gap-1 pb-4 border-b border-border-muted last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-100">{key}</span>
                        <Badge variant="muted">{prop.type}</Badge>
                        {detailTool.parameters.required?.includes(key) && (
                          <Badge variant="warning" size="sm" className="bg-rose-50 text-rose-600 border-rose-100">REQUIRED</Badge>
                        )}
                      </div>
                      <p className="text-sm text-text-muted mt-1 pl-1 border-l-2 border-border-muted">{prop.description || "未提供描述"}</p>
                      {prop.enum && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="text-[10px] text-text-muted font-bold mr-1">ENUM:</span>
                          {prop.enum.map((v: any) => (
                            <span key={v} className="text-[11px] px-2 py-0.5 rounded bg-surface-muted border border-border-muted text-text-secondary font-mono">{v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
