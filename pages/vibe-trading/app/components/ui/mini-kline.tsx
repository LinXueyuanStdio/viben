"use client";

import type { OHLCV } from "@/lib/types";

interface MiniKlineProps {
  data: OHLCV[];
  width?: number;
  height?: number;
}

export function MiniKline({ data, width = 80, height = 24 }: MiniKlineProps) {
  if (data.length < 2) return null;

  const padding = 2;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const allPrices = data.flatMap((k) => [k.h, k.l]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;

  const barWidth = Math.max(1, (drawWidth / data.length) * 0.6);
  const gap = drawWidth / data.length;

  const toY = (price: number) => padding + drawHeight - ((price - min) / range) * drawHeight;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
    >
      {data.map((k, i) => {
        const x = padding + i * gap + gap / 2;
        const isUp = k.c >= k.o;
        const color = isUp ? "#16a34a" : "#dc2626";
        const bodyTop = toY(Math.max(k.o, k.c));
        const bodyBottom = toY(Math.min(k.o, k.c));
        const bodyHeight = Math.max(0.5, bodyBottom - bodyTop);

        return (
          <g key={i}>
            <line
              x1={x}
              y1={toY(k.h)}
              x2={x}
              y2={toY(k.l)}
              stroke={color}
              strokeWidth={0.5}
            />
            <rect
              x={x - barWidth / 2}
              y={bodyTop}
              width={barWidth}
              height={bodyHeight}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}
