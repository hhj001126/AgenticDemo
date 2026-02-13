import React from 'react';
import { LayoutDashboard, Database, Cpu, Layers, Box, Wrench, ListTodo } from 'lucide-react';
import { Industry, AgentMode } from '../types';
import { ApiKeyStatus } from './sidebar/ApiKeyStatus';
import { IndustryModeSelector } from './sidebar/IndustryModeSelector';
import { SessionList } from './sidebar/SessionList';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSessionId?: string | null;
  onSwitchSession?: (sessionId: string) => void;
  sessionListVersion?: number;
  industry: Industry;
  setIndustry: (industry: Industry) => void;
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: '智能编排中枢', icon: LayoutDashboard },
  { id: 'todos', label: '今日待办', icon: ListTodo },
  { id: 'tools', label: '工具管理', icon: Wrench },
  { id: 'knowledge', label: '语义切片引擎', icon: Database },
  { id: 'vector', label: '向量空间管理', icon: Layers },
  { id: 'mcp', label: '标准化能力网关', icon: Cpu },
] as const;

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeSessionId = null,
  onSwitchSession,
  sessionListVersion = 0,
  industry,
  setIndustry,
  mode,
  setMode
}) => {
  return (
    <div className="w-64 bg-sidebar text-slate-300 h-screen flex flex-col border-r border-sidebar-muted">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Box size={20} />
        </div>
        <span className="font-bold text-lg text-white tracking-tight font-display">智能 Agent 系统</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto min-h-0 flex flex-col">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-theme ${activeTab === item.id ? 'bg-primary text-white shadow-md' : 'hover:bg-sidebar-muted hover:text-white text-slate-400'
              }`}
          >
            <item.icon size={18} />
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
        {activeTab === 'dashboard' && onSwitchSession && (
          <div className="mt-4 pt-4 border-t border-sidebar-muted">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">会话列表</p>
            <SessionList
              activeSessionId={activeSessionId}
              onSwitchSession={onSwitchSession}
              sessionListVersion={sessionListVersion}
            />
          </div>
        )}
      </nav>

      <IndustryModeSelector industry={industry} setIndustry={setIndustry} mode={mode} setMode={setMode} />
    </div>
  );
};

export default Sidebar;
