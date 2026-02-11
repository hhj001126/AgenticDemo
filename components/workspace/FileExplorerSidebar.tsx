import React, { memo } from 'react';
import { FileCode, Coffee, FileJson, X } from 'lucide-react';
import { VfsFile } from '../../types';

interface FileExplorerSidebarProps {
  files: Record<string, VfsFile>;
  activeFile: string;
  onSelectFile: (path: string) => void;
  onClose: () => void;
}

const getIcon = (path: string) => {
  if (path.endsWith('.java')) return <Coffee size={14} className="text-amber-500" />;
  if (path.endsWith('.xml')) return <FileJson size={14} className="text-indigo-400" />;
  return <FileCode size={14} className="text-slate-400" />;
};

export const FileExplorerSidebar = memo<FileExplorerSidebarProps>(({ files, activeFile, onSelectFile, onClose }) => {
  const fileList = Object.keys(files);
  return (
    <div className="w-56 border-r border-slate-800 bg-slate-900/50 flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Explorer</span>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {fileList.map((path) => (
          <div
            key={path}
            onClick={() => onSelectFile(path)}
            className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer text-xs transition-all ${
              activeFile === path ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/5 text-slate-500'
            }`}
          >
            {getIcon(path)}
            <span className="truncate flex-1">{path}</span>
            {files[path].content === '' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
          </div>
        ))}
      </div>
    </div>
  );
});
