import React, { memo } from 'react';
import { ChartData } from '../../types';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface LineChartProps {
  data: ChartData;
}

export const LineChart = memo<LineChartProps>(({ data }) => {
  const { labels, datasets } = data;
  const maxValue = Math.max(...datasets.flatMap((d) => d.data), 1);
  const height = 180;
  const width = 500;
  const padding = 24;

  return (
    <div className="w-full pt-2 pb-2">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-[180px] overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={padding}
            y1={height - p * (height - padding)}
            x2={width - padding}
            y2={height - p * (height - padding)}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
        ))}
        {datasets.map((ds, dsIdx) => {
          const points = ds.data
            .map((val, idx) => {
              const x = (idx / Math.max(labels.length - 1, 1)) * (width - padding * 2) + padding;
              const y = height - (val / maxValue) * (height - padding) - 10;
              return `${x},${y}`;
            })
            .join(' ');
          const color = ds.color || COLORS[dsIdx % COLORS.length];
          return (
            <g key={dsIdx}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-lg transition-all"
              />
              {ds.data.map((val, idx) => {
                const x = (idx / Math.max(labels.length - 1, 1)) * (width - padding * 2) + padding;
                const y = height - (val / maxValue) * (height - padding) - 10;
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="white"
                    stroke={color}
                    strokeWidth="3"
                    className="cursor-pointer hover:r-7 transition-all"
                  />
                );
              })}
            </g>
          );
        })}
        {labels.map((label, idx) => {
          const x = (idx / Math.max(labels.length - 1, 1)) * (width - padding * 2) + padding;
          return (
            <text key={idx} x={x} y={height + 15} fontSize="9" fill="#94a3b8" textAnchor="middle" fontWeight="bold" className="uppercase tracking-tighter">
              {label}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {datasets.map((ds, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full" style={{ backgroundColor: ds.color || COLORS[idx % COLORS.length] }} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ds.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
