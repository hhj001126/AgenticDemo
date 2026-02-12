import React, { memo } from 'react';
import { ListChecks, ChevronDown, ChevronUp, Square, CheckSquare, CheckCircle2, AlertCircle, User, Zap, Clock, CheckCircle, ListTodo } from 'lucide-react';
import { Plan } from '../../types';
import { todoService } from '../../services/todoService';
import { toast } from '../../utils/toast';

export interface PlanViewProps {
  plan: Plan;
  msgId: string;
  isAwaitingApproval: boolean;
  onToggleFold: (id: string) => void;
  onToggleStep: (id: string, stepId: string) => void;
  onConfirm: (plan: Plan, msgId?: string) => void;
}

export const PlanView = memo<PlanViewProps>(({ plan, msgId, isAwaitingApproval, onToggleFold, onToggleStep, onConfirm }) => {
  const isCollapsed = plan.isCollapsed ?? false;
  const toggle = () => onToggleFold?.(msgId);
  const completedCount = plan.steps.filter((s) => s.status === "completed").length;
  const totalCount = plan.steps.length;

  const handleExportToTodos = () => {
    plan.steps.forEach((s) => todoService.add(s.task));
    toast(`已导出 ${plan.steps.length} 项到待办`);
  };

  return (
    <div className="w-full bg-surface border border-primary-100 rounded-card shadow-card overflow-hidden animate-in fade-in zoom-in-95 duration-500 border-2">
      <div onClick={toggle} className="flex items-center justify-between gap-2 px-5 py-3 cursor-pointer hover:bg-surface-muted transition-theme border-b border-primary-50 bg-primary-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary text-white rounded-xl shadow-lg">
            <ListChecks size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{plan.title}</h4>
            <span className="text-[10px] text-primary font-bold uppercase">
              {totalCount > 0 && completedCount > 0 ? `${completedCount}/${totalCount} 已完成` : `${plan.steps.length} 阶段编排就绪`}
            </span>
          </div>
        </div>
        {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
      </div>
      {!isCollapsed && (
        <div className="px-5 py-3">
          <div className="space-y-2">
            {plan.steps.map((s) => (
              <div
                key={s.id}
                className={`flex items-start gap-4 p-4 rounded-[1.25rem] transition-all border ${isAwaitingApproval && s.requiresApproval ? 'bg-surface border-border cursor-pointer hover:border-primary hover:shadow-md' : 'bg-surface-muted border-border-muted'} ${!s.approved ? 'opacity-50' : ''}`}
                onClick={() => isAwaitingApproval && s.requiresApproval && onToggleStep(msgId, s.id)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isAwaitingApproval ? (
                    s.approved ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-slate-300" />
                  ) : (
                    s.approved ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[13px] font-bold truncate ${s.approved ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{s.task}</p>
                    {s.isAutoApproved ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase">
                        <Zap size={8} /> Auto
                      </div>
                    ) : (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${s.approved ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-600'}`}>
                        <User size={8} /> {s.approved ? 'Approved' : 'Review'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      s.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      s.status === "in_progress" ? "bg-primary-100 text-primary-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {s.status === "completed" ? "完成" : s.status === "in_progress" ? "进行中" : "待执行"}
                    </span>
                    {s.parallel && <span className="text-[8px] bg-slate-200 text-slate-600 px-1.5 rounded uppercase font-black">Parallel Thread</span>}
                    {s.requiresApproval && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 rounded uppercase font-black tracking-tighter">Manual Review Required</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {isAwaitingApproval ? (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-3 bg-primary-50/50 p-4 rounded-card border border-primary-100">
                <div className="p-2 bg-primary-100 text-primary rounded-lg"><Clock size={16} /></div>
                <p className="text-[11px] font-bold text-primary-700">当前任务处于挂起状态。您可以手动勾选步骤进行授权，或在下方输入补充调整建议来优化此计划。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => onConfirm(plan, msgId)} className="w-full bg-slate-900 text-white py-4 rounded-card text-[11px] font-black uppercase tracking-widest hover:bg-primary transition-theme shadow-card flex items-center justify-center gap-2"><CheckCircle size={16} /> 确认并开始执行</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={handleExportToTodos}
                className="w-full py-3 rounded-card text-[11px] font-bold uppercase tracking-widest border border-border hover:border-primary hover:bg-primary-50 transition-theme flex items-center justify-center gap-2 text-primary"
              >
                <ListTodo size={14} />
                导出为待办
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
