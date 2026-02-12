import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AgentChat from './components/AgentChat';
import SemanticChunker from './components/SemanticChunker';
import VectorDatabase from './components/VectorDatabase';
import { AppLayout, MainContent, PageContainer } from './components/ui';
import { Industry, AgentMode } from './types';
import { Network, ExternalLink } from 'lucide-react';

const STORAGE_APP_STATE = 'agent_orchestrator_app_state';

const App: React.FC = () => {
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
          <PageContainer padding="lg">
            <div className="max-w-4xl mx-auto text-center space-y-8 py-12">
              <div className="w-20 h-20 bg-primary-50 rounded-3xl flex items-center justify-center text-primary mx-auto shadow-inner">
                <Network size={40} />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-text font-display tracking-tight">标准化能力网关</h1>
                <p className="text-text-muted mt-2 text-lg">统一连接企业级工具集，支持双向 Context 注入。</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['工具链自动发现', '权限分级审计', '调用链路追踪', '网关熔断控制'].map((item) => (
                  <div
                    key={item}
                    className="p-6 border border-border rounded-card hover:border-primary transition-theme bg-surface-muted group cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="px-2 py-1 bg-primary-50 text-primary text-[10px] font-bold rounded uppercase">核心功能</div>
                      <ExternalLink size={16} className="text-text-muted group-hover:text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-text-secondary">{item}</h3>
                    <p className="text-xs text-text-muted mt-2">系统已自动配置该能力插件，支持在 Agent 编排中直接调用。</p>
                  </div>
                ))}
              </div>
            </div>
          </PageContainer>
        );
      default:
        return <PageContainer />;
    }
  };

  return (
    <AppLayout
      sidebar={
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          industry={industry}
          setIndustry={setIndustry}
          mode={mode}
          setMode={setMode}
        />
      }
    >
      <MainContent>{renderContent()}</MainContent>
    </AppLayout>
  );
};

export default App;
