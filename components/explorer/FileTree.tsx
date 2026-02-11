import React, { memo } from 'react';
import { ChevronDown, Package, Coffee, FileJson } from 'lucide-react';

interface FileTreeProps {
  files: string[];
  selectedFile: string;
  onSelect: (path: string) => void;
  getIcon: (name: string) => React.ReactNode;
}

export const FileTree = memo<FileTreeProps>(({ files, selectedFile, onSelect, getIcon }) => (
  <div className="space-y-1 font-mono text-xs flex-1 overflow-y-auto">
    <div className="flex items-center gap-2 py-1 px-2 text-indigo-300 bg-indigo-500/10 rounded-lg">
      <ChevronDown size={14} />
      <Package size={14} className="text-indigo-500" />
      <span className="font-bold">src/main/java</span>
    </div>
    <div className="pl-4 space-y-1 mt-2">
      {files.map((fileName) => (
        <div
          key={fileName}
          onClick={() => onSelect(fileName)}
          className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all ${
            selectedFile === fileName ? 'bg-slate-800 text-white border border-slate-700 shadow-lg' : 'hover:bg-slate-800/50 text-slate-400'
          }`}
        >
          {getIcon(fileName)}
          <span className="font-medium">{fileName}</span>
        </div>
      ))}
    </div>
  </div>
));
