import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Bot, Sparkles, RefreshCw, Loader2, 
  ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Braces,
  BarChart3, Activity, ExternalLink, TrendingUp, Calendar, 
  Terminal, User, HardDrive, Eraser
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Industry, AgentMode, Message, ThinkingStep, ChartData } from '../types';
import { supervisorAgent, toolDefinitions } from '../services/geminiService';
import { agentStateService } from '../services/agentStateService';
import ThinkingProcess from './ThinkingProcess';

interface AgentChatProps {
  industry: Industry;
  mode: AgentMode;
}

const SalesChart: React.FC<{ data?: ChartData; isLoading?: boolean }> = ({ data, isLoading }) => {
  const maxValue = useMemo(() => {
    if (!data?.datasets || data.datasets.length === 0 || !data.datasets[0].data) {
      return 100;
    }
    return Math.max(...data.datasets[0].data, 1);
  }, [data]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  
  if (!data && !isLoading) return null;

  return (
    <div className={`my-6 p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl border border-white/5 transition-all ${isLoading ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <BarChart3 size={18} />
          </div>
          <div>
            <h4 className="text-[13px] font-black tracking-tight">{data?.title || '正在加载图表数据...'}</h4>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
              {isLoading ? 'Real-time Processing' : 'MCP Verified Engine'}
            </span>
          </div>
        </div>
        {!isLoading && (
          <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={10} className="text-emerald-400" /> Insight Ready
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {(data?.labels || ['...', '...', '...']).map((label, idx) => {
          const dataset = data?.datasets?.[0];
          const val = (dataset?.data && dataset.data[idx]) !== undefined ? dataset.data[idx] : 0;
          const percentage = data ? (val / maxValue) * 100 : 30;
          const isHovered = hoverIdx === idx;

          return (
            <div 
              key={`${label}-${idx}`} 
              className={`space-y-1.5 cursor-pointer transition-opacity ${isLoading ? 'opacity-50' : ''}`}
              onMouseEnter={() => !isLoading && setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div className="flex justify-between items-end">
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isHovered ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {label}
                </span>
                {data && (
                  <span className={`text-[11px] font-mono font-bold transition-all ${isHovered ? 'text-white scale-105' : 'text-slate-400'}`}>
                    {val.toLocaleString()} {dataset?.label?.includes('营收') ? '¥' : ''}
                  </span>
                )}
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 ease-out rounded-full ${
                    isHovered ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AgentChat: React.FC<AgentChatProps> = ({ industry, mode }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThinkId, setExpandedThinkId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize and load persistent session state
  useEffect(() => {
    const id = agentStateService.initializeSession();
    setSessionId(id);
    
    const savedState = agentStateService.getSession(id);
    if (savedState && savedState.uiMessages.length > 0) {
      setMessages(savedState.uiMessages);
      // Auto-scroll to bottom after restore
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleReset = () => {
    if (sessionId) {
      agentStateService.clearSession(sessionId);
      const newId = agentStateService.createSession();
      setSessionId(newId);
      setMessages([]);
    }
  };

  const handleClearContext = () => {
    if (sessionId) {
      agentStateService.clearSessionContext(sessionId);
      setMessages(prev => [...prev, {
        id: 'sys-clear-' + Date.now(),
        role: 'system',
        content: 'Context has been cleared (Tool history removed).',
        timestamp: Date.now()
      }]);
    }
  };

  const handleSend = async (customInput?: string) => {
    const textToSend = customInput || input;
    if (!textToSend.trim() || isLoading) return;

    // Automatic context compression before new turn to avoid repeating large tool histories
    // agentStateService.clearSessionContext(sessionId); 

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    // Update local and persistent state immediately
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    agentStateService.syncUiState(sessionId, nextMessages);
    
    setInput('');
    setIsLoading(true);

    const thinkingMsgId = 'thinking-' + Date.now();
    const initialThinkingStep: ThinkingStep = {
      id: 'init-' + Date.now(),
      agentId: 'supervisor',
      agentName: '任务分发中枢',
      content: '解析需求意图... 正在规划执行链路。',
      status: 'active',
      timestamp: Date.now()
    };
    
    const assistantMsg: Message = {
      id: thinkingMsgId,
      role: 'assistant',
      content: '',
      thinkingSteps: [initialThinkingStep],
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMsg]);
    setExpandedThinkId(thinkingMsgId);

    try {
      const response = await supervisorAgent(
        sessionId,
        textToSend, 
        industry, 
        (newStep) => {
          setMessages(prev => {
            const updated = prev.map(m => {
              if (m.id === thinkingMsgId) {
                const steps = [...(m.thinkingSteps || [])];
                // Mark previous step as completed if exists
                if (steps.length > 0 && steps[steps.length - 1].status === 'active') {
                   steps[steps.length - 1].status = 'completed';
                }
                steps.push(newStep);
                return { ...m, thinkingSteps: steps };
              }
              return m;
            });
            // Don't sync every thinking step to storage to avoid thrashing, 
            // but for robustness we could. Here we sync at end.
            return updated;
          });
        },
        (chunkText) => {
          setMessages(prev => prev.map(m => {
            if (m.id === thinkingMsgId) {
              return { ...m, content: chunkText };
            }
            return m;
          }));
        }
      );

      setMessages(prev => {
        const finalMessages = prev.map(m => {
          if (m.id === thinkingMsgId) {
            const finalSteps = m.thinkingSteps ? [...m.thinkingSteps] : [];
            if (finalSteps.length > 0 && finalSteps[finalSteps.length - 1].status === 'active') {
               finalSteps[finalSteps.length - 1].status = 'completed';
            }
            // Ensure we use the text from the response, or fallback to existing content if streamed
            const finalContent = response.text || m.content;
            return { ...m, content: finalContent, thinkingSteps: finalSteps };
          }
          return m;
        });
        
        // Final sync of the complete turn to persistent storage
        agentStateService.syncUiState(sessionId, finalMessages);
        
        // Optional: Auto-compress history after turn to save tokens for next turn
        agentStateService.clearSessionContext(sessionId);
        
        return finalMessages;
      });
      
      setExpandedThinkId(null);

    } catch (error: any) {
      setMessages(prev => {
        const updated = prev.map(m => {
          if (m.id === thinkingMsgId) {
            return { ...m, role: 'system' as const, content: `执行异常: ${error?.message || '未知通信中断'}` };
          }
          return m;
        });
        agentStateService.syncUiState(sessionId, updated);
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickCommands = [
    { text: '第一步核实张伟的员工信息，然后分析去年业绩并计算 ROI', icon: <User size={14} /> },
    { text: '分析年度销售部各人员的获客贡献', icon: <BarChart3 size={14} /> },
    { text: '预约年后第一个工作日的项目评审会并发送祝福', icon: <Calendar size={14} /> }
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Braces size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tighter uppercase">Enterprise Supervisor</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Active</p>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-400 font-mono">
                <HardDrive size={8} />
                <span>{sessionId.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearContext} 
            className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-all hover:bg-slate-50"
            title="Clear Context (Keep UI)"
          >
            <Eraser size={18} />
          </button>
          <button 
            onClick={handleReset} 
            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-all hover:bg-slate-50"
            title="Reset Session & State"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth bg-slate-50/20">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 py-12">
            <div className="w-16 h-16 bg-white rounded-[1.25rem] flex items-center justify-center text-indigo-500 shadow-xl border border-indigo-50">
              <Sparkles size={32} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">智能业务调度</h3>
              <p className="text-slate-500 text-sm font-medium">深度集成企业 MCP 组件与 Chain-of-Thought 逻辑审计。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl px-4">
              {quickCommands.map((cmd) => (
                <button
                  key={cmd.text}
                  onClick={() => handleSend(cmd.text)}
                  className="p-4 text-[11px] font-black text-left bg-white border border-slate-100 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all text-slate-700 flex items-center justify-between group"
                >
                  <span className="line-clamp-1">{cmd.text}</span>
                  <span className="text-slate-300 group-hover:text-indigo-500 shrink-0">{cmd.icon}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-3 animate-in fade-in duration-500`}>
            {msg.role === 'system' ? (
              <div className="w-full flex justify-center my-4">
                 <span className="text-[10px] bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                   {msg.content}
                 </span>
              </div>
            ) : (
              <>
                <div className={`px-2 flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${msg.role === 'user' ? 'bg-indigo-400' : 'bg-slate-900'}`}></div>
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 font-mono">
                    {msg.role === 'assistant' ? 'Cog_Network' : 'Client_Root'}
                  </span>
                </div>
                
                <div className="flex gap-4 max-w-[98%] w-full items-start">
                  <div className={`flex flex-col gap-4 flex-1 min-w-0 ${msg.role === 'user' ? 'items-end' : ''}`}>
                    {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                      <div className="w-full border-l-4 border-indigo-500 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                        <button onClick={() => setExpandedThinkId(expandedThinkId === msg.id ? null : msg.id)} className="flex items-center justify-between w-full px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Activity size={16} className="text-indigo-600" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Reasoning Chain</span>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-xl">
                             <span className="text-[10px] font-black text-slate-600">{msg.thinkingSteps.length} STEPS</span>
                             {expandedThinkId === msg.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </button>
                        {expandedThinkId === msg.id && (
                          <div className="px-6 pb-6 border-t border-slate-100">
                            <ThinkingProcess steps={msg.thinkingSteps} className="!bg-transparent !border-none !shadow-none !p-0" />
                          </div>
                        )}
                      </div>
                    )}

                    {msg.content && (
                       <div className={`p-8 rounded-[2rem] shadow-sm relative transition-all border ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none border-transparent' 
                          : 'bg-white text-slate-800 rounded-tl-none border-slate-100'
                      }`}>
                        <div className="markdown-body">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, className, children, ...props }: any) {
                                const match = /language-json/.exec(className || '');
                                const content = String(children || '').replace(/\n$/, '');
                                if (match && content.includes('"chartData"')) {
                                  try {
                                    const parsed = JSON.parse(content);
                                    if (parsed.chartData) {
                                      return <SalesChart data={parsed.chartData} />;
                                    }
                                  } catch (e) {
                                    return <SalesChart isLoading={true} />;
                                  }
                                }
                                const { inline, ...rest } = props;
                                return <code className={className} {...rest}>{children}</code>;
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="px-6 py-6 border-t border-slate-100">
        <div className="max-w-3xl mx-auto flex items-end gap-3 bg-white p-2 rounded-[1.5rem] border border-slate-200 focus-within:border-slate-900 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={`输入业务需求 (例如: 第一步核实张伟信息，然后分析 2025 销售业绩)...`}
            rows={1}
            className="flex-1 max-h-32 bg-transparent border-none focus:ring-0 text-sm py-3 px-4 resize-none outline-none font-bold text-slate-800"
          />
          <button 
            onClick={() => handleSend()} 
            disabled={!input.trim() || isLoading} 
            className="w-12 h-12 rounded-xl bg-slate-900 text-white shadow-lg hover:bg-indigo-600 disabled:opacity-20 transition-all flex items-center justify-center"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;