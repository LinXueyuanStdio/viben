'use client';

import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import type { ModuleStat } from './types';

interface ModuleChartProps {
  modules: ModuleStat[];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function shortenName(name: string): string {
  return name
    .replace('packages/', 'pkg/')
    .replace('backend/', 'be/')
    .replace('apps/', '');
}

export function ModuleChart({ modules }: ModuleChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const data = modules.slice(0, 10).map((m) => ({
    ...m,
    shortName: shortenName(m.name),
  }));

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.1s' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">模块组成</h3>
          <p className="text-sm text-zinc-500">按模块分组统计行数</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-300">
          {modules.length} 个模块
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis
              type="number"
              tickFormatter={formatNumber}
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortName"
              tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => `${Number(value).toLocaleString()} 行`}
            />
            <Bar
              dataKey="lines"
              radius={[0, 4, 4, 0]}
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
