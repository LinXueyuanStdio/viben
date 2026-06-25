'use client';

import { useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import { ChartFrame } from './chart-frame';
import type { FreshnessStat } from './types';

interface CodeFreshnessChartProps {
  data: FreshnessStat[];
}

export function CodeFreshnessChart({ data }: CodeFreshnessChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const totalFiles = data.reduce((sum, d) => sum + d.files, 0);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.2s' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">代码新鲜度</h3>
          <p className="text-sm text-zinc-500">文件最后修改时间分布</p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          {totalFiles.toLocaleString()} 个文件
        </span>
      </div>

      <ChartFrame className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="files"
              nameKey="label"
              cx="50%"
              cy="45%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={3}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color + 'CC'} stroke="#07070b" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
               
              formatter={(value: any, name: any, props: any) => {
                const percentage = ((Number(value) / totalFiles) * 100).toFixed(1);
                const lines = props.payload.lines?.toLocaleString() || '0';
                return [`${Number(value).toLocaleString()} 个文件 (${percentage}%)\n${lines} 行代码`, name];
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-zinc-400">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
