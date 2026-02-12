import type { FunctionDeclaration } from "@google/genai";

/** 通用 AI 角色配置：由外部或用户指定 */
export interface AgentRoleConfig {
  /** 角色唯一标识 */
  id: string;
  /** 角色展示名 */
  name: string;
  /** 角色描述（能力、职责） */
  description?: string;
  /** 自定义系统指令追加（可选） */
  customInstructions?: string;
}

/** 子代理定义：用于 Function 调用或独立 Agent 链 */
export interface SubAgentDefinition {
  id: string;
  name: string;
  description: string;
  /** 系统提示模板 {(vars) => string} */
  systemPrompt: (vars: Record<string, string>) => string;
  /** 用户提示模板 {(vars) => string} */
  userPrompt: (vars: Record<string, string>) => string;
  /** 返回结构化输出时的 schema（可选） */
  outputSchema?: object;
}

/** 工具/Function 执行器签名 */
export type ToolExecutor = (
  args: Record<string, unknown>,
  sessionId: string,
  onProgress?: (content: string) => void
) => Promise<unknown> | unknown;

/** 工具/Function 注册项 */
export interface ToolDefinition {
  definition: FunctionDeclaration;
  executor: ToolExecutor;
  /** 是否阻塞式（Supervisor 必须等待完成才继续） */
  blocking?: boolean;
}

/** 注册源：区分内置、MCP、用户注册 */
export type RegistrySource = "builtin" | "mcp" | "user";

/** 用户注册工具的标准接口 */
export interface ToolRegistrationSpec {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, { type: string; description?: string; required?: boolean; items?: object; enum?: string[] }>;
  executor: ToolExecutor;
  blocking?: boolean;
}

/** 用户注册子代理的标准接口 */
export interface SubAgentRegistrationSpec {
  id: string;
  name: string;
  description: string;
  systemPrompt: (vars: Record<string, string>) => string;
  userPrompt: (vars: Record<string, string>) => string;
  outputSchema?: object;
}

export enum Industry {
  GENERAL = '通用政企',
  LEGAL = '法律合规',
  FINANCE = '金融财务',
  TECHNICAL = '技术研发'
}

export enum AgentMode {
  TRADITIONAL = '标准模型',
  AGENTIC = '智能编排',
  DEEP_SEARCH = '深度检索'
}

export interface ThinkingStep {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  details?: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp: number;
  group?: string; // Used for grouping parallel tasks
  fileLink?: string; // Optional link to a VFS file (deprecated, use fileLinks)
  fileLinks?: string[]; // Multiple file links for write_file operations
  fileStreamState?: Record<string, { progress: string; isWriting: boolean }>; // Per-file streaming state
}

export interface PlanStep {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed';
  requiresApproval: boolean;
  parallel: boolean;
  approved?: boolean;
  isAutoApproved?: boolean; // New field for UI differentiation
}

export interface Plan {
  title: string;
  steps: PlanStep[];
  isApproved: boolean;
  isCollapsed?: boolean; // UI state
}

export interface ChartData {
  type: 'bar' | 'pie' | 'line';
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface VfsFile {
  path: string;
  content: string;
  language: string;
  isWriting?: boolean; // Real-time status
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingSteps?: ThinkingStep[];
  writtenFiles?: string[]; // 正文中写入的文件列表（供正文区域展示）
  isThinkingCollapsed?: boolean; // UI state
  plan?: Plan;
  charts?: ChartData[]; // 正文内联多图表（按 [CHART] 占位符顺序）
  timestamp: number;
  feedback?: 'like' | 'dislike';
  isAwaitingApproval?: boolean;
}
