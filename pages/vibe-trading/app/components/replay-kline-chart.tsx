"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  CrosshairMode,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  IPriceLine,
  ISeriesMarkersPluginApi,
  Time,
} from "lightweight-charts";
import { useSessionState } from "@/app/context/session-state-context";
import { getReplayCandles, buildTradeMarkers, buildPriceLines } from "@/app/lib/replay-klines";

interface ReplayKlineChartProps {
  symbol: string;
}

function ReplayKlineChartInner({ symbol }: ReplayKlineChartProps) {
  const { state, replay, allEvents } = useSessionState();
  const { currentIndex } = replay;

  const { candles, intervalMs } = useMemo(
    () => getReplayCandles(allEvents, symbol, currentIndex),
    [allEvents, symbol, currentIndex],
  );

  const cutoffTs = allEvents[currentIndex]?.ts ?? "";

  const markers = useMemo(
    () => buildTradeMarkers(state.trades, symbol, cutoffTs, intervalMs),
    [state.trades, symbol, cutoffTs, intervalMs],
  );

  const priceLineConfigs = useMemo(
    () => buildPriceLines(state.positions, symbol),
    [state.positions, symbol],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const hasFittedRef = useRef(false);
  const prevSymbolRef = useRef(symbol);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "#ffffff" }, textColor: "#64748b" },
      grid: { vertLines: { color: "#f1f5f9" }, horzLines: { color: "#f1f5f9" } },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: "#e2e8f0" },
      timeScale: { borderColor: "#e2e8f0", timeVisible: true, secondsVisible: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    const markersPlugin = createSeriesMarkers(series);

    chartRef.current = chart;
    seriesRef.current = series;
    markersPluginRef.current = markersPlugin;

    return () => {
      markersPlugin.detach();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersPluginRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(candles);

    const symbolChanged = prevSymbolRef.current !== symbol;
    if (symbolChanged) {
      prevSymbolRef.current = symbol;
      hasFittedRef.current = false;
    }

    if (!hasFittedRef.current && chartRef.current) {
      chartRef.current.timeScale().fitContent();
      hasFittedRef.current = true;
    }
  }, [candles, symbol]);

  useEffect(() => {
    if (!markersPluginRef.current) return;
    markersPluginRef.current.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    if (!seriesRef.current) return;

    for (const line of priceLinesRef.current) {
      seriesRef.current.removePriceLine(line);
    }
    priceLinesRef.current = [];

    for (const cfg of priceLineConfigs) {
      const line = seriesRef.current.createPriceLine({
        price: cfg.price,
        color: cfg.color,
        lineStyle: cfg.lineStyle,
        lineWidth: cfg.lineWidth as 1 | 2 | 3 | 4,
        title: cfg.title,
        axisLabelVisible: cfg.axisLabelVisible,
      });
      priceLinesRef.current.push(line);
    }
  }, [priceLineConfigs]);

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm bg-card/80">
          暂无行情数据
        </div>
      )}
    </div>
  );
}

export default ReplayKlineChartInner;
