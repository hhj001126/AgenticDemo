import React, { memo } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  colorClass: string;
}

export const StatCard = memo<StatCardProps>(({ label, value, colorClass }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-extrabold ${colorClass}`}>{value}</p>
  </div>
));
