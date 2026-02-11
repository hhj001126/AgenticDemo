import React, { useState } from 'react';
import { 
  BrainCircuit, CheckCircle2, Loader2, ChevronDown, ChevronUp, 
  Activity, ExternalLink, Info, Braces
} from 'lucide-react';
import { ThinkingStep } from '../types';

interface ThinkingStepItemProps {
  step: ThinkingStep;
  onFileClick?: (path: string) => void;
}

const ThinkingStepRow: React.FC<ThinkingStepItemProps> = ({ step, onFileClick }) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <div className="relative pl-6 pb-6 last:pb-0 group/row">
      {/* Timeline line */}
      <div className="absolute left-[9px] top-2 bottom-0 w-0.5 bg-slate-100 group-last/row:hidden"></div>
      
      {/* Status indicator */}
      <div className={`absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 z-10 transition-all ${
        step.status === 'completed' ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 
        step.status === 'active' ? 'bg-indigo-600 border-indigo-600 text-white animate-pulse' : 
        step.status === 'failed' ? 'bg-rose-50 border-rose-300 text-rose-600' : 'bg-white border-slate-200 text-slate-400'
      }`}>
        {step.status === 'active' ? <Loader2 size={10} className="animate-spin" /> : 
         step.status === 'completed' ? <CheckCircle2 size={10} /> : <Activity size={10} />}
      </div>

      <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all group/item shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{step.id.slice(-4)}</span>
            <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
              <Braces size={10} />
              {step.agentName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400">{new Date(step.timestamp).toLocaleTimeString()}</span>
            {step.details && (
              <button 
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
              >
                {isDetailsOpen ? <ChevronUp size={12} /> : <Info size={12} />}
              </button>
            )}
            {step.fileLink && (
              <button onClick={() => onFileClick?.(step.fileLink!)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors">
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>

        <p className="text-sm font-bold text-slate-800 leading-relaxed">{step.content}</p>

        {isDetailsOpen && step.details && (
          <div className="mt-3 p-4 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner group/details relative animate-in fade-in slide-in-from-top-2 duration-300">
             <pre className="text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">{step.details}</pre>
             <div className="absolute top-2 right-2 text-[8px] font-black text-slate-700 uppercase tracking-widest opacity-30 group-hover/details:opacity-60 transition-opacity">Execution Trace</div>
          </div>
        )}
      </div>
    </div>
  );
};

const ThinkingProcess: React.FC<{ steps: ThinkingStep[]; onFileClick?: (path: string) => void }> = ({ steps, onFileClick }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!steps.length) return null;

  const isActive = steps.some(s => s.status === 'active');
  const sortedSteps = [...steps].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className={`bg-white rounded-[2rem] border-2 ${isActive ? 'border-indigo-400 shadow-indigo-100' : 'border-slate-200 shadow-slate-100'} overflow-hidden transition-all duration-500 w-full shadow-xl`}>
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`flex items-center justify-between px-7 py-5 cursor-pointer transition-colors ${isCollapsed ? 'hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50 border-b border-slate-100'}`}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-2xl shadow-lg transition-all ${isActive ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 block">思维逻辑链条 (Chain of Thought)</span>
              {isActive && <div className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black rounded-full animate-pulse uppercase">编排中...</div>}
            </div>
            {/* Show summarized activity even when collapsed */}
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
              {steps[steps.length - 1].content}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase mr-2">{isCollapsed ? '展开详情' : '折叠'}</span>
          {isCollapsed ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="px-7 py-8 max-h-[500px] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col">
            {sortedSteps.map(s => (
              <ThinkingStepRow key={s.id} step={s} onFileClick={onFileClick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingProcess;
