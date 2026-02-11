import React, { useState, useMemo, useEffect } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';
import { ThinkingStep } from '../types';
import { ThinkingStepRow } from './thinking/ThinkingStepRow';

const ThinkingProcess: React.FC<{
  steps: ThinkingStep[];
  onFileClick?: (path: string) => void;
  onFileDetailClick?: (path: string) => void;
  vfs?: Record<string, { path: string; content: string; language: string; isWriting?: boolean }>;
}> = ({ steps, onFileClick, onFileDetailClick, vfs = {} }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const prevActiveRef = React.useRef(false);

  const { sortedSteps, isActive, stepCount } = useMemo(() => {
    if (!steps.length) return { sortedSteps: [], isActive: false, stepCount: 0 };
    const sorted = [...steps].sort((a, b) => a.timestamp - b.timestamp);
    const seen = new Set<string>();
    const deduped = sorted.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return {
      sortedSteps: deduped,
      isActive: deduped.some((s) => s.status === 'active'),
      stepCount: deduped.length,
    };
  }, [steps]);

  useEffect(() => {
    if (prevActiveRef.current && !isActive) setIsCollapsed(true);
    prevActiveRef.current = isActive;
  }, [isActive]);

  if (!steps.length) return null;

  const lastStep = sortedSteps[sortedSteps.length - 1];

  return (
    <div className={`bg-white rounded-[2rem] border-2 ${isActive ? 'border-indigo-400 shadow-indigo-100' : 'border-slate-200 shadow-slate-100'} overflow-hidden transition-all duration-500 w-full shadow-xl`}>
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`flex items-center justify-between gap-2 px-5 py-3 cursor-pointer transition-colors ${isCollapsed ? 'hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50 border-b border-slate-100'}`}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-2xl shadow-lg transition-all ${isActive ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
            <BrainCircuit size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 block">REASONING CHAIN</span>
              {isActive && <div className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black rounded-full animate-pulse uppercase">编排中...</div>}
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight block">SUPERVISOR ORCHESTRATED</span>
            {isCollapsed && lastStep && (
              <span className="text-[10px] text-slate-600 font-medium truncate block max-w-[280px] mt-0.5">{lastStep.content}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
            {stepCount} STEPS
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase mr-1">{isCollapsed ? '展开' : '折叠'}</span>
          {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
        </div>
      </div>

      {!isCollapsed && (
        <div className="px-5 py-4 max-h-[500px] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-0">
            {sortedSteps.map((s, idx) => (
              <ThinkingStepRow
                key={s.id}
                step={s}
                index={idx}
                total={sortedSteps.length}
                onFileClick={onFileClick}
                onFileDetailClick={onFileDetailClick}
                vfs={vfs}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingProcess;
