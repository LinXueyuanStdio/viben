import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsItem } from "./components";
import { TradingAccountsDialog } from "./trading-accounts-dialog";

interface AccountSummary {
  id: string;
  exchange: string;
  name: string;
}

export function TradingAccountsSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:18790/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => {});
  }, [dialogOpen]); // refetch when dialog closes

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">交易账户</h2>
        <p className="text-sm text-muted-foreground">
          管理交易所 API 账户，用于自动化交易和数据获取。
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <SettingsItem
          title="已配置账户"
          description={`${accounts.length} 个交易账户`}
        >
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            管理交易账户
          </Button>
        </SettingsItem>

        {accounts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <Badge key={acc.id} variant="secondary">
                {acc.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <TradingAccountsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
