"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MarketQuote } from "@/lib/types";

interface UseMarketQuoteOptions {
  symbols: string[];
  interval?: number;
  enabled?: boolean;
}

const quoteCache = new Map<string, { data: MarketQuote; ts: number }>();
const CACHE_TTL = 3000;

export function useMarketQuote({ symbols, interval = 5000, enabled = true }: UseMarketQuoteOptions) {
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return;

    const now = Date.now();
    const stale = symbols.filter((s) => {
      const cached = quoteCache.get(s);
      return !cached || now - cached.ts > CACHE_TTL;
    });

    if (stale.length === 0) {
      const cached = new Map<string, MarketQuote>();
      symbols.forEach((s) => {
        const c = quoteCache.get(s);
        if (c) cached.set(s, c.data);
      });
      setQuotes(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/market/quote?symbols=${stale.join(",")}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { quotes: MarketQuote[] };

      const updatedTs = Date.now();
      for (const q of data.quotes) {
        quoteCache.set(q.symbol, { data: q, ts: updatedTs });
      }

      const all = new Map<string, MarketQuote>();
      symbols.forEach((s) => {
        const c = quoteCache.get(s);
        if (c) all.set(s, c.data);
      });
      setQuotes(all);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    if (!enabled || symbols.length === 0) return;
    fetchQuotes();
    timerRef.current = setInterval(fetchQuotes, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, symbols, interval, fetchQuotes]);

  return { quotes, loading, error, refresh: fetchQuotes };
}
