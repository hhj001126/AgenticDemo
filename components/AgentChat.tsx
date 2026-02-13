import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Code, PieChart, ShieldCheck, Loader2, FileText, Search, ListChecks, BarChart3, Scale, Briefcase, MessageSquare, Sparkles } from 'lucide-react';
import { Industry, AgentMode, Message, Plan, VfsFile } from '../types';
import { supervisorAgent } from '../services/geminiService';
import { agentStateService } from '../services/agentStateService';
import CodeWorkspace from './CodeWorkspace';
import { ChatPanelLayout, useConfirm } from './ui';
import {
  PlanView,
  ChatHeader,
  ChatInput,
  QuickCommandGrid,
  QuickCommandRow,
  MessageBubble,
  QuickCommand,
} from './chat';

interface AgentChatProps {
  sessionId: string;
  industry: Industry;
  mode: AgentMode;
  onSessionChange?: (sessionId: string) => void;
  onSessionContentChange?: () => void;
}

const QUICK_COMMANDS: QuickCommand[] = [
  { label: '构建 Spring Boot 骨架', icon: Code, prompt: '构建一个典型的 Spring Boot 3 初始架构，包含核心配置。' },
  { label: '执行业务需求分析', icon: PieChart, prompt: '分析 2024 年政企数字化转型的核心挑战并给出方案。' },
  { label: '生成财务营收图表', icon: PieChart, prompt: '生成一个过去五个季度的财务营收对比图表，包含收入与利润两个维度。' },
  { label: '安全合规审计', icon: ShieldCheck, prompt: '审计当前应用架构是否存在安全漏洞，并给出加固建议。' },
  { label: '合同条款摘要', icon: FileText, prompt: '请对一份合同的关键条款进行摘要，并标出风险点。' },
  { label: '深度检索分析', icon: Search, prompt: '对给定主题进行深度检索，汇总多源信息并给出结论。' },
  { label: '任务计划拆解', icon: ListChecks, prompt: '将当前需求拆解为可执行的任务计划，并标注依赖与优先级。' },
  { label: '业务数据可视化', icon: BarChart3, prompt: '根据业务数据生成合适的图表（柱状/折线/饼图）并做简要分析。' },
  { label: '合规风险排查', icon: Scale, prompt: '从法律合规角度排查方案或文档中的风险，并给出整改建议。' },
  { label: '竞品与方案对比', icon: Briefcase, prompt: '对比分析多个方案或竞品的优劣，给出选型建议。' },
  { label: '会议纪要整理', icon: MessageSquare, prompt: '将会议记录整理成结构化纪要，包含结论与待办。' },
  { label: '创意头脑风暴', icon: Sparkles, prompt: '针对给定主题进行头脑风暴，给出多种可行方案。' },
];

const TITLE_MAX_LEN = 28;

const AgentChat: React.FC<AgentChatProps> = ({ sessionId, industry, mode, onSessionChange, onSessionContentChange }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [vfs, setVfs] = useState<Record<string, VfsFile>>({});
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  const loadState = useCallback((id: string) => {
    const saved = agentStateService.getSession(id);
    if (saved) {
      if (saved.uiMessages) setMessages(saved.uiMessages);
      if (saved.vfs) setVfs(saved.vfs);
    } else {
      setMessages([]);
      setVfs({});
    }
  }, []);

  useEffect(() => {
    loadState(sessionId);
  }, [sessionId, loadState]);

  useEffect(() => {
    const handleVfsUpdate = (e: Event) => {
      const ev = e as CustomEvent<Record<string, VfsFile>>;
      setVfs(ev.detail || {});
      setShowWorkspace(true);
    };
    window.addEventListener('vfs-updated', handleVfsUpdate);
    return () => window.removeEventListener('vfs-updated', handleVfsUpdate);
  }, []);

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

  const handleSend = async (customInput?: string, resumePlan?: Plan, isConfirmAction = false, planMsgId?: string) => {
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
      setMessages((prev) => {
        const next = [...prev, userMsg];
        if (prev.length === 0) {
          const title = textToSend.length > TITLE_MAX_LEN ? textToSend.slice(0, TITLE_MAX_LEN) + '…' : textToSend;
          agentStateService.updateSessionTitle(sessionId, title);
          onSessionContentChange?.();
        }
        return next;
      });
      setInput('');
    } else if (isConfirmAction) {
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.plan || !m.isAwaitingApproval) return m;
          const steps = m.plan.steps.map((s, i) =>
            i === 0 ? { ...s, status: "in_progress" as const } : s
          );
          return { ...m, isAwaitingApproval: false, plan: { ...m.plan, steps, isCollapsed: true } };
        })
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
        (msgId, stepId, status) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== msgId || !m.plan) return m;
              const steps = m.plan.steps;
              const idx = steps.findIndex((s) => s.id === stepId);
              const newSteps = steps.map((s, i) => {
                if (s.id === stepId) return { ...s, status };
                if (status === "completed" && idx >= 0 && i === idx + 1) return { ...s, status: "in_progress" as const };
                return s;
              });
              return { ...m, plan: { ...m.plan, steps: newSteps } };
            })
          );
        },
        targetPlan,
        isConfirmAction,
        planMsgId,
        { mode }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSession = async () => {
    const ok = await confirm({
      title: '清空会话',
      message: '确定要清空当前会话吗？消息与工作区内容将被重置，此操作不可恢复。',
      danger: true,
      confirmText: '清空',
      cancelText: '取消'
    });
    if (!ok) return;
    agentStateService.clearSessionContent(sessionId);
    loadState(sessionId);
    onSessionContentChange?.();
  };

  return (
    <ChatPanelLayout
      showWorkspace={showWorkspace}
      chat={
        <>
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-surface-muted/20">
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
                onConfirm={(p, msgId) => void handleSend(undefined, p, true, msgId)}
              />
            ))}
            {isLoading && !messages.some((m) => m.isAwaitingApproval) && (
              <div className="flex items-center gap-3 text-text-muted ml-12 animate-pulse">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">正在协同算力资源编排指令...</span>
              </div>
            )}
          </div>
          {messages.length > 0 && <QuickCommandRow commands={QUICK_COMMANDS} onSelect={(p) => handleSend(p)} />}
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
        </>
      }
      workspace={<CodeWorkspace files={vfs} onClose={() => setShowWorkspace(false)} activeFileOverride={activeFilePath} />}
    />
  );
};

export default AgentChat;
