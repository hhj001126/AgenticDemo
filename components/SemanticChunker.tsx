
import React, { useState } from 'react';
import { FileText, Scissors, FilePlus, ChevronRight, Tags, Info, Loader2, Sparkles } from 'lucide-react';
import { semanticChunker } from '../services/geminiService';

interface SemanticChunk {
  content: string;
  summary: string;
  boundaryReason: string;
}

const SemanticChunker: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [chunks, setChunks] = useState<SemanticChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const result = await semanticChunker(inputText);
      setChunks(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
              <FilePlus size={18} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Raw Document Input</h2>
          </div>
          <button
            onClick={handleProcess}
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all font-semibold text-sm"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
            Run Semantic Splitting
          </button>
        </div>
        
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
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

      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
            <Tags size={18} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Agent-Optimized Chunks</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {chunks.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50 space-y-2">
              <FileText size={48} />
              <p className="text-sm font-medium">Result chunks will appear here after processing.</p>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          )}

          {chunks.map((chunk, idx) => (
            <div key={idx} className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-500 uppercase">CHUNK #{idx + 1}</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">SEMANTIC SCORE: 0.94</span>
              </div>
              <div className="mb-3">
                <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  {/* Added missing Sparkles icon from lucide-react */}
                  <Sparkles size={12} className="text-indigo-500" /> Agent Summary:
                </p>
                <p className="text-xs text-indigo-600 bg-indigo-50 p-2 rounded-lg italic">"{chunk.summary}"</p>
              </div>
              <div className="text-sm text-slate-600 font-medium line-clamp-3 group-hover:line-clamp-none transition-all">
                {chunk.content}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Boundary Reason: {chunk.boundaryReason}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SemanticChunker;
