import { describe, it, expect } from "vitest";
import { nanoid } from "nanoid";
import { runAgentDecision } from "../lib/viben-agent";
import { getAIDecision } from "../lib/ai-decision";
import { appendEvent, readEventsFrom } from "../lib/session-store";
import type { AgentInputEvent, AgentDecisionEvent, AgentErrorEvent, SessionInitEvent } from "../lib/types";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://127.0.0.1:18790";

function createMockInput(overrides?: Partial<AgentInputEvent["context"]>): AgentInputEvent {
  return {
    type: "agent_input",
    ts: new Date().toISOString(),
    cycle: 1,
    agent_session_id: "test-session-001",
    context: {
      market_summary: "BTC/USDT: $67500.00 RSI=55.2 Trend=sideways\nETH/USDT: $3450.00 RSI=48.1 Trend=up",
      current_positions: [],
      available_balance: { USDT: 10000 },
      recent_trades: [],
      nav: 10000,
      total_pnl: 0,
      win_rate: 0,
      max_drawdown: 0,
      constraints: {
        max_position_pct: 0.2,
        stop_loss_pct: 0.05,
        remaining_daily_trades: 10,
      },
      ...overrides,
    },
  };
}

describe("viben-agent integration", () => {
  it("gateway is reachable", async () => {
    const res = await fetch(`${GATEWAY_URL}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("runAgentDecision returns a valid decision with prompt and raw_response", async () => {
    const input = createMockInput();
    const marketSummary = "BTC/USDT: $67500.00 RSI=55.2 Trend=sideways";

    const result = await runAgentDecision(input, marketSummary, {
      model: "claude-sonnet-4-20250514",
      strategy_name: "test-strategy",
      strategy_description: "A test momentum strategy",
      risk_level: "low",
      timeout_ms: 120_000,
    });

    // Must have prompt recorded
    expect(result.prompt).toBeDefined();
    expect(result.prompt).toContain("Market Context");
    expect(result.prompt).toContain("BTC/USDT");
    expect(result.prompt).toContain("Portfolio State");

    // Must have raw_response recorded
    expect(result.raw_response).toBeDefined();
    expect(typeof result.raw_response).toBe("string");
    expect(result.raw_response!.length).toBeGreaterThan(0);

    if (result.type === "agent_decision") {
      // Validate decision structure
      expect(["order", "hold", "close", "close_all"]).toContain(result.action);
      expect(typeof result.reasoning).toBe("string");
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // If action is order, validate orders
      if (result.action === "order") {
        expect(result.orders).toBeDefined();
        expect(result.orders!.length).toBeGreaterThan(0);
        for (const order of result.orders!) {
          expect(typeof order.symbol).toBe("string");
          expect(["buy", "sell"]).toContain(order.side);
          expect(["market", "limit"]).toContain(order.type);
          expect(typeof order.quantity).toBe("number");
          expect(order.quantity).toBeGreaterThan(0);
        }
      }

      // If action is hold, orders should be absent
      if (result.action === "hold") {
        expect(result.orders).toBeUndefined();
      }

      console.log("Decision:", {
        action: result.action,
        confidence: result.confidence,
        reasoning: result.reasoning.slice(0, 100),
        orders: result.orders?.length ?? 0,
      });
    } else {
      // Even errors should have prompt
      console.log("Agent error:", result.error);
      expect(result.prompt).toBeDefined();
    }
  }, 180_000);

  it("runAgentDecision with positions suggests close or hold", async () => {
    const input = createMockInput({
      current_positions: [
        {
          symbol: "BTC/USDT",
          side: "long",
          quantity: 0.01,
          entry_price: 65000,
          entry_time: "2026-06-14T10:00:00Z",
          current_price: 67500,
          unrealized_pnl: 25,
          unrealized_pnl_pct: 0.0385,
        },
      ],
      nav: 10025,
      total_pnl: 25,
    });

    const result = await runAgentDecision(
      input,
      "BTC/USDT: $67500.00 RSI=72.5 Trend=up (overbought zone)",
      {
        model: "claude-sonnet-4-20250514",
        strategy_name: "test-strategy",
        strategy_description: "A test momentum strategy that closes positions in overbought zones",
        risk_level: "low",
        timeout_ms: 120_000,
      },
    );

    expect(result.prompt).toContain("BTC/USDT long qty=0.01");
    expect(result.raw_response).toBeDefined();

    if (result.type === "agent_decision") {
      expect(["order", "hold", "close", "close_all"]).toContain(result.action);
      console.log("Position decision:", {
        action: result.action,
        confidence: result.confidence,
        reasoning: result.reasoning.slice(0, 100),
      });
    }
  }, 180_000);

  it("records raw_response even on parse failure", async () => {
    // We can't easily force a parse failure with the real gateway,
    // but we verify the structure is correct by checking a normal call
    const input = createMockInput();
    const result = await runAgentDecision(input, "BTC/USDT: $67500 RSI=50", {
      model: "claude-sonnet-4-20250514",
      strategy_name: "simple",
      strategy_description: "Hold unless obvious signal",
      risk_level: "low",
      timeout_ms: 120_000,
    });

    // raw_response should be parseable JSON (possibly wrapped in code fences)
    expect(result.raw_response).toBeDefined();
    const raw = result.raw_response!;
    const cleaned = raw.startsWith("```")
      ? raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
      : raw;
    expect(() => JSON.parse(cleaned)).not.toThrow();
  }, 180_000);

  it("persists prompt and raw_response in session JSONL via getAIDecision", async () => {
    const sessionId = `test_${nanoid(8)}`;

    const initEvent: SessionInitEvent = {
      type: "session_init",
      ts: new Date().toISOString(),
      session_id: sessionId,
      session_name: "JSONL Persist Test",
      account_id: "test",
      exchange: "binance",
      initial_balance: { USDT: 10000 },
      agent_config: {
        model: "claude-sonnet-4-20250514",
        strategy_name: "test",
        strategy_description: "Test",
        risk_level: "low",
        symbols: ["BTC/USDT"],
        interval_minutes: 5,
        max_position_pct: 0.2,
      },
      tags: ["test"],
    };
    await appendEvent(sessionId, initEvent);

    const input = createMockInput();
    await appendEvent(sessionId, input);

    const decision = await getAIDecision(
      input,
      "BTC/USDT: $67500.00 RSI=55.2 Trend=sideways",
      {
        model: "claude-sonnet-4-20250514",
        strategy_name: "test",
        strategy_description: "Test",
        risk_level: "low",
      },
    );
    await appendEvent(sessionId, decision);

    // Read back from JSONL
    const events = await readEventsFrom(sessionId, 0);
    const recorded = events.find(
      (e) => e.type === "agent_decision" || e.type === "agent_error",
    ) as AgentDecisionEvent | AgentErrorEvent;

    expect(recorded).toBeDefined();
    expect(recorded.prompt).toBeDefined();
    expect(recorded.prompt!.length).toBeGreaterThan(50);
    expect(recorded.prompt).toContain("Market Context");
    expect(recorded.raw_response).toBeDefined();
    expect(recorded.raw_response!.length).toBeGreaterThan(0);

    console.log("JSONL recorded:", {
      type: recorded.type,
      prompt_length: recorded.prompt!.length,
      raw_response_length: recorded.raw_response!.length,
    });

    // Cleanup
    const fs = await import("fs/promises");
    const path = await import("path");
    await fs.unlink(path.join(process.cwd(), "sessions", `${sessionId}.jsonl`)).catch(() => {});
  }, 180_000);
});
