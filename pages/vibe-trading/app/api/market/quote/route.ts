import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols")?.split(",") ?? [];
  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      const binanceSymbol = symbol.replace("/", "");
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
      try {
        const res = await proxyFetch(url);
        if (!res.ok) return null;
        const data = await res.json() as Record<string, string>;
        return {
          symbol,
          last_price: parseFloat(data.lastPrice),
          open_price: parseFloat(data.openPrice),
          high_price: parseFloat(data.highPrice),
          low_price: parseFloat(data.lowPrice),
          prev_close: parseFloat(data.prevClosePrice),
          change: parseFloat(data.priceChange),
          change_pct: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          turnover: parseFloat(data.quoteVolume),
          turnover_rate: 0,
          amplitude: ((parseFloat(data.highPrice) - parseFloat(data.lowPrice)) / parseFloat(data.prevClosePrice)) * 100,
        };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json({ quotes: quotes.filter(Boolean) });
}
