"use client";

import { useState, useMemo } from "react";
import type { DecisionEntry } from "@/lib/types";
import { useSessionState } from "@/app/context/session-state-context";

interface DecisionLogProps {
  initialDecisions: DecisionEntry[];
}

export function DecisionLog({ initialDecisions }: DecisionLogProps) {
  const { state } = useSessionState();
  const decisions = state.decisions.length > 0 || state.current_cycle > 0 ? state.decisions : initialDecisions;
  const [filter, setFilter] = useState<"all" | "order">("all");

  const filtered = useMemo(() => {
    return decisions.filter((d) => {
      if (filter === "all") return true;
      return d.action === "order" || d.action === "close" || d.action === "close_all";
    });
  }, [decisions, filter]);

  // Statistics summary
  const stats = useMemo(() => {
    const total = filtered.length;
    const orderCount = filtered.filter(
      (d) => d.action === "order" || d.action === "close" || d.action === "close_all"
    ).length;
    return { total, orderCount };
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold mb-2">最近决策</h2>
        {/* Type filter */}
        <div className="flex gap-1 mb-2">
          {(["all", "order"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 text-xs rounded ${filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted"}`}
            >
              {{ all: "全部", order: "下单" }[f]}
            </button>
          ))}
        </div>
        {/* Stats summary */}
        <p className="text-xs text-muted-foreground">
          共 {stats.total} 次决策 · {stats.orderCount} 次下单
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length > 0 ? (
          <div className="relative pl-5">
            {/* Timeline vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
              {[...filtered].reverse().map((d, i) => (
                <TimelineCard key={`${d.cycle}-${i}`} decision={d} isFirst={i === 0} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// ─── Timeline Card ───────────────────────────────────────────────────────────
function TimelineCard({ decision, isFirst }: { decision: DecisionEntry; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isError = !!decision.error;
  const time = new Date(decision.ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const actionLabel = {
    order: "下单",
    hold: "观望",
    close: "平仓",
    close_all: "全部平仓",
  }[decision.action];

  // Dot color based on action type
  const dotColor = isError
    ? "bg-loss"
    : decision.action === "order" || decision.action === "close" || decision.action === "close_all"
      ? "bg-gain"
      : "bg-border";

  // Confidence bar color
  const confidencePct = Math.round(decision.confidence * 100);
  const confidenceBarColor =
    confidencePct < 40 ? "bg-loss" : confidencePct < 70 ? "bg-yellow-500" : "bg-gain";

  return (
    <div className={`relative ${isFirst ? "decision-card-enter" : ""}`}>
      {/* Timeline dot */}
      <div
        className={`absolute -left-5 top-3 w-[10px] h-[10px] rounded-full border-2 border-white ${dotColor} z-10`}
      />
      {/* Card */}
      <div
        className={`decision-card rounded-lg border ${
          isError ? "border-loss/30 bg-loss/10" : "border-border bg-card"
        } text-sm`}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs text-muted-foreground">{time} · 周期 #{decision.cycle}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              isError ? "bg-loss/15 text-loss" : "bg-gain/10 text-gain"
            }`}
          >
            {isError ? "失败" : actionLabel}
          </span>
        </div>
        <div className="px-3 py-2">
          {isError ? (
            <p className="text-loss text-sm">{decision.error}</p>
          ) : (
            <>
              {decision.orders?.map((o, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {o.side === "buy" ? "买入" : "卖出"} {o.symbol} · 数量 {o.quantity}
                  {o.price ? ` · 价格 ${o.price}` : ""}
                </p>
              ))}
              {decision.reasoning && (
                <p className="text-muted-foreground mt-2 leading-relaxed">{decision.reasoning}</p>
              )}
              {/* Confidence bar */}
              {decision.confidence > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">置信度</span>
                    <span className="text-xs text-muted-foreground font-mono">{confidencePct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${confidenceBarColor}`}
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {(decision.thinking_summary || decision.key_signals) && (
          <div className="px-3 py-2 border-t border-border">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline"
            >
              {expanded ? "收起" : "思考过程"}
            </button>
            <div
              className="thinking-collapse overflow-hidden"
              style={{
                maxHeight: expanded ? "500px" : "0px",
              }}
            >
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                {decision.thinking_summary && <p>{decision.thinking_summary}</p>}
                {decision.key_signals?.map((sig, i) => (
                  <p key={i}>
                    • {sig.indicator}: {sig.value} → {sig.interpretation}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <svg
        className="w-12 h-12 text-muted-foreground/60 mb-3 float-animation"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
      <p className="text-sm text-muted-foreground font-medium mb-1">暂无决策记录</p>
      <p className="text-xs text-muted-foreground/60">AI 将在下一决策周期生成分析</p>
    </div>
  );
}
