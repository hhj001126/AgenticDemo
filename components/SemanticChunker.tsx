import React, { useState } from 'react';
import { FileText, Tags } from 'lucide-react';
import { semanticChunker } from '../services/geminiService';
import { ChunkInputPanel } from './chunker/ChunkInputPanel';
import { ChunkCard, SemanticChunk } from './chunker/ChunkCard';

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
      <ChunkInputPanel value={inputText} onChange={setInputText} onProcess={handleProcess} isProcessing={isProcessing} />

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
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {chunks.map((chunk, idx) => (
            <ChunkCard key={idx} chunk={chunk} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SemanticChunker;
