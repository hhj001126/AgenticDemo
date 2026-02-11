import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';
import { PlanView } from './PlanView';
import VisualChart from '../VisualChart';
import { Plan, ChartData } from '../../types';

const PLACEHOLDER = '[WRITTEN_FILES]';
const CHART_PLACEHOLDER = /\[CHART(?:_(\d+))?\]/g; // [CHART] or [CHART_1], [CHART_2], ...

const WrittenFilesChips: React.FC<{ files: string[]; onFileClick?: (path: string) => void }> = ({ files, onFileClick }) => {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2 my-3">
      {files.map((path, idx) => (
        <button
          key={`${path}-${idx}`}
          onClick={() => onFileClick?.(path)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-lg border border-slate-200 hover:border-indigo-300 transition-all text-[11px] font-medium"
        >
          <ExternalLink size={11} />
          <span className="truncate max-w-[140px]">{path}</span>
        </button>
      ))}
    </div>
  );
};

interface CodeComponentProps {
  msgId?: string;
  isAwaitingApproval?: boolean;
  onToggleFold?: (id: string) => void;
  onToggleStep?: (id: string, stepId: string) => void;
  onConfirm?: (plan: Plan) => void;
}

const noop = () => {};

const createCodeComponents = (props: CodeComponentProps) => ({
  code({ node, inline, className, children, ...rest }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const content = String(children).replace(/\n$/, '');

    if (!inline && match && match[1] === 'json') {
      const isPlanPossible = content.includes('"plan"');

      if (isPlanPossible) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.plan) {
            parsed.plan.steps = (parsed.plan.steps || []).map((s: any) => ({
              ...s,
              approved: s.approved ?? !s.requiresApproval,
              isAutoApproved: s.isAutoApproved ?? !s.requiresApproval,
            }));
            return (
              <PlanView
                plan={parsed.plan}
                msgId={props.msgId || 'text-plan'}
                isAwaitingApproval={props.isAwaitingApproval ?? false}
                onToggleFold={props.onToggleFold ?? noop}
                onToggleStep={props.onToggleStep ?? noop}
                onConfirm={props.onConfirm ?? noop}
              />
            );
          }
        } catch {
          return <div className="p-4 bg-slate-50 border rounded-xl animate-pulse text-xs font-bold text-slate-400">正在解析任务编排矩阵...</div>;
        }
        return null;
      }
    }

    return !inline && match ? (
      <pre className={`${className} bg-slate-900 text-indigo-200 p-4 rounded-xl overflow-x-auto text-xs my-4 border border-slate-800`}>
        <code {...rest}>{children}</code>
      </pre>
    ) : (
      <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-[0.9em] font-bold" {...rest}>
        {children}
      </code>
    );
  },
});

export interface MarkdownWithChartsProps {
  content: string;
  msgId?: string;
  isAwaitingApproval?: boolean;
  writtenFiles?: string[];
  charts?: ChartData[];
  onFileClick?: (path: string) => void;
  onToggleFold?: (id: string) => void;
  onToggleStep?: (id: string, stepId: string) => void;
  onConfirm?: (plan: Plan) => void;
}

/** 将 content 按 [WRITTEN_FILES] 和 [CHART]/[CHART_1] 拆分为段落，占位符处插入对应组件 */
const splitWithPlaceholders = (content: string): { type: 'markdown' | 'files' | 'chart'; value: string | number }[] => {
  const combinedRegex = /\[WRITTEN_FILES\]|\[CHART(?:_(\d+))?\]/g;
  const result: { type: 'markdown' | 'files' | 'chart'; value: string | number }[] = [];
  let lastEnd = 0;
  let chartSeq = 0;
  let m: RegExpExecArray | null;
  while ((m = combinedRegex.exec(content)) !== null) {
    if (m.index > lastEnd) {
      result.push({ type: 'markdown', value: content.slice(lastEnd, m.index) });
    }
    if (m[0] === PLACEHOLDER) {
      result.push({ type: 'files', value: '' });
    } else {
      // [CHART_1] -> 0, [CHART_2] -> 1; [CHART] 无序号则按出现顺序
      const idx = m[1] != null ? parseInt(m[1], 10) - 1 : chartSeq++;
      result.push({ type: 'chart', value: idx });
    }
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < content.length) {
    result.push({ type: 'markdown', value: content.slice(lastEnd) });
  }
  return result;
};

export const MarkdownWithCharts = memo<MarkdownWithChartsProps>(
  ({ content, msgId, isAwaitingApproval, writtenFiles = [], charts = [], onFileClick, onToggleFold, onToggleStep, onConfirm }) => {
    const components = createCodeComponents({ msgId, isAwaitingApproval, onToggleFold, onToggleStep, onConfirm });
    const segments = splitWithPlaceholders(content);

    return (
      <div className="markdown-body text-sm font-medium leading-relaxed">
        {segments.map((seg, i) => {
          if (seg.type === 'markdown') {
            return (
              <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={components as any}>
                {String(seg.value)}
              </ReactMarkdown>
            );
          }
          if (seg.type === 'files') {
            return <WrittenFilesChips key={i} files={writtenFiles} onFileClick={onFileClick} />;
          }
          const chartIndex = typeof seg.value === 'number' ? seg.value : 0;
          const chart = charts[chartIndex];
          if (!chart) return null;
          return <VisualChart key={i} data={chart} />;
        })}
      </div>
    );
  }
);
