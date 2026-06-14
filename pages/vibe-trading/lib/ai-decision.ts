import type {
  AgentInputEvent,
  AgentDecisionEvent,
  AgentErrorEvent,
} from "./types";

export interface AIDecisionOptions {
  model: string;
  strategy_name: string;
  strategy_description: string;
  risk_level: "low" | "medium" | "high";
}

const isDemo =
  !process.env.AI_API_KEY || process.env.DEMO_MODE === "true";

// Quantity multipliers based on risk level
const RISK_QTY_MULTIPLIER: Record<string, number> = {
  low: 0.05,
  medium: 0.15,
  high: 0.30,
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDemoDecision(
  input: AgentInputEvent,
  marketSummary: string,
  options: AIDecisionOptions
): AgentDecisionEvent | AgentErrorEvent {
  const ts = new Date().toISOString();

  // Weighted random action: 40% hold, 30% buy, 20% sell, 10% close
  const roll = Math.random();
  let action: AgentDecisionEvent["action"];
  if (roll < 0.4) {
    action = "hold";
  } else if (roll < 0.7) {
    action = "order"; // buy
  } else if (roll < 0.9) {
    action = "order"; // sell
  } else {
    action = "close";
  }

  const confidence = Math.round((0.3 + Math.random() * 0.6) * 100) / 100;

  // Determine reasoning based on action
  const reasonings: Record<string, string[]> = {
    hold: [
      "Market is in a consolidation phase. RSI near neutral levels suggest no clear directional bias. Waiting for a clearer signal before entering.",
      "Current volatility is low and indicators are mixed. The risk-reward ratio does not favor entering a position at this time.",
      "Price is range-bound between support and resistance. MACD histogram is flat, indicating lack of momentum. Holding until breakout confirmation.",
    ],
    order: [
      "Bullish momentum detected with RSI crossing above 50 and positive MACD histogram. EMA alignment confirms uptrend. Entering long position with defined risk parameters.",
      "Price has pulled back to the 50 EMA support level with RSI showing oversold bounce. This presents a favorable entry point with tight stop-loss.",
      "Bearish divergence on RSI combined with price rejection at upper Bollinger Band. Entering short position targeting mean reversion.",
      "Volume spike accompanied by break above resistance level. Momentum indicators confirm breakout. Taking position in direction of breakout.",
    ],
    close: [
      "Position has reached take-profit zone. RSI showing overbought/oversold conditions at extreme levels. Closing to lock in profits.",
      "Trend reversal signals detected. MACD crossover against position direction. Closing position to preserve capital.",
    ],
  };

  const reasoning = randomChoice(
    reasonings[action === "close" ? "close" : action === "hold" ? "hold" : "order"] ?? reasonings.hold
  );

  // Build key signals from market summary
  const keySignals: AgentDecisionEvent["key_signals"] = [];
  const lines = marketSummary.split("\n");
  for (const line of lines) {
    const symbolMatch = line.match(/^([^:]+):/);
    if (symbolMatch) {
      const symbol = symbolMatch[1].trim();
      const rsiMatch = line.match(/RSI=([0-9.]+)/);
      const trendMatch = line.match(/Trend=(\w+)/);
      if (rsiMatch) {
        keySignals.push({
          symbol,
          indicator: "RSI",
          value: rsiMatch[1],
          interpretation:
            parseFloat(rsiMatch[1]) > 60
              ? "Overbought zone"
              : parseFloat(rsiMatch[1]) < 40
                ? "Oversold zone"
                : "Neutral",
        });
      }
      if (trendMatch) {
        keySignals.push({
          symbol,
          indicator: "Trend",
          value: trendMatch[1],
          interpretation: `Market trending ${trendMatch[1]}`,
        });
      }
    }
  }

  // Generate orders if action is "order"
  let orders: AgentDecisionEvent["orders"] | undefined;
  if (action === "order") {
    const availableBalance = input.context.available_balance["USDT"] ?? input.context.available_balance["usdt"] ?? 0;
    const qtyMultiplier = RISK_QTY_MULTIPLIER[options.risk_level] ?? 0.1;

    // Pick a symbol from the context
    const symbols = lines.map((l) => l.match(/^([^:]+):/)?.[1]?.trim()).filter(Boolean) as string[];
    const symbol = symbols[0] ?? "BTC/USDT";

    // Get last price from market summary
    const priceMatch = lines[0]?.match(/\$([0-9.]+)/);
    const lastPrice = priceMatch ? parseFloat(priceMatch[1]) : 67000;

    // Determine buy or sell based on the random roll
    const side: "buy" | "sell" = roll < 0.7 ? "buy" : "sell";

    // Calculate quantity
    const orderValue = availableBalance * qtyMultiplier;
    const quantity =
      lastPrice > 0
        ? Math.round((orderValue / lastPrice) * 100000) / 100000
        : 0;

    if (quantity > 0) {
      orders = [
        {
          symbol,
          side,
          type: "market" as const,
          quantity,
          stop_loss:
            side === "buy"
              ? Math.round(lastPrice * 0.97 * 100) / 100
              : Math.round(lastPrice * 1.03 * 100) / 100,
          take_profit:
            side === "buy"
              ? Math.round(lastPrice * 1.05 * 100) / 100
              : Math.round(lastPrice * 0.95 * 100) / 100,
        },
      ];
    } else {
      // Insufficient balance to place an order, convert to hold
      action = "hold";
      orders = undefined;
    }
  }

  // For close action, generate close orders for existing positions
  if (action === "close" && input.context.current_positions.length > 0) {
    orders = input.context.current_positions.map((pos) => ({
      symbol: pos.symbol,
      side: (pos.side === "long" ? "sell" : "buy") as "buy" | "sell",
      type: "market" as const,
      quantity: pos.quantity,
    }));
  } else if (action === "close" && input.context.current_positions.length === 0) {
    // No positions to close, convert to hold
    action = "hold";
  }

  return {
    type: "agent_decision",
    ts,
    cycle: input.cycle,
    agent_session_id: input.agent_session_id,
    action,
    orders,
    reasoning,
    thinking_summary: `Analyzed ${lines.length} symbols. Confidence: ${(confidence * 100).toFixed(0)}%.`,
    confidence,
    key_signals: keySignals.length > 0 ? keySignals : undefined,
  };
}

// TODO: Implement live AI integration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function callLiveAI(
  _input: AgentInputEvent,
  _marketSummary: string,
  _options: AIDecisionOptions
): Promise<AgentDecisionEvent | AgentErrorEvent> {
  // Placeholder for live AI API call (e.g., Anthropic, OpenAI)
  // Implementation would:
  // 1. Build structured prompt with market context and positions
  // 2. Call AI API with JSON response format
  // 3. Parse response into AgentDecisionEvent
  // 4. Handle errors (timeout, quota, etc.)
  throw new Error("Live AI integration not yet implemented. Set DEMO_MODE=true.");
}

export async function getAIDecision(
  input: AgentInputEvent,
  marketSummary: string,
  options: AIDecisionOptions
): Promise<AgentDecisionEvent | AgentErrorEvent> {
  if (isDemo) {
    // Small delay to simulate API call latency
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
    return generateDemoDecision(input, marketSummary, options);
  }

  try {
    return await callLiveAI(input, marketSummary, options);
  } catch (error) {
    const ts = new Date().toISOString();
    return {
      type: "agent_error",
      ts,
      cycle: input.cycle,
      agent_session_id: input.agent_session_id,
      error: error instanceof Error ? error.message : "Unknown AI error",
      error_code: "api_error",
    };
  }
}
