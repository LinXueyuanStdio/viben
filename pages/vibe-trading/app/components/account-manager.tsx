"use client";

import { useState, useTransition, useEffect } from "react";
import {
  addAccountAction,
  removeAccountAction,
  testAccountAction,
  listAccountsAction,
} from "../actions/account-manage";
import type { Account, ExchangeId } from "@/lib/types";

interface AccountManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

interface TestResult {
  ok: boolean;
  error?: string;
  latency_ms?: number;
}

const EXCHANGES: { value: ExchangeId; label: string }[] = [
  { value: "binance", label: "Binance" },
  { value: "okx", label: "OKX" },
  { value: "bitget", label: "Bitget" },
  { value: "bybit", label: "Bybit" },
  { value: "gate", label: "Gate.io" },
];

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AccountManagerDialog({ open, onClose }: AccountManagerDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId>("binance");
  const [isDemo, setIsDemo] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [testResults, setTestResults] = useState<Record<string, TestResult | "loading">>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      listAccountsAction().then((accs) => {
        setAccounts(accs);
        setLoading(false);
      });
    }
  }, [open]);

  if (!open) return null;

  function clearMessage() {
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleAddAccount(formData: FormData) {
    startTransition(async () => {
      try {
        await addAccountAction(formData);
        const updated = await listAccountsAction();
        setAccounts(updated);
        setShowForm(false);
        setMessage({ type: "success", text: "账户添加成功" });
        clearMessage();
      } catch {
        setMessage({ type: "error", text: "添加账户失败，请检查输入" });
        clearMessage();
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      try {
        const result = await removeAccountAction(id);
        if (result.success) {
          setAccounts((prev) => prev.filter((a) => a.id !== id));
          setMessage({ type: "success", text: "账户已删除" });
        } else {
          setMessage({ type: "error", text: "删除失败，账户不存在" });
        }
        clearMessage();
      } catch {
        setMessage({ type: "error", text: "删除失败" });
        clearMessage();
      } finally {
        setConfirmingDeleteId(null);
      }
    });
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const result = await testAccountAction(id);
      setTestResults((prev) => ({ ...prev, [id]: result as TestResult }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, error: "连接超时或网络错误" },
      }));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
      <div className="bg-card rounded-xl shadow-xl w-[560px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">账户管理</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted"
          >
            关闭
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">

      {/* Message banner */}
      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-md text-sm ${
            message.type === "success"
              ? "bg-gain/10 text-gain border border-gain/30"
              : "bg-loss/10 text-loss border border-loss/30"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Account list */}
      <div className="space-y-3 mb-6">
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-md">
            暂无账户，点击下方按钮添加
          </div>
        ) : (
          accounts.map((account) => {
            const testResult = testResults[account.id];
            return (
              <div
                key={account.id}
                className="border border-border rounded-md p-4 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{account.name}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                        {account.exchange.toUpperCase()}
                      </span>
                      {account.is_demo && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning font-medium">
                          Demo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>API Key: {maskApiKey(account.api_key)}</div>
                      <div>创建时间: {formatDate(account.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleTest(account.id)}
                      disabled={testResult === "loading"}
                      className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50"
                    >
                      {testResult === "loading" ? "测试中..." : "测试连接"}
                    </button>
                    {confirmingDeleteId === account.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(account.id)}
                          disabled={isPending}
                          className="px-2 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {isPending ? "..." : "确认"}
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-2 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDeleteId(account.id)}
                        className="px-3 py-1.5 text-xs rounded-md border border-loss/30 text-loss hover:bg-loss/10"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
                {/* Test result */}
                {testResult && testResult !== "loading" && (
                  <div
                    className={`mt-2 px-3 py-1.5 rounded text-xs ${
                      testResult.ok
                        ? "bg-gain/10 text-gain"
                        : "bg-loss/10 text-loss"
                    }`}
                  >
                    {testResult.ok
                      ? `连接成功${testResult.latency_ms ? ` (${testResult.latency_ms}ms)` : ""}`
                      : `连接失败: ${testResult.error ?? "未知错误"}`}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add account button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/80"
        >
          添加账户
        </button>
      ) : (
        <div className="border border-border rounded-md p-4 bg-card">
          <h3 className="text-sm font-semibold mb-4">添加新账户</h3>
          <form action={handleAddAccount} className="space-y-3">
            <input type="hidden" name="is_demo" value={isDemo ? "true" : "false"} />

            <div>
              <label className="block text-sm font-medium mb-1">交易所</label>
              <select
                name="exchange"
                required
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value as ExchangeId)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                {EXCHANGES.map((ex) => (
                  <option key={ex.value} value={ex.value}>
                    {ex.label}
                  </option>
                ))}
              </select>
              {selectedExchange === "okx" && (
                <p className="mt-1 text-xs text-warning">
                  OKX 需要 Passphrase，请确保填写。
                </p>
              )}
            </div>

            {/* Demo checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_demo_checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
                className="accent-primary"
              />
              <label htmlFor="is_demo_checkbox" className="text-sm text-foreground cursor-pointer">
                测试账户 (Demo)
              </label>
              <span className="text-xs text-muted-foreground">使用模拟数据，无需真实 API 密钥</span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">账户名称</label>
              <input
                name="name"
                required
                placeholder={isDemo ? "e.g. 模拟账户" : "e.g. 主账户"}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                API Key {isDemo && <span className="text-xs text-muted-foreground">(自动填充)</span>}
              </label>
              <input
                name="api_key"
                required={!isDemo}
                type="password"
                placeholder={isDemo ? "demo_key_xxx (自动生成)" : "输入 API Key"}
                disabled={isDemo}
                className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono disabled:bg-muted disabled:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Secret {isDemo && <span className="text-xs text-muted-foreground">(自动填充)</span>}
              </label>
              <input
                name="secret"
                required={!isDemo}
                type="password"
                placeholder={isDemo ? "demo_secret_xxx (自动生成)" : "输入 Secret"}
                disabled={isDemo}
                className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono disabled:bg-muted disabled:text-muted-foreground"
              />
            </div>

            {selectedExchange === "okx" && !isDemo && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Passphrase <span className="text-loss">*</span>
                </label>
                <input
                  name="passphrase"
                  required
                  type="password"
                  placeholder="输入 Passphrase"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono"
                />
              </div>
            )}

            {selectedExchange !== "okx" && !isDemo && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Passphrase <span className="text-xs text-muted-foreground">(可选)</span>
                </label>
                <input
                  name="passphrase"
                  type="password"
                  placeholder="如不需要可留空"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primary/80 disabled:opacity-50"
              >
                {isPending ? "添加中..." : "确认添加"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setIsDemo(false); }}
                className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
