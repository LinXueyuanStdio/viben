"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NavPoint } from "@/lib/types";

interface NavChartProps {
  navHistory: NavPoint[];
  initialNav: number;
}

interface HoverState {
  index: number;
  canvasX: number;
  canvasY: number;
  clientX: number;
  clientY: number;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}`;
}

function formatFullTime(ts: string): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}:${ss}`;
}

const PADDING = { top: 24, right: 72, bottom: 36, left: 56 };
const COLOR_GREEN = "#16a34a";
const COLOR_RED = "#dc2626";
const COLOR_BASELINE = "#cbd5e1";
const COLOR_AXIS_TEXT = "#94a3b8";
const COLOR_AXIS_TEXT_DARK = "#64748b";

export function NavChart({ navHistory, initialNav }: NavChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animFrameRef = useRef<number>(0);

  // ResizeObserver for responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compute chart geometry
  const getChartGeometry = useCallback(
    (w: number, h: number) => {
      const chartW = w - PADDING.left - PADDING.right;
      const chartH = h - PADDING.top - PADDING.bottom;
      return { chartW, chartH };
    },
    []
  );

  // Get data point coordinates
  const getPointCoords = useCallback(
    (
      index: number,
      totalPoints: number,
      chartW: number,
      chartH: number,
      min: number,
      range: number
    ) => {
      const x = PADDING.left + (index / (totalPoints - 1)) * chartW;
      const y =
        PADDING.top + (1 - (navHistory[index].nav - min) / range) * chartH;
      return { x, y };
    },
    [navHistory]
  );

  // Find nearest data point from mouse position
  const findNearestIndex = useCallback(
    (mouseX: number, w: number): number => {
      if (navHistory.length < 2) return -1;
      const { chartW } = getChartGeometry(w, 0);
      const relX = mouseX - PADDING.left;
      const ratio = relX / chartW;
      const idx = Math.round(ratio * (navHistory.length - 1));
      return Math.max(0, Math.min(navHistory.length - 1, idx));
    },
    [navHistory, getChartGeometry]
  );

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || navHistory.length < 2 || dimensions.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width;
    const h = dimensions.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const { chartW, chartH } = getChartGeometry(w, h);

    const values = navHistory.map((p) => p.nav);
    const dataMin = Math.min(...values, initialNav);
    const dataMax = Math.max(...values, initialNav);
    const marginFactor = 0.005;
    const min = dataMin * (1 - marginFactor);
    const max = dataMax * (1 + marginFactor);
    const range = max - min || 1;

    const latestNav = values[values.length - 1];
    const isProfitable = latestNav >= initialNav;
    const lineColor = isProfitable ? COLOR_GREEN : COLOR_RED;

    ctx.clearRect(0, 0, w, h);

    // --- Y-axis grid lines + labels ---
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const val = min + (range * i) / 4;
      const y = PADDING.top + (1 - i / 4) * chartH;

      // Grid line
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left + chartW, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = COLOR_AXIS_TEXT;
      ctx.fillText(val.toFixed(2), PADDING.left - 8, y);
    }

    // --- Initial NAV baseline ---
    const baselineY =
      PADDING.top + (1 - (initialNav - min) / range) * chartH;
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = COLOR_BASELINE;
    ctx.lineWidth = 1;
    ctx.moveTo(PADDING.left, baselineY);
    ctx.lineTo(PADDING.left + chartW, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Baseline label
    ctx.fillStyle = COLOR_BASELINE;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("初始", PADDING.left + chartW + 4, baselineY);

    // --- Line gradient (gray -> profit/loss color) ---
    const lineGradient = ctx.createLinearGradient(
      PADDING.left,
      0,
      PADDING.left + chartW,
      0
    );
    lineGradient.addColorStop(0, "#94a3b8");
    lineGradient.addColorStop(0.4, lineColor);
    lineGradient.addColorStop(1, lineColor);

    // --- Draw main line ---
    ctx.beginPath();
    for (let i = 0; i < navHistory.length; i++) {
      const { x, y } = getPointCoords(i, navHistory.length, chartW, chartH, min, range);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // --- Area fill ---
    const areaPath = new Path2D();
    for (let i = 0; i < navHistory.length; i++) {
      const { x, y } = getPointCoords(i, navHistory.length, chartW, chartH, min, range);
      if (i === 0) areaPath.moveTo(x, y);
      else areaPath.lineTo(x, y);
    }
    const lastPoint = getPointCoords(
      navHistory.length - 1,
      navHistory.length,
      chartW,
      chartH,
      min,
      range
    );
    areaPath.lineTo(lastPoint.x, PADDING.top + chartH);
    areaPath.lineTo(PADDING.left, PADDING.top + chartH);
    areaPath.closePath();

    const areaGradient = ctx.createLinearGradient(
      0,
      PADDING.top,
      0,
      PADDING.top + chartH
    );
    if (isProfitable) {
      areaGradient.addColorStop(0, "rgba(22, 163, 74, 0.12)");
      areaGradient.addColorStop(1, "rgba(22, 163, 74, 0)");
    } else {
      areaGradient.addColorStop(0, "rgba(220, 38, 38, 0.12)");
      areaGradient.addColorStop(1, "rgba(220, 38, 38, 0)");
    }
    ctx.fillStyle = areaGradient;
    ctx.fill(areaPath);

    // --- Current value endpoint dot ---
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // --- Current value label (right side) ---
    const pnlPct = ((latestNav - initialNav) / initialNav) * 100;
    const pnlSign = pnlPct >= 0 ? "+" : "";
    ctx.fillStyle = lineColor;
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${latestNav.toFixed(2)}`,
      lastPoint.x + 8,
      lastPoint.y - 7
    );
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(
      `${pnlSign}${pnlPct.toFixed(2)}%`,
      lastPoint.x + 8,
      lastPoint.y + 7
    );

    // --- X-axis time labels ---
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = COLOR_AXIS_TEXT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelCount = Math.min(5, navHistory.length);
    for (let i = 0; i < labelCount; i++) {
      const dataIdx = Math.round(
        (i / (labelCount - 1)) * (navHistory.length - 1)
      );
      const x =
        PADDING.left + (dataIdx / (navHistory.length - 1)) * chartW;
      ctx.fillText(formatTime(navHistory[dataIdx].ts), x, PADDING.top + chartH + 8);
    }

    // --- Hover crosshair ---
    if (hover !== null) {
      const { x: hx, y: hy } = getPointCoords(
        hover.index,
        navHistory.length,
        chartW,
        chartH,
        min,
        range
      );

      // Vertical dashed line
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.moveTo(hx, PADDING.top);
      ctx.lineTo(hx, PADDING.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Horizontal dashed line
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.moveTo(PADDING.left, hy);
      ctx.lineTo(PADDING.left + chartW, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hover dot
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }, [navHistory, initialNav, dimensions, hover, getChartGeometry, getPointCoords]);

  // Mouse interaction handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (navHistory.length < 2) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { chartW, chartH } = getChartGeometry(
        dimensions.width,
        dimensions.height
      );

      // Only show crosshair when within chart area
      if (
        mouseX < PADDING.left ||
        mouseX > PADDING.left + chartW ||
        mouseY < PADDING.top ||
        mouseY > PADDING.top + chartH
      ) {
        setHover(null);
        return;
      }

      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        const idx = findNearestIndex(mouseX, dimensions.width);
        if (idx >= 0) {
          setHover({
            index: idx,
            canvasX: mouseX,
            canvasY: mouseY,
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }
      });
    },
    [navHistory, dimensions, getChartGeometry, findNearestIndex]
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setHover(null);
  }, []);

  // Empty state
  if (navHistory.length < 2) {
    return (
      <div
        ref={containerRef}
        className="h-full flex flex-col items-center justify-center gap-3"
      >
        {/* Skeleton chart placeholder */}
        <div className="w-full max-w-[280px] h-[100px] relative overflow-hidden rounded-lg">
          <div className="absolute inset-0 bg-muted rounded-lg" />
          <svg
            className="absolute inset-0 w-full h-full animate-pulse"
            viewBox="0 0 280 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,70 Q40,65 70,60 T140,50 T210,55 T280,45"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M0,70 Q40,65 70,60 T140,50 T210,55 T280,45 L280,100 L0,100 Z"
              fill="url(#skeleton-gradient)"
              opacity="0.5"
            />
            <defs>
              <linearGradient
                id="skeleton-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">等待数据积累...</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            初始资金: ${initialNav.toFixed(2)}
          </p>
        </div>
      </div>
    );
  }

  // Tooltip data
  const tooltipData =
    hover !== null
      ? (() => {
          const point = navHistory[hover.index];
          const nav = point.nav;
          const pnl = nav - initialNav;
          const pnlPct = ((nav - initialNav) / initialNav) * 100;
          return { nav, pnl, pnlPct, ts: point.ts };
        })()
      : null;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip (HTML overlay) */}
      {hover !== null && tooltipData !== null && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: Math.min(
              hover.canvasX + 12,
              dimensions.width - 160
            ),
            top: Math.max(hover.canvasY - 60, 4),
          }}
        >
          <div className="bg-card rounded-lg shadow-lg border border-border px-3 py-2 min-w-[140px]">
            <p className="text-[10px] text-muted-foreground mb-1">
              {formatFullTime(tooltipData.ts)}
            </p>
            <p className="text-xs font-semibold text-foreground">
              NAV: ${tooltipData.nav.toFixed(4)}
            </p>
            <p
              className="text-[11px] font-medium mt-0.5"
              style={{
                color: tooltipData.pnlPct >= 0 ? COLOR_GREEN : COLOR_RED,
              }}
            >
              {tooltipData.pnlPct >= 0 ? "+" : ""}
              {tooltipData.pnlPct.toFixed(2)}%
              <span className="ml-1 text-[10px]">
                ({tooltipData.pnl >= 0 ? "+" : ""}
                {tooltipData.pnl.toFixed(4)})
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
