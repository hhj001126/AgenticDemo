import React, { memo } from 'react';
import { ChartData } from '../../types';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface BarChartProps {
  data: ChartData;
}

export const BarChart = memo<BarChartProps>(({ data }) => {
  const { labels, datasets } = data;
  const maxValue = Math.max(...datasets.flatMap((d) => d.data), 1);
  const chartHeight = 160;

  return (
    <div className="w-full pt-2 pb-2 px-1">
      <div className="flex gap-2 items-end justify-between h-[180px] border-b border-slate-100">
        {labels.map((label, idx) => (
          <div key={idx} className="flex flex-col items-center flex-1 min-w-0">
            <div className="flex gap-1 items-end w-full justify-center h-full">
              {datasets.map((ds, dsIdx) => {
                const val = ds.data[idx] || 0;
                const h = (val / maxValue) * chartHeight;
                const color = ds.color || COLORS[dsIdx % COLORS.length];
                return (
                  <div
                    key={dsIdx}
                    style={{ height: `${Math.max(h, 2)}px`, backgroundColor: color }}
                    className="w-full max-w-[12px] rounded-t-sm relative group transition-all hover:brightness-110"
                  >
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap font-bold">
                      {ds.label}: {val}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="h-8 flex items-center justify-center w-full">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-center truncate w-full mt-2">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {datasets.map((ds, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: ds.color || COLORS[idx % COLORS.length] }} />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{ds.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
