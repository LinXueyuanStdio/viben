'use client';

import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import type { SizeDistribution } from './types';

interface FileSizeChartProps {
  data: SizeDistribution[];
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function FileSizeChart({ data }: FileSizeChartProps) {
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
      style={{ animationDelay: '0.3s' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">文件大小分布</h3>
          <p className="text-sm text-zinc-500">按行数统计文件数量</p>
        </div>
        <span className="rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-xs font-semibold text-blue-300">
          {totalFiles.toLocaleString()} 个文件
        </span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 5 }}>
            <XAxis
              dataKey="range"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              label={{ value: '行数', position: 'right', fill: '#64748B', fontSize: 10, dx: 10 }}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => {
                const percentage = ((Number(value) / totalFiles) * 100).toFixed(1);
                return [`${Number(value).toLocaleString()} 个文件 (${percentage}%)`, '文件数'];
              }}
              labelFormatter={(label) => `${label} 行`}
            />
            <Bar
              dataKey="files"
              radius={[4, 4, 0, 0]}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color + 'CC'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
