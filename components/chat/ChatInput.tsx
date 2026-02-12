import React, { memo, useState, useRef, useEffect } from 'react';
import { Send, Loader2, Zap } from 'lucide-react';

const SLASH_COMMANDS: { cmd: string; label: string; template: string }[] = [
  { cmd: 'plan', label: '制定任务计划', template: '请帮我制定一个任务计划：' },
  { cmd: 'search', label: '深度检索', template: '请对以下内容进行深度检索和分析：' },
  { cmd: 'code', label: '写代码', template: '请帮我编写代码，需求如下：' },
  { cmd: 'summary', label: '总结', template: '请总结以下内容：' },
  { cmd: 'translate', label: '翻译', template: '请将以下内容翻译成中文：' },
  { cmd: 'explain', label: '解释', template: '请解释以下概念或内容：' },
  { cmd: 'compare', label: '对比分析', template: '请对比分析以下内容：' },
  { cmd: 'review', label: '审查/校对', template: '请审查并给出修改建议：' },
  { cmd: 'rewrite', label: '润色改写', template: '请润色并改写以下内容，保持原意：' },
  { cmd: 'expand', label: '展开扩写', template: '请将以下内容展开、补充细节：' },
  { cmd: 'simplify', label: '简化', template: '请用更简洁的语言重写以下内容：' },
  { cmd: 'checklist', label: '待办清单', template: '请把以下内容整理成可执行的待办清单：' },
  { cmd: 'table', label: '表格化', template: '请将以下内容整理成结构化表格：' },
  { cmd: 'email', label: '写邮件', template: '请根据以下要点写一封正式邮件：' },
  { cmd: 'report', label: '写报告', template: '请根据以下信息撰写一份报告：' },
  { cmd: 'brainstorm', label: '头脑风暴', template: '请针对以下主题进行头脑风暴，给出多种方案：' },
  { cmd: 'fix', label: '修 Bug/排错', template: '请帮我排查并修复以下问题：' },
  { cmd: 'test', label: '写测试', template: '请为以下代码或功能编写测试用例：' },
  { cmd: 'doc', label: '写文档', template: '请为以下内容编写清晰的技术/使用文档：' },
  { cmd: 'refactor', label: '重构建议', template: '请对以下代码或方案给出重构建议：' },
  { cmd: 'proscons', label: '利弊分析', template: '请分析以下方案的优缺点：' },
];

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder: string;
}

export const ChatInput = memo<ChatInputProps>(({ value, onChange, onSend, isLoading, placeholder }) => {
  const [isComposing, setIsComposing] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSlashTrigger = value === '/' || (value.startsWith('/') && !value.includes('\n'));
  const filterLower = slashFilter.toLowerCase();
  const filteredCommands = SLASH_COMMANDS.filter(
    (c) => c.cmd.includes(filterLower) || c.label.includes(filterLower)
  );
  const selectedCmd = filteredCommands[slashIndex];

  useEffect(() => {
    if (isSlashTrigger) {
      setShowSlash(true);
      setSlashFilter(value.slice(1));
      setSlashIndex(0);
    } else {
      setShowSlash(false);
    }
  }, [value, isSlashTrigger]);

  useEffect(() => {
    setSlashIndex((i) => Math.min(i, Math.max(0, filteredCommands.length - 1)));
  }, [filteredCommands.length, slashFilter]);

  const applySlashCommand = (template: string) => {
    const afterSlash = value.startsWith('/') ? value.slice(1) : value;
    const rest = afterSlash.slice(slashFilter.length).trimStart();
    const newValue = rest ? `${template} ${rest}` : template;
    onChange(newValue);
    setShowSlash(false);
    setSlashFilter('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySlashCommand(selectedCmd.template);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlash(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSend();
      }
    }
  };

  return (
    <div className="p-4 border-t border-slate-100 bg-white relative">
      {showSlash && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-4 right-4 mb-1 py-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-10 max-h-64 overflow-auto"
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Zap size={12} /> 快捷指令
          </div>
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-2 text-sm text-slate-400">无匹配指令</div>
          ) : (
            filteredCommands.map((c, i) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => applySlashCommand(c.template)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                  i === slashIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-indigo-500 font-mono text-sm">/{c.cmd}</span>
                <span className="text-sm">{c.label}</span>
              </button>
            ))
          )}
        </div>
      )}
      <div className="flex items-end gap-3 bg-slate-50 p-2 rounded-[1.75rem] border-2 border-slate-100 focus-within:border-indigo-600 focus-within:bg-white transition-all duration-300">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={handleKeyDown}
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
