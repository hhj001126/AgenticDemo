
import React, { useState, useEffect } from 'react';
import { FileCode, Coffee, FileJson, ChevronRight, Braces, Terminal, Save, Play, X, Loader2 } from 'lucide-react';
import { VfsFile } from '../types';

interface CodeWorkspaceProps {
  files: Record<string, VfsFile>;
  onClose: () => void;
  activeFileOverride?: string | null;
}

const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ files, onClose, activeFileOverride }) => {
  const fileList = Object.keys(files);
  const [activeFile, setActiveFile] = useState<string>(activeFileOverride || fileList[0] || '');

  useEffect(() => {
    if (activeFileOverride && files[activeFileOverride]) {
      setActiveFile(activeFileOverride);
    }
  }, [activeFileOverride, files]);

  useEffect(() => {
    if (!activeFile && fileList.length > 0) setActiveFile(fileList[0]);
  }, [fileList]);

  const getIcon = (path: string) => {
    if (path.endsWith('.java')) return <Coffee size={14} className="text-amber-500" />;
    if (path.endsWith('.xml')) return <FileJson size={14} className="text-indigo-400" />;
    return <FileCode size={14} className="text-slate-400" />;
  };

  const currentFile = files[activeFile];
  const isWriting = currentFile?.content === ""; // Simulating real-time writing feedback

  return (
    <div className="flex h-full bg-slate-950 text-slate-300 rounded-[1.5rem] border border-slate-800 overflow-hidden shadow-2xl animate-in slide-in-from-right-10 duration-500">
      {/* Sidebar */}
      <div className="w-56 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Explorer</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {fileList.map(path => (
            <div 
              key={path}
              onClick={() => setActiveFile(path)}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer text-xs transition-all ${
                activeFile === path ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/5 text-slate-500'
              }`}
            >
              {getIcon(path)}
              <span className="truncate flex-1">{path}</span>
              {files[path].content === "" && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${isWriting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
             <span className="text-[11px] font-mono text-slate-400">{activeFile}</span>
             {isWriting && <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Writing...</span>}
          </div>
          <div className="flex items-center gap-2">
             <button className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-md text-[10px] font-bold hover:bg-slate-700">
               <Play size={10} className="text-emerald-500 fill-emerald-500" /> Run
             </button>
          </div>
        </div>
        
        <div className="flex-1 p-8 overflow-auto bg-slate-950/20 selection:bg-indigo-500/30">
           {isWriting ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
                <p className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Streaming content from Agent...</p>
             </div>
           ) : (
             <pre className="text-sm font-mono leading-relaxed text-indigo-100/90 whitespace-pre-wrap">
               <code>{currentFile?.content || '// No content yet'}</code>
             </pre>
           )}
        </div>

        <div className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-4 justify-between">
           <div className="flex items-center gap-4">
             <span className="text-[9px] font-bold text-slate-600 flex items-center gap-1">
               <Terminal size={10} /> UTF-8
             </span>
             <span className="text-[9px] font-bold text-slate-600">Enterprise Java 17</span>
           </div>
           <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Supervisor Sync Active</span>
        </div>
      </div>
    </div>
  );
};

export default CodeWorkspace;
