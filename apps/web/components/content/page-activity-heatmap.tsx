'use client';

import { useMemo } from 'react';

export interface PageActivityDay {
  date: string;  // YYYY-MM-DD
  count: number;
}

interface PageActivityHeatmapProps {
  data: PageActivityDay[];
}

// GitHub-style green heatmap
const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function getColor(count: number, maxCount: number): string {
  if (count === 0) return COLORS[0];
  if (maxCount <= 0) return COLORS[0];
  const ratio = count / maxCount;
  if (ratio <= 0.25) return COLORS[1];
  if (ratio <= 0.5) return COLORS[2];
  if (ratio <= 0.75) return COLORS[3];
  return COLORS[4];
}

const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PageActivityHeatmap({ data }: PageActivityHeatmapProps) {
  const { weeks, monthLabels, maxCount } = useMemo(() => {
    const dateMap = new Map(data?.map((d) => [d.date, d.count]) ?? []);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // Align to Sunday
    const startDayOfWeek = startDate.getDay();
    const weeks: { date: string; count: number }[][] = [];
    let currentWeek: { date: string; count: number }[] = [];
    let max = 0;

    for (let i = 0; i < 365 + startDayOfWeek; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i - startDayOfWeek);
      const dateStr = date.toISOString().split('T')[0];
      const count = i >= startDayOfWeek ? (dateMap.get(dateStr) || 0) : -1;

      if (i >= startDayOfWeek) {
        max = Math.max(max, count);
      }

      if (date.getDay() === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({ date: dateStr, count });
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Month labels
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

    return { weeks, monthLabels: labels, maxCount: max };
  }, [data]);

  const cellSize = 11;
  const cellGap = 3;
  const leftPad = 28;
  const topPad = 14;

  const svgWidth = leftPad + weeks.length * (cellSize + cellGap)
  const svgHeight = topPad + 7 * (cellSize + cellGap) + 24

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        preserveAspectRatio="xMinYMin meet"
      >
        {/* Month labels */}
        {monthLabels.map(({ weekIndex, label }) => (
          <text
            key={`month-${weekIndex}`}
            x={leftPad + weekIndex * (cellSize + cellGap)}
            y={10}
            fill="#8b949e"
            fontSize={10}
          >
            {label}
          </text>
        ))}

        {/* Weekday labels */}
        {WEEKDAYS.map((day, i) =>
          day ? (
            <text
              key={`wd-${i}`}
              x={4}
              y={topPad + i * (cellSize + cellGap) + cellSize - 1}
              fill="#8b949e"
              fontSize={10}
              textAnchor="start"
            >
              {day}
            </text>
          ) : null
        )}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day.count < 0) return null;
            return (
              <rect
                key={`${wi}-${di}`}
                x={leftPad + wi * (cellSize + cellGap)}
                y={topPad + di * (cellSize + cellGap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(day.count, maxCount)}
              >
                <title>{`${day.date}: ${day.count} pages`}</title>
              </rect>
            );
          })
        )}

        {/* Legend */}
        <g transform={`translate(${leftPad + weeks.length * (cellSize + cellGap) - 200}, ${topPad + 7 * (cellSize + cellGap) + 4})`}>
          <text x={0} y={10} fill="#8b949e" fontSize={10}>Less</text>
          {COLORS.map((color, i) => (
            <rect key={i} x={32 + i * 14} y={0} width={11} height={11} rx={2} fill={color} />
          ))}
          <text x={107} y={10} fill="#8b949e" fontSize={10}>More</text>
        </g>
      </svg>
    </div>
  );
}
