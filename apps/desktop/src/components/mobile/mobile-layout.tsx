import { Outlet, NavLink } from "react-router-dom";
import { Smartphone, Link, MessageSquare, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

function MobileHeader() {
  const active = useConnectionStore((s) => s.getActive());
  const status: ConnectionStatus = (active ? "connected" : "disconnected") as ConnectionStatus;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <span className="text-lg font-semibold">Viben</span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {status === "connected" && (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-green-500">{active?.name ?? "Connected"}</span>
          </>
        )}
        {status === "connecting" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting...</span>
          </>
        )}
        {status === "disconnected" && (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-destructive">Disconnected</span>
          </>
        )}
      </div>
    </header>
  );
}

const tabs = [
  { to: "/m/devices", icon: Smartphone, label: "Devices" },
  { to: "/m/connect", icon: Link, label: "Connect" },
  { to: "/m/chat", icon: MessageSquare, label: "Chat" },
] as const;

export function MobileLayout() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <nav className="flex border-t bg-background">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center gap-1 py-2 text-xs",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
