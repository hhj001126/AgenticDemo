
import React from 'react';
import { ChartData } from '../types';
import { PieChart, Loader2, BarChart3 } from 'lucide-react';

interface VisualChartProps {
  data: ChartData;
}

export const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-xl w-full my-6 animate-pulse">
    <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 text-slate-300 rounded-xl">
           <BarChart3 size={20} />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded"></div>
          <div className="h-2 w-24 bg-slate-50 rounded"></div>
        </div>
      </div>
      <div className="w-16 h-6 bg-slate-100 rounded-full"></div>
    </div>
    <div className="h-[240px] flex flex-col items-center justify-center space-y-4">
      <div className="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
         <Loader2 size={32} className="text-indigo-200 animate-spin" />
      </div>
      <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">正在解析数据可视化矩阵...</div>
    </div>
  </div>
);

const VisualChart: React.FC<VisualChartProps> = ({ data }) => {
  const { type, title, labels, datasets } = data;
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  const renderBarChart = () => {
    const maxValue = Math.max(...datasets.flatMap(d => d.data), 1);
    const chartHeight = 180;

    return (
      <div className="w-full pt-10 pb-6 px-2">
        <div className="flex items-end justify-between h-[200px] border-b border-slate-100 gap-4">
          {labels.map((label, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 min-w-0">
              <div className="flex gap-1 items-end w-full justify-center h-full">
                {datasets.map((ds, dsIdx) => {
                  const val = ds.data[idx] || 0;
                  const h = (val / maxValue) * chartHeight;
                  return (
                    <div 
                      key={dsIdx} 
                      style={{ 
                        height: `${Math.max(h, 2)}px`, 
                        backgroundColor: ds.color || colors[dsIdx % colors.length] 
                      }} 
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
        <div className="flex flex-wrap gap-4 mt-6 justify-center">
          {datasets.map((ds, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: ds.color || colors[idx % colors.length] }}></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{ds.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPieChart = () => {
    const dataPoints = datasets[0]?.data || [];
    const total = dataPoints.reduce((a, b) => a + b, 0);
    let currentAngle = 0;

    if (total === 0) return <div className="text-center p-10 text-slate-400 text-xs font-bold uppercase">No data to display</div>;

    return (
      <div className="flex flex-col md:flex-row items-center gap-10 py-6">
        <div className="relative">
          <svg viewBox="0 0 100 100" className="w-48 h-48 drop-shadow-2xl transform -rotate-90">
            {dataPoints.map((val, idx) => {
              const angle = (val / total) * 360;
              const x1 = 50 + 42 * Math.cos((currentAngle * Math.PI) / 180);
              const y1 = 50 + 42 * Math.sin((currentAngle * Math.PI) / 180);
              const x2 = 50 + 42 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
              const y2 = 50 + 42 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
              const largeArc = angle > 180 ? 1 : 0;
              const pathData = `M 50 50 L ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2} Z`;
              const color = colors[idx % colors.length];
              currentAngle += angle;
              return (
                <path 
                  key={idx} 
                  d={pathData} 
                  fill={color} 
                  className="hover:opacity-90 transition-all cursor-pointer hover:scale-105 origin-center" 
                />
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
                <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: colors[idx % colors.length] }}></div>
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
  };

  const renderLineChart = () => {
    const maxValue = Math.max(...datasets.flatMap(d => d.data), 1);
    const height = 180;
    const width = 500;
    const padding = 40;

    return (
      <div className="w-full pt-8 pb-4">
        <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-[200px] overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line 
              key={i} 
              x1={padding} 
              y1={height - (p * (height - padding))} 
              x2={width - padding} 
              y2={height - (p * (height - padding))} 
              stroke="#f1f5f9" 
              strokeWidth="1" 
            />
          ))}

          {datasets.map((ds, dsIdx) => {
            const points = ds.data.map((val, idx) => {
              const x = (idx / (labels.length - 1)) * (width - padding * 2) + padding;
              const y = height - (val / maxValue) * (height - padding) - 10;
              return `${x},${y}`;
            }).join(' ');

            return (
              <g key={dsIdx}>
                <polyline 
                  points={points} 
                  fill="none" 
                  stroke={ds.color || colors[dsIdx % colors.length]} 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="drop-shadow-lg transition-all"
                />
                {ds.data.map((val, idx) => {
                  const x = (idx / (labels.length - 1)) * (width - padding * 2) + padding;
                  const y = height - (val / maxValue) * (height - padding) - 10;
                  return (
                    <circle 
                      key={idx} 
                      cx={x} 
                      cy={y} 
                      r="5" 
                      fill="white" 
                      stroke={ds.color || colors[dsIdx % colors.length]} 
                      strokeWidth="3" 
                      className="cursor-pointer hover:r-7 transition-all"
                    />
                  );
                })}
              </g>
            );
          })}
          
          {labels.map((label, idx) => {
             const x = (idx / (labels.length - 1)) * (width - padding * 2) + padding;
             return (
               <text key={idx} x={x} y={height + 15} fontSize="9" fill="#94a3b8" textAnchor="middle" fontWeight="bold" className="uppercase tracking-tighter">{label}</text>
             );
          })}
        </svg>
        <div className="flex flex-wrap gap-4 mt-6 justify-center">
          {datasets.map((ds, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-4 h-1 rounded-full" style={{ backgroundColor: ds.color || colors[idx % colors.length] }}></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ds.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-xl w-full my-6 animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
             <PieChart size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Real-time Data Visualization</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
          {type} chart
        </div>
      </div>
      <div className="min-h-[240px] flex items-center justify-center">
        {type === 'bar' && renderBarChart()}
        {type === 'pie' && renderPieChart()}
        {type === 'line' && renderLineChart()}
      </div>
    </div>
  );
};

export default VisualChart;
