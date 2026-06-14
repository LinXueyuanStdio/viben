"use client";

import { useEffect, useRef, useState } from "react";
import type { ExchangeId, NavPoint } from "@/lib/types";
import { toTradingViewSymbol } from "@/lib/tradingview";
import { NavChart } from "./nav-chart";
import { useSessionState } from "@/app/context/session-state-context";

interface ChartAreaProps {
  sessionId: string;
  symbols: string[];
  exchange: ExchangeId;
  navHistory: NavPoint[];
  initialNav: number;
}

export function ChartArea({ sessionId, symbols, exchange, navHistory: propNavHistory, initialNav: propInitialNav }: ChartAreaProps) {
  const { state } = useSessionState();
  const navHistory = state.nav_history.length > 0 ? state.nav_history : propNavHistory;
  const initialNav = Object.keys(state.initial_balance).length > 0
    ? Object.values(state.initial_balance).reduce((s, v) => s + v, 0)
    : propInitialNav;
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"kline" | "nav">("kline");
  const [selectedSymbol, setSelectedSymbol] = useState((symbols ?? [])[0] ?? "BTCUSDT");

  useEffect(() => {
    if (activeTab !== "kline" || !containerRef.current) return;

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
  }, [activeTab, selectedSymbol, exchange]);

  return (
    <div className="flex-1 min-h-0 flex flex-col border-b border-slate-200">
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("kline")}
            className={`text-sm pb-1 ${activeTab === "kline" ? "text-primary border-b-2 border-primary font-medium" : "text-slate-500"}`}
          >
            行情图表
          </button>
          <button
            onClick={() => setActiveTab("nav")}
            className={`text-sm pb-1 ${activeTab === "nav" ? "text-primary border-b-2 border-primary font-medium" : "text-slate-500"}`}
          >
            净值曲线
          </button>
        </div>
        {activeTab === "kline" && symbols.length > 1 && (
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {activeTab === "kline" ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <NavChart navHistory={navHistory} initialNav={initialNav} />
        )}
      </div>
    </div>
  );
}
