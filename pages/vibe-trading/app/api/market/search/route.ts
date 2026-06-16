import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";

interface BinanceSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

let symbolCache: BinanceSymbolInfo[] = [];
let cacheTime = 0;

async function getSymbolList(): Promise<BinanceSymbolInfo[]> {
  if (symbolCache.length > 0 && Date.now() - cacheTime < 3600_000) {
    return symbolCache;
  }
  const res = await proxyFetch("https://api.binance.com/api/v3/exchangeInfo");
  if (!res.ok) return symbolCache;
  const data = await res.json() as { symbols: BinanceSymbolInfo[] };
  symbolCache = data.symbols.filter((s) => s.status === "TRADING");
  cacheTime = Date.now();
  return symbolCache;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").toUpperCase();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const symbols = await getSymbolList();
  const results = symbols
    .filter((s) => s.symbol.includes(q) || s.baseAsset.includes(q))
    .slice(0, 20)
    .map((s) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));

  return NextResponse.json({ results });
}
