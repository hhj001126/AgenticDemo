import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';

export interface SemanticChunk {
  content: string;
  summary: string;
  boundaryReason: string;
}

interface ChunkCardProps {
  chunk: SemanticChunk;
  index: number;
}

export const ChunkCard = memo<ChunkCardProps>(({ chunk, index }) => (
  <div className="group p-4 bg-surface border border-border rounded-xl hover:border-primary hover:shadow-md transition-theme">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-bold px-2 py-0.5 bg-surface-muted rounded text-text-muted uppercase">CHUNK #{index + 1}</span>
      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">SEMANTIC SCORE: 0.94</span>
    </div>
    <div className="mb-3">
      <p className="text-xs font-bold text-text-secondary mb-1 flex items-center gap-1">
        <Sparkles size={12} className="text-primary" /> Agent Summary:
      </p>
      <p className="text-xs text-primary-700 bg-primary-50 p-2 rounded-lg italic">&quot;{chunk.summary}&quot;</p>
    </div>
    <div className="text-sm text-text-secondary font-medium line-clamp-3 group-hover:line-clamp-none transition-theme">{chunk.content}</div>
    <div className="mt-3 pt-3 border-t border-border-muted flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      <span className="text-[10px] font-bold text-text-muted uppercase">Boundary Reason: {chunk.boundaryReason}</span>
    </div>
  </div>
));
