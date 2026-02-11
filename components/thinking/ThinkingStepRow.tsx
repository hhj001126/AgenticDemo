import React, { memo, useState } from 'react';
import { Loader2, CheckCircle2, ChevronUp, Info, ExternalLink, Braces, FileText } from 'lucide-react';
import { ThinkingStep } from '../../types';
import { PlanLoadingSkeleton } from '../chat/PlanLoadingSkeleton';

interface ThinkingStepRowProps {
  step: ThinkingStep;
  index?: number;
  total?: number;
  onFileClick?: (path: string) => void;
  onFileDetailClick?: (path: string) => void;
  vfs?: Record<string, { path: string; content: string; language: string; isWriting?: boolean }>;
}

export const ThinkingStepRow = memo<ThinkingStepRowProps>(({ step, index = 0, total = 1, onFileClick, onFileDetailClick, vfs = {} }) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailFilePath, setDetailFilePath] = useState<string | null>(null);
  const isLast = index === total - 1;
  const isPlanLoading = step.agentId === 'propose_plan' && step.status === 'active';

  const isCompleted = step.status === 'completed';
  const isActive = step.status === 'active';
  const isFailed = step.status === 'failed';

  const nodeBg =
    isCompleted ? 'bg-emerald-500' :
    isActive ? 'bg-indigo-500' :
    isFailed ? 'bg-rose-500' : 'bg-slate-300';

  return (
    <div className="relative pl-8 pb-4 last:pb-0 group/row animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* 链式垂直线 */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200" />
      )}
      {/* 步骤节点：绿色对勾 / 加载中 / 失败 */}
      <div className={`absolute left-0 top-2 w-6 h-6 rounded-full flex items-center justify-center z-10 ${nodeBg} shadow-md`}>
        {isActive ? (
          <Loader2 size={12} className="animate-spin text-white" />
        ) : isCompleted ? (
          <CheckCircle2 size={14} className="text-white" strokeWidth={2.5} />
        ) : isFailed ? (
          <span className="text-white text-xs font-black">!</span>
        ) : (
          <div className="w-2 h-2 rounded-full bg-white/80" />
        )}
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-indigo-200 transition-all shadow-sm hover:shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{step.agentName}</span>
            {step.details && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Braces size={9} />
                JSON
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-medium text-slate-500">{new Date(step.timestamp).toLocaleTimeString()}</span>
            {step.details && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsDetailsOpen(!isDetailsOpen); }}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"
                aria-label={isDetailsOpen ? '收起' : '展开'}
              >
                {isDetailsOpen ? <ChevronUp size={12} /> : <Info size={12} />}
              </button>
            )}
            {step.fileLink && (
              <button
                onClick={(e) => { e.stopPropagation(); onFileClick?.(step.fileLink!); }}
                className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors"
                aria-label="打开文件"
              >
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>

        {isPlanLoading ? (
          <div className="mt-2">
            <PlanLoadingSkeleton />
          </div>
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed mb-2">{step.content}</p>
        )}

        {/* 多文件链接显示：一行横向滚动，点击可查看流式写入详情 */}
        {(step.fileLinks && step.fileLinks.length > 0) && (
          <div className="mt-2 -mx-1 px-1 overflow-x-auto custom-scrollbar">
            <div className="flex gap-2 min-w-max">
              {step.fileLinks.map((filePath, idx) => {
                const file = vfs[filePath];
                const isWriting = file?.isWriting;
                return (
                  <div key={`${filePath}-${idx}`} className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileClick?.(filePath);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-lg border border-slate-200 hover:border-indigo-300 transition-all text-[11px] font-medium"
                    >
                      <ExternalLink size={11} />
                      <span className="truncate max-w-[120px]">{filePath}</span>
                      {isWriting && (
                        <span className="ml-1 px-1 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-bold rounded animate-pulse">写入中</span>
                      )}
                    </button>
                    {onFileDetailClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailFilePath((p) => (p === filePath ? null : filePath));
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                        aria-label="查看写入详情"
                        title="查看文件流式写入详情"
                      >
                        <FileText size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* 文件详情抽屉：显示流式写入内容 */}
            {detailFilePath && vfs[detailFilePath] && (
              <div className="mt-3 p-4 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner relative animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-indigo-300">{detailFilePath}</span>
                  <button
                    onClick={() => setDetailFilePath(null)}
                    className="text-slate-500 hover:text-white text-xs"
                  >
                    收起
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                  {vfs[detailFilePath]?.content || '(暂无内容)'}
                </pre>
                {vfs[detailFilePath]?.isWriting && (
                  <div className="absolute bottom-2 right-2 text-[9px] font-black text-indigo-400 animate-pulse uppercase">Streaming...</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 单个文件链接（向后兼容） */}
        {step.fileLink && !step.fileLinks && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileClick?.(step.fileLink!);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-lg border border-slate-200 hover:border-indigo-300 transition-all text-[11px] font-medium"
            >
              <ExternalLink size={11} />
              <span>{step.fileLink}</span>
              {vfs[step.fileLink]?.isWriting && (
                <span className="ml-1 px-1 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-bold rounded animate-pulse">写入中</span>
              )}
            </button>
            {onFileDetailClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailFilePath((p) => (p === step.fileLink ? null : step.fileLink!));
                }}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                aria-label="查看写入详情"
                title="查看文件流式写入详情"
              >
                <FileText size={12} />
              </button>
            )}
            {detailFilePath === step.fileLink && vfs[step.fileLink] && (
              <div className="mt-3 p-4 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner relative animate-in fade-in slide-in-from-top-1 duration-200 w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-indigo-300">{step.fileLink}</span>
                  <button onClick={() => setDetailFilePath(null)} className="text-slate-500 hover:text-white text-xs">收起</button>
                </div>
                <pre className="text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                  {vfs[step.fileLink]?.content || '(暂无内容)'}
                </pre>
                {vfs[step.fileLink]?.isWriting && (
                  <div className="absolute bottom-2 right-2 text-[9px] font-black text-indigo-400 animate-pulse uppercase">Streaming...</div>
                )}
              </div>
            )}
          </div>
        )}

        {isDetailsOpen && step.details && (
          <div className="mt-3 p-4 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner relative animate-in fade-in slide-in-from-top-1 duration-200">
            <pre className="text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">{step.details}</pre>
            <div className="absolute top-2 right-2 text-[8px] font-black text-slate-600 uppercase tracking-widest opacity-50">Execution Trace</div>
          </div>
        )}
      </div>
    </div>
  );
});
