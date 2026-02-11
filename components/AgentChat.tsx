import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { 
  Send, Bot, Sparkles, RefreshCw, Loader2, 
  Braces, ListChecks, CheckCircle, Split, 
  Square, CheckSquare, XCircle, MessageSquare, 
  Code, ShieldCheck, PieChart, Terminal,
  User, ChevronDown, ChevronUp, Trash2, Zap,
  Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Industry, AgentMode, Message, ThinkingStep, Plan, VfsFile, ChartData } from '../types';
import { supervisorAgent } from '../services/geminiService';
import { agentStateService } from '../services/agentStateService';
import ThinkingProcess from './ThinkingProcess';
import CodeWorkspace from './CodeWorkspace';
import VisualChart, { ChartSkeleton } from './VisualChart';

interface AgentChatProps { industry: Industry; mode: AgentMode; }

const PlanView: React.FC<{ 
  plan: Plan; 
  msgId: string; 
  isAwaitingApproval: boolean;
  onToggleFold: (id: string) => void;
  onToggleStep: (id: string, stepId: string) => void;
  onConfirm: (plan: Plan) => void;
}> = memo(({ plan, msgId, isAwaitingApproval, onToggleFold, onToggleStep, onConfirm }) => {
  const [localCollapsed, setLocalCollapsed] = useState(plan.isCollapsed ?? false);

  const toggle = () => {
    setLocalCollapsed(!localCollapsed);
    if (onToggleFold) onToggleFold(msgId);
  };

  return (
    <div className="w-full bg-white border border-indigo-100 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border-2 my-4">
      <div onClick={toggle} className="flex items-center justify-between px-7 py-5 cursor-pointer hover:bg-slate-50 transition-colors border-b border-indigo-50 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
              <ListChecks size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{plan.title}</h4>
              <span className="text-[10px] text-indigo-600 font-bold uppercase">{plan.steps.length} 阶段编排就绪</span>
            </div>
          </div>
          {localCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
      </div>
      {!localCollapsed && (
        <div className="p-7">
          <div className="space-y-4">
            {plan.steps.map(s => (
              <div key={s.id} className={`flex items-start gap-4 p-4 rounded-[1.25rem] transition-all border ${isAwaitingApproval && s.requiresApproval ? 'bg-white border-slate-200 cursor-pointer hover:border-indigo-400 hover:shadow-md' : 'bg-slate-50 border-slate-100'} ${!s.approved ? 'opacity-50' : ''}`} onClick={() => isAwaitingApproval && s.requiresApproval && onToggleStep(msgId, s.id)}>
                <div className={`mt-0.5 flex-shrink-0`}>
                  {isAwaitingApproval ? (
                    s.approved ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-slate-300" />
                  ) : (
                    s.approved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[13px] font-bold truncate ${s.approved ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{s.task}</p>
                    {s.isAutoApproved ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase">
                        <Zap size={8} /> Auto
                      </div>
                    ) : (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${s.approved ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                        <User size={8} /> {s.approved ? 'Approved' : 'Review'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {s.parallel && <span className="text-[8px] bg-slate-200 text-slate-600 px-1.5 rounded uppercase font-black">Parallel Thread</span>}
                    {s.requiresApproval && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 rounded uppercase font-black tracking-tighter">Manual Review Required</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {isAwaitingApproval && (
            <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                 <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Clock size={16} /></div>
                 <p className="text-[11px] font-bold text-indigo-800">当前任务处于挂起状态。您可以手动勾选步骤进行授权，或在下方输入补充调整建议来优化此计划。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => onConfirm(plan)} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center justify-center gap-2"><CheckCircle size={16} /> 确认并开始执行</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const AgentChat: React.FC<AgentChatProps> = ({ industry, mode }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [vfs, setVfs] = useState<Record<string, VfsFile>>({});
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [customFeedback, setCustomFeedback] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickCommands = [
    { label: '构建 Spring Boot 骨架', icon: Code, prompt: '构建一个典型的 Spring Boot 3 初始架构，包含核心配置。' },
    { label: '执行业务需求分析', icon: PieChart, prompt: '分析 2024 年政企数字化转型的核心挑战并给出方案。' },
    { label: '生成财务营收图表', icon: PieChart, prompt: '生成一个过去五个季度的财务营收对比图表，包含收入与利润两个维度。' },
    { label: '安全合规审计', icon: ShieldCheck, prompt: '审计当前应用架构是否存在安全漏洞，并给出加固建议。' }
  ];

  useEffect(() => {
    const id = agentStateService.initializeSession();
    setSessionId(id);
    loadState(id);
    
    const handleVfsUpdate = (e: any) => { 
      setVfs(e.detail); 
      // Auto-switch to workspace if a file is being written for the first time
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
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.plan) {
        const newSteps = m.plan.steps.map(s => s.id === stepId ? { ...s, approved: !s.approved } : s);
        return { ...m, plan: { ...m.plan, steps: newSteps } };
      }
      return m;
    }));
  }, []);

  const togglePlanFold = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => (m.id === msgId && m.plan) ? { ...m, plan: { ...m.plan, isCollapsed: !m.plan.isCollapsed } } : m));
  }, []);

  const handleSend = async (customInput?: string, resumePlan?: Plan, isConfirmAction: boolean = false) => {
    const textToSend = customInput || input;
    const isRefiningPlan = !isConfirmAction && messages.some(m => m.isAwaitingApproval) && textToSend.trim();
    
    if (!textToSend.trim() && !isConfirmAction || isLoading) return;

    let targetPlan = resumePlan;
    if (isRefiningPlan) {
      const pendingMsg = [...messages].reverse().find(m => m.isAwaitingApproval);
      if (pendingMsg && pendingMsg.plan) {
        targetPlan = pendingMsg.plan;
      }
    }

    if (!isConfirmAction && !isRefiningPlan) {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
    } else if (isConfirmAction) {
      setMessages(prev => prev.map(m => m.plan && m.isAwaitingApproval ? { ...m, isAwaitingApproval: false, plan: { ...m.plan!, isCollapsed: true } } : m));
    } else if (isRefiningPlan) {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
      setMessages(prev => {
        return prev.map(m => m.isAwaitingApproval ? { ...m, isAwaitingApproval: false } : m).concat(userMsg);
      });
      setInput('');
    }

    setIsLoading(true);
    const assistantMsgId = 'agent-' + Date.now();
    const assistantMsg: Message = { id: assistantMsgId, role: 'assistant', content: '', thinkingSteps: [], timestamp: Date.now() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      await supervisorAgent(sessionId, textToSend, industry,
        (step) => {
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
            ...m, thinkingSteps: [...(m.thinkingSteps || []).filter(s => s.id !== step.id), step] 
          } : m));
        },
        (text) => {
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: text } : m));
        },
        (plan) => {
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, plan, isAwaitingApproval: true } : m));
        },
        (chartData) => {
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, chartData } : m));
        },
        targetPlan,
        isConfirmAction
      );
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const content = String(children).replace(/\n$/, '');
      
      if (!inline && match && match[1] === 'json') {
        const isChartDataPossible = content.includes('"chartData"');
        const isPlanPossible = content.includes('"plan"');
        
        if (isChartDataPossible) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.chartData) return <VisualChart data={parsed.chartData} />;
          } catch (e) { return <ChartSkeleton />; }
          return null;
        }

        if (isPlanPossible) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.plan) {
              parsed.plan.steps = (parsed.plan.steps || []).map((s: any) => ({
                ...s,
                approved: s.approved ?? !s.requiresApproval,
                isAutoApproved: s.isAutoApproved ?? !s.requiresApproval
              }));
              
              return (
                <PlanView 
                  plan={parsed.plan} 
                  msgId="text-plan" 
                  isAwaitingApproval={false} 
                  onToggleFold={() => {}} 
                  onToggleStep={() => {}} 
                  onConfirm={() => {}} 
                />
              );
            }
          } catch (e) { return <div className="p-4 bg-slate-50 border rounded-xl animate-pulse text-xs font-bold text-slate-400">正在解析任务编排矩阵...</div>; }
          return null;
        }
      }
      
      return !inline && match ? (
        <pre className={`${className} bg-slate-900 text-indigo-200 p-4 rounded-xl overflow-x-auto text-xs my-4 border border-slate-800`}>
          <code {...props}>{children}</code>
        </pre>
      ) : (
        <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-[0.9em] font-bold" {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      <div className={`flex flex-col h-full bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden transition-all duration-500 ${showWorkspace ? 'w-[45%]' : 'w-full'}`}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg"><Braces size={20} /></div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Supervisor Pro</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{industry} • {mode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowWorkspace(!showWorkspace)} title="代码工作空间" className={`p-2 rounded-lg transition-all ${showWorkspace ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Split size={18} /></button>
             <button onClick={() => { if(window.confirm("确定要清空会话吗？")) { agentStateService.clearSession(sessionId); window.location.reload(); } }} title="清空会话" className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-all hover:bg-rose-50"><Trash2 size={18} /></button>
             <button onClick={() => { loadState(sessionId); setIsLoading(true); setTimeout(() => setIsLoading(false), 500); }} title="刷新状态" className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-all hover:bg-slate-50"><RefreshCw size={18} /></button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 px-10">
              <Sparkles size={48} className="text-indigo-500 mb-6 animate-pulse" />
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">智能编排控制中心</h3>
              <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mt-10">
                {quickCommands.map((cmd) => (
                  <button key={cmd.label} onClick={() => handleSend(cmd.prompt)} className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all group text-left">
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-4 transition-colors"><cmd.icon size={20} /></div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{cmd.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-3 max-w-[92%]`}>
                
                {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                  <ThinkingProcess steps={msg.thinkingSteps} onFileClick={(path) => { setShowWorkspace(true); setActiveFilePath(path); }} />
                )}

                {msg.content && (
                  <div className={`p-5 rounded-[1.5rem] shadow-sm border ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border-slate-100'}`}>
                    <div className="markdown-body text-sm font-medium leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents as any}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                
                {msg.chartData && !msg.content.includes('"chartData"') && <VisualChart data={msg.chartData} />}
                
                {msg.plan && !msg.content.includes('"plan"') && (
                   <PlanView 
                      plan={msg.plan} 
                      msgId={msg.id} 
                      isAwaitingApproval={!!msg.isAwaitingApproval} 
                      onToggleFold={togglePlanFold} 
                      onToggleStep={toggleStepApproval} 
                      onConfirm={(p) => handleSend(undefined, p, true)}
                   />
                )}
              </div>
            </div>
          ))}
          {isLoading && !messages.some(m => m.isAwaitingApproval) && (
            <div className="flex items-center gap-3 text-slate-400 ml-12 animate-pulse">
               <Loader2 size={18} className="animate-spin text-indigo-500" />
               <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">正在协同算力资源编排指令...</span>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="flex items-end gap-3 bg-slate-50 p-2 rounded-[1.75rem] border-2 border-slate-100 focus-within:border-indigo-600 focus-within:bg-white transition-all duration-300">
            <textarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
              placeholder={messages.some(m => m.isAwaitingApproval) ? "输入反馈以调整计划，或直接点击上方确认执行..." : "输入任务指令或业务需求..." }
              rows={1} 
              className="flex-1 max-h-32 bg-transparent border-none focus:ring-0 text-sm py-3 px-5 resize-none outline-none font-bold text-slate-800" 
            />
            <button 
              onClick={() => handleSend()} 
              disabled={!input.trim() || isLoading} 
              className="w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-lg hover:bg-indigo-600 disabled:opacity-20 transition-all flex items-center justify-center transform active:scale-95"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>
      {showWorkspace && <div className="flex-1 h-full min-w-0"><CodeWorkspace files={vfs} onClose={() => setShowWorkspace(false)} activeFileOverride={activeFilePath} /></div>}
    </div>
  );
};
export default AgentChat;
