import { Outlet, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Smartphone, Link, MessageSquare, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

function MobileHeader() {
  const { t } = useTranslation();
  const active = useConnectionStore((s) => s.getActive());
  const status: ConnectionStatus = (active ? "connected" : "disconnected") as ConnectionStatus;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <span className="text-lg font-semibold">Viben</span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {status === "connected" && (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-green-500">{active?.name ?? t("mobile.status.connected", "Connected")}</span>
          </>
        )}
        {status === "connecting" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("mobile.status.connecting", "Connecting...")}</span>
          </>
        )}
        {status === "disconnected" && (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-destructive">{t("mobile.status.disconnected", "Disconnected")}</span>
          </>
        )}
      </div>
    </header>
  );
}

const tabKeys = [
  { to: "/m/devices", icon: Smartphone, labelKey: "mobile.tabs.devices", label: "Devices" },
  { to: "/m/connect", icon: Link, labelKey: "mobile.tabs.connect", label: "Connect" },
  { to: "/m/chat", icon: MessageSquare, labelKey: "mobile.tabs.chat", label: "Chat" },
] as const;

export function MobileLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {/* Bottom navigation with safe area padding for Android/iOS system navigation */}
      <nav className="flex border-t bg-background pb-[env(safe-area-inset-bottom,0px)]">
        {tabKeys.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            <span>{t(tab.labelKey, tab.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
