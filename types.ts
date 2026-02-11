
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
  details?: string; // For function arguments, raw results, or audit logs
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp: number;
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

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingSteps?: ThinkingStep[];
  chartData?: ChartData;
  timestamp: number;
  feedback?: 'like' | 'dislike';
}
