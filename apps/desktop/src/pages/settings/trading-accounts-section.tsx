import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Plus,
} from "lucide-react";
import { exchangeIcons } from "./exchange-icons";
import { TradingAccountsDialog } from "./trading-accounts-dialog";

const GATEWAY = "http://127.0.0.1:18790";

interface AccountSummary {
  id: string;
  exchange: string;
  name: string;
  created_at: string;
}

interface ExchangeGroup {
  exchange: string;
  displayName: string;
  accounts: AccountSummary[];
}

/** Brand color classes for exchange mini-cards (background + text). */
function getExchangeBg(id: string): string {
  const map: Record<string, string> = {
    binance: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    okx: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    bybit: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    bitget: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    gate: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    htx: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    kucoin: "bg-green-500/10 text-green-600 dark:text-green-400",
    mexc: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  };
  return map[id] ?? "bg-muted text-muted-foreground";
}

/** Capitalize exchange name for display. */
function exchangeDisplayName(id: string): string {
  const names: Record<string, string> = {
    binance: "Binance",
    okx: "OKX",
    bybit: "Bybit",
    bitget: "Bitget",
    gate: "Gate.io",
    htx: "HTX",
    kucoin: "KuCoin",
    mexc: "MEXC",
  };
  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** Group accounts by exchange, preserving insertion order. */
function groupByExchange(accounts: AccountSummary[]): ExchangeGroup[] {
  const map = new Map<string, AccountSummary[]>();
  for (const acc of accounts) {
    const list = map.get(acc.exchange);
    if (list) {
      list.push(acc);
    } else {
      map.set(acc.exchange, [acc]);
    }
  }
  const groups: ExchangeGroup[] = [];
  for (const [exchange, accs] of map) {
    groups.push({
      exchange,
      displayName: exchangeDisplayName(exchange),
      accounts: accs,
    });
  }
  return groups;
}

// -- Animation variants --

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const },
  },
};

export function TradingAccountsSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);

  // Bulk test state
  const [testingAll, setTestingAll] = useState(false);
  const [testResults, setTestResults] = useState<
    Map<string, { success: boolean; latency_ms?: number; error?: string }>
  >(new Map());

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY}/api/accounts`);
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      // silently fail -- gateway may not be running
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, dialogOpen]); // refetch when dialog closes

  const groups = useMemo(() => groupByExchange(accounts), [accounts]);

  // -- Bulk test all accounts --
  const handleTestAll = async () => {
    if (accounts.length === 0) return;
    setTestingAll(true);
    setTestResults(new Map());

    const results = await Promise.allSettled(
      accounts.map(async (acc) => {
        const res = await fetch(`${GATEWAY}/api/accounts/${acc.id}/test`, {
          method: "POST",
        });
        const data = await res.json();
        return { id: acc.id, data };
      })
    );

    const nextResults = new Map<
      string,
      { success: boolean; latency_ms?: number; error?: string }
    >();
    let successCount = 0;
    let failCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { id, data } = result.value;
        if (data.success) {
          nextResults.set(id, { success: true, latency_ms: data.latency_ms });
          successCount++;
        } else {
          nextResults.set(id, {
            success: false,
            error: data.error ?? "Unknown",
          });
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    setTestResults(nextResults);
    setTestingAll(false);

    if (failCount === 0) {
      toast.success(`全部 ${successCount} 个账户连接正常`);
    } else {
      toast.error(`${failCount} 个账户连接失败，${successCount} 个正常`);
    }

    // Clear results after 8 seconds
    setTimeout(() => setTestResults(new Map()), 8000);
  };

  const hasAccounts = accounts.length > 0;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold font-serif mb-1">
            交易账户
          </h2>
          <p className="text-sm text-muted-foreground">
            管理交易所 API 账户，用于自动化交易和数据获取。
          </p>
        </div>
      </div>

      {/* Main content card */}
      <div className="rounded-xl border bg-card">
        {/* Top bar with count and actions */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              已配置账户
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasAccounts
                ? `${accounts.length} 个交易账户，${groups.length} 个交易所`
                : "尚未配置任何交易账户"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasAccounts && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestAll}
                      disabled={testingAll}
                      className="gap-1.5"
                    >
                      {testingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5" />
                      )}
                      {testingAll ? "测试中..." : "测试全部"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    测试所有账户的 API 连接
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant={hasAccounts ? "outline" : "default"}
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5"
            >
              {hasAccounts ? (
                "管理账户"
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  添加账户
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Account list or empty state */}
        <div className="p-5">
          <AnimatePresence mode="wait">
            {hasAccounts ? (
              <motion.div
                key="accounts-list"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-5"
              >
                {groups.map((group) => (
                  <motion.div
                    key={group.exchange}
                    variants={cardVariants}
                    className="space-y-2.5"
                  >
                    {/* Exchange group header */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-md",
                          getExchangeBg(group.exchange)
                        )}
                      >
                        {exchangeIcons[group.exchange]
                          ? exchangeIcons[group.exchange]({ size: 14 })
                          : (
                              <span className="text-[10px] font-bold">
                                {group.displayName.charAt(0)}
                              </span>
                            )}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.displayName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {group.accounts.length} 个账户
                      </span>
                    </div>

                    {/* Account mini-cards */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.accounts.map((acc) => {
                        const result = testResults.get(acc.id);
                        return (
                          <motion.div
                            key={acc.id}
                            variants={cardVariants}
                            whileHover={{ scale: 1.01 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-lg border px-3.5 py-3",
                              "bg-background/60 transition-colors",
                              "hover:border-foreground/15 hover:bg-background"
                            )}
                          >
                            {/* Exchange icon avatar */}
                            <span
                              className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-md shrink-0",
                                getExchangeBg(acc.exchange)
                              )}
                            >
                              {exchangeIcons[acc.exchange]
                                ? exchangeIcons[acc.exchange]({ size: 16 })
                                : (
                                    <span className="text-xs font-bold">
                                      {exchangeDisplayName(acc.exchange).charAt(0)}
                                    </span>
                                  )}
                            </span>

                            {/* Account info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">
                                  {acc.name}
                                </p>
                                {/* Connected indicator dot */}
                                <span
                                  className={cn(
                                    "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                                    result
                                      ? result.success
                                        ? "bg-green-500"
                                        : "bg-red-500"
                                      : "bg-green-500/60"
                                  )}
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {exchangeDisplayName(acc.exchange)}
                              </p>
                            </div>

                            {/* Test result badge (appears after bulk test) */}
                            <AnimatePresence>
                              {result && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ duration: 0.2 }}
                                  className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                                    result.success
                                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                                  )}
                                >
                                  {result.success ? (
                                    <span className="flex items-center gap-0.5">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {result.latency_ms}ms
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5">
                                      <AlertCircle className="h-3 w-3" />
                                      失败
                                    </span>
                                  )}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              /* Empty state */
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/80 mb-5">
                  <KeyRound className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  暂未配置交易账户
                </p>
                <p className="text-xs text-muted-foreground max-w-[300px] mb-5 leading-relaxed">
                  添加交易所 API 密钥以开始使用自动化交易和实时数据获取功能。支持币安、OKX、Bybit 等主流交易所。
                </p>
                <Button
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加第一个账户
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <TradingAccountsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
