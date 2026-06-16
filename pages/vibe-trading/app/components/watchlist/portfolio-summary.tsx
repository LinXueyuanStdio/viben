"use client";

import type { MarketQuote } from "@/lib/types";
import { IconChart } from "./icons";

interface PortfolioSummaryProps {
  quotes: Map<string, MarketQuote>;
  symbols: string[];
}

export function PortfolioSummary({ quotes, symbols }: PortfolioSummaryProps) {
  if (symbols.length === 0) return null;

  let totalChangePct = 0;
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;
  let validCount = 0;

  for (const symbol of symbols) {
    const q = quotes.get(symbol);
    if (!q) continue;
    validCount++;
    totalChangePct += q.change_pct;
    if (q.change_pct > 0) upCount++;
    else if (q.change_pct < 0) downCount++;
    else flatCount++;
  }

  const avgChangePct = validCount > 0 ? totalChangePct / validCount : 0;
  const isPositive = avgChangePct >= 0;

  return (
    <div className="px-4 py-2.5 border-b border-border flex items-center gap-4 text-xs bg-muted/50">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <IconChart size={14} className="text-muted-foreground" />
        <span>组合今日：</span>
      </div>
      <span className={`text-sm font-semibold ${isPositive ? "text-gain" : "text-loss"}`}>
        {isPositive ? "+" : ""}{avgChangePct.toFixed(2)}%
      </span>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-gain font-medium">↑{upCount}</span>
        <span className="text-loss font-medium">↓{downCount}</span>
        <span>平{flatCount}</span>
      </div>
      {validCount < symbols.length && (
        <span className="text-muted-foreground/60 ml-auto">加载 {validCount}/{symbols.length}</span>
      )}
    </div>
  );
}
