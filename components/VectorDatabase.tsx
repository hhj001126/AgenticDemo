import React from 'react';
import { Layers, Database, Search, RefreshCw } from 'lucide-react';
import { PageContainer } from './ui';
import { StatCard } from './vector/StatCard';

const STATS = [
  { label: '向量总数', value: '1,284,092', colorClass: 'text-primary' },
  { label: '维度 (Dimensions)', value: '1536', colorClass: 'text-emerald-400' },
  { label: '索引类型', value: 'HNSW', colorClass: 'text-amber-400' },
  { label: '查询延迟', value: '14ms', colorClass: 'text-rose-400' },
];

const VectorDatabase: React.FC = () => (
  <div className="h-full flex flex-col space-y-6">
    <div className="grid grid-cols-4 gap-4">
      {STATS.map((s) => (
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
              className="pl-9 pr-4 py-1.5 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary transition-theme w-64"
            />
          </div>
          <button className="p-2 text-text-muted hover:text-primary hover:bg-primary-50 rounded-lg transition-theme">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative border border-border-muted rounded-xl bg-surface-muted/50 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid grid-cols-12 gap-2 p-8 w-full h-full opacity-20">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className={`h-8 rounded ${Math.random() > 0.7 ? 'bg-primary' : 'bg-slate-300'}`} />
            ))}
          </div>
          <div className="absolute bg-surface/80 backdrop-blur-md px-6 py-4 rounded-card border border-primary-100 shadow-2xl text-center">
            <Layers size={32} className="text-primary mx-auto mb-2 animate-bounce" />
            <p className="font-bold text-text-secondary">向量空间拓扑图</p>
            <p className="text-xs text-text-muted mt-1">正在连接云端向量集群进行实时渲染...</p>
          </div>
        </div>
      </div>
    </PageContainer>
  </div>
);

export default VectorDatabase;
