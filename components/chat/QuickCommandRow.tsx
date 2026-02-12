import React, { memo, useState } from 'react';
import { Button } from '../ui';
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
    <div className="flex-shrink-0 px-4 border-t border-border-muted bg-surface">
      <div className="flex gap-2 overflow-x-auto py-2 -mx-1 px-1 overflow-y-hidden" style={{ scrollbarGutter: 'stable' }}>
        {shuffled.map((cmd) => (
          <Button
            key={cmd.label}
            variant="muted"
            size="md"
            onClick={() => onSelect(cmd.prompt)}
            className="flex-shrink-0 whitespace-nowrap group"
          >
            <cmd.icon size={16} className="text-text-muted group-hover:text-primary" />
            <span>{cmd.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
});
