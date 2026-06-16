"use client";

import { useEffect, useRef } from "react";
import type { ExchangeId } from "@/lib/types";
import { useMarketQuote } from "@/app/hooks/use-market-quote";
import { toTradingViewSymbol } from "@/lib/tradingview";

interface SymbolDetailProps {
  symbol: string;
  exchange: ExchangeId;
}

export function SymbolDetail({ symbol, exchange }: SymbolDetailProps) {
  const { quotes } = useMarketQuote({ symbols: [symbol], interval: 3000 });
  const quote = quotes.get(symbol);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTradingViewSymbol(exchange, symbol),
      interval: "60",
      timezone: "Asia/Shanghai",
      theme: "light",
      style: "1",
      locale: "zh_CN",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
    });

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";

    wrapper.appendChild(inner);
    wrapper.appendChild(script);
    chartRef.current.appendChild(wrapper);
  }, [symbol, exchange]);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-5 gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <StatItem
          label="最新价"
          value={quote ? formatPrice(quote.last_price) : "—"}
          className="text-foreground font-semibold"
        />
        <StatItem
          label="24h 涨跌"
          value={quote ? `${quote.change_pct > 0 ? "+" : ""}${quote.change_pct.toFixed(2)}%` : "—"}
          className={quote ? (quote.change_pct > 0 ? "text-gain" : quote.change_pct < 0 ? "text-loss" : "text-muted-foreground") : "text-muted-foreground"}
        />
        <StatItem
          label="24h 最高"
          value={quote ? formatPrice(quote.high_price) : "—"}
          className="text-foreground"
        />
        <StatItem
          label="24h 最低"
          value={quote ? formatPrice(quote.low_price) : "—"}
          className="text-foreground"
        />
        <StatItem
          label="24h 成交量"
          value={quote ? formatVolume(quote.volume) : "—"}
          className="text-foreground"
        />
      </div>
      <div ref={chartRef} className="flex-1 min-h-0" />
    </div>
  );
}

function StatItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono ${className ?? ""}`}>{value}</span>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price >= 10000) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toFixed(0);
}
