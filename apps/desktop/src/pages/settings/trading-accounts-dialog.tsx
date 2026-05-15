import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Eye, EyeOff, Copy, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const GATEWAY = "http://127.0.0.1:18790";

export function TradingAccountsDialog({ open, onOpenChange }: Props) {
  const [exchanges, setExchanges] = useState<ExchangeMeta[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formPassphrase, setFormPassphrase] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [exRes, accRes] = await Promise.all([
        fetch(`${GATEWAY}/api/exchanges`).then((r) => r.json()),
        fetch(`${GATEWAY}/api/accounts`).then((r) => r.json()),
      ]);
      setExchanges(exRes.exchanges ?? []);
      setAccounts(accRes.accounts ?? []);
      if (exRes.exchanges?.length > 0) {
        setSelectedExchange((prev) => prev || exRes.exchanges[0].id);
      }
    } catch {
      toast.error("Failed to load exchange data");
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const currentExchange = exchanges.find((e) => e.id === selectedExchange);
  const exchangeAccounts = accounts.filter((a) => a.exchange === selectedExchange);

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

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
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

      const res = await fetch(`${GATEWAY}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("账户添加成功");
        setShowForm(false);
        await fetchData();
      } else {
        toast.error(data.error ?? "保存失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    toast.info("测试连接中...");
    try {
      const res = await fetch(`${GATEWAY}/api/accounts/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`连接成功 (${data.latency_ms}ms)`);
      } else {
        toast.error(`连接失败: ${data.error}`);
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该账户？")) return;
    try {
      const res = await fetch(`${GATEWAY}/api/accounts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("账户已删除");
        await fetchData();
      } else {
        toast.error(data.error ?? "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>导入交易账户</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — exchange list */}
          <ScrollArea className="w-56 border-r">
            <div className="p-2">
              {exchanges.map((ex) => {
                const count = accounts.filter((a) => a.exchange === ex.id).length;
                return (
                  <button
                    key={ex.id}
                    onClick={() => handleSelectExchange(ex.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                      selectedExchange === ex.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">{ex.name}</span>
                    {count > 0 && <Badge variant="secondary" className="text-xs">{count}</Badge>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Right panel — form / account list */}
          <div className="flex-1 overflow-y-auto p-6">
            {currentExchange && (
              <>
                {/* Top links */}
                <div className="flex gap-2 mb-4">
                  {currentExchange.referral_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentExchange.referral_url} target="_blank" rel="noreferrer">
                        注册(手续费折扣) <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {currentExchange.api_doc_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={currentExchange.api_doc_url} target="_blank" rel="noreferrer">
                        创建API <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>

                {/* Whitelist IP (Binance) */}
                {currentExchange.whitelist_ip && (
                  <div className="mb-4 p-3 rounded-lg border bg-muted/50 flex items-center justify-between">
                    <span className="text-sm">白名单IP: <code>{currentExchange.whitelist_ip}</code></span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(currentExchange.whitelist_ip!);
                        toast.success("IP已复制");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Existing accounts */}
                {exchangeAccounts.length > 0 && !showForm && (
                  <div className="space-y-2 mb-4">
                    {exchangeAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(acc.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleTest(acc.id)}>
                            <Zap className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new / Form */}
                {!showForm ? (
                  <Button variant="outline" onClick={handleAddNew}>+ 添加新账户</Button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">账户名称</label>
                      <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" />
                    </div>

                    <div>
                      <label className="text-sm font-medium">API密钥 *</label>
                      <div className="relative mt-1">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={formApiKey}
                          onChange={(e) => setFormApiKey(e.target.value)}
                          placeholder="请输入API密钥"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">API Key 将被存储，请确保其有效</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">密钥 *</label>
                      <div className="relative mt-1">
                        <Input
                          type={showSecret ? "text" : "password"}
                          value={formSecret}
                          onChange={(e) => setFormSecret(e.target.value)}
                          placeholder="输入密钥"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {currentExchange.fields.includes("passphrase") && (
                      <div>
                        <label className="text-sm font-medium">密码(Passphrase) *</label>
                        <Input
                          type="password"
                          value={formPassphrase}
                          onChange={(e) => setFormPassphrase(e.target.value)}
                          placeholder="输入密码(Passphrase)"
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? "保存中..." : "保存配置"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
