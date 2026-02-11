
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
