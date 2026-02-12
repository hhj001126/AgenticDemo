import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AgentChat from './components/AgentChat';
import SemanticChunker from './components/SemanticChunker';
import VectorDatabase from './components/VectorDatabase';
import { Industry, AgentMode } from './types';
import {
  Network,
  ExternalLink,
} from 'lucide-react';

const STORAGE_APP_STATE = 'agent_orchestrator_app_state';

const App: React.FC = () => {
  // Restore state from localStorage if available
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(STORAGE_APP_STATE);
    return saved ? JSON.parse(saved).activeTab : 'dashboard';
  });

  const [industry, setIndustry] = useState<Industry>(() => {
    const saved = localStorage.getItem(STORAGE_APP_STATE);
    return saved ? JSON.parse(saved).industry : Industry.GENERAL;
  });

  const [mode, setMode] = useState<AgentMode>(() => {
    const saved = localStorage.getItem(STORAGE_APP_STATE);
    return saved ? JSON.parse(saved).mode : AgentMode.AGENTIC;
  });

  // Save state on changes
  useEffect(() => {
    localStorage.setItem(STORAGE_APP_STATE, JSON.stringify({ activeTab, industry, mode }));
  }, [activeTab, industry, mode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AgentChat industry={industry} mode={mode} />;
      case 'knowledge':
        return <SemanticChunker />;
      case 'vector':
        return <VectorDatabase />;
      case 'mcp':
        return (
          <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto text-center space-y-8 py-12">
              <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto shadow-inner">
                <Network size={40} />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">标准化能力网关</h1>
                <p className="text-slate-500 mt-2 text-lg">统一连接企业级工具集，支持双向 Context 注入。</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['工具链自动发现', '权限分级审计', '调用链路追踪', '网关熔断控制'].map(item => (
                  <div key={item} className="p-6 border border-slate-200 rounded-2xl hover:border-indigo-500 transition-all bg-slate-50 group cursor-pointer text-left">
                    <div className="flex items-center justify-between mb-4">
                      <div className="px-2 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded uppercase">核心功能</div>
                      <ExternalLink size={16} className="text-slate-300 group-hover:text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{item}</h3>
                    <p className="text-xs text-slate-500 mt-2">系统已自动配置该能力插件，支持在 Agent 编排中直接调用。</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return <div className="h-full bg-white rounded-2xl" />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        industry={industry}
        setIndustry={setIndustry}
        mode={mode}
        setMode={setMode}
      />

      <main className="flex-1 p-6 h-full flex flex-col overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
