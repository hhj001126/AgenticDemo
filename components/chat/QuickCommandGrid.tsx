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
    <Sparkles size={48} className="text-primary mb-6 animate-pulse" />
    <h3 className="text-xl font-black text-slate-900 uppercase mb-2">智能编排控制中心</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-10">
      {commands.map((cmd) => (
        <button
          key={cmd.label}
          onClick={() => onSelect(cmd.prompt)}
          className="flex flex-col items-start p-5 bg-surface border border-border-muted rounded-card hover:border-primary hover:shadow-xl transition-theme group text-left"
        >
          <div className="p-2 bg-surface-muted rounded-xl text-text-muted group-hover:bg-primary-50 group-hover:text-primary mb-4 transition-colors">
            <cmd.icon size={20} />
          </div>
          <span className="text-xs font-black text-text-secondary uppercase tracking-tight">{cmd.label}</span>
        </button>
      ))}
    </div>
  </div>
));
