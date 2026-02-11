import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Database, Cpu, Layers, Box } from 'lucide-react';
import { Industry, AgentMode } from '../types';
import { ApiKeyStatus } from './sidebar/ApiKeyStatus';
import { IndustryModeSelector } from './sidebar/IndustryModeSelector';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  industry: Industry;
  setIndustry: (industry: Industry) => void;
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: '智能编排中枢', icon: LayoutDashboard },
  { id: 'knowledge', label: '语义切片引擎', icon: Database },
  { id: 'vector', label: '向量空间管理', icon: Layers },
  { id: 'mcp', label: '标准化能力网关', icon: Cpu },
] as const;

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, industry, setIndustry, mode, setMode }) => {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
    const interval = setInterval(checkKey, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
          <Box size={20} />
        </div>
        <span className="font-bold text-lg text-white tracking-tight">智能 Agent 系统</span>
      </div>

      <div className="px-4 mb-4">
        <ApiKeyStatus hasKey={hasKey} onOpenKey={handleOpenKey} />
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <item.icon size={18} />
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <IndustryModeSelector industry={industry} setIndustry={setIndustry} mode={mode} setMode={setMode} />
    </div>
  );
};

export default Sidebar;
