import { Outlet, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Smartphone, Link, MessageSquare, Wifi, WifiOff } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { useSafeArea } from "@/hooks/use-safe-area";
import { cn } from "@/lib/utils";

function MobileHeader() {
  const { t } = useTranslation();
  const active = useConnectionStore((s) => s.getActive());

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border-strong bg-background">
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

  // Apply safe area insets from native plugin
  useSafeArea();

  return (
    <div className="flex flex-col h-screen bg-background pt-[var(--safe-area-inset-top,0px)]">
      <MobileHeader />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {/* Bottom navigation with safe area padding */}
      <nav className="flex border-t border-border-strong bg-background pb-[var(--safe-area-inset-bottom,0px)]">
        {tabKeys.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs min-h-[60px]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="leading-none">{t(tab.labelKey, tab.label)}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
