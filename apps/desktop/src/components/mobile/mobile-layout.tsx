import { Outlet, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Smartphone, Link, MessageSquare, Wifi, WifiOff } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

function MobileHeader() {
  const { t } = useTranslation();
  const active = useConnectionStore((s) => s.getActive());

  return (
    <header
      className="flex items-center justify-between px-4 pb-3 border-b border-border-strong bg-background"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
    >
      <span className="text-lg font-semibold">Viben</span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {active ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-green-500">{active.name ?? t("mobile.status.connected", "Connected")}</span>
          </>
        ) : (
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
      <nav
        className="flex border-t border-border-strong bg-background"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
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
