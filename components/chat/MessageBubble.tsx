import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot } from 'lucide-react';
import { Message } from '../../types';
import ThinkingProcess from '../ThinkingProcess';
import { PlanView } from './PlanView';
import { MarkdownWithCharts } from './MarkdownWithCharts';

export interface MessageBubbleProps {
  msg: Message;
  onFileClick?: (path: string) => void;
  onFileDetailClick?: (path: string) => void;
  vfs?: Record<string, { path: string; content: string; language: string; isWriting?: boolean }>;
  onToggleFold?: (id: string) => void;
  onToggleStep?: (id: string, stepId: string) => void;
  onConfirm?: (plan: import('../../types').Plan, msgId?: string) => void;
}

export const MessageBubble = memo<MessageBubbleProps>(({ msg, onFileClick, onFileDetailClick, vfs = {}, onToggleFold, onToggleStep, onConfirm }) => (
  <div className={`mb-4 flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-slate-900 text-white'}`}>
      {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
    </div>
    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-3 max-w-[92%]`}>
      {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
        <ThinkingProcess steps={msg.thinkingSteps} onFileClick={onFileClick} onFileDetailClick={onFileDetailClick} vfs={vfs} />
      )}
      {msg.content && (
        <div className={`px-5 rounded-[1.5rem] shadow-sm border ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-surface text-text rounded-tl-none border-border-muted'}`}>
          {msg.role === 'user' ? (
            <div className="markdown-body text-sm font-medium leading-relaxed [&_*]:text-inherit">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            <MarkdownWithCharts
              content={msg.content}
              msgId={msg.id}
              isAwaitingApproval={!!msg.isAwaitingApproval}
              writtenFiles={msg.writtenFiles}
              charts={msg.charts ?? []}
              onFileClick={onFileClick}
              onToggleFold={onToggleFold}
              onToggleStep={onToggleStep}
              onConfirm={onConfirm}
            />
          )}
        </div>
      )}
      {msg.plan && !msg.content?.includes('"plan"') && onToggleFold && onToggleStep && onConfirm && (
        <PlanView
          plan={msg.plan}
          msgId={msg.id}
          isAwaitingApproval={!!msg.isAwaitingApproval}
          onToggleFold={onToggleFold}
          onToggleStep={onToggleStep}
          onConfirm={onConfirm}
        />
      )}
    </div>
  </div>
));
