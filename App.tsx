import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AgentChat from './components/AgentChat';
import ToolsManagerPage from './components/tools/ToolsManagerPage';
import TodoListPage from './components/tools/TodoListPage';
import McpConnectionManager from './components/tools/McpConnectionManager';
import SemanticChunker from './components/SemanticChunker';
import VectorDatabase from './components/VectorDatabase';
import { AppLayout, MainContent, PageContainer, ConfirmProvider, ToastProvider } from './components/ui';
import { Industry, AgentMode } from './types';

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
      case 'todos':
        return <TodoListPage />;
      case 'tools':
        return <ToolsManagerPage />;
      case 'knowledge':
        return <SemanticChunker />;
      case 'vector':
        return <VectorDatabase />;
      case 'mcp':
        return <ToolsManagerPage initialTab="mcp" />;
      default:
        return <PageContainer />;
    }
  };

  return (
    <ConfirmProvider>
      <ToastProvider>
      <McpConnectionManager />
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
      </ToastProvider>
    </ConfirmProvider>
  );
};

export default App;
