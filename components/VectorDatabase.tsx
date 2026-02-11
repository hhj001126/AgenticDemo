
import React from 'react';
import { Layers, Database, Activity, Search, RefreshCw } from 'lucide-react';

const VectorDatabase: React.FC = () => {
  const stats = [
    { label: '向量总数', value: '1,284,092', color: 'text-indigo-400' },
    { label: '维度 (Dimensions)', value: '1536', color: 'text-emerald-400' },
    { label: '索引类型', value: 'HNSW', color: 'text-amber-400' },
    { label: '查询延迟', value: '14ms', color: 'text-rose-400' }
  ];

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">向量化预览 (Similarity Visualization)</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="测试语义检索..." className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-64" />
            </div>
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 relative border border-slate-100 rounded-xl bg-slate-50/50 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="grid grid-cols-12 gap-2 p-8 w-full h-full opacity-20">
               {Array.from({length: 144}).map((_, i) => (
                 <div key={i} className={`h-8 rounded ${Math.random() > 0.7 ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
               ))}
             </div>
             <div className="absolute bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-indigo-100 shadow-2xl text-center">
               <Layers size={32} className="text-indigo-600 mx-auto mb-2 animate-bounce" />
               <p className="font-bold text-slate-800">向量空间拓扑图</p>
               <p className="text-xs text-slate-500 mt-1">正在连接云端向量集群进行实时渲染...</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VectorDatabase;
