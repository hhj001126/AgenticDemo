import React, { memo } from 'react';
import { AlertCircle, CheckCircle2, Key } from 'lucide-react';

interface ApiKeyStatusProps {
  hasKey: boolean;
  onOpenKey: () => void;
}

export const ApiKeyStatus = memo<ApiKeyStatusProps>(({ hasKey, onOpenKey }) => (
  <div className={`p-4 rounded-xl border transition-all ${hasKey ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">配额状态</span>
      {hasKey ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
    </div>
    <p className="text-[11px] font-bold text-slate-200 mb-3 leading-snug">
      {hasKey ? '已连接高配额项目 Key' : '检测到限流风险 (429)'}
    </p>
    <button
      onClick={onOpenKey}
      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
        hasKey ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'
      }`}
    >
      <Key size={12} />
      {hasKey ? '切换 API KEY' : '配置高配额 KEY'}
    </button>
    {!hasKey && (
      <a
        href="https://ai.google.dev/gemini-api/docs/billing"
        target="_blank"
        rel="noreferrer"
        className="mt-2 block text-center text-[9px] text-slate-500 hover:text-indigo-400 underline"
      >
        了解计费与配额限制
      </a>
    )}
  </div>
));
