"use client";

import { useState, useEffect } from "react";
import type { WatchlistConfig } from "@/lib/types";
import { IconCheck, IconSpinner } from "./icons";

interface ListConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: {
    name: string;
    color: string;
    refresh_interval: number;
    refresh_prompt: string;
    initial_symbols?: string[];
    run_refresh_prompt?: boolean;
  }) => void;
  onRefreshPrompt?: (prompt: string) => Promise<void>;
  onDelete?: () => void;
  initial?: Pick<WatchlistConfig, "name" | "color" | "refresh_interval" | "refresh_prompt"> | null;
}

const PRESET_COLORS = ["#0891B2", "#7c3aed", "#ea580c", "#16a34a", "#dc2626", "#2563eb", "#d97706", "#db2777"];

export function ListConfigDialog({ open, onClose, onSave, onRefreshPrompt, onDelete, initial }: ListConfigDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [refreshInterval, setRefreshInterval] = useState(initial?.refresh_interval ?? 300);
  const [refreshPrompt, setRefreshPrompt] = useState(initial?.refresh_prompt ?? "");
  const [symbolsInput, setSymbolsInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setColor(initial.color);
      setRefreshInterval(initial.refresh_interval);
      setRefreshPrompt(initial.refresh_prompt);
    } else {
      setName("");
      setColor(PRESET_COLORS[0]);
      setRefreshInterval(300);
      setRefreshPrompt("");
      setSymbolsInput("");
    }
  }, [initial, open]);

  if (!open) return null;

  async function handleRunRefresh() {
    if (!refreshPrompt.trim() || !onRefreshPrompt) return;
    setRefreshing(true);
    try {
      await onRefreshPrompt(refreshPrompt);
    } finally {
      setRefreshing(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={refreshing ? undefined : onClose}>
      <div className="bg-card rounded-xl shadow-2xl p-6 w-[440px] max-h-[80vh] overflow-auto border border-border" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-foreground mb-5">{initial ? "编辑列表" : "新建列表"}</h3>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
              placeholder="例如：科技龙头"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">颜色</label>
            <div className="flex gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full relative transition-transform ${color === c ? "scale-110 ring-2 ring-offset-2 ring-border" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <IconCheck size={14} className="absolute inset-0 m-auto text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {!initial && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">初始标的</label>
              <input
                value={symbolsInput}
                onChange={(e) => setSymbolsInput(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary transition-all"
                placeholder="例如：BTCUSDT, ETHUSDT, SOLUSDT"
              />
              <p className="text-[10px] text-muted-foreground mt-1">逗号或空格分隔。若留空且填写了刷新 Prompt，创建后将自动用 AI 生成</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">刷新 Prompt（AI 执行指令）</label>
            <textarea
              value={refreshPrompt}
              onChange={(e) => setRefreshPrompt(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary"
              placeholder="例如：筛选 Binance 合约市值前10的币种"
            />
            {initial && onRefreshPrompt && (
              <button
                onClick={handleRunRefresh}
                disabled={!refreshPrompt.trim() || refreshing}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-warning/10 text-warning border border-warning/30 rounded-md hover:bg-warning/15 disabled:opacity-40 transition-colors"
              >
                {refreshing ? <IconSpinner size={12} /> : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
                立即用 AI 刷新标的
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">自动刷新周期</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10) || 300)}
                className="w-24 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary"
                min={60}
                step={60}
              />
              <span className="text-xs text-muted-foreground">秒</span>
            </div>
          </div>
        </div>

        <div className="flex items-center mt-6">
          {initial && onDelete && (
            <button onClick={onDelete} className="text-xs text-destructive hover:text-destructive transition-colors">
              删除此列表
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={refreshing} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-40">
              取消
            </button>
            <button
              onClick={() => {
                const symbols = symbolsInput
                  .split(/[,，\s]+/)
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean);
                const hasManualSymbols = symbols.length > 0;
                const shouldRunPrompt = !initial && !hasManualSymbols && refreshPrompt.trim().length > 0;
                onSave({
                  name,
                  color,
                  refresh_interval: refreshInterval,
                  refresh_prompt: refreshPrompt,
                  initial_symbols: hasManualSymbols ? symbols : undefined,
                  run_refresh_prompt: shouldRunPrompt,
                });
                onClose();
              }}
              disabled={!name.trim() || refreshing}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
            >
              {initial ? "保存" : "创建"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
