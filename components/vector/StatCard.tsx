import React, { memo } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  colorClass: string;
}

export const StatCard = memo<StatCardProps>(({ label, value, colorClass }) => (
  <div className="bg-surface p-4 rounded-card border border-border shadow-subtle transition-theme">
    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-extrabold ${colorClass}`}>{value}</p>
  </div>
));
