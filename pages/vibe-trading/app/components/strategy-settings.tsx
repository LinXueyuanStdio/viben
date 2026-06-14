"use client";

import { useState, useTransition, useEffect } from "react";
import { updateStrategyConfig } from "@/app/actions/update-strategy";
import { listAccountsAction } from "@/app/actions/account-manage";
import type { Account } from "@/lib/types";

interface AgentConfig {
  model: string;
  strategy_name: string;
  strategy_description: string;
  risk_level: "low" | "medium" | "high";
  symbols: string[];
  interval_minutes: number;
  max_position_pct: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  max_daily_trades?: number;
}

interface StrategySettingsProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentConfig: AgentConfig;
  locked?: boolean;
}

type PositionMode = "cross" | "isolated";
type KlineInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
type MarketType = "crypto" | "us_stock" | "commodity";
type MarketMode = "simulated" | "real";
type TargetTab = "list" | "custom";

interface IndicatorConfig {
  enabled: boolean;
  period?: number;
}

interface FormState {
  account_id: string;
  market_mode: MarketMode;
  interval_minutes: number;
  hard_stop_loss_pct: number;
  max_position_leverage: number;
  max_account_leverage: number;
  position_mode: PositionMode;
  kline_interval: KlineInterval;
  indicators: {
    rsi: IndicatorConfig;
    ema: IndicatorConfig;
    macd: IndicatorConfig;
    bollinger: IndicatorConfig;
    atr: IndicatorConfig;
    volume_ma: IndicatorConfig;
  };
  excluded_symbols: string;
  market_type: MarketType;
  target_tab: TargetTab;
  selected_lists: string[];
  custom_symbols: string;
}

const DATA_SOURCE_CARDS = [
  { id: "ai500", label: "AI500 数据源", description: "使用 AI500 智能筛选的热门资产" },
  { id: "oi_rising", label: "持仓量上升", description: "持仓量上升的资产" },
  { id: "oi_falling", label: "持仓量下降", description: "持仓量下降的代币" },
  { id: "net_inflow", label: "净流入最高", description: "净流入最高的代币" },
  { id: "net_outflow", label: "净流出最高", description: "净流出最高的代币" },
  { id: "top_gainers", label: "涨幅榜", description: "24小时涨幅居前的加密货币，适合趋势跟随、突破追涨" },
  { id: "top_losers", label: "跌幅榜", description: "24小时跌幅居前的加密货币，适合超跌反弹、均值回归" },
  { id: "agent_pick", label: "Agent 自动选股", description: "AI 自主分析市场选择标的" },
];

const KLINE_OPTIONS: { value: KlineInterval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" },
];

export function StrategySettings({ open, onClose, sessionId, currentConfig, locked = false }: StrategySettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<FormState>(() => ({
    account_id: "",
    market_mode: "real",
    interval_minutes: currentConfig.interval_minutes,
    hard_stop_loss_pct: currentConfig.stop_loss_pct ?? 50,
    max_position_leverage: 5,
    max_account_leverage: 5,
    position_mode: "cross",
    kline_interval: "15m",
    indicators: {
      rsi: { enabled: true, period: 14 },
      ema: { enabled: true, period: 20 },
      macd: { enabled: false },
      bollinger: { enabled: false },
      atr: { enabled: false },
      volume_ma: { enabled: false },
    },
    excluded_symbols: "",
    market_type: "crypto",
    target_tab: "list",
    selected_lists: ["ai500"],
    custom_symbols: currentConfig.symbols.join(", "),
  }));

  useEffect(() => {
    if (open) {
      listAccountsAction().then((accs) => {
        setAccounts(accs);
        // If market mode is simulated, auto-select a demo account
        setForm((prev) => {
          if (prev.market_mode === "simulated") {
            const demoAccount = accs.find((a) => a.is_demo);
            if (demoAccount) {
              return { ...prev, account_id: demoAccount.id };
            }
          }
          return prev;
        });
      });
    }
  }, [open]);

  if (!open) return null;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleIndicator(key: keyof FormState["indicators"]) {
    setForm((prev) => ({
      ...prev,
      indicators: {
        ...prev.indicators,
        [key]: { ...prev.indicators[key], enabled: !prev.indicators[key].enabled },
      },
    }));
  }

  function updateIndicatorPeriod(key: keyof FormState["indicators"], period: number) {
    setForm((prev) => ({
      ...prev,
      indicators: {
        ...prev.indicators,
        [key]: { ...prev.indicators[key], period },
      },
    }));
  }

  function toggleList(id: string) {
    setForm((prev) => {
      const selected = prev.selected_lists.includes(id)
        ? prev.selected_lists.filter((l) => l !== id)
        : [...prev.selected_lists, id];
      return { ...prev, selected_lists: selected };
    });
  }

  function handleMarketModeChange(mode: MarketMode) {
    updateForm("market_mode", mode);
    if (mode === "simulated") {
      // Auto-select or create a demo account
      const demoAccount = accounts.find((a) => a.is_demo);
      if (demoAccount) {
        updateForm("account_id", demoAccount.id);
      }
    }
  }

  function handleSave() {
    startTransition(async () => {
      const updates: Record<string, unknown> = {
        account_id: form.account_id,
        market_mode: form.market_mode,
        interval_minutes: form.interval_minutes,
        hard_stop_loss_pct: form.hard_stop_loss_pct,
        max_position_leverage: form.max_position_leverage,
        max_account_leverage: form.max_account_leverage,
        position_mode: form.position_mode,
        kline_interval: form.kline_interval,
        indicators: form.indicators,
        excluded_symbols: form.excluded_symbols
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        market_type: form.market_type,
        selected_lists: form.selected_lists,
        custom_symbols: form.custom_symbols
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await updateStrategyConfig(sessionId, updates);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold">策略设置</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            关闭
          </button>
        </div>

        {/* Scrollable content */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${locked ? "opacity-60 pointer-events-none" : ""}`}>
          {locked && (
            <div className="pointer-events-auto mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
              策略运行中无法修改配置。如需变更，请先停止当前 session 再创建新 session。
            </div>
          )}
          {/* Section: 账户 */}
          <section className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">账户</h3>
            <div>
              <label className="block text-sm text-slate-600 mb-1">选择账户</label>
              <select
                value={form.account_id}
                onChange={(e) => updateForm("account_id", e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm"
              >
                <option value="">-- 请选择账户 --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.exchange.toUpperCase()}){acc.is_demo ? " [Demo]" : ""}
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">暂无账户，请先在账户管理中添加</p>
              )}
            </div>
          </section>

          {/* Section 1: 基础规则 */}
          <section className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">基础规则</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* AI决策周期 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">AI 决策周期</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={form.interval_minutes}
                    onChange={(e) => updateForm("interval_minutes", Math.max(1, Math.min(1440, Number(e.target.value))))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                  />
                  <span className="text-sm text-slate-500">min</span>
                </div>
              </div>

              {/* 硬止损 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">硬止损</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.hard_stop_loss_pct}
                    onChange={(e) => updateForm("hard_stop_loss_pct", Math.max(1, Math.min(100, Number(e.target.value))))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>

              {/* 最大仓位杠杆 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">最大仓位杠杆</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={125}
                    value={form.max_position_leverage}
                    onChange={(e) => updateForm("max_position_leverage", Math.max(1, Math.min(125, Number(e.target.value))))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                  />
                  <span className="text-sm text-slate-500">x</span>
                </div>
              </div>

              {/* 账户最大杠杆 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">账户最大杠杆</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.max_account_leverage}
                    onChange={(e) => updateForm("max_account_leverage", Math.max(1, Math.min(100, Number(e.target.value))))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                  />
                  <span className="text-sm text-slate-500">x</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: 高级设置 */}
          <section className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">高级设置</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 仓位模式 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1">仓位模式</label>
                  <select
                    value={form.position_mode}
                    onChange={(e) => updateForm("position_mode", e.target.value as PositionMode)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="cross">全仓</option>
                    <option value="isolated">逐仓</option>
                  </select>
                </div>

                {/* K线周期 */}
                <div>
                  <label className="block text-sm text-slate-600 mb-1">K线周期</label>
                  <select
                    value={form.kline_interval}
                    onChange={(e) => updateForm("kline_interval", e.target.value as KlineInterval)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                  >
                    {KLINE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 技术指标 */}
              <div>
                <label className="block text-sm text-slate-600 mb-2">技术指标</label>
                <div className="grid grid-cols-3 gap-2">
                  {/* RSI */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      form.indicators.rsi.enabled
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/50"
                    }`}
                    onClick={() => toggleIndicator("rsi")}
                  >
                    <input
                      type="checkbox"
                      checked={form.indicators.rsi.enabled}
                      readOnly
                      className="accent-primary"
                    />
                    <span className="text-sm">RSI</span>
                    {form.indicators.rsi.enabled && (
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={form.indicators.rsi.period ?? 14}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateIndicatorPeriod("rsi", Number(e.target.value))}
                        className="w-10 px-1 py-0.5 border border-slate-300 rounded text-xs text-center"
                      />
                    )}
                  </div>

                  {/* EMA */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      form.indicators.ema.enabled
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/50"
                    }`}
                    onClick={() => toggleIndicator("ema")}
                  >
                    <input
                      type="checkbox"
                      checked={form.indicators.ema.enabled}
                      readOnly
                      className="accent-primary"
                    />
                    <span className="text-sm">EMA</span>
                    {form.indicators.ema.enabled && (
                      <input
                        type="number"
                        min={2}
                        max={200}
                        value={form.indicators.ema.period ?? 20}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateIndicatorPeriod("ema", Number(e.target.value))}
                        className="w-10 px-1 py-0.5 border border-slate-300 rounded text-xs text-center"
                      />
                    )}
                  </div>

                  {/* MACD */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      form.indicators.macd.enabled
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/50"
                    }`}
                    onClick={() => toggleIndicator("macd")}
                  >
                    <input
                      type="checkbox"
                      checked={form.indicators.macd.enabled}
                      readOnly
                      className="accent-primary"
                    />
                    <span className="text-sm">MACD</span>
                  </div>

                  {/* Bollinger */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      form.indicators.bollinger.enabled
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/50"
                    }`}
                    onClick={() => toggleIndicator("bollinger")}
                  >
                    <input
                      type="checkbox"
                      checked={form.indicators.bollinger.enabled}
                      readOnly
                      className="accent-primary"
                    />
                    <span className="text-sm">Bollinger</span>
                  </div>

                  {/* ATR */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      form.indicators.atr.enabled
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/50"
                    }`}
                    onClick={() => toggleIndicator("atr")}
                  >
                    <input
                      type="checkbox"
                      checked={form.indicators.atr.enabled}
                      readOnly
                      className="accent-primary"
                    />
                    <span className="text-sm">ATR</span>
                  </div>

                  {/* Volume MA */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      form.indicators.volume_ma.enabled
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/50"
                    }`}
                    onClick={() => toggleIndicator("volume_ma")}
                  >
                    <input
                      type="checkbox"
                      checked={form.indicators.volume_ma.enabled}
                      readOnly
                      className="accent-primary"
                    />
                    <span className="text-sm">Volume MA</span>
                  </div>
                </div>
              </div>

              {/* 排除币种 */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">排除币种</label>
                <input
                  type="text"
                  value={form.excluded_symbols}
                  onChange={(e) => updateForm("excluded_symbols", e.target.value)}
                  placeholder="逗号分隔，如: LUNA, FTT, UST"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
          </section>

          {/* Section 3: 交易范围 */}
          <section className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">交易范围</h3>
            <div className="space-y-4">
              {/* Market Mode */}
              <div>
                <label className="block text-sm text-slate-600 mb-2">市场模式</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarketModeChange("simulated")}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                      form.market_mode === "simulated"
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-600 hover:border-amber-300"
                    }`}
                  >
                    模拟市场
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarketModeChange("real")}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                      form.market_mode === "real"
                        ? "border-green-400 bg-green-50 text-green-700"
                        : "border-slate-200 text-slate-600 hover:border-green-300"
                    }`}
                  >
                    真实市场
                  </button>
                </div>
                {form.market_mode === "simulated" && (
                  <div className="mt-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    模拟模式：使用合成市场数据，不会执行真实交易
                  </div>
                )}
              </div>

              {/* Market Type */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="market_type"
                    value="crypto"
                    checked={form.market_type === "crypto"}
                    onChange={() => updateForm("market_type", "crypto")}
                    className="accent-primary"
                  />
                  <span className="text-sm">加密货币</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="market_type"
                    value="us_stock"
                    checked={form.market_type === "us_stock"}
                    onChange={() => updateForm("market_type", "us_stock")}
                    className="accent-primary"
                  />
                  <span className="text-sm">美股</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="market_type"
                    value="commodity"
                    checked={form.market_type === "commodity"}
                    onChange={() => updateForm("market_type", "commodity")}
                    className="accent-primary"
                  />
                  <span className="text-sm">大宗商品</span>
                </label>
              </div>
            </div>
          </section>

          {/* Section 4: 标的选择 */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">标的选择</h3>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => updateForm("target_tab", "list")}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  form.target_tab === "list"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-primary/50"
                }`}
              >
                榜单
              </button>
              <button
                onClick={() => updateForm("target_tab", "custom")}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  form.target_tab === "custom"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-primary/50"
                }`}
              >
                自选标的
              </button>
            </div>

            {form.target_tab === "list" ? (
              <div className="grid grid-cols-3 gap-3">
                {DATA_SOURCE_CARDS.map((card) => {
                  const selected = form.selected_lists.includes(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleList(card.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:border-primary/50"
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">{card.label}</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{card.description}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <textarea
                  value={form.custom_symbols}
                  onChange={(e) => updateForm("custom_symbols", e.target.value)}
                  placeholder="输入币种，逗号分隔，如: BTC/USDT, ETH/USDT, SOL/USDT"
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">逗号或换行分隔多个标的</p>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || locked}
            className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/80 disabled:opacity-50"
          >
            {locked ? "运行中（不可修改）" : isPending ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
