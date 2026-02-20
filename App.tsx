import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AgentChat from './components/AgentChat';
import ToolsManagerPage from './components/tools/ToolsManagerPage';
import TodoListPage from './components/tools/TodoListPage';
import McpConnectionManager from './components/tools/McpConnectionManager';
import SemanticChunker from './components/SemanticChunker';
import VectorDatabase from './components/VectorDatabase';
import { api } from './services/api';
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

  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const [sessionListVersion, setSessionListVersion] = useState(0);

  useEffect(() => {
    if (activeSessionId !== '') return;
    api.getActiveSession()
      .then((r) => {
        if (r.sessionId) {
          setActiveSessionId(r.sessionId);
        } else {
          return api.createSession().then((s) => {
            setActiveSessionId(s.sessionId);
            setSessionListVersion((v) => v + 1);
          });
        }
      })
      .catch(() =>
        api.createSession().then((r) => {
          setActiveSessionId(r.sessionId);
          setSessionListVersion((v) => v + 1);
        })
      );
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_APP_STATE, JSON.stringify({ activeTab, industry, mode }));
  }, [activeTab, industry, mode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <AgentChat
            sessionId={activeSessionId}
            industry={industry}
            mode={mode}
            onSessionChange={setActiveSessionId}
            onSessionContentChange={() => setSessionListVersion((v) => v + 1)}
          />
        );
      case 'todos':
        return <TodoListPage />;
      case 'tools':
        return <ToolsManagerPage />;
      case 'knowledge':
        return <SemanticChunker activeSessionId={activeSessionId} />;
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
            activeSessionId={activeTab === 'dashboard' ? activeSessionId : null}
            onSwitchSession={setActiveSessionId}
            sessionListVersion={sessionListVersion}
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
