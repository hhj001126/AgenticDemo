import { Industry, ThinkingStep, Plan, ChartData, AgentRoleConfig, AgentMode } from "../types";
import { api, API_BASE_URL } from "./api";

export interface SupervisorAgentOptions {
  industry?: Industry | string;
  role?: AgentRoleConfig;
  customRules?: string;
  mode?: AgentMode;
}

export const supervisorAgent = async (
  sessionId: string,
  prompt: string,
  industry: Industry,
  onThinking: (step: ThinkingStep) => void,
  onText: (chunk: string) => void,
  onPlanProposed?: (plan: Plan) => void,
  onChartData?: (data: ChartData) => void,
  onFilesWritten?: (paths: string[]) => void,
  onPlanStepUpdate?: (msgId: string, stepId: string, status: "in_progress" | "completed") => void,
  resumePlan?: Plan,
  isApprovalConfirmed?: boolean,
  planMsgId?: string,
  options?: SupervisorAgentOptions
) => {
  // Use fetch directly for SSE
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message: prompt,
      params: {
        resumePlan,
        isApprovalConfirmed,
        planMsgId,
        assistantMsgId: (options as any)?.assistantMsgId,
        options: { ...options, industry: options?.industry ?? industry }
      }
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to connect to agent server: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        if (jsonStr === '[DONE]') break; // Standard SSE close, though our backend sends 'done' event
        
        try {
          const event = JSON.parse(jsonStr);
          switch (event.type) {
            case 'thinking':
              onThinking(event.step);
              break;
            case 'text':
              onText(event.content);
              break;
            case 'plan':
              onPlanProposed?.(event.plan);
              break;
            case 'chart':
              onChartData?.(event.data);
              break;
            case 'files':
              onFilesWritten?.(event.paths);
              break;
            case 'planUpdate':
              onPlanStepUpdate?.(event.msgId, event.stepId, event.status);
              break;
            case 'done':
              return { text: '' }; // Text is streamed via onText
            case 'error':
              throw new Error(event.message);
          }
        } catch (e) {
          console.error("Error parsing SSE event:", e, line);
        }
      }
    }
  }
  
  return { text: '' };
};

export const semanticChunker = async (text: string): Promise<any[]> => {
  return api.post<any[]>('/chunk', { text });
};

// Re-export registry things if needed by UI (e.g. for displaying tools)
// requires toolRegistryService to be refactored too? 
// The original file exported `toolRegistryService` etc.
// If components use `toolRegistryService.getDefinitions()`, we need to mock it or fetch from backend.
// Let's implement a facade for `toolRegistryService`.

export const toolRegistryService = {
  getDefinitions: () => [], // Use API if needed: api.get('/tools/definitions')
  get: (name: string) => null,
  getBlockingIds: () => new Set<string>(),
  register: () => {}, // No-op on frontend
  execute: async () => {} // No-op
};

export const subAgentRegistryService = {
  register: () => {}
};

export const registerToolFromSpec = () => {};
export const registerSubAgentFromSpec = () => {};
