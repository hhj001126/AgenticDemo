import React, { memo } from 'react';
import { ListChecks, ChevronDown, ChevronUp, Square, CheckSquare, CheckCircle2, AlertCircle, User, Zap, Clock, CheckCircle } from 'lucide-react';
import { Plan } from '../../types';

export interface PlanViewProps {
  plan: Plan;
  msgId: string;
  isAwaitingApproval: boolean;
  onToggleFold: (id: string) => void;
  onToggleStep: (id: string, stepId: string) => void;
  onConfirm: (plan: Plan) => void;
}

export const PlanView = memo<PlanViewProps>(({ plan, msgId, isAwaitingApproval, onToggleFold, onToggleStep, onConfirm }) => {
  const isCollapsed = plan.isCollapsed ?? false;
  const toggle = () => onToggleFold?.(msgId);

  return (
    <div className="w-full bg-white border border-indigo-100 rounded-[2rem] shadow-xl shadow-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500 border-2">
      <div onClick={toggle} className="flex items-center justify-between gap-2 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-indigo-50 bg-indigo-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
            <ListChecks size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{plan.title}</h4>
            <span className="text-[10px] text-indigo-600 font-bold uppercase">{plan.steps.length} 阶段编排就绪</span>
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
                className={`flex items-start gap-4 p-4 rounded-[1.25rem] transition-all border ${isAwaitingApproval && s.requiresApproval ? 'bg-white border-slate-200 cursor-pointer hover:border-indigo-400 hover:shadow-md' : 'bg-slate-50 border-slate-100'} ${!s.approved ? 'opacity-50' : ''}`}
                onClick={() => isAwaitingApproval && s.requiresApproval && onToggleStep(msgId, s.id)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isAwaitingApproval ? (
                    s.approved ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-slate-300" />
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
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${s.approved ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                        <User size={8} /> {s.approved ? 'Approved' : 'Review'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {s.parallel && <span className="text-[8px] bg-slate-200 text-slate-600 px-1.5 rounded uppercase font-black">Parallel Thread</span>}
                    {s.requiresApproval && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 rounded uppercase font-black tracking-tighter">Manual Review Required</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {isAwaitingApproval && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Clock size={16} /></div>
                <p className="text-[11px] font-bold text-indigo-800">当前任务处于挂起状态。您可以手动勾选步骤进行授权，或在下方输入补充调整建议来优化此计划。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => onConfirm(plan)} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center justify-center gap-2"><CheckCircle size={16} /> 确认并开始执行</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
