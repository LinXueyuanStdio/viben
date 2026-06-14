"use client";

interface MiniSparklineProps {
  data: number[]; // Recent N price points
  width?: number; // Default 60
  height?: number; // Default 20
  color?: string; // Line color
}

export function MiniSparkline({
  data,
  width = 60,
  height = 20,
  color = "#0891B2",
}: MiniSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  const padding = 2; // Padding for the dot at the end
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  // Generate points
  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * drawWidth;
    const y = padding + drawHeight - ((value - min) / range) * drawHeight;
    return { x, y };
  });

  // Build polyline path
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Last point for the dot
  const lastPoint = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
    >
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill={color} />
    </svg>
  );
}
