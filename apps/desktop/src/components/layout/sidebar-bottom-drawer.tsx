import { useState, useRef, useCallback } from "react";
import { Settings, FileText, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { GatewayStatusIndicator } from "@/components/status/gateway-status-indicator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePageTabs } from "@/hooks/use-page-tabs";
import { useGatewayStatus } from "@/hooks/use-gateway-status";

interface SidebarBottomDrawerProps {
  collapsed: boolean;
}

/**
 * Sidebar bottom drawer that shows gateway status as a trigger button.
 * On hover, it expands upward to reveal user info, navigation items,
 * and gateway status description.
 */
export function SidebarBottomDrawer({ collapsed }: SidebarBottomDrawerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openGlobalView } = usePageTabs();
  const { status, error } = useGatewayStatus();
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    setIsOpen(true);
  }, [clearCloseTimeout]);

  const handleMouseLeave = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  }, [clearCloseTimeout]);

  const handleNavigate = useCallback(
    (href: string, titleKey: string, iconValue: string) => {
      openGlobalView(href, t(titleKey), {
        type: "lucide",
        value: iconValue,
      });
    },
    [openGlobalView, t]
  );

  const gatewayDescription = (() => {
    switch (status) {
      case "connected":
        return t("gateway.connectedTooltip");
      case "connecting":
        return t("gateway.connectingTooltip");
      case "disconnected":
        return t("gateway.disconnectedTooltip");
      case "error":
        return error || t("gateway.errorTooltip");
      default:
        return "";
    }
  })();

  const getInitials = (name: string): string => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navItems = [
    { titleKey: "nav.documents", href: "/documents", icon: FileText, iconValue: "file-text" },
    { titleKey: "nav.devices", href: "/devices/pair", icon: Smartphone, iconValue: "smartphone" },
    { titleKey: "nav.settings", href: "/settings/general", icon: Settings, iconValue: "settings" },
  ];

  if (collapsed) {
    return (
      <div
        className="relative pb-2"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Expanded drawer (appears above trigger) */}
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 z-50",
            "w-[calc(100%-8px)]",
            "transition-all duration-200 ease-out",
            isOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-1 pointer-events-none"
          )}
        >
          <div className="rounded-lg border bg-popover p-1 shadow-md flex flex-col gap-0.5 mb-1">
            {user && (
              <div className="grid place-items-center w-full">
                <button
                  type="button"
                  onClick={() => window.open("https://viben-web.vercel.app/profile", "_blank")}
                  className="flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-accent"
                >
                  <Avatar size="sm">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                    <AvatarFallback className="text-[10px]">{getInitials(user.displayName || user.username)}</AvatarFallback>
                  </Avatar>
                </button>
              </div>
            )}
            {navItems.map((item) => (
              <div key={item.href} className="grid place-items-center w-full">
                <button
                  type="button"
                  onClick={() => handleNavigate(item.href, item.titleKey, item.iconValue)}
                  className="flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-accent text-popover-foreground/70"
                >
                  <item.icon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Trigger: Gateway Status */}
        <div className="grid place-items-center w-full">
          <GatewayStatusIndicator collapsed />
        </div>
      </div>
    );
  }

  // Expanded sidebar
  return (
    <div
      className="relative pb-2 px-2"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Expanded drawer (appears above trigger) */}
      <div
        className={cn(
          "absolute bottom-full left-2 right-2 z-50",
          "transition-all duration-200 ease-out",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-1 pointer-events-none"
        )}
      >
        <div className="rounded-lg border bg-popover p-1 shadow-md flex flex-col gap-0.5 mb-1">
          {user && (
            <button
              type="button"
              onClick={() => window.open("https://viben-web.vercel.app/profile", "_blank")}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left transition-colors hover:bg-accent"
            >
              <Avatar size="sm">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                <AvatarFallback className="text-[10px]">{getInitials(user.displayName || user.username)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-popover-foreground text-xs">{user.displayName || user.username}</span>
            </button>
          )}
          {navItems.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => handleNavigate(item.href, item.titleKey, item.iconValue)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs w-full text-left transition-colors hover:bg-accent text-popover-foreground/70"
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{t(item.titleKey)}</span>
            </button>
          ))}
          {/* Gateway description */}
          <div className="px-2 py-1">
            <p className="text-[11px] text-muted-foreground leading-snug">{gatewayDescription}</p>
          </div>
        </div>
      </div>

      {/* Trigger: Gateway Status */}
      <GatewayStatusIndicator collapsed={false} />
    </div>
  );
}
