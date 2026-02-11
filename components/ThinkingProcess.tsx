
import React, { useState, useMemo } from 'react';
import { 
  BrainCircuit, CheckCircle2, Loader2, ChevronDown, ChevronUp, 
  Code2, AlertTriangle, Braces, Copy, Plus, Minus, Activity 
} from 'lucide-react';
import { ThinkingStep } from '../types';

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  className?: string;
}

// Deep JSON Viewer with individual expansion logic
const JsonView: React.FC<{ data: any; label?: string; level?: number; defaultOpen?: boolean }> = ({ data, label, level = 0, defaultOpen = false }) => {
  const isObject = data !== null && typeof data === 'object';
  const [isOpen, setIsOpen] = useState(defaultOpen || level < 2);

  if (!isObject) {
    return (
      <div className="flex items-start gap-2 py-0.5 pl-2">
        {label && <span className="text-indigo-300 font-semibold italic">"{label}":</span>}
        <span className={typeof data === 'string' ? 'text-emerald-400' : 'text-amber-400'}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
      </div>
    );
  }

  const entries = Object.entries(data);
  const isArray = Array.isArray(data);

  return (
    <div className={`font-mono text-[11px] ${level > 0 ? 'ml-4 border-l border-slate-700/50 pl-2' : ''}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-white/5 rounded transition-all group/header"
      >
        <div className="text-slate-500 group-hover/header:text-slate-300">
          {isOpen ? <Minus size={10} /> : <Plus size={10} />}
        </div>
        {label && <span className="text-indigo-300 font-bold">"{label}":</span>}
        <span className="text-slate-500">
          {isArray ? `Array(${entries.length}) [` : `Object {`}
          {!isOpen && ' ... '}
          {isArray ? ']' : '}'}
        </span>
      </div>
      
      {isOpen && (
        <div className="space-y-0.5">
          {entries.map(([key, value]) => (
            <JsonView key={key} label={isArray ? undefined : key} data={value} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const ThinkingStepItem: React.FC<{ step: ThinkingStep }> = ({ step }) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const parsedDetails = useMemo(() => {
    if (!step.details) return null;
    try {
      return JSON.parse(step.details);
    } catch (e) {
      return step.details;
    }
  }, [step.details]);

  return (
    <div className="relative pl-10 animate-in fade-in slide-in-from-left-2 duration-300">
      {/* Node Icon */}
      <div className={`absolute left-[11px] top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center z-10 ${
        step.status === 'completed' ? 'border-emerald-500 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 
        step.status === 'active' ? 'border-indigo-500 text-indigo-500' : 
        step.status === 'failed' ? 'border-rose-500 text-rose-500' : 'border-slate-300'
      }`}>
        {step.status === 'completed' ? <CheckCircle2 size={10} /> : 
         step.status === 'active' ? <Loader2 size={10} className="animate-spin" /> : 
         step.status === 'failed' ? <AlertTriangle size={10} /> : null}
      </div>

      <div className={`p-4 rounded-2xl border transition-all ${
        step.status === 'active' ? 'bg-white border-indigo-200 shadow-lg scale-[1.01]' : 
        step.status === 'failed' ? 'bg-rose-50/50 border-rose-100 shadow-sm' : 'bg-slate-50 border-transparent shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
             <span className={`text-[10px] font-black uppercase tracking-widest ${
              step.status === 'failed' ? 'text-rose-500' : 'text-slate-500'
            }`}>{step.agentName}</span>
            {typeof parsedDetails === 'object' && (
              <div className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-md flex items-center gap-1 border border-indigo-100">
                <Braces size={10} />
                <span className="text-[8px] font-bold uppercase">JSON</span>
              </div>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-400 font-mono flex items-center gap-1">
             <Activity size={10} className="opacity-50" />
            {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        
        <p className={`text-sm leading-relaxed font-semibold ${step.status === 'failed' ? 'text-rose-700' : 'text-slate-800'}`}>
          {step.content}
        </p>
        
        {step.details && (
          <div className="mt-4">
            <button 
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-indigo-600 transition-all uppercase tracking-widest group"
            >
              <div className="p-1 rounded bg-slate-200 group-hover:bg-indigo-100 transition-colors">
                <Code2 size={12} />
              </div>
              {isDetailsOpen ? '收起技术参数' : '展开调用参数与原始回传'}
              <div className={`transition-transform duration-200 ${isDetailsOpen ? 'rotate-180' : ''}`}>
                <ChevronDown size={12} />
              </div>
            </button>
            
            {isDetailsOpen && (
              <div className="mt-3 p-4 bg-slate-900 rounded-2xl overflow-x-auto border border-white/5 shadow-2xl group relative animate-in fade-in zoom-in-95 duration-200">
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                    onClick={() => navigator.clipboard.writeText(step.details || '')}
                  >
                    <Copy size={12} />
                    <span className="text-[9px] font-bold tracking-tighter">COPY</span>
                  </button>
                </div>
                
                <div className="text-[11px] leading-relaxed">
                  {typeof parsedDetails === 'object' ? (
                    <JsonView data={parsedDetails} defaultOpen={true} />
                  ) : (
                    <pre className="text-emerald-400 font-mono whitespace-pre-wrap">{step.details}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step.status === 'active' && (
          <div className="mt-3 flex gap-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 animate-progress w-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
          </div>
        )}
      </div>
    </div>
  );
};

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ steps, className }) => {
  if (!steps.length) return null;

  return (
    <div className={`space-y-4 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-200/60 shadow-inner ${className}`}>
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2 text-indigo-600">
          <BrainCircuit size={18} className="animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Reasoning Path (CoT)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-400 uppercase">Supervisor Orchestrated</span>
        </div>
      </div>
      
      <div className="space-y-6 relative">
        <div className="absolute left-[18.5px] top-2 bottom-2 w-0.5 bg-slate-200/50 border-l border-dashed border-slate-300"></div>
        
        {steps.map((step) => (
          <ThinkingStepItem key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
};

export default ThinkingProcess;
