
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import AgentChat from './components/AgentChat';
import SemanticChunker from './components/SemanticChunker';
import VectorDatabase from './components/VectorDatabase';
import { Industry, AgentMode } from './types';
import { 
  Network, 
  ExternalLink, 
  Zap,
  Globe,
  Lock,
  Terminal,
  Server
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [industry, setIndustry] = useState<Industry>(Industry.GENERAL);
  const [mode, setMode] = useState<AgentMode>(AgentMode.AGENTIC);

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
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
              <Server size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'dashboard' ? '智能编排控制台' : 
                 activeTab === 'knowledge' ? '语义处理引擎' : 
                 activeTab === 'vector' ? '向量化资产管理' : '能力网关中心'}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                <Terminal size={10} />
                <span>RUNTIME: ENTERPRISE ENGINE 4.0</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold text-slate-600">后端算力节点在线</span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all font-bold text-sm">
              <Zap size={16} className="text-indigo-400 fill-indigo-400" />
              立即发布
            </button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          {renderContent()}
        </div>

        <footer className="mt-4 flex items-center justify-between px-2 text-slate-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <Globe size={12} />
              <span>部署环境: 多云协同架构</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <Lock size={12} />
              <span>数据安全: AES-256 全链路加密</span>
            </div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
            智能 Agentic Orchestrator &copy; 2026 基于 Gemini 3 系列深度驱动
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress {
          animation: progress 2s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default App;
