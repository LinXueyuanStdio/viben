"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createSession } from "../actions/create-session";
import type { Account } from "@/lib/types";

interface CreateSessionFormProps {
  accounts: Account[];
}

export function CreateSessionForm({ accounts }: CreateSessionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSession(formData);
      if (result?.session_id) {
        router.push(`/?session=${result.session_id}`);
      }
    });
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-6">新建交易会话</h2>
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">会话名称</label>
          <input
            name="session_name"
            required
            placeholder="e.g. BTC趋势跟踪"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">交易账户</label>
          {accounts.length > 0 ? (
            <select
              name="account_id"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">选择账户...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.exchange})
                </option>
              ))}
            </select>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                暂无账户，请先添加账户。
              </p>
              <input type="hidden" name="account_id" value="" />
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">交易所</label>
          <select
            name="exchange"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="binance">Binance</option>
            <option value="okx">OKX</option>
            <option value="bitget">Bitget</option>
            <option value="bybit">Bybit</option>
            <option value="gate">Gate.io</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">AI 模型</label>
          <input
            name="model"
            required
            defaultValue="claude-sonnet-4-20250514"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">策略名称</label>
          <input
            name="strategy_name"
            required
            placeholder="e.g. 动量突破"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">策略描述</label>
          <textarea
            name="strategy_description"
            rows={3}
            placeholder="描述策略逻辑..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">风险等级</label>
            <select
              name="risk_level"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">决策间隔(分钟)</label>
            <input
              name="interval_minutes"
              type="number"
              defaultValue={60}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">交易对(逗号分隔)</label>
          <input
            name="symbols"
            required
            defaultValue="BTC/USDT"
            placeholder="BTC/USDT, ETH/USDT"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">最大仓位比例</label>
          <input
            name="max_position_pct"
            type="number"
            step="0.01"
            defaultValue={0.5}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/80 disabled:opacity-50"
          >
            {isPending ? "创建中..." : "创建会话"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-4 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
