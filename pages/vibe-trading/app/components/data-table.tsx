"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  Position,
  TradeRecord,
  OrderSubmitEvent,
  OrderResultEvent,
} from "@/lib/types";
import { OrderDialog } from "./order-dialog";
import { closePosition, closeAllPositions } from "@/app/actions/close-position";
import { PnlBar } from "./ui/pnl-bar";
import { FlashCell } from "./ui/flash-cell";
import { MiniSparkline } from "./ui/mini-sparkline";

interface DataTableProps {
  positions: Position[];
  trades: TradeRecord[];
  sessionId: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type TabId = "positions" | "history" | "orders";

// ─── Utility: format duration ────────────────────────────────────────────────
function formatDuration(entryTime: string): string {
  const diff = Date.now() - new Date(entryTime).getTime();
  if (diff < 0) return "0m";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Utility: relative time ──────────────────────────────────────────────────
function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return "刚刚";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// ─── Order record combining submit + result ──────────────────────────────────
interface OrderRecord {
  order_id: string;
  symbol: string;
  side: "buy" | "sell";
  order_type: "market" | "limit";
  quantity: number;
  price?: number;
  source: "agent" | "manual";
  status: "pending" | "filled" | "partial_filled" | "rejected" | "expired" | "cancelled";
  filled_price?: number;
  fee?: number;
  error?: string;
  ts: string;
  slippage?: number;
  latency_ms?: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function DataTable({ positions, trades, sessionId, collapsed, onToggleCollapse }: DataTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("positions");
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const lineCountRef = useRef(0);

  // Poll for order events
  useEffect(() => {
    // Initial load
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);

    async function fetchOrders() {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/events?from_line=${lineCountRef.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.events?.length > 0) {
          lineCountRef.current = data.total_lines;
          const submitEvents = data.events.filter(
            (e: { type: string }) => e.type === "order_submit"
          ) as OrderSubmitEvent[];
          const resultEvents = data.events.filter(
            (e: { type: string }) => e.type === "order_result"
          ) as OrderResultEvent[];

          setOrders((prev) => {
            const updated = [...prev];
            for (const submit of submitEvents) {
              if (!updated.find((o) => o.order_id === submit.order_id)) {
                updated.push({
                  order_id: submit.order_id,
                  symbol: submit.symbol,
                  side: submit.side,
                  order_type: submit.order_type,
                  quantity: submit.quantity,
                  price: submit.price,
                  source: submit.source,
                  status: "pending",
                  ts: submit.ts,
                });
              }
            }
            for (const result of resultEvents) {
              const idx = updated.findIndex((o) => o.order_id === result.order_id);
              if (idx >= 0) {
                updated[idx] = {
                  ...updated[idx],
                  status: result.status,
                  filled_price: result.filled_price,
                  fee: result.fee,
                  error: result.error,
                };
              } else {
                updated.push({
                  order_id: result.order_id,
                  symbol: result.symbol,
                  side: result.side,
                  order_type: "market",
                  quantity: result.filled_quantity,
                  source: "agent",
                  status: result.status,
                  filled_price: result.filled_price,
                  fee: result.fee,
                  error: result.error,
                  ts: result.ts,
                });
              }
            }
            return updated;
          });
        }
      } catch {
        // Ignore polling errors
      }
    }
  }, [sessionId]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "positions", label: "当前持仓", count: positions.length },
    { id: "history", label: "历史成交", count: trades.length },
    { id: "orders", label: "订单记录", count: orders.length },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 select-none shrink-0">
        <div className="flex items-center gap-4">
          {/* Collapse button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-0.5 rounded hover:bg-slate-100 transition-colors"
              title={collapsed ? "展开" : "收起"}
            >
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  collapsed ? "" : "rotate-180"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
          {/* Tab buttons */}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm pb-1 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary font-medium"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "positions" && positions.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("确定要平掉所有持仓吗？")) return;
                await closeAllPositions(
                  sessionId,
                  positions.map((p) => ({
                    symbol: p.symbol,
                    side: p.side,
                    quantity: p.quantity,
                  }))
                );
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-loss/10 text-loss hover:bg-loss/20 font-medium"
            >
              一键全平
            </button>
          )}
          <button
            onClick={() => setShowOrderDialog(true)}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary/80"
          >
            手动开仓
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          <div key={activeTab} className="tab-content-enter h-full">
            {activeTab === "positions" && (
              <PositionsTable positions={positions} trades={trades} sessionId={sessionId} />
            )}
            {activeTab === "history" && <TradesTable trades={trades} />}
            {activeTab === "orders" && <OrdersTable orders={orders} />}
          </div>
        </div>
      )}
      {showOrderDialog && (
        <OrderDialog
          sessionId={sessionId}
          onClose={() => setShowOrderDialog(false)}
        />
      )}
    </div>
  );
}

// ─── Positions Tab ───────────────────────────────────────────────────────────
function PositionsTable({
  positions,
  trades,
  sessionId,
}: {
  positions: Position[];
  trades: TradeRecord[];
  sessionId: string;
}) {
  const [closingId, setClosingId] = useState<string | null>(null);
  // Store previous prices for flash effect
  const prevPricesRef = useRef<Record<string, number>>({});

  // Build sparkline data from recent trades per symbol
  const sparklineData = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const trade of trades) {
      if (!map[trade.symbol]) {
        map[trade.symbol] = [];
      }
      map[trade.symbol].push(trade.price);
    }
    // Keep only last 20 points per symbol
    for (const key of Object.keys(map)) {
      if (map[key].length > 20) {
        map[key] = map[key].slice(-20);
      }
    }
    return map;
  }, [trades]);

  // Update previous prices after render
  useEffect(() => {
    const newPrices: Record<string, number> = {};
    for (const pos of positions) {
      const key = `${pos.symbol}-${pos.side}`;
      if (pos.current_price !== undefined) {
        newPrices[key] = pos.current_price;
      }
    }
    // Defer update so current render uses old values
    const timer = setTimeout(() => {
      prevPricesRef.current = newPrices;
    }, 50);
    return () => clearTimeout(timer);
  }, [positions]);

  const handleClose = useCallback(
    async (pos: Position) => {
      const key = `${pos.symbol}-${pos.side}`;
      setClosingId(key);
      try {
        await closePosition(sessionId, pos.symbol, pos.side, pos.quantity);
      } finally {
        setClosingId(null);
      }
    },
    [sessionId]
  );

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <svg
          className="w-12 h-12 text-slate-300 mb-3 float-animation"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
          />
        </svg>
        <p className="text-sm text-slate-500 font-medium mb-1">暂无持仓</p>
        <p className="text-xs text-slate-400">
          AI 将在下一决策周期自动建仓
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
            <th className="px-6 py-2 font-medium">币对</th>
            <th className="px-3 py-2 font-medium">方向</th>
            <th className="px-3 py-2 font-medium text-right">数量</th>
            <th className="px-3 py-2 font-medium text-right">开仓价</th>
            <th className="px-3 py-2 font-medium text-right">当前价</th>
            <th className="px-3 py-2 font-medium text-right">未实现盈亏</th>
            <th className="px-3 py-2 font-medium text-right">盈亏%</th>
            <th className="px-3 py-2 font-medium w-[76px]"></th>
            <th className="px-3 py-2 font-medium text-right">杠杆</th>
            <th className="px-3 py-2 font-medium text-right">保证金</th>
            <th className="px-3 py-2 font-medium text-right">强平价</th>
            <th className="px-3 py-2 font-medium">持仓时长</th>
            <th className="px-3 py-2 font-medium text-right">止损/止盈</th>
            <th className="px-3 py-2 font-medium text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => {
            const key = `${pos.symbol}-${pos.side}`;
            const isClosing = closingId === key;
            const pnlPct = pos.unrealized_pnl_pct;
            const prevPrice = prevPricesRef.current[key];
            const symbolSparkline = sparklineData[pos.symbol];
            return (
              <tr
                key={i}
                className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  i % 2 === 1 ? "bg-slate-25" : ""
                }`}
              >
                <td className="px-6 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span>{pos.symbol}</span>
                    {symbolSparkline && symbolSparkline.length >= 2 && (
                      <MiniSparkline
                        data={symbolSparkline}
                        width={48}
                        height={16}
                        color={
                          (pos.unrealized_pnl ?? 0) >= 0 ? "#16a34a" : "#dc2626"
                        }
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      pos.side === "long" ? "text-gain" : "text-loss"
                    }
                  >
                    {pos.side === "long" ? "多" : "空"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {pos.quantity}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {pos.entry_price.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {pos.current_price !== undefined ? (
                    <FlashCell
                      value={pos.current_price}
                      prevValue={prevPrice}
                      format={(v) => v.toFixed(2)}
                    />
                  ) : (
                    "-"
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    (pos.unrealized_pnl ?? 0) >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {pos.unrealized_pnl !== undefined
                    ? `$${pos.unrealized_pnl.toFixed(4)}`
                    : "-"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    (pnlPct ?? 0) >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {pnlPct !== undefined
                    ? `${pnlPct >= 0 ? "+" : ""}${(pnlPct * 100).toFixed(2)}%`
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  {pnlPct !== undefined ? <PnlBar value={pnlPct} /> : null}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {pos.leverage ? `${pos.leverage}x` : "1x"}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {pos.margin_used !== undefined
                    ? `$${pos.margin_used.toFixed(2)}`
                    : "-"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    pos.liquidation_price !== undefined &&
                    pos.current_price !== undefined &&
                    Math.abs(pos.liquidation_price - pos.current_price) /
                      pos.current_price <
                      0.05
                      ? "text-loss font-semibold"
                      : ""
                  }`}
                >
                  {pos.liquidation_price !== undefined
                    ? `$${pos.liquidation_price.toFixed(2)}`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatDuration(pos.entry_time)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-400 font-mono tabular-nums">
                  {pos.stop_loss?.toFixed(2) ?? "-"} /{" "}
                  {pos.take_profit?.toFixed(2) ?? "-"}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleClose(pos)}
                    disabled={isClosing}
                    className="px-2 py-1 text-xs rounded bg-loss/10 text-loss hover:bg-loss/20 disabled:opacity-50 font-medium"
                  >
                    {isClosing ? "..." : "平仓"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Historical Trades Tab ───────────────────────────────────────────────────
function TradesTable({ trades }: { trades: TradeRecord[] }) {
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [sideFilter, setSideFilter] = useState<"all" | "buy" | "sell">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "agent" | "manual">(
    "all"
  );
  // Track previous trade count to identify new rows
  const prevTradeCountRef = useRef(trades.length);

  useEffect(() => {
    prevTradeCountRef.current = trades.length;
  }, [trades.length]);

  const symbols = useMemo(() => {
    const set = new Set(trades.map((t) => t.symbol));
    return Array.from(set).sort();
  }, [trades]);

  const filtered = useMemo(() => {
    return [...trades]
      .filter((t) => {
        if (symbolFilter !== "all" && t.symbol !== symbolFilter) return false;
        if (sideFilter !== "all" && t.side !== sideFilter) return false;
        if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
        return true;
      })
      .reverse();
  }, [trades, symbolFilter, sideFilter, sourceFilter]);

  const summary = useMemo(() => {
    const totalPnl = filtered.reduce(
      (sum, t) => sum + (t.realized_pnl ?? 0),
      0
    );
    const totalFees = filtered.reduce((sum, t) => sum + t.fee, 0);
    const winCount = filtered.filter((t) => (t.realized_pnl ?? 0) > 0).length;
    const tradeWithPnl = filtered.filter(
      (t) => t.realized_pnl !== undefined
    ).length;
    const winRate =
      tradeWithPnl > 0 ? ((winCount / tradeWithPnl) * 100).toFixed(1) : "-";
    return { count: filtered.length, totalPnl, totalFees, winRate };
  }, [filtered]);

  // Number of new rows to animate (max 3)
  const newRowCount = Math.min(
    3,
    Math.max(0, trades.length - prevTradeCountRef.current)
  );

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <svg
          className="w-12 h-12 text-slate-300 mb-3 float-animation"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-6L16.5 16.5m0 0L12 10.5m4.5 6V3"
          />
        </svg>
        <p className="text-sm text-slate-500 font-medium">暂无交易记录</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter row */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-50 bg-slate-50/50">
        <select
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
        >
          <option value="all">全部币对</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sideFilter}
          onChange={(e) => setSideFilter(e.target.value as "all" | "buy" | "sell")}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
        >
          <option value="all">全部方向</option>
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) =>
            setSourceFilter(e.target.value as "all" | "agent" | "manual")
          }
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
        >
          <option value="all">全部来源</option>
          <option value="agent">AI</option>
          <option value="manual">手动</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-6 py-2 font-medium">币对</th>
              <th className="px-3 py-2 font-medium">方向</th>
              <th className="px-3 py-2 font-medium text-right">价格</th>
              <th className="px-3 py-2 font-medium text-right">数量</th>
              <th className="px-3 py-2 font-medium text-right">手续费</th>
              <th className="px-3 py-2 font-medium text-right">盈亏</th>
              <th className="px-3 py-2 font-medium w-[76px]"></th>
              <th className="px-3 py-2 font-medium text-right">滑点</th>
              <th className="px-3 py-2 font-medium text-right">耗时</th>
              <th className="px-3 py-2 font-medium">来源</th>
              <th className="px-3 py-2 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((trade, i) => (
              <tr
                key={trade.order_id}
                className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  i % 2 === 1 ? "bg-slate-25" : ""
                } ${i < newRowCount ? "row-enter" : ""}`}
              >
                <td className="px-6 py-2 font-medium">{trade.symbol}</td>
                <td
                  className={`px-3 py-2 ${
                    trade.side === "buy" ? "text-gain" : "text-loss"
                  }`}
                >
                  {trade.side === "buy" ? "买入" : "卖出"}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {trade.price.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {trade.quantity}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">
                  ${trade.fee.toFixed(4)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    (trade.realized_pnl ?? 0) >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {trade.realized_pnl !== undefined
                    ? `$${trade.realized_pnl.toFixed(4)}`
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  {trade.realized_pnl !== undefined ? (
                    <PnlBar
                      value={
                        trade.realized_pnl >= 0
                          ? Math.min(trade.realized_pnl / 100, 0.1)
                          : Math.max(trade.realized_pnl / 100, -0.1)
                      }
                    />
                  ) : null}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    trade.slippage !== undefined
                      ? trade.slippage > 0
                        ? "text-loss"
                        : trade.slippage < 0
                          ? "text-gain"
                          : ""
                      : ""
                  }`}
                >
                  {trade.slippage !== undefined
                    ? `${trade.slippage > 0 ? "+" : ""}${(trade.slippage * 10000).toFixed(1)}bp`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">
                  {trade.trade_duration_ms !== undefined
                    ? `${trade.trade_duration_ms}ms`
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      trade.source === "agent"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {trade.source === "agent" ? "AI" : "手动"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {formatRelativeTime(trade.ts)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-6 px-6 py-2 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
        <span>
          共 <strong className="text-slate-900">{summary.count}</strong> 笔
        </span>
        <span>
          总盈亏{" "}
          <strong
            className={`font-mono ${
              summary.totalPnl >= 0 ? "text-gain" : "text-loss"
            }`}
          >
            ${summary.totalPnl.toFixed(4)}
          </strong>
        </span>
        <span>
          手续费{" "}
          <strong className="font-mono text-slate-900">
            ${summary.totalFees.toFixed(4)}
          </strong>
        </span>
        <span>
          胜率 <strong className="text-slate-900">{summary.winRate}%</strong>
        </span>
      </div>
    </div>
  );
}

// ─── Orders Tab ──────────────────────────────────────────────────────────────
function OrdersTable({ orders }: { orders: OrderRecord[] }) {
  // Track previous order count for fade-in animation
  const prevOrderCountRef = useRef(orders.length);

  useEffect(() => {
    prevOrderCountRef.current = orders.length;
  }, [orders.length]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <svg
          className="w-12 h-12 text-slate-300 mb-3 float-animation"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p className="text-sm text-slate-500 font-medium">暂无订单记录</p>
      </div>
    );
  }

  const sortedOrders = [...orders].reverse();
  const newOrderCount = Math.max(0, orders.length - prevOrderCountRef.current);

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
            <th className="px-6 py-2 font-medium">订单ID</th>
            <th className="px-3 py-2 font-medium">币对</th>
            <th className="px-3 py-2 font-medium">方向</th>
            <th className="px-3 py-2 font-medium">类型</th>
            <th className="px-3 py-2 font-medium text-right">数量</th>
            <th className="px-3 py-2 font-medium text-right">价格</th>
            <th className="px-3 py-2 font-medium text-center">状态</th>
            <th className="px-3 py-2 font-medium text-right">延迟</th>
            <th className="px-3 py-2 font-medium">来源</th>
            <th className="px-3 py-2 font-medium">时间</th>
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map((order, i) => (
            <tr
              key={order.order_id}
              className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                i % 2 === 1 ? "bg-slate-25" : ""
              } ${i < newOrderCount ? "order-enter" : ""}`}
            >
              <td className="px-6 py-2 font-mono text-xs text-slate-500">
                {order.order_id}
              </td>
              <td className="px-3 py-2 font-medium">{order.symbol}</td>
              <td
                className={`px-3 py-2 ${
                  order.side === "buy" ? "text-gain" : "text-loss"
                }`}
              >
                {order.side === "buy" ? "买入" : "卖出"}
              </td>
              <td className="px-3 py-2 text-xs">
                {order.order_type === "market" ? "市价" : "限价"}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {order.quantity}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {order.filled_price
                  ? order.filled_price.toFixed(2)
                  : order.price
                    ? order.price.toFixed(2)
                    : "-"}
              </td>
              <td className="px-3 py-2 text-center">
                <StatusBadge status={order.status} isNew={i < newOrderCount} />
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">
                {order.latency_ms !== undefined ? `${order.latency_ms}ms` : "-"}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    order.source === "agent"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {order.source === "agent" ? "AI" : "手动"}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-400">
                {formatRelativeTime(order.ts)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({
  status,
  isNew = false,
}: {
  status: OrderRecord["status"];
  isNew?: boolean;
}) {
  const config: Record<
    OrderRecord["status"],
    { label: string; className: string }
  > = {
    pending: {
      label: "待成交",
      className: "bg-blue-50 text-blue-600",
    },
    filled: {
      label: "已成交",
      className: "bg-green-50 text-green-600",
    },
    partial_filled: {
      label: "部分成交",
      className: "bg-yellow-50 text-yellow-600",
    },
    rejected: {
      label: "已拒绝",
      className: "bg-red-50 text-red-600",
    },
    expired: {
      label: "已过期",
      className: "bg-slate-100 text-slate-500",
    },
    cancelled: {
      label: "已撤销",
      className: "bg-slate-100 text-slate-500",
    },
  };

  const { label, className } = config[status];
  return (
    <span
      className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${className} ${
        isNew ? "badge-pulse" : ""
      }`}
    >
      {label}
    </span>
  );
}
