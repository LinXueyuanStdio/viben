import type { ChartCommand, Point } from "../types"
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
import { useSlideIn } from "../utils/motion"

interface ChartProps {
  command: ChartCommand
}

const DEFAULT_COLORS = [
  "#6366F1", "#76B900", "#ED1C24", "#F59E0B", "#EC4899",
  "#14B8A6", "#3B82F6", "#A855F7", "#F97316", "#06B6D4",
]

/**
 * Chart overlay -- Professional animated chart using recharts.
 *
 * Supports line, bar, area, and pie/donut charts with entry animations.
 * Styled with dark glassmorphism to match the presentation overlay system.
 * Container uses Remotion slide-in; recharts internal animations are kept active.
 */
export function Chart({ command }: ChartProps) {
  const {
    position: _position,
    width = 360,
    height = 200,
    chartType,
    data,
    series,
    dataMulti,
    showGrid = true,
    showAxis = true,
    title,
    colors = DEFAULT_COLORS,
    innerRadius = 0,
  } = command
  const position = _position as Point

  // Remotion slide-in for the container (replaces CSS presentationSlideInDown)
  const slide = useSlideIn(0, "bottom", 40)

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        padding: "14px 12px 10px",
        opacity: slide.opacity,
        transform: `translateY(${slide.translateY}px) scale(${slide.scale})`,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      {title && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 10,
          paddingLeft: 8,
          letterSpacing: 0.3,
          textShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}>
          {title}
        </div>
      )}

      {renderChart(chartType, data, series, dataMulti, colors, showGrid, showAxis, innerRadius, width - 24, height)}
    </div>
  )
}

// Module-level static styles (avoid per-frame allocation)
const AXIS_STYLE = { fontSize: 10, fill: "rgba(255,255,255,0.5)" } as const
const GRID_STYLE = { strokeDasharray: "4 4", stroke: "rgba(255, 255, 255, 0.04)" } as const

function renderChart(
  chartType: ChartCommand["chartType"],
  data: ChartCommand["data"],
  series: ChartCommand["series"],
  dataMulti: ChartCommand["dataMulti"],
  colors: string[],
  showGrid: boolean,
  showAxis: boolean,
  innerRadius: number,
  chartWidth: number,
  chartHeight: number,
): React.ReactElement {
  const axisStyle = AXIS_STYLE
  const gridStyle = GRID_STYLE

  // Disable recharts CSS animations -- they run on wall-clock time (60fps RAF loop)
  // which conflicts with Remotion's frame-driven rendering and breaks seek/export.
  switch (chartType) {
    case "line": {
      if (series && dataMulti) {
        return (
          <LineChart data={dataMulti} width={chartWidth} height={chartHeight}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            {showAxis && <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />}
            {showAxis && <YAxis tick={axisStyle} axisLine={false} tickLine={false} />}
            <Tooltip contentStyle={tooltipStyle} />
            {series.map((s, i) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color || colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color || colors[i % colors.length], stroke: "rgba(15,15,30,0.6)", strokeWidth: 1 }}
                isAnimationActive={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        )
      }
      return (
        <LineChart data={data} width={chartWidth} height={chartHeight}>
          {showGrid && <CartesianGrid {...gridStyle} />}
          {showAxis && <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />}
          {showAxis && <YAxis tick={axisStyle} axisLine={false} tickLine={false} />}
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors[0]}
            strokeWidth={2.5}
            dot={{ r: 4, fill: colors[0], stroke: "rgba(15,15,30,0.6)", strokeWidth: 1.5 }}
            isAnimationActive={false}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </LineChart>
      )
    }

    case "bar": {
      if (series && dataMulti) {
        return (
          <BarChart data={dataMulti} width={chartWidth} height={chartHeight}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            {showAxis && <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />}
            {showAxis && <YAxis tick={axisStyle} axisLine={false} tickLine={false} />}
            <Tooltip contentStyle={tooltipStyle} />
            {series.map((s, i) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                fill={s.color || colors[i % colors.length]}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        )
      }
      return (
        <BarChart data={data} width={chartWidth} height={chartHeight}>
          {showGrid && <CartesianGrid {...gridStyle} />}
          {showAxis && <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />}
          {showAxis && <YAxis tick={axisStyle} axisLine={false} tickLine={false} />}
          <Tooltip contentStyle={tooltipStyle} />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color || colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      )
    }

    case "area": {
      if (series && dataMulti) {
        return (
          <AreaChart data={dataMulti} width={chartWidth} height={chartHeight}>
            {showGrid && <CartesianGrid {...gridStyle} />}
            {showAxis && <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />}
            {showAxis && <YAxis tick={axisStyle} axisLine={false} tickLine={false} />}
            <Tooltip contentStyle={tooltipStyle} />
            {series.map((s, i) => (
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color || colors[i % colors.length]}
                fill={`${s.color || colors[i % colors.length]}30`}
                strokeWidth={2}
                isAnimationActive={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        )
      }
      return (
        <AreaChart data={data} width={chartWidth} height={chartHeight}>
          {showGrid && <CartesianGrid {...gridStyle} />}
          {showAxis && <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />}
          {showAxis && <YAxis tick={axisStyle} axisLine={false} tickLine={false} />}
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors[0]}
            fill={`${colors[0]}30`}
            strokeWidth={2}
            isAnimationActive={false}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      )
    }

    case "pie": {
      return (
        <PieChart width={chartWidth} height={chartHeight}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius="80%"
            isAnimationActive={false}
            animationDuration={1000}
            animationEasing="ease-out"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ stroke: "rgba(255,255,255,0.2)" }}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color || colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}
          />
        </PieChart>
      )
    }
  }
}

const tooltipStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(15, 15, 30, 0.95), rgba(25, 25, 50, 0.9))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  fontSize: 11,
  color: "#fff",
  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  backdropFilter: "blur(12px)",
}
