/**
 * 当前 Agent 执行上下文，供内置工具读取（如 analyze_requirements 需要 mode）
 */
import type { AgentMode } from "../types";

let currentMode: AgentMode | undefined;

export function setAgentContext(mode?: AgentMode): void {
  currentMode = mode;
}

export function getAgentContext(): { mode?: AgentMode } {
  return { mode: currentMode };
}
