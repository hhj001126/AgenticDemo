import React, { memo, useState } from 'react';
import type { QuickCommand } from './QuickCommandGrid';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface QuickCommandRowProps {
  commands: QuickCommand[];
  onSelect: (prompt: string) => void;
}

export const QuickCommandRow = memo<QuickCommandRowProps>(({ commands, onSelect }) => {
  const [shuffled] = useState(() => shuffle(commands));

  return (
    <div className="flex-shrink-0 px-4 border-t border-slate-100 bg-white">
      <div className="flex gap-2 overflow-x-auto py-2 -mx-1 px-1 overflow-y-hidden" style={{ scrollbarGutter: 'stable' }}>
        {shuffled.map((cmd) => (
          <button
            key={cmd.label}
            type="button"
            onClick={() => onSelect(cmd.prompt)}
            className="flex items-center gap-2 flex-shrink-0 px-2 py-1 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-sm font-medium whitespace-nowrap"
          >
            <cmd.icon size={16} className="text-slate-500 group-hover:text-indigo-600" />
            <span>{cmd.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
