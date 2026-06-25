'use client';

import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import { ChartFrame } from './chart-frame';
import type { DensityStat } from './types';

interface DensityChartProps {
  density: DensityStat[];
}

export function DensityChart({ density }: DensityChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  if (!density || density.length === 0) {
    return null;
  }

  const sortedDensity = [...density].sort((a, b) => b.density - a.density).slice(0, 8);

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.5s' }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">代码密度</h3>
        <p className="text-sm text-zinc-500">平均每文件行数（行/文件）</p>
      </div>

      <ChartFrame className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedDensity} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis
              type="number"
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
               
              formatter={(value: any) => `${Number(value).toFixed(1)} 行/文件`}
            />
            <Bar
              dataKey="density"
              radius={[0, 4, 4, 0]}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {sortedDensity.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color + 'CC'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
