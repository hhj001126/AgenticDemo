import React, { memo } from 'react';
import { ListChecks } from 'lucide-react';

interface PlanLoadingSkeletonProps {
  /** 是否紧凑模式（内嵌在 ThinkingStepRow 中） */
  compact?: boolean;
}

export const PlanLoadingSkeleton = memo<PlanLoadingSkeletonProps>(({ compact = true }) => (
  <div className={`w-full overflow-hidden animate-pulse ${compact ? 'rounded-xl border border-indigo-100 bg-indigo-50/30' : 'rounded-[2rem] border-2 border-indigo-100 shadow-xl shadow-slate-100'}`}>
    <div className={`flex items-center gap-3 ${compact ? 'p-3' : 'px-5 py-3 border-b border-indigo-50 bg-indigo-50/30'}`}>
      <div className="p-2 bg-indigo-200/80 rounded-xl shrink-0">
        <ListChecks size={compact ? 16 : 20} className="text-indigo-400" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {compact ? (
          <>
            <div className="h-2.5 w-24 bg-slate-200 rounded" />
            <div className="h-2 w-20 bg-slate-100 rounded" />
          </>
        ) : (
          <>
            <div className="h-3 w-32 bg-slate-200 rounded" />
            <div className="h-2.5 w-24 bg-slate-100 rounded" />
          </>
        )}
      </div>
    </div>
    {!compact && (
      <div className="p-5 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-[1.25rem] bg-slate-50 border border-slate-100">
            <div className="mt-0.5 w-[18px] h-[18px] rounded bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-full max-w-[80%]" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )}
    <div className={`flex justify-center ${compact ? 'py-2' : 'pt-2 pb-4'}`}>
      <span className="text-[10px] font-medium text-indigo-500 uppercase tracking-wider">正在生成执行计划...</span>
    </div>
  </div>
));
