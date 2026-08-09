"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { GithubIcon, GoogleIcon } from "@/components/ui/icons";
import type { OAuthConnectionStatus } from "@/app/api/account/oauth-connections/route";

async function fetchConnections(): Promise<OAuthConnectionStatus[]> {
  const res = await fetch("/api/account/oauth-connections");
  if (!res.ok) throw new Error("Failed to fetch OAuth connections");
  const data = await res.json();
  return data.providers;
}

async function disconnectProvider(provider: string): Promise<void> {
  const res = await fetch(`/api/account/oauth-connections?provider=${provider}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to disconnect");
  }
}

const PROVIDER_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ size?: number }>;
    nameKey: string;
    connectUrl: string;
    colorClass?: string;
  }
> = {
  google: {
    icon: GoogleIcon,
    nameKey: "profile.connectedAccounts.providers.google",
    connectUrl: "/api/auth/google?redirect=/settings/account",
  },
  github: {
    icon: GithubIcon,
    nameKey: "profile.connectedAccounts.providers.github",
    connectUrl: "/api/auth/github?redirect=/settings/account",
  },
};

interface ProviderRowProps {
  provider: OAuthConnectionStatus;
  onDisconnect: (provider: string) => void;
  disconnecting: string | null;
}

function ProviderRow({ provider, onDisconnect, disconnecting }: ProviderRowProps) {
  const { t } = useTranslation();
  const config = PROVIDER_CONFIG[provider.provider];
  if (!config) return null;

  const Icon = config.icon;
  const isBusy = disconnecting === provider.provider;

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <Icon size={22} />
        <div>
          <p className="text-sm font-medium">{t(config.nameKey)}</p>
          <p className="text-xs text-muted-foreground">
            {provider.connected
              ? t("profile.connectedAccounts.connected")
              : t("profile.connectedAccounts.notConnected")}
          </p>
        </div>
      </div>
      {provider.connected ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDisconnect(provider.provider)}
          disabled={isBusy}
        >
          {isBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {t("profile.connectedAccounts.disconnect")}
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={config.connectUrl}>{t("profile.connectedAccounts.connect")}</a>
        </Button>
      )}
    </div>
  );
}

export function ConnectedAccountsCard() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<OAuthConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const data = await fetchConnections();
      setProviders(data);
    } catch {
      toast.error(t("profile.connectedAccounts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const handleDisconnect = useCallback(
    async (provider: string) => {
      setDisconnecting(provider);
      try {
        await disconnectProvider(provider);
        setProviders((prev) =>
          prev.map((p) => (p.provider === provider ? { ...p, connected: false } : p)),
        );
        toast.success(t("profile.connectedAccounts.disconnectedSuccess"));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t("profile.connectedAccounts.disconnectError"),
        );
      } finally {
        setDisconnecting(null);
      }
    },
    [t],
  );

  return (
    <section className="rounded-lg border">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{t("profile.connectedAccounts.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("profile.connectedAccounts.description")}
        </p>
      </div>
      <div className="divide-y px-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          providers.map((p) => (
            <ProviderRow
              key={p.provider}
              provider={p}
              onDisconnect={handleDisconnect}
              disconnecting={disconnecting}
            />
          ))
        )}
      </div>
    </section>
  );
}
