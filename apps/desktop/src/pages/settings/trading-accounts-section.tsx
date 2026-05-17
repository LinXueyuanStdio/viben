import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  Settings2,
  X,
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

type TestState = "idle" | "testing" | "success" | "error";

interface TestResult {
  state: TestState;
  latency_ms?: number;
  error?: string;
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
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-account test state (streaming updates)
  const [testingAll, setTestingAll] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(
    new Map()
  );

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${GATEWAY}/api/accounts`);
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      // silently fail -- gateway may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, dialogOpen]); // refetch when dialog closes

  const groups = useMemo(() => groupByExchange(accounts), [accounts]);

  // -- Single account test --
  const handleTestSingle = async (accId: string) => {
    setTestResults((prev) => {
      const next = new Map(prev);
      next.set(accId, { state: "testing" });
      return next;
    });

    try {
      const res = await fetch(`${GATEWAY}/api/accounts/${accId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResults((prev) => {
        const next = new Map(prev);
        next.set(
          accId,
          data.success
            ? { state: "success", latency_ms: data.latency_ms }
            : { state: "error", error: data.error ?? "Unknown" }
        );
        return next;
      });
    } catch {
      setTestResults((prev) => {
        const next = new Map(prev);
        next.set(accId, { state: "error", error: t("settings.tradingAccounts.networkError") });
        return next;
      });
    }
  };

  // -- Bulk test all accounts (streaming per-card feedback) --
  const handleTestAll = async () => {
    if (accounts.length === 0) return;
    setTestingAll(true);

    // Set all to testing
    const initial = new Map<string, TestResult>();
    for (const acc of accounts) {
      initial.set(acc.id, { state: "testing" });
    }
    setTestResults(initial);

    const results = await Promise.allSettled(
      accounts.map(async (acc) => {
        const res = await fetch(`${GATEWAY}/api/accounts/${acc.id}/test`, {
          method: "POST",
        });
        const data = await res.json();
        // Update immediately per-card
        setTestResults((prev) => {
          const next = new Map(prev);
          next.set(
            acc.id,
            data.success
              ? { state: "success", latency_ms: data.latency_ms }
              : { state: "error", error: data.error ?? "Unknown" }
          );
          return next;
        });
        return { id: acc.id, data };
      })
    );

    setTestingAll(false);

    let successCount = 0;
    let failCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if (failCount === 0) {
      toast.success(t("settings.tradingAccounts.allSuccess", { count: successCount }));
    } else {
      toast.error(t("settings.tradingAccounts.someFailed", { failed: failCount, success: successCount }));
    }
  };

  const clearResults = () => setTestResults(new Map());
  const hasResults = testResults.size > 0;
  const hasAccounts = accounts.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Section header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold font-serif mb-1">{t("settings.tradingAccounts.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.tradingAccounts.description")}
            </p>
          </div>
        </div>

        {/* Main content card */}
        <div className="rounded-xl border bg-card">
          {/* Top bar with count and actions */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t("settings.tradingAccounts.configured")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading
                  ? t("settings.tradingAccounts.loading")
                  : hasAccounts
                    ? t("settings.tradingAccounts.countSummary", { count: accounts.length, exchanges: groups.length })
                    : t("settings.tradingAccounts.noAccounts")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasResults && !testingAll && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={clearResults}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("settings.tradingAccounts.clearResults")}</TooltipContent>
                </Tooltip>
              )}
              {hasAccounts && (
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
                      {testingAll ? t("settings.tradingAccounts.testing") : t("settings.tradingAccounts.testAll")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("settings.tradingAccounts.testConnection")}</TooltipContent>
                </Tooltip>
              )}
              <Button
                variant={hasAccounts ? "default" : "default"}
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="gap-1.5"
              >
                {hasAccounts ? (
                  <>
                    <Settings2 className="h-3.5 w-3.5" />
                    {t("settings.tradingAccounts.manageAccounts")}
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    {t("settings.tradingAccounts.addAccount")}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Account list, skeleton, or empty state */}
          <div className="p-5">
            <AnimatePresence mode="wait">
              {loading ? (
                /* Skeleton loading state */
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg bg-muted/60 animate-pulse"
                    />
                  ))}
                </motion.div>
              ) : hasAccounts ? (
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
                      {/* Exchange group header with divider line */}
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-md",
                            getExchangeBg(group.exchange)
                          )}
                        >
                          {exchangeIcons[group.exchange]
                            ? exchangeIcons[group.exchange]({ size: 15 })
                            : (
                                <span className="text-[10px] font-bold">
                                  {group.displayName.charAt(0)}
                                </span>
                              )}
                        </span>
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          {group.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {t("settings.tradingAccounts.accountCount", { count: group.accounts.length })}
                        </span>
                        <div className="flex-1 h-px bg-border/60 ml-1" />
                      </div>

                      {/* Account mini-cards */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.accounts.map((acc) => {
                          const result = testResults.get(acc.id);
                          return (
                            <motion.div
                              key={acc.id}
                              variants={cardVariants}
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
                                {result?.state === "testing" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : exchangeIcons[acc.exchange] ? (
                                  exchangeIcons[acc.exchange]({ size: 16 })
                                ) : (
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
                                  {/* Status dot with tooltip */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={cn(
                                          "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                                          !result || result.state === "idle"
                                            ? "bg-muted-foreground/30"
                                            : result.state === "testing"
                                              ? "bg-muted-foreground/30 animate-pulse"
                                              : result.state === "success"
                                                ? "bg-green-500"
                                                : "bg-red-500"
                                        )}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {!result || result.state === "idle"
                                        ? t("settings.tradingAccounts.untested")
                                        : result.state === "testing"
                                          ? t("settings.tradingAccounts.testingStatus")
                                          : result.state === "success"
                                            ? t("settings.tradingAccounts.latency", { ms: result.latency_ms })
                                            : result.error ?? t("settings.tradingAccounts.connectionFailed")}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {acc.created_at
                                    ? new Date(
                                        acc.created_at
                                      ).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : exchangeDisplayName(acc.exchange)}
                                </p>
                              </div>

                              {/* Right area: hover action OR test result badge */}
                              <div className="w-16 shrink-0 flex items-center justify-end">
                                <AnimatePresence mode="wait">
                                  {result &&
                                  result.state !== "idle" &&
                                  result.state !== "testing" ? (
                                    /* Test result badge */
                                    <motion.span
                                      key="result"
                                      initial={{ opacity: 0, x: 4 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: 4 }}
                                      transition={{ duration: 0.18 }}
                                      className={cn(
                                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                        result.state === "success"
                                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                                      )}
                                    >
                                      {result.state === "success" ? (
                                        <span className="flex items-center gap-0.5">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {result.latency_ms}ms
                                        </span>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="flex items-center gap-0.5 cursor-help">
                                              <AlertCircle className="h-3 w-3" />
                                              {t("settings.tradingAccounts.failed")}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="left"
                                            className="max-w-[200px] text-xs break-words"
                                          >
                                            {result.error ??
                                              t("settings.tradingAccounts.connectionFailed")}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </motion.span>
                                  ) : (
                                    /* Hover action: single test */
                                    <motion.button
                                      key="action"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTestSingle(acc.id);
                                      }}
                                      disabled={result?.state === "testing"}
                                      className={cn(
                                        "opacity-0 group-hover:opacity-100 transition-opacity",
                                        "p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {result?.state === "testing" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Zap className="h-3.5 w-3.5" />
                                      )}
                                    </motion.button>
                                  )}
                                </AnimatePresence>
                              </div>
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
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                    <KeyRound className="h-6 w-6 text-primary/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    {t("settings.tradingAccounts.emptyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[300px] mb-5 leading-relaxed">
                    {t("settings.tradingAccounts.emptyDescription")}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("settings.tradingAccounts.addFirstAccount")}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <TradingAccountsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </TooltipProvider>
  );
}
