import React, { memo } from 'react';
import { ChartData } from '../../types';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface PieChartViewProps {
  data: ChartData;
}

export const PieChartView = memo<PieChartViewProps>(({ data }) => {
  const { labels, datasets } = data;
  const dataPoints = datasets[0]?.data || [];
  const total = dataPoints.reduce((a, b) => a + b, 0);
  let currentAngle = 0;

  if (total === 0) return <div className="text-center p-10 text-slate-400 text-xs font-bold uppercase">No data to display</div>;

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 py-3">
      <div className="relative">
        <svg viewBox="0 0 100 100" className="w-40 h-40 drop-shadow-2xl transform -rotate-90">
          {dataPoints.map((val, idx) => {
            const angle = (val / total) * 360;
            const x1 = 50 + 42 * Math.cos((currentAngle * Math.PI) / 180);
            const y1 = 50 + 42 * Math.sin((currentAngle * Math.PI) / 180);
            const x2 = 50 + 42 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
            const y2 = 50 + 42 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
            const largeArc = angle > 180 ? 1 : 0;
            const pathData = `M 50 50 L ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2} Z`;
            const color = COLORS[idx % COLORS.length];
            currentAngle += angle;
            return (
              <path key={idx} d={pathData} fill={color} className="hover:opacity-90 transition-all cursor-pointer hover:scale-105 origin-center" />
            );
          })}
          <circle cx="50" cy="50" r="20" fill="white" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <span className="block text-[8px] font-black text-slate-300 uppercase tracking-widest">Total</span>
            <span className="block text-sm font-black text-slate-800">{total}</span>
          </div>
        </div>
      </div>
      <div className="space-y-2 flex-1 w-full">
        {labels.map((label, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-900">{dataPoints[idx]}</span>
              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                {Math.round((dataPoints[idx] / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
