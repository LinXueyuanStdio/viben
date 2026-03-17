'use client';

import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import type { FileChurn } from './types';

interface FileChurnChartProps {
  data: FileChurn[];
}

// Color gradient based on change frequency
function getChurnColor(changes: number, maxChanges: number): string {
  const ratio = changes / maxChanges;
  if (ratio >= 0.8) return '#EF4444CC'; // Red - very hot
  if (ratio >= 0.6) return '#F97316CC'; // Orange
  if (ratio >= 0.4) return '#F59E0BCC'; // Yellow
  if (ratio >= 0.2) return '#3B82F6CC'; // Blue
  return '#10B981CC'; // Green - cool
}

function shortenPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join('/')}`;
}

export function FileChurnChart({ data }: FileChurnChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  if (!data || data.length === 0) {
    return null;
  }

  const maxChanges = Math.max(...data.map((d) => d.changes));
  const chartData = data.map((d) => ({
    ...d,
    shortPath: shortenPath(d.path),
    color: getChurnColor(d.changes, maxChanges),
  }));

  const totalChanges = data.reduce((sum, d) => sum + d.changes, 0);

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
          <h3 className="text-lg font-semibold text-white">热点文件</h3>
          <p className="text-sm text-zinc-500">过去 90 天变更最频繁的文件</p>
        </div>
        <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-xs font-semibold text-orange-300">
          {totalChanges.toLocaleString()} 次变更
        </span>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis
              type="number"
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortPath"
              tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
              }}
               
              formatter={(value: any, _name: any, props: any) => {
                return [`${Number(value)} 次变更`, props.payload.path];
              }}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="changes"
              radius={[0, 4, 4, 0]}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" />
          <span>低频</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-500/80" />
          <span>中低</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-yellow-500/80" />
          <span>中等</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-orange-500/80" />
          <span>较高</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-red-500/80" />
          <span>热点</span>
        </div>
      </div>
    </div>
  );
}
