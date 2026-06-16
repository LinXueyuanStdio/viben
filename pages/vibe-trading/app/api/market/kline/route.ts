import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";
import type { OHLCV } from "@/lib/types";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10);

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const binanceSymbol = symbol.replace("/", "");
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

  try {
    const res = await proxyFetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Binance API error: ${res.status}` }, { status: 502 });
    }
    const data: unknown[] = await res.json();
    const klines: OHLCV[] = data.map((k) => {
      const row = k as [number, string, string, string, string, string, ...unknown[]];
      return {
        ts: new Date(row[0]).toISOString(),
        o: parseFloat(row[1]),
        h: parseFloat(row[2]),
        l: parseFloat(row[3]),
        c: parseFloat(row[4]),
        v: parseFloat(row[5]),
      };
    });
    return NextResponse.json({ klines });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
