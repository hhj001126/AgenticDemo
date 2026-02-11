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
  <div className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-500 uppercase">CHUNK #{index + 1}</span>
      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">SEMANTIC SCORE: 0.94</span>
    </div>
    <div className="mb-3">
      <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
        <Sparkles size={12} className="text-indigo-500" /> Agent Summary:
      </p>
      <p className="text-xs text-indigo-600 bg-indigo-50 p-2 rounded-lg italic">&quot;{chunk.summary}&quot;</p>
    </div>
    <div className="text-sm text-slate-600 font-medium line-clamp-3 group-hover:line-clamp-none transition-all">{chunk.content}</div>
    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
      <span className="text-[10px] font-bold text-slate-400 uppercase">Boundary Reason: {chunk.boundaryReason}</span>
    </div>
  </div>
));
