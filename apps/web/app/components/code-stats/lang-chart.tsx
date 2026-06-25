'use client';

import { useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import { ChartFrame } from './chart-frame';
import type { LanguageStat } from './types';

interface LangChartProps {
  languages: LanguageStat[];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function LangChart({ languages }: LangChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const total = languages.reduce((sum, l) => sum + l.lines, 0);

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">语言分布</h3>
          <p className="text-sm text-zinc-500">按代码行数统计</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-300">
          {languages.length} 种语言
        </span>
      </div>

      <ChartFrame className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={languages.slice(0, 8)}
              dataKey="lines"
              nameKey="lang"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {languages.slice(0, 8).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#07070b" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
               
              formatter={(value: any) =>
                `${Number(value).toLocaleString()} 行 (${((Number(value) / total) * 100).toFixed(1)}%)`
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>

      <div className="mt-4 flex flex-wrap gap-2">
        {languages.slice(0, 10).map((lang) => (
          <div
            key={lang.lang}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-xs"
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: lang.color }}
            />
            <span className="font-mono text-zinc-300">.{lang.ext}</span>
            <span className="text-zinc-500">{((lang.lines / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
