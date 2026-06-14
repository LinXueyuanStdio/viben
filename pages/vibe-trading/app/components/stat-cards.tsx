"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionMetrics } from "@/lib/types";
import { useSessionState } from "@/app/context/session-state-context";

interface StatCardsProps {
  metrics: SessionMetrics;
  initialBalance: Record<string, number>;
}

// ─── Animated Number Hook ────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 600): number {
  const [current, setCurrent] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setCurrent(target);
      return;
    }
    hasAnimated.current = true;

    const start = performance.now();
    let rafId: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setCurrent(target);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return current;
}

// ─── Trend Arrow SVG ─────────────────────────────────────────────────────────

function TrendArrow({ up }: { up: boolean }) {
  if (up) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="text-gain"
      >
        <path
          d="M8 3v10M8 3l4 4M8 3L4 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="text-loss"
    >
      <path
        d="M8 13V3M8 13l4-4M8 13L4 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Card Icons (inline SVG) ─────────────────────────────────────────────────

function WinRateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PnlIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
      <path d="M1 10l3-3 3 2 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 9l2-3 2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PositionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
      <rect x="2" y="6" width="2.5" height="5" rx="0.5" fill="currentColor" />
      <rect x="5.75" y="4" width="2.5" height="7" rx="0.5" fill="currentColor" />
      <rect x="9.5" y="2" width="2.5" height="9" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function BalanceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4v6M5 5.5h4M5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FeeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
      <path d="M2 4h10M2 7h10M2 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Card Data Definition ────────────────────────────────────────────────────

type CardColor = "gain" | "loss" | "neutral";

interface CardDef {
  label: string;
  icon: React.ReactNode;
  numericValue: number;
  formatValue: (animated: number) => string;
  sub: string;
  color: CardColor;
  trendUp: boolean | null; // null = no trend arrow
  borderColor: string;
}

// ─── Animated Card Component ─────────────────────────────────────────────────

function AnimatedCard({ card }: { card: CardDef }) {
  const animated = useAnimatedNumber(card.numericValue);

  const textColor =
    card.color === "gain"
      ? "text-gain"
      : card.color === "loss"
        ? "text-loss"
        : "text-slate-900";

  return (
    <div
      className={`
        relative bg-white rounded-xl p-4 shadow-sm
        border-l-2 ${card.borderColor}
        transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-md
      `}
    >
      {/* Trend arrow top-right */}
      {card.trendUp !== null && (
        <div className="absolute top-3 right-3">
          <TrendArrow up={card.trendUp} />
        </div>
      )}

      {/* Label with icon */}
      <div className="flex items-center gap-1.5 mb-1">
        {card.icon}
        <p className="text-xs text-slate-500">{card.label}</p>
      </div>

      {/* Animated value */}
      <p className={`text-xl font-semibold ${textColor}`}>
        {card.formatValue(animated)}
      </p>

      {/* Sub text */}
      <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StatCards({ metrics: propMetrics, initialBalance: propBalance }: StatCardsProps) {
  const { state } = useSessionState();
  const metrics = state.metrics.nav > 0 ? state.metrics : propMetrics;
  const initialBalance = Object.keys(state.initial_balance).length > 0 ? state.initial_balance : propBalance;
  const initialNav = Object.values(initialBalance).reduce((s, v) => s + v, 0);
  const totalBalance = Object.values(metrics.available_balance).reduce((s, v) => s + v, 0);

  const cards: CardDef[] = [
    {
      label: "胜率",
      icon: <WinRateIcon />,
      numericValue: metrics.win_rate * 100,
      formatValue: (v) => `${v.toFixed(2)}%`,
      sub: `${metrics.win_count} 盈 ${metrics.loss_count} 亏`,
      color: metrics.win_rate >= 0.5 ? "gain" : "loss",
      trendUp: metrics.win_rate >= 0.5 ? true : false,
      borderColor: metrics.win_rate >= 0.5 ? "border-l-gain" : "border-l-loss",
    },
    {
      label: "交易盈亏",
      icon: <PnlIcon />,
      numericValue: metrics.total_pnl,
      formatValue: (v) =>
        `${v >= 0 ? "+" : ""}$${v.toFixed(4)}`,
      sub: `初始: $${initialNav.toFixed(2)}`,
      color: metrics.total_pnl >= 0 ? "gain" : "loss",
      trendUp: metrics.total_pnl >= 0 ? true : false,
      borderColor: metrics.total_pnl >= 0 ? "border-l-gain" : "border-l-loss",
    },
    {
      label: "NAV 收益率",
      icon: <NavIcon />,
      numericValue: metrics.total_pnl_pct,
      formatValue: (v) =>
        `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
      sub: `回撤: ${(metrics.max_drawdown_pct * 100).toFixed(2)}%`,
      color: metrics.total_pnl_pct >= 0 ? "gain" : "loss",
      trendUp: metrics.total_pnl_pct >= 0 ? true : false,
      borderColor: metrics.total_pnl_pct >= 0 ? "border-l-gain" : "border-l-loss",
    },
    {
      label: "持仓",
      icon: <PositionIcon />,
      numericValue: metrics.position_pct * 100,
      formatValue: (v) => `${v.toFixed(2)}%`,
      sub: `${metrics.total_trades} 笔交易`,
      color: "neutral",
      trendUp: null,
      borderColor: "border-l-slate-300",
    },
    {
      label: "可用余额",
      icon: <BalanceIcon />,
      numericValue: totalBalance,
      formatValue: (v) => `$${v.toFixed(2)}`,
      sub: `夏普: ${metrics.sharpe_ratio.toFixed(2)}`,
      color: "neutral",
      trendUp: null,
      borderColor: "border-l-slate-300",
    },
    {
      label: "手续费",
      icon: <FeeIcon />,
      numericValue: metrics.total_fees,
      formatValue: (v) => `$${v.toFixed(4)}`,
      sub: `占盈亏: ${metrics.total_pnl !== 0 ? ((metrics.total_fees / Math.abs(metrics.total_pnl)) * 100).toFixed(1) : "0.0"}%`,
      color: metrics.total_fees > 0 ? "loss" : "neutral",
      trendUp: metrics.total_fees > 0 ? false : null,
      borderColor: metrics.total_fees > 0 ? "border-l-loss" : "border-l-slate-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 px-6 py-4">
      {cards.map((card) => (
        <AnimatedCard key={card.label} card={card} />
      ))}
    </div>
  );
}
