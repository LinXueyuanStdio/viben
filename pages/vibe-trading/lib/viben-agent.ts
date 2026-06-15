import type { AgentDecisionEvent, AgentErrorEvent, AgentInputEvent } from "./types";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://127.0.0.1:18790";

interface AgentRunRequest {
  prompt: string;
  agent_config?: {
    name?: string;
    model?: string;
    provider?: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
  };
}

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export interface AgentRunOptions {
  model: string;
  strategy_name: string;
  strategy_description: string;
  risk_level: "low" | "medium" | "high";
  timeout_ms?: number; // default 120_000
}

export interface AgentRunResult {
  decision: AgentDecisionEvent | AgentErrorEvent;
  sdk_session_id?: string;
}

const TRADING_SYSTEM_PROMPT = `You are a quantitative trading agent. You analyze market data and portfolio state, then output a trading decision in strict JSON format.

Your response MUST be valid JSON matching this schema:
{
  "action": "order" | "hold" | "close" | "close_all",
  "orders": [{ "symbol": string, "side": "buy"|"sell", "type": "market"|"limit", "quantity": number, "price?": number, "stop_loss?": number, "take_profit?": number }],
  "reasoning": string,
  "thinking_summary": string,
  "confidence": number (0-1),
  "key_signals": [{ "symbol": string, "indicator": string, "value": string, "interpretation": string }]
}

Rules:
- "orders" is required when action is "order" or "close", omit for "hold" or "close_all"
- "confidence" is between 0 and 1
- "reasoning" should explain your analysis (2-4 sentences)
- "thinking_summary" is a brief one-liner
- Respond ONLY with the JSON object, no markdown fences or extra text
- NEVER ask questions or request clarification. Always produce a decision.`;

function buildPrompt(input: AgentInputEvent, marketSummary: string, options: AgentRunOptions): string {
  const { context } = input;
  return `## Market Context
${marketSummary}

## Portfolio State
- NAV: $${context.nav.toFixed(2)}
- Total PnL: $${context.total_pnl.toFixed(2)}
- Win Rate: ${(context.win_rate * 100).toFixed(1)}%
- Max Drawdown: ${(context.max_drawdown * 100).toFixed(1)}%
- Available Balance: ${JSON.stringify(context.available_balance)}

## Current Positions
${context.current_positions.length === 0 ? "None" : context.current_positions.map((p) => `- ${p.symbol} ${p.side} qty=${p.quantity} entry=$${p.entry_price} pnl=${p.unrealized_pnl_pct?.toFixed(2) ?? "?"}%`).join("\n")}

## Recent Trades (last 5)
${context.recent_trades.length === 0 ? "None" : context.recent_trades.slice(-5).map((t) => `- ${t.ts} ${t.symbol} ${t.side} qty=${t.quantity} @ $${t.price}`).join("\n")}

## Constraints
- Risk Level: ${options.risk_level}
- Max Position: ${(context.constraints.max_position_pct * 100).toFixed(0)}% of portfolio
${context.constraints.stop_loss_pct ? `- Stop Loss: ${(context.constraints.stop_loss_pct * 100).toFixed(1)}%` : ""}
${context.constraints.remaining_daily_trades != null ? `- Remaining Daily Trades: ${context.constraints.remaining_daily_trades}` : ""}

## Strategy
Name: ${options.strategy_name}
Description: ${options.strategy_description}

Analyze the above and output your trading decision as JSON.`;
}

function parseSSELine(line: string): SSEEvent | null {
  const trimmed = line.replace(/\r$/, "");
  if (!trimmed.startsWith("data: ")) return null;
  const json = trimmed.slice(6);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function runAgentDecision(
  input: AgentInputEvent,
  marketSummary: string,
  options: AgentRunOptions,
): Promise<AgentDecisionEvent | AgentErrorEvent> {
  const ts = new Date().toISOString();
  const timeout = options.timeout_ms ?? 120_000;
  const prompt = buildPrompt(input, marketSummary, options);

  const body: AgentRunRequest = {
    prompt,
    agent_config: {
      name: `trading-${options.strategy_name}`,
      model: options.model,
      system_prompt: TRADING_SYSTEM_PROMPT,
      temperature: 0.3,
      max_tokens: 2048,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}/api/agent/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return {
        type: "agent_error",
        ts,
        cycle: input.cycle,
        agent_session_id: input.agent_session_id,
        error: `Agent request timed out after ${timeout}ms`,
        error_code: "timeout",
        prompt,
      };
    }
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: `Gateway connection failed: ${err instanceof Error ? err.message : String(err)}`,
      error_code: "api_error",
      prompt,
    };
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    const errText = await response.text().catch(() => "unknown");
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: `Gateway returned ${response.status}: ${errText}`,
      error_code: "api_error",
      prompt,
    };
  }

  let accumulatedText = "";
  let sseError: string | null = null;

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const evt = parseSSELine(line);
        if (!evt) continue;

        switch (evt.type) {
          case "text":
            if (typeof evt.content === "string") {
              accumulatedText += evt.content;
            }
            break;
          case "error":
            sseError = typeof evt.message === "string" ? evt.message : "Unknown gateway error";
            break;
          case "question":
            // Agent asked a question — abort immediately since this is an automated trading loop
            sseError = "Agent unexpectedly requested user input instead of producing a decision";
            reader.cancel();
            break outer;
          case "done":
            break outer;
          case "result":
          case "session":
          case "sdk_session":
          case "tool_use":
          case "tool_result":
            break;
        }
      }
    }
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return {
        type: "agent_error",
        ts,
        cycle: input.cycle,
        agent_session_id: input.agent_session_id,
        error: `Agent streaming timed out after ${timeout}ms`,
        error_code: "timeout",
        prompt,
        raw_response: accumulatedText || undefined,
      };
    }
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: `Stream read error: ${err instanceof Error ? err.message : String(err)}`,
      error_code: "api_error",
      prompt,
      raw_response: accumulatedText || undefined,
    };
  } finally {
    clearTimeout(timer);
  }

  if (sseError) {
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: sseError,
      error_code: "api_error",
      prompt,
      raw_response: accumulatedText || undefined,
    };
  }

  const result = parseAgentResponse(accumulatedText, input, ts);
  result.prompt = prompt;
  result.raw_response = accumulatedText;
  return result;
}

function validateOrder(o: unknown): o is AgentDecisionEvent["orders"] extends Array<infer T> | undefined ? T : never {
  if (typeof o !== "object" || o === null) return false;
  const obj = o as Record<string, unknown>;
  return (
    typeof obj.symbol === "string" &&
    (obj.side === "buy" || obj.side === "sell") &&
    (obj.type === "market" || obj.type === "limit") &&
    typeof obj.quantity === "number" &&
    obj.quantity > 0
  );
}

function parseAgentResponse(
  text: string,
  input: AgentInputEvent,
  ts: string,
): AgentDecisionEvent | AgentErrorEvent {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: "Agent returned empty response",
      error_code: "api_error",
    };
  }

  // Strip markdown code fences if present
  const jsonStr = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    : trimmed;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: `Failed to parse agent response as JSON: ${trimmed.slice(0, 200)}`,
      error_code: "api_error",
    };
  }

  const action = parsed.action as string;
  if (!["order", "hold", "close", "close_all"].includes(action)) {
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: `Invalid action "${action}" from agent`,
      error_code: "api_error",
    };
  }

  // Validate orders when action requires them
  let orders: AgentDecisionEvent["orders"] | undefined;
  if (action === "order" || action === "close") {
    if (!Array.isArray(parsed.orders) || parsed.orders.length === 0) {
      return {
        type: "agent_error",
        ts,
        cycle: input.cycle,
        agent_session_id: input.agent_session_id,
        error: `Action "${action}" requires non-empty orders array`,
        error_code: "api_error",
      };
    }
    const validOrders = parsed.orders.filter(validateOrder);
    if (validOrders.length === 0) {
      return {
        type: "agent_error",
        ts,
        cycle: input.cycle,
        agent_session_id: input.agent_session_id,
        error: `All orders from agent failed validation (missing symbol/side/type/quantity)`,
        error_code: "api_error",
      };
    }
    orders = validOrders.map((o) => {
      const obj = o as Record<string, unknown>;
      return {
        symbol: obj.symbol as string,
        side: obj.side as "buy" | "sell",
        type: obj.type as "market" | "limit",
        quantity: obj.quantity as number,
        price: typeof obj.price === "number" ? obj.price : undefined,
        stop_loss: typeof obj.stop_loss === "number" ? obj.stop_loss : undefined,
        take_profit: typeof obj.take_profit === "number" ? obj.take_profit : undefined,
      };
    });
  } else {
    // hold / close_all — orders should be absent
    orders = undefined;
  }

  return {
    type: "agent_decision",
    ts,
    cycle: input.cycle,
    agent_session_id: input.agent_session_id,
    action: action as AgentDecisionEvent["action"],
    orders,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided",
    thinking_summary: typeof parsed.thinking_summary === "string" ? parsed.thinking_summary : undefined,
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
    key_signals: Array.isArray(parsed.key_signals) ? parsed.key_signals.filter(
      (s): s is NonNullable<AgentDecisionEvent["key_signals"]>[number] =>
        typeof s === "object" && s !== null &&
        typeof (s as Record<string, unknown>).symbol === "string" &&
        typeof (s as Record<string, unknown>).indicator === "string" &&
        typeof (s as Record<string, unknown>).value === "string" &&
        typeof (s as Record<string, unknown>).interpretation === "string"
    ) : undefined,
  };
}
