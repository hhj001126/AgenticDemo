import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Code, PieChart, ShieldCheck, Loader2 } from 'lucide-react';
import { Industry, AgentMode, Message, Plan, VfsFile } from '../types';
import { supervisorAgent } from '../services/geminiService';
import { agentStateService } from '../services/agentStateService';
import CodeWorkspace from './CodeWorkspace';
import {
  PlanView,
  ChatHeader,
  ChatInput,
  QuickCommandGrid,
  MessageBubble,
  QuickCommand,
} from './chat';

interface AgentChatProps {
  industry: Industry;
  mode: AgentMode;
}

const QUICK_COMMANDS: QuickCommand[] = [
  { label: '构建 Spring Boot 骨架', icon: Code, prompt: '构建一个典型的 Spring Boot 3 初始架构，包含核心配置。' },
  { label: '执行业务需求分析', icon: PieChart, prompt: '分析 2024 年政企数字化转型的核心挑战并给出方案。' },
  { label: '生成财务营收图表', icon: PieChart, prompt: '生成一个过去五个季度的财务营收对比图表，包含收入与利润两个维度。' },
  { label: '安全合规审计', icon: ShieldCheck, prompt: '审计当前应用架构是否存在安全漏洞，并给出加固建议。' },
];

const AgentChat: React.FC<AgentChatProps> = ({ industry, mode }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [vfs, setVfs] = useState<Record<string, VfsFile>>({});
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = agentStateService.initializeSession();
    setSessionId(id);
    loadState(id);

    const handleVfsUpdate = (e: Event) => {
      const ev = e as CustomEvent<Record<string, VfsFile>>;
      setVfs(ev.detail || {});
      setShowWorkspace(true);
    };
    window.addEventListener('vfs-updated', handleVfsUpdate);
    return () => window.removeEventListener('vfs-updated', handleVfsUpdate);
  }, []);

  const loadState = (id: string) => {
    const saved = agentStateService.getSession(id);
    if (saved) {
      if (saved.uiMessages) setMessages(saved.uiMessages);
      if (saved.vfs) setVfs(saved.vfs);
    }
  };

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      agentStateService.syncUiState(sessionId, messages);
    }
  }, [messages, sessionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const toggleStepApproval = useCallback((msgId: string, stepId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.plan) {
          const newSteps = m.plan.steps.map((s) => (s.id === stepId ? { ...s, approved: !s.approved } : s));
          return { ...m, plan: { ...m.plan, steps: newSteps } };
        }
        return m;
      })
    );
  }, []);

  const togglePlanFold = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId && m.plan ? { ...m, plan: { ...m.plan, isCollapsed: !m.plan.isCollapsed } } : m))
    );
  }, []);

  const handleSend = async (customInput?: string, resumePlan?: Plan, isConfirmAction = false) => {
    const textToSend = customInput || input;
    const isRefiningPlan = !isConfirmAction && messages.some((m) => m.isAwaitingApproval) && textToSend.trim();

    if ((!textToSend.trim() && !isConfirmAction) || isLoading) return;

    let targetPlan = resumePlan;
    let contextualInput = textToSend;
    
    if (isRefiningPlan) {
      const pendingMsg = [...messages].reverse().find((m) => m.isAwaitingApproval);
      if (pendingMsg?.plan) {
        targetPlan = pendingMsg.plan;
        // 将用户输入作为上下文，结合原始计划
        contextualInput = `用户补充指令：${textToSend}\n\n请基于以上补充调整计划 ${JSON.stringify(targetPlan)} 并执行。`;
      }
    }

    if (!isConfirmAction && !isRefiningPlan) {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    } else if (isConfirmAction) {
      setMessages((prev) =>
        prev.map((m) => (m.plan && m.isAwaitingApproval ? { ...m, isAwaitingApproval: false, plan: { ...m.plan!, isCollapsed: true } } : m))
      );
    } else if (isRefiningPlan) {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      setMessages((prev) =>
        prev
          .map((m) =>
            m.isAwaitingApproval && m.plan
              ? { ...m, isAwaitingApproval: false, plan: { ...m.plan, isCollapsed: true } }
              : m.isAwaitingApproval
                ? { ...m, isAwaitingApproval: false }
                : m
          )
          .concat(userMsg)
      );
      setInput('');
    }

    setIsLoading(true);
    const assistantMsgId = 'agent-' + Date.now();
    const assistantMsg: Message = { id: assistantMsgId, role: 'assistant', content: '', thinkingSteps: [], timestamp: Date.now() };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      await supervisorAgent(
        sessionId,
        contextualInput,
        industry,
        (step) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, thinkingSteps: [...(m.thinkingSteps || []).filter((s) => s.id !== step.id), step] } : m
            )
          );
        },
        (text) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: text } : m)));
        },
        (plan) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, plan, isAwaitingApproval: true } : m)));
        },
        (chartData) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, charts: [...(m.charts ?? []), chartData] } : m
            )
          );
        },
        (paths) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, writtenFiles: [...(m.writtenFiles ?? []), ...paths] }
                : m
            )
          );
        },
        targetPlan,
        isConfirmAction
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSession = () => {
    if (window.confirm('确定要清空会话吗？')) {
      agentStateService.clearSession(sessionId);
      window.location.reload();
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      <div
        className={`flex flex-col h-full bg-white rounded-[2rem] border border-slate-200 overflow-hidden transition-all duration-500 ${showWorkspace ? 'w-[45%]' : 'w-full'}`}
      >
        <ChatHeader
          industry={industry}
          mode={mode}
          showWorkspace={showWorkspace}
          onToggleWorkspace={() => setShowWorkspace(!showWorkspace)}
          onClearSession={handleClearSession}
          onRefresh={() => {
            loadState(sessionId);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
          }}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-50/20">
          {messages.length === 0 && <QuickCommandGrid commands={QUICK_COMMANDS} onSelect={(p) => handleSend(p)} />}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              vfs={vfs}
              onFileClick={(path) => {
                setShowWorkspace(true);
                setActiveFilePath(path);
              }}
              onFileDetailClick={(path) => {
                setShowWorkspace(true);
                setActiveFilePath(path);
              }}
              onToggleFold={togglePlanFold}
              onToggleStep={toggleStepApproval}
              onConfirm={(p) => handleSend(undefined, p, true)}
            />
          ))}

          {isLoading && !messages.some((m) => m.isAwaitingApproval) && (
            <div className="flex items-center gap-3 text-slate-400 ml-12 animate-pulse">
              <Loader2 size={18} className="animate-spin text-indigo-500" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">正在协同算力资源编排指令...</span>
            </div>
          )}
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => handleSend()}
          isLoading={isLoading}
          placeholder={
            messages.some((m) => m.isAwaitingApproval)
              ? '输入反馈以调整计划，或直接点击上方确认执行...'
              : '输入任务指令或业务需求...'
          }
        />
      </div>

      {showWorkspace && (
        <div className="flex-1 h-full min-w-0">
          <CodeWorkspace files={vfs} onClose={() => setShowWorkspace(false)} activeFileOverride={activeFilePath} />
        </div>
      )}
    </div>
  );
};

export default AgentChat;
