import type { Credentials, Exchange, OrderParams, OrderResponse, BalanceInfo } from "./types";
import type { Position } from "../types";

/**
 * In-memory simulated balance store, keyed by api_key.
 * Each demo account starts with 10000 USDT.
 */
const balanceStore = new Map<string, Record<string, number>>();

function getOrInitBalance(apiKey: string): Record<string, number> {
  if (!balanceStore.has(apiKey)) {
    balanceStore.set(apiKey, { USDT: 10000 });
  }
  return balanceStore.get(apiKey)!;
}

/**
 * Simulated positions store, keyed by api_key.
 */
const positionStore = new Map<string, Position[]>();

function getPositions(apiKey: string): Position[] {
  if (!positionStore.has(apiKey)) {
    positionStore.set(apiKey, []);
  }
  return positionStore.get(apiKey)!;
}

/**
 * Simulate random delay between 50-200ms.
 */
function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * 150) + 50;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulate slippage between 0.01% and 0.05%.
 */
function applySlippage(price: number, side: "buy" | "sell"): number {
  const slippagePct = 0.0001 + Math.random() * 0.0004; // 0.01% to 0.05%
  return side === "buy" ? price * (1 + slippagePct) : price * (1 - slippagePct);
}

/**
 * Simulate fee: 0.1% (maker/taker).
 */
function calculateFee(quantity: number, price: number): number {
  return quantity * price * 0.001;
}

let orderCounter = 1;

export const binanceDemo: Exchange = {
  id: "binance",
  name: "Binance (Demo)",

  async placeOrder(creds: Credentials, params: OrderParams): Promise<OrderResponse> {
    await randomDelay();

    const balances = getOrInitBalance(creds.api_key);
    const positions = getPositions(creds.api_key);

    // Determine if order fills
    // Market orders always fill; limit orders have 80% probability
    const isFilled = params.type === "market" || Math.random() < 0.8;

    if (!isFilled) {
      return {
        order_id: `demo_${orderCounter++}`,
        status: "expired",
        filled_price: 0,
        filled_quantity: 0,
        fee: 0,
        fee_asset: "USDT",
        error: "Limit order not filled (simulated)",
      };
    }

    // Simulate a base price (use provided price or generate one)
    const basePrice = params.price ?? 100; // fallback for market orders
    const filledPrice = applySlippage(basePrice, params.side);
    const fee = calculateFee(params.quantity, filledPrice);
    const cost = params.quantity * filledPrice;

    if (params.side === "buy") {
      const totalCost = cost + fee;
      if ((balances.USDT ?? 0) < totalCost) {
        return {
          order_id: `demo_${orderCounter++}`,
          status: "rejected",
          filled_price: 0,
          filled_quantity: 0,
          fee: 0,
          fee_asset: "USDT",
          error: "Insufficient USDT balance",
        };
      }
      balances.USDT = (balances.USDT ?? 0) - totalCost;

      // Extract asset name from symbol (e.g., "BTCUSDT" -> "BTC")
      const asset = params.symbol.replace(/USDT$/, "");
      balances[asset] = (balances[asset] ?? 0) + params.quantity;

      // Add to positions
      positions.push({
        symbol: params.symbol,
        side: "long",
        quantity: params.quantity,
        entry_price: filledPrice,
        entry_time: new Date().toISOString(),
        current_price: filledPrice,
        unrealized_pnl: 0,
        unrealized_pnl_pct: 0,
      });
    } else {
      // Sell
      const asset = params.symbol.replace(/USDT$/, "");
      if ((balances[asset] ?? 0) < params.quantity) {
        return {
          order_id: `demo_${orderCounter++}`,
          status: "rejected",
          filled_price: 0,
          filled_quantity: 0,
          fee: 0,
          fee_asset: "USDT",
          error: `Insufficient ${asset} balance`,
        };
      }
      balances[asset] = (balances[asset] ?? 0) - params.quantity;
      if (balances[asset] <= 0) delete balances[asset];
      balances.USDT = (balances.USDT ?? 0) + cost - fee;

      // Remove from positions
      const idx = positions.findIndex(
        (p) => p.symbol === params.symbol && p.side === "long"
      );
      if (idx !== -1) {
        positions.splice(idx, 1);
      }
    }

    return {
      order_id: `demo_${orderCounter++}`,
      status: "filled",
      filled_price: filledPrice,
      filled_quantity: params.quantity,
      fee,
      fee_asset: "USDT",
    };
  },

  async cancelOrder(): Promise<boolean> {
    await randomDelay();
    return true;
  },

  async getBalance(creds: Credentials): Promise<BalanceInfo> {
    await randomDelay();
    const balances = getOrInitBalance(creds.api_key);
    return { balances: { ...balances } };
  },

  async getPositions(creds: Credentials): Promise<Position[]> {
    await randomDelay();
    return [...getPositions(creds.api_key)];
  },

  async testConnection(): Promise<{ ok: boolean; latency_ms: number }> {
    await randomDelay();
    return { ok: true, latency_ms: 5 };
  },
};
