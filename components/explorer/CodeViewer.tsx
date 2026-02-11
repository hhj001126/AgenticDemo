import React, { memo } from 'react';
import { Braces } from 'lucide-react';

interface CodeViewerProps {
  fileName: string;
  content: string;
  onCopy?: () => void;
}

export const CodeViewer = memo<CodeViewerProps>(({ fileName, content, onCopy }) => (
  <div className="flex-1 flex flex-col min-w-0 bg-slate-950/40">
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-black text-slate-400 uppercase tracking-tight">{fileName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded text-[9px] font-bold uppercase">v1.2.0-RELEASE</span>
        <Braces size={16} className="text-slate-600" />
      </div>
    </div>

    <div className="flex-1 p-8 overflow-auto relative group">
      <pre className="text-sm text-indigo-200/90 font-mono leading-relaxed selection:bg-indigo-500/40">
        <code>{content}</code>
      </pre>
      {onCopy && (
        <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all active:scale-95"
            onClick={onCopy}
          >
            Copy Source
          </button>
        </div>
      )}
    </div>
  </div>
));
