"use client";

import { useState, useTransition } from "react";
import { submitOrder } from "@/app/actions/order";

interface OrderDialogProps {
  sessionId: string;
  onClose: () => void;
}

export function OrderDialog({ sessionId, onClose }: OrderDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("请输入有效数量");
      return;
    }

    const formData = new FormData();
    formData.set("symbol", symbol);
    formData.set("side", side);
    formData.set("type", type);
    formData.set("quantity", quantity);
    if (type === "limit" && price) {
      formData.set("price", price);
    }

    setError(null);
    startTransition(async () => {
      try {
        await submitOrder(sessionId, formData);
        onClose();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
      <div className="bg-card rounded-xl shadow-xl w-[420px] p-6">
        <h2 className="text-lg font-semibold mb-4">手动开仓</h2>

        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-1 block">交易对</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-1 block">方向</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSide("buy")}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${side === "buy" ? "bg-gain text-white" : "border border-border text-muted-foreground"}`}
            >
              买入 (做多)
            </button>
            <button
              onClick={() => setSide("sell")}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${side === "sell" ? "bg-loss text-white" : "border border-border text-muted-foreground"}`}
            >
              卖出 (做空)
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-1 block">类型</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType("market")}
              className={`px-4 py-1.5 rounded-md text-sm ${type === "market" ? "bg-foreground text-card" : "border border-border text-muted-foreground"}`}
            >
              市价
            </button>
            <button
              onClick={() => setType("limit")}
              className={`px-4 py-1.5 rounded-md text-sm ${type === "limit" ? "bg-foreground text-card" : "border border-border text-muted-foreground"}`}
            >
              限价
            </button>
          </div>
        </div>

        {type === "limit" && (
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-1 block">价格</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              step="any"
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
              placeholder="限价价格"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="text-sm text-muted-foreground mb-1 block">数量</label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            step="any"
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
            placeholder="下单数量"
          />
        </div>

        {error && <p className="text-sm text-loss mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/80 disabled:opacity-50"
          >
            {isPending ? "提交中..." : "确认下单"}
          </button>
        </div>
      </div>
    </div>
  );
}
