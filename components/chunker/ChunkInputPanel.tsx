import React, { memo } from 'react';
import { FilePlus, Scissors, Info, Loader2 } from 'lucide-react';
import { PageContainer } from '../ui';

interface ChunkInputPanelProps {
  value: string;
  onChange: (v: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
}

export const ChunkInputPanel = memo<ChunkInputPanelProps>(({ value, onChange, onProcess, isProcessing }) => (
  <PageContainer padding="md" className="flex flex-col h-full">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
          <FilePlus size={18} />
        </div>
        <h2 className="text-lg font-bold text-text-secondary">Raw Document Input</h2>
      </div>
      <button
        onClick={onProcess}
        disabled={isProcessing || !value.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-theme font-semibold text-sm"
      >
        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
        Run Semantic Splitting
      </button>
    </div>

    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Paste long document content here (legal contracts, financial reports, technical specs)..."
      className="flex-1 bg-surface-muted border border-border rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-primary outline-none resize-none transition-theme"
    />
    <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100">
      <div className="flex gap-3">
        <Info size={20} className="text-primary shrink-0" />
        <p className="text-xs text-primary-700 leading-relaxed">
          <strong>Architecture Tip:</strong> Unlike recursive character splitting, semantic chunking uses LLM reasoning to detect natural boundaries where topics change, preserving contextual integrity for RAG.
        </p>
      </div>
    </div>
  </PageContainer>
));
