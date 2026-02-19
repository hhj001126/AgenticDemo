import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, Search, Trash2, FileText, Loader2 } from 'lucide-react';
import { KnowledgeChunk, vectorStoreService } from '../services/vectorStoreService';
import { useConfirm } from './ui';
import { toast } from '../utils/toast';

const VectorDatabase: React.FC = () => {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const confirm = useConfirm();

  const loadChunks = useCallback(async () => {
    try {
      const data = await vectorStoreService.getChunks();
      setChunks(data);
    } catch (e) {
      console.error("Failed to load chunks", e);
    }
  }, []);

  useEffect(() => {
    loadChunks();
  }, [loadChunks]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await vectorStoreService.search(searchQuery);
      setSearchResults(results);
    } catch (e) {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = async () => {
    if (await confirm({ title: '清空知识库', message: '确定要清空所有向量数据吗？', danger: true })) {
      await vectorStoreService.clear();
      loadChunks();
      setSearchResults([]);
    }
  };

  const handleImportDemo = async () => {
    // Mock import for demo
    const demoChunks: KnowledgeChunk[] = [
      { content: "Demo Content 1", summary: "Summary 1", boundaryReason: "Start" },
      { content: "Demo Content 2", summary: "Summary 2", boundaryReason: "End" }
    ];
    setIsImporting(true);
    await vectorStoreService.addChunks(demoChunks);
    await loadChunks();
    setIsImporting(false);
    toast.success("Demo chunks imported");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          <h2 className="font-medium text-sm">向量知识库</h2>
          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
            {chunks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleImportDemo}
            disabled={isImporting}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-500 hover:text-indigo-500"
            title="导入测试数据"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-md transition-colors text-slate-500 hover:text-rose-500"
            title="清空知识库"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="语义检索..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border-none rounded-md focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {(searchResults.length > 0 ? searchResults : chunks).map((chunk, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-indigo-100 dark:hover:border-indigo-900 bg-slate-50/30 dark:bg-slate-800/30 transition-colors">
            <div className="flex items-start gap-2 mb-1">
              <FileText className="w-3 h-3 text-indigo-400 mt-1" />
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
                {chunk.summary}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 pl-5 border-l-2 border-slate-200 dark:border-slate-700 ml-1.5">
              {chunk.content}
            </div>
            <div className="mt-2 pl-5 flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                {chunk.boundaryReason}
              </span>
            </div>
          </div>
        ))}
        {chunks.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            暂无知识分块
          </div>
        )}
      </div>
    </div>
  );
};

export default VectorDatabase;
