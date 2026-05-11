import type { ChartCommand, Point } from "../types"
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"

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
    animate = true,
  } = command
  const position = _position as Point

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width,
        background: "rgba(20, 20, 35, 0.88)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        padding: "12px 8px 8px",
        opacity: animate ? 0 : 1,
        animation: animate ? "presentationSlideInDown 500ms ease-out forwards" : undefined,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      {title && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          marginBottom: 8,
          paddingLeft: 8,
        }}>
          {title}
        </div>
      )}

      {renderChart(chartType, data, series, dataMulti, colors, showGrid, showAxis, animate, innerRadius, width - 16, height)}
    </div>
  )
}

function renderChart(
  chartType: ChartCommand["chartType"],
  data: ChartCommand["data"],
  series: ChartCommand["series"],
  dataMulti: ChartCommand["dataMulti"],
  colors: string[],
  showGrid: boolean,
  showAxis: boolean,
  animate: boolean,
  innerRadius: number,
  chartWidth: number,
  chartHeight: number,
): React.ReactElement {
  const axisStyle = { fontSize: 10, fill: "rgba(255,255,255,0.5)" }
  const gridStyle = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.08)" }

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
                dot={{ r: 3, fill: s.color || colors[i % colors.length] }}
                isAnimationActive={animate}
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
            dot={{ r: 4, fill: colors[0] }}
            isAnimationActive={animate}
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
                radius={[3, 3, 0, 0]}
                isAnimationActive={animate}
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
            isAnimationActive={animate}
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
                fill={`${s.color || colors[i % colors.length]}40`}
                strokeWidth={2}
                isAnimationActive={animate}
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
            fill={`${colors[0]}40`}
            strokeWidth={2}
            isAnimationActive={animate}
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
            isAnimationActive={animate}
            animationDuration={1000}
            animationEasing="ease-out"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ stroke: "rgba(255,255,255,0.3)" }}
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
  background: "rgba(0,0,0,0.85)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  fontSize: 11,
  color: "#fff",
}
