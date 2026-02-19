import { useReducer, useCallback, useEffect } from 'react';
import { Message, Plan, ThinkingStep, ChartData, Industry, AgentMode, VfsFile } from '../types';
import { supervisorAgent } from '../services/geminiService';
import { agentStateService } from '../services/agentStateService';
import { toast } from '../utils/toast';

type SessionState = {
  messages: Message[];
  isLoading: boolean;
  vfs: Record<string, VfsFile>;
};

type Action =
  | { type: 'SET_MESSAGES'; messages: Message[] }
  | { type: 'SET_VFS'; vfs: Record<string, VfsFile> }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'UPDATE_MESSAGE'; id: string; update: Partial<Message> }
  | { type: 'UPDATE_THINKING'; msgId: string; step: ThinkingStep }
  | { type: 'APPEND_CHART'; msgId: string; chart: ChartData }
  | { type: 'APPEND_WRITTEN_FILES'; msgId: string; paths: string[] }
  | { type: 'TOGGLE_PLAN_STEP'; msgId: string; stepId: string }
  | { type: 'TOGGLE_PLAN_FOLD'; msgId: string }
  | { type: 'UPDATE_PLAN_STEP'; msgId: string; stepId: string; status: 'pending' | 'active' | 'completed' | 'failed' | 'in_progress' };

const sessionReducer = (state: SessionState, action: Action): SessionState => {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };
    case 'SET_VFS':
      return { ...state, vfs: action.vfs };
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, ...action.update } : m)),
      };
    case 'UPDATE_THINKING':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.msgId
            ? {
                ...m,
                thinkingSteps: [
                  ...(m.thinkingSteps || []).filter((s) => s.id !== action.step.id),
                  action.step,
                ],
              }
            : m
        ),
      };
    case 'APPEND_CHART':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.msgId ? { ...m, charts: [...(m.charts || []), action.chart] } : m
        ),
      };
    case 'APPEND_WRITTEN_FILES':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.msgId
            ? { ...m, writtenFiles: [...(m.writtenFiles || []), ...action.paths] }
            : m
        ),
      };
    case 'TOGGLE_PLAN_STEP':
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.msgId || !m.plan) return m;
          return {
            ...m,
            plan: {
              ...m.plan,
              steps: m.plan.steps.map((s) =>
                s.id === action.stepId ? { ...s, approved: !s.approved } : s
              ),
            },
          };
        }),
      };
    case 'TOGGLE_PLAN_FOLD':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.msgId && m.plan
            ? { ...m, plan: { ...m.plan, isCollapsed: !m.plan.isCollapsed } }
            : m
        ),
      };
    case 'UPDATE_PLAN_STEP':
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.msgId || !m.plan) return m;
          return {
            ...m,
            plan: {
              ...m.plan,
              steps: m.plan.steps.map((s) =>
                s.id === action.stepId ? { ...s, status: action.status as any } : s
              ),
            },
          };
        }),
      };
    default:
      return state;
  }
};

export const useAgentSession = (sessionId: string, industry: Industry, mode: AgentMode) => {
  const [state, dispatch] = useReducer(sessionReducer, {
    messages: [],
    isLoading: false,
    vfs: {},
  });

  const loadState = useCallback(async (id: string) => {
    try {
      const saved = await agentStateService.getSession(id);
      if (saved) {
        dispatch({ type: 'SET_MESSAGES', messages: saved.uiMessages || [] });
        dispatch({ type: 'SET_VFS', vfs: saved.vfs || {} });
      } else {
        dispatch({ type: 'SET_MESSAGES', messages: [] });
        dispatch({ type: 'SET_VFS', vfs: {} });
      }
    } catch (e) {
      console.error('Failed to load session', e);
    }
  }, []);

  useEffect(() => {
    if (sessionId) loadState(sessionId);
  }, [sessionId, loadState]);

  const sendMessage = useCallback(
    async (
      input: string,
      options?: {
        resumePlan?: Plan;
        isConfirmAction?: boolean;
        planMsgId?: string;
        onSessionContentChange?: () => void;
      }
    ) => {
      const { resumePlan, isConfirmAction, planMsgId, onSessionContentChange } = options || {};

      if (state.isLoading) {
          toast.warning("现有会话指令执行中，请稍候...");
          return;
      }
      
      if (!input.trim() && !isConfirmAction) return;

      const assistantMsgId = 'agent-' + Date.now();
      const isRefiningPlan = !isConfirmAction && state.messages.some((m) => m.isAwaitingApproval) && input.trim();

      // Handle UI side of "confirm", "refinement", or "first message"
      if (!isConfirmAction && !isRefiningPlan) {
        const userMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: input,
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: userMsg });

        // Side effect: Update title on FIRST message
        if (state.messages.length === 0) {
          const title = input.length > 28 ? input.slice(0, 28) + '…' : input;
          await agentStateService.updateSessionTitle(sessionId, title);
          onSessionContentChange?.();
        }
      } else if (isConfirmAction && planMsgId) {
        // Handled by supervisor logic usually
      } else if (isRefiningPlan) {
          const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
          // Close previous awaiting message
          const pendingMsg = [...state.messages].reverse().find(m => m.isAwaitingApproval);
          if (pendingMsg) {
              dispatch({ type: 'UPDATE_MESSAGE', id: pendingMsg.id, update: { isAwaitingApproval: false } });
          }
          dispatch({ type: 'ADD_MESSAGE', message: userMsg });
      }

      dispatch({ type: 'SET_LOADING', loading: true });
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        thinkingSteps: [],
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', message: assistantMsg });

      try {
        await supervisorAgent(
          sessionId,
          input,
          industry,
          (step: ThinkingStep) => dispatch({ type: 'UPDATE_THINKING', msgId: assistantMsgId, step }),
          (chunk: string) => dispatch({ type: 'UPDATE_MESSAGE', id: assistantMsgId, update: { content: chunk } }),
          (plan: Plan) => dispatch({ type: 'UPDATE_MESSAGE', id: assistantMsgId, update: { plan, isAwaitingApproval: true } }),
          (chart: ChartData) => dispatch({ type: 'APPEND_CHART', msgId: assistantMsgId, chart }),
          (paths: string[]) => {
            loadState(sessionId);
            dispatch({ type: 'APPEND_WRITTEN_FILES', msgId: assistantMsgId, paths });
          },
          (msgId: string, stepId: string, status: any) =>
            dispatch({ type: 'UPDATE_PLAN_STEP', msgId: msgId || planMsgId || assistantMsgId, stepId, status }),
          resumePlan,
          isConfirmAction,
          planMsgId,
          { ...options, mode, assistantMsgId } as any
        );
      } catch (err: any) {
        toast.error('Agent Error: ' + err.message);
        dispatch({
          type: 'ADD_MESSAGE',
          message: {
            id: Date.now().toString(),
            role: 'assistant',
            content: `⚠️ Error: ${err.message}`,
            timestamp: Date.now(),
          },
        });
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    [sessionId, industry, mode, state.isLoading, state.messages.length, loadState]
  );

  return {
    ...state,
    sendMessage,
    loadState,
    dispatch, 
  };
};
