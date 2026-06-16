import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/exchanges/proxy-fetch";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://127.0.0.1:18790";

const SYSTEM_PROMPT = `你是一个自选股助手。根据用户的描述和需求，返回一组交易对代码列表。

规则：
- 只返回 JSON 数组，不要多余文字
- 格式：["BTCUSDT", "ETHUSDT", ...]
- 代码使用 Binance 永续合约的格式（大写，以 USDT 结尾）
- 只返回你确定存在的交易对
- 数量通常 5-20 个`;

export async function POST(req: Request) {
  const body = await req.json() as { prompt: string; list_id: string; workspace_path?: string };
  const { prompt, list_id, workspace_path } = body;

  if (!prompt || !list_id) {
    return NextResponse.json({ error: "prompt and list_id required" }, { status: 400 });
  }

  try {
    const response = await proxyFetch(`${GATEWAY_URL}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        prompt,
        agent_config: {
          name: "watchlist-refresh",
          system_prompt: SYSTEM_PROMPT,
          temperature: 0.3,
          max_tokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      return NextResponse.json({ error: `Gateway error: ${response.status} ${errText}` }, { status: 502 });
    }

    const sseText = await response.text();
    let accumulatedText = "";

    for (const line of sseText.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed.startsWith("data: ")) continue;
      const json = trimmed.slice(6);
      if (!json) continue;
      try {
        const evt = JSON.parse(json);
        if (evt.type === "text" && typeof evt.content === "string") {
          accumulatedText += evt.content;
        }
      } catch { /* skip malformed lines */ }
    }

    const symbols = parseSymbols(accumulatedText);

    if (symbols.length === 0) {
      return NextResponse.json({ error: "Agent did not return valid symbols", raw: accumulatedText }, { status: 422 });
    }

    const patchRes = await fetch(
      `${req.url.replace("/refresh", "")}/${list_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_symbols", symbols, workspace_path }),
      }
    );
    const patchData = await patchRes.json();

    return NextResponse.json({ symbols, list: patchData.list });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function parseSymbols(text: string): string[] {
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string" && s.length > 0).map((s) => s.toUpperCase());
    }
  } catch { /* not raw JSON, try regex */ }

  const matches = cleaned.match(/[A-Z0-9]{2,}USDT/g);
  return matches ? [...new Set(matches)] : [];
}
