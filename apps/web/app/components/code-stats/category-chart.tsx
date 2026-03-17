'use client';

import { useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useInView } from '../animated-cards/use-in-view';
import type { CategoryStat } from './types';

interface CategoryChartProps {
  categories: CategoryStat[];
}

export function CategoryChart({ categories }: CategoryChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const total = categories.reduce((sum, c) => sum + c.lines, 0);

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
      style={{ animationDelay: '0.2s' }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">文件类别</h3>
        <p className="text-sm text-zinc-500">代码 / 文档 / 配置分布</p>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categories}
              dataKey="lines"
              nameKey="label"
              cx="50%"
              cy="45%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={3}
              animationBegin={isInView ? 0 : 99999}
              animationDuration={1000}
            >
              {categories.map((entry, index) => (
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
               
              formatter={(value: any) =>
                `${Number(value).toLocaleString()} 行 (${((Number(value) / total) * 100).toFixed(1)}%)`
              }
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-zinc-400">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
