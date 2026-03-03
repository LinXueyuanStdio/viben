'use client';

import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import type { DirStat } from './types';

interface DesktopChartProps {
  desktopDirs: DirStat[];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function DesktopChart({ desktopDirs }: DesktopChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  if (!desktopDirs || desktopDirs.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.4s' }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">桌面应用目录结构</h3>
          <p className="text-sm text-zinc-500">apps/desktop/src/ 子目录分布</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-300">
          {desktopDirs.length} 个目录
        </span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={desktopDirs} margin={{ bottom: 30 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              height={60}
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              {desktopDirs.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color + 'CC'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
