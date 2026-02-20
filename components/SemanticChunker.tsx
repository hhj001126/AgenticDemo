import React, { useState } from 'react';
import { FileText, Tags, Download, Layers } from 'lucide-react';
import { semanticChunker } from '../services/geminiService';
import { vectorStoreService } from '../services/vectorStoreService';
import { api } from '../services/api';
import { toast } from '../utils/toast';
import { PageContainer, Button } from './ui';
import { ChunkInputPanel } from './chunker/ChunkInputPanel';
import { ChunkCard, SemanticChunk } from './chunker/ChunkCard';

interface SemanticChunkerProps {
  activeSessionId?: string;
}

const SemanticChunker: React.FC<SemanticChunkerProps> = ({ activeSessionId = '' }) => {
  const [inputText, setInputText] = useState('');
  const [chunks, setChunks] = useState<SemanticChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imported, setImported] = useState(false);
  const [importedToVector, setImportedToVector] = useState(false);

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

  const handleImportToSession = async () => {
    if (!activeSessionId) {
      toast('请先创建或选择会话');
      return;
    }
    try {
      await api.appendKnowledgeChunks(activeSessionId, chunks);
      setImported(true);
      toast(`已导入 ${chunks.length} 个分块到当前会话`);
    } catch (e) {
      toast('导入失败：' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleImportToVector = () => {
    vectorStoreService.addChunks(chunks);
    setImportedToVector(true);
    toast(`已导入 ${chunks.length} 个分块到向量库`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <ChunkInputPanel value={inputText} onChange={setInputText} onProcess={handleProcess} isProcessing={isProcessing} />

      <PageContainer padding="md" className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
              <Tags size={18} />
            </div>
            <h2 className="text-lg font-bold text-text-secondary">Agent-Optimized Chunks</h2>
          </div>
          {chunks.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant={imported ? "muted" : "primary"}
                size="md"
                onClick={handleImportToSession}
                disabled={imported}
              >
                <Download size={14} />
                {imported ? '已导入当前会话' : '导入到当前会话'}
              </Button>
              <Button
                variant={importedToVector ? "muted" : "primary"}
                size="md"
                onClick={handleImportToVector}
                disabled={importedToVector}
              >
                <Layers size={14} />
                {importedToVector ? '已导入向量库' : '导入向量库'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {chunks.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-50 space-y-2">
              <FileText size={48} />
              <p className="text-sm font-medium">Result chunks will appear here after processing.</p>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-surface-muted rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {chunks.map((chunk, idx) => (
            <ChunkCard key={idx} chunk={chunk} index={idx} />
          ))}
        </div>
      </PageContainer>
    </div>
  );
};

export default SemanticChunker;
