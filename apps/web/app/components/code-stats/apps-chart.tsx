'use client';

import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import type { AppStat } from './types';

interface AppsChartProps {
  apps: AppStat[];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function AppsChart({ apps }: AppsChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.3s' }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">应用对比</h3>
        <p className="text-sm text-zinc-500">apps/ 目录下各应用规模</p>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={apps} margin={{ bottom: 20 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
               
              formatter={(value: any) =>
                `${Number(value).toLocaleString()} 行`
              }
            />
            <Bar
              dataKey="lines"
              radius={[4, 4, 0, 0]}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {apps.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color + 'CC'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
