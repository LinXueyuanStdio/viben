"use client";

import { useEffect, useRef, useState } from "react";
import type { ExchangeId, NavPoint } from "@/lib/types";
import { toTradingViewSymbol } from "@/lib/tradingview";
import { NavChart } from "./nav-chart";
import dynamic from "next/dynamic";
import { Leaderboard } from "./leaderboard/leaderboard";
import { Watchlist } from "./watchlist/watchlist";
import { SymbolDetail } from "./symbol-detail";

const ReplayKlineChart = dynamic(() => import("./replay-kline-chart"), { ssr: false });
import { useSessionState } from "@/app/context/session-state-context";

type ChartTab = "kline" | "nav" | "leaderboard" | "watchlist" | "detail";

interface ChartAreaProps {
  sessionId: string;
  symbols: string[];
  exchange: ExchangeId;
  navHistory: NavPoint[];
  initialNav: number;
  workspacePath?: string;
}

export function ChartArea({ sessionId, symbols, exchange, navHistory: propNavHistory, initialNav: propInitialNav, workspacePath }: ChartAreaProps) {
  const { state, mode } = useSessionState();
  const navHistory = state.nav_history.length > 0 ? state.nav_history : propNavHistory;
  const initialNav = Object.keys(state.initial_balance).length > 0
    ? Object.values(state.initial_balance).reduce((s, v) => s + v, 0)
    : propInitialNav;
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>("kline");
  const [selectedSymbol, setSelectedSymbol] = useState((symbols ?? [])[0] ?? "BTCUSDT");

  useEffect(() => {
    if (activeTab !== "kline" || mode === "replay" || !containerRef.current) return;

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTradingViewSymbol(exchange, selectedSymbol),
      interval: "60",
      timezone: "Asia/Shanghai",
      theme: "light",
      style: "1",
      locale: "zh_CN",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
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
    containerRef.current.appendChild(wrapper);
  }, [activeTab, selectedSymbol, exchange, mode]);

  const tabs: { key: ChartTab; label: string }[] = [
    { key: "kline", label: "行情图表" },
    { key: "nav", label: "净值曲线" },
    { key: "leaderboard", label: "榜单" },
    { key: "watchlist", label: "自选" },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-border">
      <div className="flex items-center justify-between px-6 py-2 border-b border-border">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-sm pb-1 ${activeTab === tab.key ? "text-primary border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
            >
              {tab.label}
            </button>
          ))}
          {activeTab === "detail" && (
            <span className="flex items-center gap-1.5 text-sm pb-1 text-primary border-b-2 border-primary font-medium">
              {selectedSymbol}
              <button
                onClick={() => setActiveTab("watchlist")}
                className="ml-1 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
        </div>
        {activeTab === "kline" && symbols.length > 1 && (
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="text-sm border border-border rounded px-2 py-1"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {activeTab === "kline" ? (
          mode === "replay" ? (
            <ReplayKlineChart symbol={selectedSymbol} />
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )
        ) : activeTab === "nav" ? (
          <NavChart navHistory={navHistory} initialNav={initialNav} />
        ) : activeTab === "leaderboard" ? (
          <Leaderboard />
        ) : activeTab === "detail" ? (
          <SymbolDetail symbol={selectedSymbol} exchange={exchange} />
        ) : (
          <Watchlist
            workspacePath={workspacePath}
            onSymbolClick={(sym) => { setSelectedSymbol(sym); setActiveTab("detail"); }}
          />
        )}
      </div>
    </div>
  );
}
