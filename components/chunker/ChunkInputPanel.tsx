import React, { memo } from 'react';
import { FilePlus, Scissors, Info, Loader2 } from 'lucide-react';

interface ChunkInputPanelProps {
  value: string;
  onChange: (v: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
}

export const ChunkInputPanel = memo<ChunkInputPanelProps>(({ value, onChange, onProcess, isProcessing }) => (
  <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
          <FilePlus size={18} />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Raw Document Input</h2>
      </div>
      <button
        onClick={onProcess}
        disabled={isProcessing || !value.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all font-semibold text-sm"
      >
        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
        Run Semantic Splitting
      </button>
    </div>

    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Paste long document content here (legal contracts, financial reports, technical specs)..."
      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
    />
    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
      <div className="flex gap-3">
        <Info size={20} className="text-indigo-400 shrink-0" />
        <p className="text-xs text-indigo-700 leading-relaxed">
          <strong>Architecture Tip:</strong> Unlike recursive character splitting, semantic chunking uses LLM reasoning to detect natural boundaries where topics change, preserving contextual integrity for RAG.
        </p>
      </div>
    </div>
  </div>
));
