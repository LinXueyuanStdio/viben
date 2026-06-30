import { useState, useEffect, useCallback, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  KeyRound,
  Wallet,
  Shield,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { getGatewayClient } from "@/lib/gateway";
import { exchangeIcons } from "./exchange-icons";

interface ExchangeMeta {
  id: string;
  name: string;
  fields: string[];
  referral_url?: string;
  api_doc_url?: string;
  whitelist_ip?: string;
}

interface AccountItem {
  id: string;
  exchange: string;
  name: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Map exchange id to a brand color used for the avatar. */
function getExchangeColor(id: string): string {
  const colors: Record<string, string> = {
    binance: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    okx: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    bybit: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    bitget: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    gate: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    htx: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    kucoin: "bg-green-500/15 text-green-600 dark:text-green-400",
    mexc: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  };
  return colors[id] ?? "bg-muted text-muted-foreground";
}

/** Map exchange id to a solid brand accent color for the left strip on account cards. */
function getExchangeAccentColor(id: string): string {
  const accents: Record<string, string> = {
    binance: "before:bg-yellow-500",
    okx: "before:bg-blue-500",
    bybit: "before:bg-orange-500",
    bitget: "before:bg-cyan-500",
    gate: "before:bg-emerald-500",
    htx: "before:bg-sky-500",
    kucoin: "before:bg-green-500",
    mexc: "before:bg-indigo-500",
  };
  return accents[id] ?? "before:bg-muted-foreground";
}

interface ExchangesResponse {
  exchanges?: ExchangeMeta[];
}

interface AccountsResponse {
  accounts?: AccountItem[];
}

interface PublicIpResponse {
  ip?: string;
}

interface AccountMutationResponse {
  success: boolean;
  error?: string;
}

interface AccountTestResponse extends AccountMutationResponse {
  latency_ms?: number;
}

export function TradingAccountsDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [exchanges, setExchanges] = useState<ExchangeMeta[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formPassphrase, setFormPassphrase] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [publicIpLoading, setPublicIpLoading] = useState(false);
  const publicIpFetched = useRef(false);

  // Refs for focus management
  const exchangeListRef = useRef<HTMLDivElement>(null);
  const exchangeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const formNameInputRef = useRef<HTMLInputElement>(null);

  // Stable IDs for form label associations
  const formId = useId();

  // Live region announcement text
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Test connection state -- tracks loading and results per account
  const [testingAccounts, setTestingAccounts] = useState<Set<string>>(
    new Set()
  );
  const [testResults, setTestResults] = useState<
    Map<string, { success: boolean; latency_ms?: number; error?: string }>
  >(new Map());

  const fetchData = useCallback(async () => {
    try {
      const client = getGatewayClient();
      const [exRes, accRes] = await Promise.all([
        client.get<ExchangesResponse>("/api/exchanges"),
        client.get<AccountsResponse>("/api/accounts"),
      ]);
      const exchanges = exRes.exchanges ?? [];
      setExchanges(exchanges);
      setAccounts(accRes.accounts ?? []);
      if (exchanges.length > 0) {
        setSelectedExchange((prev) => prev || exchanges[0].id);
      }
    } catch {
      toast.error(t("settings.tradingAccounts.loadFailed"));
    }
  }, []);

  const fetchPublicIp = useCallback(async () => {
    if (publicIpFetched.current) return;
    setPublicIpLoading(true);
    try {
      const data = await getGatewayClient().get<PublicIpResponse>("/api/system/public-ip");
      if (data.ip) {
        setPublicIp(data.ip);
        publicIpFetched.current = true;
      }
    } catch {
      // silently fail
    } finally {
      setPublicIpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData().then(() => {
        // Focus the first exchange button after data loads
        requestAnimationFrame(() => {
          const firstBtn = exchangeButtonRefs.current.values().next().value;
          if (firstBtn) firstBtn.focus();
        });
      });
      fetchPublicIp();
    }
  }, [open, fetchData, fetchPublicIp]);

  const currentExchange = exchanges.find((e) => e.id === selectedExchange);
  const exchangeAccounts = accounts.filter(
    (a) => a.exchange === selectedExchange
  );

  const isFormValid =
    formApiKey.trim().length > 0 &&
    formSecret.trim().length > 0 &&
    formName.trim().length > 0 &&
    (!currentExchange?.fields.includes("passphrase") ||
      formPassphrase.trim().length > 0);

  const resetForm = () => {
    const count = exchangeAccounts.length + 1;
    setFormName(`${currentExchange?.name ?? ""} #${count}`);
    setFormApiKey("");
    setFormSecret("");
    setFormPassphrase("");
    setShowApiKey(false);
    setShowSecret(false);
  };

  const handleSelectExchange = (id: string) => {
    setSelectedExchange(id);
    setShowForm(false);
  };

  const handleExchangeKeyDown = (
    e: React.KeyboardEvent,
    currentId: string
  ) => {
    const ids = exchanges.map((ex) => ex.id);
    const idx = ids.indexOf(currentId);
    let targetId: string | undefined;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      targetId = ids[idx + 1] ?? ids[0]; // wrap to top
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      targetId = ids[idx - 1] ?? ids[ids.length - 1]; // wrap to bottom
    } else if (e.key === "Home") {
      e.preventDefault();
      targetId = ids[0];
    } else if (e.key === "End") {
      e.preventDefault();
      targetId = ids[ids.length - 1];
    }

    if (targetId) {
      handleSelectExchange(targetId);
      exchangeButtonRefs.current.get(targetId)?.focus();
    }
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
    // Focus the first form field after render
    requestAnimationFrame(() => {
      formNameInputRef.current?.focus();
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        exchange: selectedExchange,
        name: formName,
        api_key: formApiKey,
        secret: formSecret,
      };
      if (formPassphrase) body.passphrase = formPassphrase;

      const data = await getGatewayClient().post<AccountMutationResponse>("/api/accounts", body);
      if (data.success) {
        toast.success(t("settings.tradingAccounts.addSuccess"));
        setShowForm(false);
        await fetchData();
      } else {
        toast.error(data.error ?? t("settings.tradingAccounts.saveFailed"));
      }
    } catch {
      toast.error(t("settings.tradingAccounts.networkError"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingAccounts((prev) => new Set(prev).add(id));
    setTestResults((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    try {
      const data = await getGatewayClient().post<AccountTestResponse>(`/api/accounts/${id}/test`);
      if (data.success) {
        setTestResults((prev) =>
          new Map(prev).set(id, {
            success: true,
            latency_ms: data.latency_ms,
          })
        );
        setLiveAnnouncement(t("settings.tradingAccounts.connectSuccess", { latency: data.latency_ms }));
        toast.success(t("settings.tradingAccounts.connectSuccess", { latency: data.latency_ms }));
      } else {
        const errMsg = data.error ?? t("common.unknownError", "未知错误");
        setTestResults((prev) =>
          new Map(prev).set(id, { success: false, error: errMsg })
        );
        setLiveAnnouncement(t("settings.tradingAccounts.connectFailed", { error: errMsg }));
        toast.error(t("settings.tradingAccounts.connectFailed", { error: errMsg }));
      }
    } catch {
      setTestResults((prev) =>
        new Map(prev).set(id, { success: false, error: t("settings.tradingAccounts.networkError") })
      );
      setLiveAnnouncement(t("settings.tradingAccounts.connectNetworkError"));
      toast.error(t("settings.tradingAccounts.connectNetworkError"));
    } finally {
      setTestingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const data = await getGatewayClient().request<AccountMutationResponse>(`/api/accounts/${id}`, {
        method: "DELETE",
      });
      if (data.success) {
        toast.success(t("settings.tradingAccounts.deleteSuccess"));
        await fetchData();
      } else {
        toast.error(data.error ?? t("settings.tradingAccounts.deleteFailed"));
      }
    } catch {
      toast.error(t("settings.tradingAccounts.networkError"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[calc(100vh-4rem)] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{t("settings.tradingAccounts.title", "导入交易账户")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Left panel -- exchange list */}
            <ScrollArea className="w-56 border-r bg-muted/30">
              <div
                ref={exchangeListRef}
                className="p-2 space-y-1"
                role="listbox"
                aria-label={t("settings.tradingAccounts.exchange-list", "交易所列表")}
                aria-activedescendant={selectedExchange ? `exchange-${selectedExchange}` : undefined}
              >
                {exchanges.map((ex) => {
                  const count = accounts.filter(
                    (a) => a.exchange === ex.id
                  ).length;
                  const isActive = selectedExchange === ex.id;
                  return (
                    <button
                      key={ex.id}
                      id={`exchange-${ex.id}`}
                      ref={(el) => {
                        if (el) exchangeButtonRefs.current.set(ex.id, el);
                        else exchangeButtonRefs.current.delete(ex.id);
                      }}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectExchange(ex.id)}
                      onKeyDown={(e) => handleExchangeKeyDown(e, ex.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-background text-foreground shadow-sm border"
                          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md",
                          getExchangeColor(ex.id)
                        )}
                      >
                        {exchangeIcons[ex.id]
                          ? exchangeIcons[ex.id]({ size: 18 })
                          : <span className="text-xs font-bold">{ex.name.charAt(0).toUpperCase()}</span>}
                      </span>
                      <span className="flex-1 text-left font-medium truncate">
                        {ex.name}
                      </span>
                      {count > 0 && (
                        <Badge
                          key={count}
                          variant="secondary"
                          className="text-[10px] h-5 min-w-5 justify-center px-1.5 animate-pulse"
                          aria-label={t("settings.tradingAccounts.accountCountBadge", "{{count}} 个账户", { count })}
                        >
                          {count}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Right panel -- form / account list */}
            <div className="flex-1 overflow-y-auto">
              {/* 1. Fade+slide transition when switching exchanges */}
              <AnimatePresence mode="wait">
              {currentExchange && (
                <motion.div
                  key={selectedExchange}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="p-6 space-y-5"
                >
                  {/* Section header with exchange name and action links */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex items-center justify-center w-9 h-9 rounded-lg",
                          getExchangeColor(currentExchange.id)
                        )}
                      >
                        {exchangeIcons[currentExchange.id]
                          ? exchangeIcons[currentExchange.id]({ size: 22 })
                          : <span className="text-sm font-bold">{currentExchange.name.charAt(0).toUpperCase()}</span>}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold leading-tight">
                          {currentExchange.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {exchangeAccounts.length === 0
                            ? t("settings.tradingAccounts.notConfigured", "尚未配置账户")
                            : t("settings.tradingAccounts.configuredCount", "{{count}} 个已配置账户", { count: exchangeAccounts.length })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {currentExchange.referral_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={currentExchange.referral_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("settings.tradingAccounts.registerDiscount", "注册(手续费折扣)")}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      {currentExchange.api_doc_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={currentExchange.api_doc_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("settings.tradingAccounts.createApi", "创建API")}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Whitelist IP (Binance) */}
                  {currentExchange.id === "binance" && (
                    <div className="p-3 rounded-lg border border-l-[3px] border-l-yellow-500 bg-muted/50 flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                        {t("settings.tradingAccounts.whitelistIp", "白名单IP:")}{" "}
                        {publicIpLoading ? (
                          <span className="text-muted-foreground">
                            {t("settings.tradingAccounts.fetching", "获取中...")}
                          </span>
                        ) : publicIp ? (
                          <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                            {publicIp}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("settings.tradingAccounts.cannotFetchIp", "无法获取，请运行 curl https://api.ipify.org")}
                          </span>
                        )}
                      </span>
                      {publicIp && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("settings.tradingAccounts.copyIpAddress", "复制IP地址")}
                          onClick={() => {
                            navigator.clipboard.writeText(publicIp);
                            toast.success(t("settings.tradingAccounts.ipCopied"));
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Existing accounts or empty state */}
                  {!showForm && (
                    <>
                      {exchangeAccounts.length > 0 ? (
                        <div className="space-y-2" role="list" aria-label={t("settings.tradingAccounts.accountList", "{{name}} 账户列表", { name: currentExchange.name })}>
                          {/* 3. Staggered scale+fade on account cards */}
                          {exchangeAccounts.map((acc, index) => {
                            const isTesting = testingAccounts.has(acc.id);
                            const testResult = testResults.get(acc.id);
                            return (
                              <motion.div
                                key={acc.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  duration: 0.25,
                                  delay: index * 0.05,
                                  ease: "easeOut",
                                }}
                                role="listitem"
                                className={cn(
                                  "group relative flex items-center justify-between p-3 pl-5 rounded-lg border bg-card transition-colors hover:border-foreground/20",
                                  "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full",
                                  getExchangeAccentColor(acc.exchange)
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {acc.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(
                                        acc.created_at
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {/* 4. Pulse animation on test result badge */}
                                  <AnimatePresence>
                                    {testResult && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{
                                          opacity: 1,
                                          scale: [1, 1.15, 1],
                                        }}
                                        transition={{
                                          duration: 0.4,
                                          ease: "easeOut",
                                          scale: { times: [0, 0.5, 1] },
                                        }}
                                        className={cn(
                                          "flex items-center gap-1 text-xs shrink-0",
                                          testResult.success
                                            ? "text-green-600"
                                            : "text-red-600"
                                        )}
                                      >
                                        {testResult.success ? (
                                          <>
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span>
                                              {testResult.latency_ms}ms
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <span title={testResult.error}>
                                              {testResult.error}
                                            </span>
                                          </>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleTest(acc.id)}
                                    disabled={isTesting}
                                    aria-label={t("settings.tradingAccounts.testConnectionLabel", "测试连接 {{name}}", { name: acc.name })}
                                  >
                                    {isTesting ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Zap className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() =>
                                      setDeleteTarget({
                                        id: acc.id,
                                        name: acc.name,
                                      })
                                    }
                                    aria-label={t("settings.tradingAccounts.deleteAccountLabel", "删除账户 {{name}}", { name: acc.name })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Empty state */
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
                            <KeyRound className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground mb-1">
                            {t("settings.tradingAccounts.noExchangeAccounts", "暂无 {{name}} 账户", { name: currentExchange.name })}
                          </p>
                          <p className="text-xs text-muted-foreground max-w-[280px] mb-5">
                            {t("settings.tradingAccounts.addApiKeysDesc", "添加 API 密钥以开始使用自动化交易和实时数据获取功能")}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddNew}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            {t("settings.tradingAccounts.addFirstAccount", "添加第一个账户")}
                          </Button>
                        </div>
                      )}

                      {/* Add button (shown when accounts already exist) */}
                      {exchangeAccounts.length > 0 && (
                        <Button variant="outline" onClick={handleAddNew}>
                          <Plus className="h-4 w-4 mr-1.5" />
                          {t("settings.tradingAccounts.addNewAccount", "添加新账户")}
                        </Button>
                      )}
                    </>
                  )}

                  {/* 2. Expand animation on form (collapsed -> expanded) */}
                  <AnimatePresence>
                  {showForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      style={{ overflow: "hidden" }}
                    >
                    <div className="space-y-4 rounded-lg border bg-card p-4 transition-shadow focus-within:ring-1 focus-within:ring-ring">
                      <div>
                        <label htmlFor={`${formId}-name`} className="text-sm font-medium">{t("settings.tradingAccounts.accountName", "账户名称")}</label>
                        <Input
                          ref={formNameInputRef}
                          id={`${formId}-name`}
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder={t("settings.tradingAccounts.accountNamePlaceholder", "例如 Main Trading")}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label htmlFor={`${formId}-apikey`} className="text-sm font-medium">
                          {t("settings.tradingAccounts.apiKey", "API密钥")}{" "}
                          <span className="text-red-500" aria-hidden="true">*</span>
                          <span className="sr-only">{t("settings.tradingAccounts.required", "(必填)")}</span>
                        </label>
                        <div className="relative mt-1">
                          <Input
                            id={`${formId}-apikey`}
                            type={showApiKey ? "text" : "password"}
                            value={formApiKey}
                            onChange={(e) => setFormApiKey(e.target.value)}
                            placeholder={t("settings.tradingAccounts.enterApiKey", "请输入API密钥")}
                            aria-required="true"
                            aria-describedby={`${formId}-apikey-hint`}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            aria-label={showApiKey ? t("settings.tradingAccounts.hideApiKey", "隐藏API密钥") : t("settings.tradingAccounts.showApiKey", "显示API密钥")}
                            className={cn(
                              "absolute right-0 top-0 h-full px-3",
                              "flex items-center justify-center",
                              "text-muted-foreground hover:text-foreground",
                              "rounded-r-md transition-colors"
                            )}
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p id={`${formId}-apikey-hint`} className="text-xs text-muted-foreground mt-1">
                          {t("settings.tradingAccounts.apiKeyEncrypted", "API Key 将被加密存储，请确保其有效")}
                        </p>
                      </div>

                      <div>
                        <label htmlFor={`${formId}-secret`} className="text-sm font-medium">
                          {t("settings.tradingAccounts.secret", "密钥")}{" "}
                          <span className="text-red-500" aria-hidden="true">*</span>
                          <span className="sr-only">{t("settings.tradingAccounts.required", "(必填)")}</span>
                        </label>
                        <div className="relative mt-1">
                          <Input
                            id={`${formId}-secret`}
                            type={showSecret ? "text" : "password"}
                            value={formSecret}
                            onChange={(e) => setFormSecret(e.target.value)}
                            placeholder={t("settings.tradingAccounts.enterSecret", "输入密钥")}
                            aria-required="true"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            aria-label={showSecret ? t("settings.tradingAccounts.hideSecret", "显示密钥") : t("settings.tradingAccounts.showSecret", "显示密钥")}
                            className={cn(
                              "absolute right-0 top-0 h-full px-3",
                              "flex items-center justify-center",
                              "text-muted-foreground hover:text-foreground",
                              "rounded-r-md transition-colors"
                            )}
                            onClick={() => setShowSecret(!showSecret)}
                          >
                            {showSecret ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {currentExchange.fields.includes("passphrase") && (
                        <div>
                          <label htmlFor={`${formId}-passphrase`} className="text-sm font-medium">
                            {t("settings.tradingAccounts.passphrase", "密码(Passphrase)")}{" "}
                            <span className="text-red-500" aria-hidden="true">*</span>
                            <span className="sr-only">{t("settings.tradingAccounts.required", "(必填)")}</span>
                          </label>
                          <Input
                            id={`${formId}-passphrase`}
                            type="password"
                            value={formPassphrase}
                            onChange={(e) => setFormPassphrase(e.target.value)}
                            placeholder={t("settings.tradingAccounts.enterPassphrase", "输入密码(Passphrase)")}
                            aria-required="true"
                            className="mt-1"
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          variant="ghost"
                          onClick={() => setShowForm(false)}
                          disabled={saving}
                        >
                          {t("settings.tradingAccounts.cancel", "取消")}
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={saving || !isFormValid}
                        >
                          {saving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {saving ? t("settings.tradingAccounts.saving", "保存中...") : t("settings.tradingAccounts.saveConfig", "保存配置")}
                        </Button>
                      </div>
                    </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screen reader live region for test connection announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.tradingAccounts.confirmDeleteTitle", "确认删除账户")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.tradingAccounts.confirmDeleteDesc", "即将删除账户「{{name}}」，此操作不可撤销。删除后该账户的 API 密钥将被永久移除。", { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.tradingAccounts.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {t("settings.tradingAccounts.delete", "删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
