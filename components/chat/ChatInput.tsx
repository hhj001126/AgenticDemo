import React, { memo, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder: string;
}

export const ChatInput = memo<ChatInputProps>(({ value, onChange, onSend, isLoading, placeholder }) => {
  const [isComposing, setIsComposing] = useState(false);

  return (
    <div className="p-4 border-t border-slate-100 bg-white">
      <div className="flex items-end gap-3 bg-slate-50 p-2 rounded-[1.75rem] border-2 border-slate-100 focus-within:border-indigo-600 focus-within:bg-white transition-all duration-300">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
              e.preventDefault();
              if (value.trim() && !isLoading) {
                onSend();
              }
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="flex-1 max-h-32 bg-transparent border-none focus:ring-0 text-sm py-3 px-5 resize-none outline-none font-bold text-slate-800"
        />
      <button
        onClick={onSend}
        disabled={!value.trim() || isLoading}
        className="w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-lg hover:bg-indigo-600 disabled:opacity-20 transition-all flex items-center justify-center transform active:scale-95"
      >
        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
      </button>
    </div>
  </div>
  );
});
