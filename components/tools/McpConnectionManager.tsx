/**
 * 应用级 MCP 连接器：根据持久化的「已连接」列表保持连接，
 * 使切换到聊天页后 MCP 工具仍保留在 registry 中供 Agent 使用。
 */
import React, { useState, useEffect } from "react";
import { useMcp } from "use-mcp/react";
import {
  getStoredMcpServers,
  getConnectedMcpIds,
  registerMcpTools,
  unregisterMcpTools,
  setMcpServerState,
  setMcpServerError,
} from "../../services/mcpService";

const EVENT_MCP_CONNECTIONS_CHANGED = "mcp-connections-changed";

export function notifyMcpConnectionsChanged(): void {
  window.dispatchEvent(new CustomEvent(EVENT_MCP_CONNECTIONS_CHANGED));
}

function SingleMcpConnector({
  serverId,
  url,
}: {
  serverId: string;
  url: string;
}) {
  const { state, tools, callTool, error } = useMcp({
    url,
    clientName: "AgenticDemo",
    autoReconnect: false,
    transportType: "auto",
  });

  // 先更新连接中/失败状态；ready 在有工具时由下方 effect 在 registerMcpTools 之后再设，避免页面在工具注册前刷新
  useEffect(() => {
    if (state === "connecting" || state === "failed")
      setMcpServerState(serverId, state === "failed" ? "failed" : "connecting");
    else if (state === "ready" && tools.length === 0) {
      setMcpServerState(serverId, "ready");
      setMcpServerError(serverId, undefined);
    }
  }, [serverId, state, tools.length]);

  useEffect(() => {
    if (state === "failed" && error) setMcpServerError(serverId, error);
  }, [serverId, state, error]);

  // 连接成功且有工具时：先注册到 registry，再设为 ready 并清空错误，这样订阅方 refreshTools 能拿到最新工具
  useEffect(() => {
    if (state === "ready" && tools.length > 0 && callTool) {
      const mcpTools = tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t as any).inputSchema ?? { type: "object", properties: {} },
      }));
      registerMcpTools(serverId, mcpTools, callTool);
      setMcpServerState(serverId, "ready");
      setMcpServerError(serverId, undefined);
    }
  }, [serverId, state, tools, callTool]);

  useEffect(() => {
    return () => {
      unregisterMcpTools(serverId);
    };
  }, [serverId]);

  return null;
}

export default function McpConnectionManager() {
  const [connectedIds, setConnectedIds] = useState<string[]>(() => getConnectedMcpIds());

  useEffect(() => {
    const handler = () => setConnectedIds(getConnectedMcpIds());
    window.addEventListener(EVENT_MCP_CONNECTIONS_CHANGED, handler);
    return () => window.removeEventListener(EVENT_MCP_CONNECTIONS_CHANGED, handler);
  }, []);

  const servers = getStoredMcpServers();
  const toConnect = servers.filter((s) => connectedIds.includes(s.id));

  return (
    <>
      {toConnect.map((s) => (
        <SingleMcpConnector key={s.id} serverId={s.id} url={s.url} />
      ))}
    </>
  );
}
