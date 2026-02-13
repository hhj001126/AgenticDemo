/**
 * 工具启用状态：内置与自添加工具均可单独控制是否启用
 * 持久化到 localStorage，未配置时默认启用
 */
const STORAGE_KEY = "agent_tool_enabled";

function loadMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** 获取指定工具是否启用，未配置时默认 true */
export function getToolEnabled(toolId: string): boolean {
  const map = loadMap();
  if (!(toolId in map)) return true;
  return !!map[toolId];
}

/** 设置指定工具的启用状态 */
export function setToolEnabled(toolId: string, enabled: boolean): void {
  const map = loadMap();
  map[toolId] = enabled;
  saveMap(map);
}

export const toolEnableService = {
  getToolEnabled,
  setToolEnabled,
};
