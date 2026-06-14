import type { ExchangeId, Position } from "../types";

export interface Credentials {
  api_key: string;
  secret: string;
  passphrase?: string;
}

export interface OrderParams {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  price?: number;
}

export interface OrderResponse {
  order_id: string;
  status: "filled" | "partial_filled" | "rejected" | "expired";
  filled_price: number;
  filled_quantity: number;
  fee: number;
  fee_asset: string;
  error?: string;
}

export interface BalanceInfo {
  balances: Record<string, number>;
}

export interface Exchange {
  id: ExchangeId;
  name: string;
  placeOrder(creds: Credentials, params: OrderParams): Promise<OrderResponse>;
  cancelOrder(creds: Credentials, orderId: string, symbol: string): Promise<boolean>;
  getBalance(creds: Credentials): Promise<BalanceInfo>;
  getPositions(creds: Credentials, symbols?: string[]): Promise<Position[]>;
  testConnection(creds: Credentials): Promise<{ ok: boolean; error?: string; latency_ms?: number }>;
}
