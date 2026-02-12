import React, { memo } from 'react';
import { Industry, AgentMode } from '../../types';

interface IndustryModeSelectorProps {
  industry: Industry;
  setIndustry: (v: Industry) => void;
  mode: AgentMode;
  setMode: (v: AgentMode) => void;
}

export const IndustryModeSelector = memo<IndustryModeSelectorProps>(({ industry, setIndustry, mode, setMode }) => (
  <div className="p-4 border-t border-slate-800 bg-slate-900/50">
    <div className="mb-4">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">行业业务模板</label>
      <select
        value={industry}
        onChange={(e) => setIndustry(e.target.value as Industry)}
        className="w-full bg-slate-800 border-none rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-primary outline-none cursor-pointer transition-theme"
      >
        {Object.values(Industry).map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Agent 协作模式</label>
      <div className="grid grid-cols-1 gap-1">
        {Object.values(AgentMode).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-left px-3 py-1.5 rounded text-[11px] transition-theme ${
              mode === m ? 'bg-primary-500/20 text-primary font-semibold' : 'hover:bg-slate-800 text-slate-500'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  </div>
));
