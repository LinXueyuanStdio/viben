"use client";

import { useState, useEffect } from "react";
import type { MarketQuote, OHLCV } from "@/lib/types";
import { COLUMN_DEFINITIONS, type WatchlistColumnKey } from "./types";
import { MiniKline } from "../ui/mini-kline";
import { IconSearchPlus, IconPlus } from "./icons";

const COLUMN_TO_QUOTE_KEY: Partial<Record<WatchlistColumnKey, keyof MarketQuote>> = {
  lastPrice: "last_price",
  openPrice: "open_price",
  highPrice: "high_price",
  lowPrice: "low_price",
  prevClose: "prev_close",
  changePct: "change_pct",
  change: "change",
  volume: "volume",
  turnover: "turnover",
  turnoverRate: "turnover_rate",
  amplitude: "amplitude",
};

interface WatchlistTableProps {
  symbols: Array<{ symbol: string; annotation: string }>;
  quotes: Map<string, MarketQuote>;
  columns: WatchlistColumnKey[];
  onAddSymbols?: (symbols: string[]) => void;
  onSymbolClick?: (symbol: string) => void;
}

export function WatchlistTable({ symbols, quotes, columns, onAddSymbols, onSymbolClick }: WatchlistTableProps) {
  const [klineCache, setKlineCache] = useState<Map<string, OHLCV[]>>(new Map());

  const showKline = columns.includes("miniKline");

  useEffect(() => {
    if (!showKline) return;
    const toFetch = symbols
      .map((s) => s.symbol)
      .filter((sym) => !klineCache.has(sym));
    if (toFetch.length === 0) return;

    Promise.all(
      toFetch.map(async (sym) => {
        try {
          const res = await fetch(`/api/market/kline?symbol=${sym}&interval=1d&limit=30`);
          const data = await res.json() as { klines: OHLCV[] };
          return { sym, klines: data.klines };
        } catch {
          return { sym, klines: [] as OHLCV[] };
        }
      })
    ).then((results) => {
      setKlineCache((prev) => {
        const next = new Map(prev);
        for (const { sym, klines } of results) {
          next.set(sym, klines);
        }
        return next;
      });
    });
  }, [symbols, showKline, klineCache]);

  const visibleCols = COLUMN_DEFINITIONS.filter((c) => columns.includes(c.key));

  function formatCell(key: WatchlistColumnKey, quote: MarketQuote | undefined, entry: { symbol: string; annotation: string }): React.ReactNode {
    if (key === "symbol") return <span className="font-mono font-medium text-foreground">{entry.symbol}</span>;
    if (key === "name") return <span className="text-foreground">{entry.symbol}</span>;
    if (key === "annotation") return <span className="text-muted-foreground truncate max-w-[180px] inline-block">{entry.annotation || <span className="text-muted-foreground/40">—</span>}</span>;
    if (key === "miniKline") {
      const klines = klineCache.get(entry.symbol);
      if (!klines || klines.length === 0) return <span className="text-muted-foreground/40">—</span>;
      return <MiniKline data={klines} width={70} height={20} />;
    }
    if (!quote) return <span className="text-muted-foreground/40">—</span>;

    const quoteKey = COLUMN_TO_QUOTE_KEY[key];
    const value = quoteKey ? quote[quoteKey] : quote[key as keyof MarketQuote];
    if (value === undefined || value === null) return <span className="text-muted-foreground/40">—</span>;

    const col = COLUMN_DEFINITIONS.find((c) => c.key === key);
    if (!col) return String(value);

    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);

    switch (col.render) {
      case "percent": {
        const cls = num > 0 ? "text-gain" : num < 0 ? "text-loss" : "text-muted-foreground";
        return <span className={cls}>{num > 0 ? "+" : ""}{num.toFixed(2)}%</span>;
      }
      case "currency":
        return <span className="text-foreground">{num >= 10000 ? `${(num / 10000).toFixed(2)}万` : num.toFixed(2)}</span>;
      case "number":
        return <span className="text-muted-foreground">{num >= 1_000_000 ? `${(num / 1_000_000).toFixed(2)}M` : num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toFixed(2)}</span>;
      default:
        return String(value);
    }
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm border-b border-border z-10">
          <tr>
            {visibleCols.map((col) => (
              <th key={col.key} className={`px-3 py-2 font-medium text-muted-foreground whitespace-nowrap text-${col.align} uppercase tracking-wider`} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((entry, i) => {
            const quote = quotes.get(entry.symbol);
            return (
              <tr
                key={entry.symbol}
                onClick={() => onSymbolClick?.(entry.symbol)}
                className={`border-b border-border/50 hover:bg-accent/10 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-card" : "bg-muted/50"}`}
              >
                {visibleCols.map((col) => (
                  <td key={col.key} className={`px-3 py-2 whitespace-nowrap text-${col.align}`}>
                    {formatCell(col.key, quote, entry)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {symbols.length === 0 && (
        <EmptyState onAddSymbols={onAddSymbols} />
      )}
    </div>
  );
}

function EmptyState({ onAddSymbols }: { onAddSymbols?: (symbols: string[]) => void }) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const symbols = input
      .split(/[,，\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length > 0 && onAddSymbols) {
      onAddSymbols(symbols);
      setInput("");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <IconSearchPlus size={24} className="text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">暂无标的</p>
      {onAddSymbols && (
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            placeholder="输入标的，如 BTCUSDT, ETHUSDT"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <IconPlus size={10} />
            添加
          </button>
        </div>
      )}
      <p className="text-xs text-muted-foreground/60">也可让 AI 帮你添加</p>
    </div>
  );
}
