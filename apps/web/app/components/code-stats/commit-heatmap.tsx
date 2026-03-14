'use client';

import { useRef, useMemo } from 'react';
import { useInView } from '../animated-cards/use-in-view';
import type { CommitActivity } from './types';

interface CommitHeatmapProps {
  data: CommitActivity[];
}

// GitHub-style heatmap colors
const COLORS = {
  0: '#161B22',
  1: '#0E4429',
  2: '#006D32',
  3: '#26A641',
  4: '#39D353',
};

function getColor(count: number): string {
  if (count === 0) return COLORS[0];
  if (count <= 2) return COLORS[1];
  if (count <= 5) return COLORS[2];
  if (count <= 9) return COLORS[3];
  return COLORS[4];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function CommitHeatmap({ data }: CommitHeatmapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  const { weeks, monthLabels, totalCommits, maxCount } = useMemo(() => {
    if (!data || data.length === 0) {
      return { weeks: [], monthLabels: [], totalCommits: 0, maxCount: 0 };
    }

    // Group by weeks (columns)
    const weeks: { date: string; count: number; dayOfWeek: number }[][] = [];
    let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];
    let total = 0;
    let max = 0;

    // Build map for quick lookup
    const dateMap = new Map(data.map((d) => [d.date, d.count]));

    // Generate 365 days
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // Align to Sunday
    const startDayOfWeek = startDate.getDay();

    for (let i = 0; i < 365 + startDayOfWeek; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i - startDayOfWeek);
      const dateStr = date.toISOString().split('T')[0];
      const count = dateMap.get(dateStr) || 0;
      const dayOfWeek = date.getDay();

      if (i >= startDayOfWeek) {
        total += count;
        max = Math.max(max, count);
      }

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({ date: dateStr, count: i >= startDayOfWeek ? count : -1, dayOfWeek });
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Generate month labels
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDay = week.find((d) => d.count >= 0);
      if (firstDay) {
        const month = new Date(firstDay.date).getMonth();
        if (month !== lastMonth) {
          labels.push({ weekIndex, label: MONTHS[month] });
          lastMonth = month;
        }
      }
    });

    return { weeks, monthLabels: labels, totalCommits: total, maxCount: max };
  }, [data]);

  const cellSize = 11;
  const cellGap = 3;
  const leftPadding = 32;
  const topPadding = 20;
  const width = leftPadding + weeks.length * (cellSize + cellGap);
  const height = topPadding + 7 * (cellSize + cellGap) + 30; // Extra space for legend

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">提交活跃度</h3>
          <p className="text-sm text-zinc-500">过去 365 天的 Git 提交分布</p>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          {totalCommits.toLocaleString()} 次提交
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          className={`transition-opacity duration-500 ${isInView ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Month labels */}
          {monthLabels.map(({ weekIndex, label }) => (
            <text
              key={`month-${weekIndex}`}
              x={leftPadding + weekIndex * (cellSize + cellGap)}
              y={12}
              fill="#64748B"
              fontSize={10}
              fontFamily="system-ui"
            >
              {label}
            </text>
          ))}

          {/* Weekday labels */}
          {WEEKDAYS.map((day, i) => (
            <text
              key={`weekday-${i}`}
              x={8}
              y={topPadding + i * (cellSize + cellGap) + cellSize - 2}
              fill="#64748B"
              fontSize={9}
              fontFamily="system-ui"
              textAnchor="start"
              style={{ display: i % 2 === 1 ? 'block' : 'none' }}
            >
              {day}
            </text>
          ))}

          {/* Heatmap cells */}
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (day.count < 0) return null; // Skip placeholder cells
              return (
                <g key={`${weekIndex}-${dayIndex}`}>
                  <rect
                    x={leftPadding + weekIndex * (cellSize + cellGap)}
                    y={topPadding + dayIndex * (cellSize + cellGap)}
                    width={cellSize}
                    height={cellSize}
                    rx={2}
                    fill={getColor(day.count)}
                    className="transition-all duration-200 hover:stroke-white/30 hover:stroke-1"
                  >
                    <title>{`${day.date}: ${day.count} 次提交`}</title>
                  </rect>
                </g>
              );
            })
          )}

          {/* Legend */}
          <g transform={`translate(${width - 180}, ${height - 20})`}>
            <text x={0} y={10} fill="#64748B" fontSize={10}>
              少
            </text>
            {Object.values(COLORS).map((color, i) => (
              <rect key={`legend-${i}`} x={20 + i * 14} y={0} width={11} height={11} rx={2} fill={color} />
            ))}
            <text x={95} y={10} fill="#64748B" fontSize={10}>
              多
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
