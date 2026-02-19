import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquarePlus, MessageSquare, Trash2 } from 'lucide-react';
import { agentStateService, SessionMeta } from '../../services/agentStateService';
import { useConfirm } from '../ui';
import { cn } from '../../utils/classnames';

const MAX_TITLE_LEN = 20;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = now.toDateString();
  const target = d.toDateString();
  if (target === today) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

interface SessionListProps {
  activeSessionId: string | null;
  onSwitchSession: (sessionId: string) => void;
  onSessionsChange?: () => void;
  sessionListVersion?: number;
}

export const SessionList: React.FC<SessionListProps> = ({
  activeSessionId,
  onSwitchSession,
  onSessionsChange,
  sessionListVersion = 0
}) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const confirm = useConfirm();

  const refresh = useCallback(async () => {
    try {
      const list = await agentStateService.listSessions();
      setSessions(list);
      onSessionsChange?.();
    } catch (e) {
      console.error("Failed to refresh sessions", e);
    }
  }, [onSessionsChange]);

  useEffect(() => {
    refresh();
  }, [refresh, activeSessionId, sessionListVersion]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, meta: SessionMeta) => {
      e.stopPropagation();
      const ok = await confirm({
        title: '删除会话',
        message: `确定要删除「${meta.title}」吗？删除后无法恢复。`,
        danger: true,
        confirmText: '删除',
        cancelText: '取消'
      });
      if (!ok) return;

      await agentStateService.deleteSession(meta.sessionId);

      // Refresh list locally first to feel responsive
      const remaining = sessions.filter(s => s.sessionId !== meta.sessionId);
      setSessions(remaining);

      // Switch if needed
      if (activeSessionId === meta.sessionId) {
        if (remaining.length > 0) {
          await agentStateService.switchSession(remaining[0].sessionId);
          onSwitchSession(remaining[0].sessionId);
        } else {
          const newId = await agentStateService.createSession();
          // onSwitchSession triggers parent, which might reload list?
          onSwitchSession(newId);
        }
      }
      refresh();
    },
    [confirm, activeSessionId, onSwitchSession, refresh, sessions]
  );

  const handleCreate = async () => {
    const newId = await agentStateService.createSession();
    await agentStateService.switchSession(newId);
    onSwitchSession(newId);
    refresh();
  };

  const displayTitle = (title: string) => {
    if (title.length <= MAX_TITLE_LEN) return title;
    return title.slice(0, MAX_TITLE_LEN) + '…';
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCreate}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
          'text-slate-400 hover:bg-sidebar-muted hover:text-white transition-theme'
        )}
      >
        <MessageSquarePlus size={16} />
        <span>新建会话</span>
      </button>
      <div className="flex-1 overflow-y-auto max-h-[280px] space-y-1 pr-1">
        {sessions.map((meta) => (
          <div
            key={meta.sessionId}
            role="button"
            tabIndex={0}
            onClick={async () => {
              await agentStateService.switchSession(meta.sessionId);
              onSwitchSession(meta.sessionId);
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                await agentStateService.switchSession(meta.sessionId);
                onSwitchSession(meta.sessionId);
              }
            }}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-theme',
              activeSessionId === meta.sessionId
                ? 'bg-primary text-white'
                : 'hover:bg-sidebar-muted hover:text-white text-slate-400'
            )}
          >
            <MessageSquare size={14} className="shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm font-medium" title={meta.title}>
              {displayTitle(meta.title)}
            </span>
            <span className={cn('text-[10px] shrink-0', activeSessionId === meta.sessionId ? 'text-white/80' : 'text-slate-500')}>
              {formatTime(meta.lastUpdated)}
            </span>
            <button
              type="button"
              onClick={(e) => handleDelete(e, meta)}
              className={cn(
                'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
                activeSessionId === meta.sessionId
                  ? 'hover:bg-white/20 text-white'
                  : 'hover:bg-rose-500/20 text-rose-400 hover:text-rose-300'
              )}
              title="删除会话"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
