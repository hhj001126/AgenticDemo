import React from 'react';
import { PieChart, BarChart3, Loader2 } from 'lucide-react';
import { ChartData } from '../types';
import { BarChart } from './charts/BarChart';
import { PieChartView } from './charts/PieChartView';
import { LineChart } from './charts/LineChart';

export const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-[2rem] border border-slate-200 p-4 shadow-xl w-full my-4 animate-pulse">
    <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 text-slate-300 rounded-xl">
          <BarChart3 size={20} />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-2 w-24 bg-slate-50 rounded" />
        </div>
      </div>
      <div className="w-16 h-6 bg-slate-100 rounded-full" />
    </div>
    <div className="h-[200px] flex flex-col items-center justify-center space-y-2">
      <div className="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        <Loader2 size={32} className="text-indigo-200 animate-spin" />
      </div>
      <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">正在解析数据可视化矩阵...</div>
    </div>
  </div>
);

interface VisualChartProps {
  data: ChartData;
}

const VisualChart: React.FC<VisualChartProps> = ({ data }) => {
  const { type, title } = data;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 p-4 shadow-xl w-full my-4 animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
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
      <div className="min-h-[200px] flex items-center justify-center">
        {type === 'bar' && <BarChart data={data} />}
        {type === 'pie' && <PieChartView data={data} />}
        {type === 'line' && <LineChart data={data} />}
      </div>
    </div>
  );
};

export default VisualChart;
