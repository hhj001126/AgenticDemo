import React, { useState, useCallback } from 'react';
import { Layers, Database, Search, RefreshCw } from 'lucide-react';
import { PageContainer, Button } from './ui';
import { StatCard } from './vector/StatCard';
import { vectorStoreService } from '../services/vectorStoreService';
import type { KnowledgeChunk } from '../services/agentStateService';

const VectorDatabase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>(() => vectorStoreService.getChunks());

  const refresh = useCallback(() => {
    setChunks(vectorStoreService.getChunks());
    setSearchResults([]);
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const results = vectorStoreService.search(searchQuery.trim(), 10);
    setSearchResults(results);
  };

  const displayChunks = searchResults.length > 0 ? searchResults : chunks;
  const stats = [
    { label: '向量总数', value: chunks.length.toLocaleString(), colorClass: 'text-primary' },
    { label: '维度 (Dimensions)', value: '—', colorClass: 'text-emerald-400' },
    { label: '索引类型', value: '全文', colorClass: 'text-amber-400' },
    { label: '检索模式', value: '关键词匹配', colorClass: 'text-rose-400' },
  ];

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} colorClass={s.colorClass} />
        ))}
      </div>

      <PageContainer padding="md" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-text-secondary">向量化预览 (Similarity Visualization)</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                placeholder="测试语义检索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 pr-4 py-1.5 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary transition-theme w-64"
              />
            </div>
            <Button variant="primary" size="md" onClick={handleSearch}>
              <Search size={14} />
              检索
            </Button>
            <Button variant="muted" size="md" onClick={refresh} className="p-2">
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-border-muted rounded-xl bg-surface-muted/50 p-4">
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted opacity-50 space-y-2">
              <Layers size={48} />
              <p className="text-sm font-medium">向量库为空</p>
              <p className="text-xs">在「语义切片引擎」中处理文本后点击「导入向量库」即可</p>
            </div>
          ) : searchResults.length === 0 && searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted space-y-2">
              <Search size={32} />
              <p className="text-sm">未找到匹配结果</p>
              <p className="text-xs">尝试调整检索关键词</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchQuery.trim() && (
                <p className="text-xs text-text-muted">
                  检索「{searchQuery}」共 {searchResults.length} 条结果
                </p>
              )}
              {displayChunks.map((c, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-surface border border-border rounded-xl hover:border-primary transition-theme"
                >
                  <p className="text-xs font-bold text-primary mb-1">{c.summary}</p>
                  <p className="text-sm text-text-secondary line-clamp-3">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
};

export default VectorDatabase;
