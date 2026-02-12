import React, { memo } from 'react';
import { Braces, Split, Trash2, RefreshCw } from 'lucide-react';
import { Industry, AgentMode } from '../../types';

interface ChatHeaderProps {
  industry: Industry;
  mode: AgentMode;
  showWorkspace: boolean;
  onToggleWorkspace: () => void;
  onClearSession: () => void;
  onRefresh: () => void;
}

export const ChatHeader = memo<ChatHeaderProps>(({ industry, mode, showWorkspace, onToggleWorkspace, onClearSession, onRefresh }) => (
  <div className="px-6 py-4 border-b border-border-muted flex items-center justify-between bg-surface/80 backdrop-blur-xl z-20">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg"><Braces size={20} /></div>
      <div>
        <h2 className="text-sm font-black text-text font-display uppercase tracking-tight">Supervisor Pro</h2>
        <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">{industry} • {mode}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onToggleWorkspace} title="代码工作空间" className={`p-2 rounded-lg transition-theme ${showWorkspace ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-muted'}`}><Split size={18} /></button>
      <button onClick={onClearSession} title="清空会话" className="p-2 text-text-muted hover:text-rose-600 rounded-lg transition-theme hover:bg-rose-50"><Trash2 size={18} /></button>
      <button onClick={onRefresh} title="刷新状态" className="p-2 text-text-muted hover:text-primary rounded-lg transition-theme hover:bg-surface-muted"><RefreshCw size={18} /></button>
    </div>
  </div>
));
