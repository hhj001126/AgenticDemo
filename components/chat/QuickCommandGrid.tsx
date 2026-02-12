import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface QuickCommand {
  label: string;
  icon: LucideIcon;
  prompt: string;
}

interface QuickCommandGridProps {
  commands: QuickCommand[];
  onSelect: (prompt: string) => void;
}

export const QuickCommandGrid = memo<QuickCommandGridProps>(({ commands, onSelect }) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-20 px-10">
    <Sparkles size={48} className="text-indigo-500 mb-6 animate-pulse" />
    <h3 className="text-xl font-black text-slate-900 uppercase mb-2">智能编排控制中心</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-10">
      {commands.map((cmd) => (
        <button
          key={cmd.label}
          onClick={() => onSelect(cmd.prompt)}
          className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all group text-left"
        >
          <div className="p-2 bg-slate-50 rounded-xl text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 mb-4 transition-colors">
            <cmd.icon size={20} />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{cmd.label}</span>
        </button>
      ))}
    </div>
  </div>
));
