
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Settings, 
  ShieldCheck, 
  Cpu,
  Box,
  Layers,
  Key,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Industry, AgentMode } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  industry: Industry;
  setIndustry: (industry: Industry) => void;
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  industry, 
  setIndustry,
  mode,
  setMode
}) => {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      // 检查是否已选择 API Key
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
    const interval = setInterval(checkKey, 3000); // 轮询状态
    return () => clearInterval(interval);
  }, []);

  const handleOpenKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // 弹出后假设成功以绕过 race condition
      setHasKey(true);
    }
  };

  const navItems = [
    { id: 'dashboard', label: '智能编排中枢', icon: LayoutDashboard },
    { id: 'knowledge', label: '语义切片引擎', icon: Database },
    { id: 'vector', label: '向量空间管理', icon: Layers },
    { id: 'mcp', label: '标准化能力网关', icon: Cpu },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
          <Box size={20} />
        </div>
        <span className="font-bold text-lg text-white tracking-tight">智能 Agent 系统</span>
      </div>

      <div className="px-4 mb-4">
        <div className={`p-4 rounded-xl border transition-all ${hasKey ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">配额状态</span>
            {hasKey ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
          </div>
          <p className="text-[11px] font-bold text-slate-200 mb-3 leading-snug">
            {hasKey ? '已连接高配额项目 Key' : '检测到限流风险 (429)'}
          </p>
          <button 
            onClick={handleOpenKey}
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
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'hover:bg-slate-800 hover:text-white text-slate-400'
            }`}
          >
            <item.icon size={18} />
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">行业业务模板</label>
          <select 
            value={industry}
            onChange={(e) => setIndustry(e.target.value as Industry)}
            className="w-full bg-slate-800 border-none rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            {Object.values(Industry).map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Agent 协作模式</label>
          <div className="grid grid-cols-1 gap-1">
            {Object.values(AgentMode).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-left px-3 py-1.5 rounded text-[11px] transition-colors ${
                  mode === m ? 'bg-indigo-500/20 text-indigo-400 font-semibold' : 'hover:bg-slate-800 text-slate-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
