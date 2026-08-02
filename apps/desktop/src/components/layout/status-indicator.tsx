import { useState, useRef, useCallback, useEffect } from "react";
import { Settings, FileText, Smartphone, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConsoleDialog } from "@/components/console";
import { GatewayStatusIndicator } from "@/components/status/gateway-status-indicator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import {
  DEFAULT_SETTINGS_SECTION,
  getSettingsSectionConfig,
} from "@/navigation/settings-sections";
import { getSettingsSectionDescriptor } from "@/navigation/navigation-meta";

interface SidebarBottomDrawerProps {
  collapsed: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
  iconValue: string;
  settingsSection?: string;
}

const defaultSettingsDescriptor =
  getSettingsSectionDescriptor(DEFAULT_SETTINGS_SECTION);
const defaultSettingsConfig = getSettingsSectionConfig(DEFAULT_SETTINGS_SECTION);

const NAV_ITEMS: NavItem[] = [
  { titleKey: "nav.documents", href: "/documents", icon: FileText, iconValue: "file-text" },
  { titleKey: "nav.devices", href: "/devices/pair", icon: Smartphone, iconValue: "smartphone" },
  {
    titleKey: "settings.title",
    href: `/settings/${defaultSettingsDescriptor?.section ?? DEFAULT_SETTINGS_SECTION}`,
    icon: defaultSettingsConfig?.icon ?? Settings,
    iconValue: defaultSettingsDescriptor?.icon.value ?? "settings",
    settingsSection: defaultSettingsDescriptor?.section ?? DEFAULT_SETTINGS_SECTION,
  },
];

export function SidebarBottomDrawer({ collapsed, onOpenChange }: SidebarBottomDrawerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openPath, openSettings } = useDesktopRouting();
  const { status, error } = useGatewayStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notify parent of open state changes
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  }, [onOpenChange]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    handleOpenChange(true);
  }, [clearCloseTimeout, handleOpenChange]);

  const handleMouseLeave = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      handleOpenChange(false);
    }, 300);
  }, [clearCloseTimeout, handleOpenChange]);

  const handleNavigate = useCallback(
    (href: string, titleKey: string, iconValue: string, settingsSection?: string) => {
      if (settingsSection) {
        openSettings(settingsSection);
        return;
      }
      openPath(href, {
        title: t(titleKey),
        icon: { type: "lucide", value: iconValue },
      });
    },
    [openPath, openSettings, t]
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
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (collapsed) {
    return (
      <>
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <PopoverTrigger asChild>
              <div className="grid place-items-center w-full">
                <GatewayStatusIndicator collapsed disableTooltip={isOpen} />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              sideOffset={8}
              className="w-48 p-1"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="flex flex-col gap-0.5">
                {/* User info */}
                {user && (
                  <button
                    type="button"
                    onClick={() => window.open("https://viben-web.vercel.app/profile", "_blank")}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                      "transition-colors duration-200",
                      "hover:bg-accent"
                    )}
                  >
                    <Avatar size="default">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                      <AvatarFallback>{getInitials(user.displayName || user.username)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-popover-foreground">{user.displayName || user.username}</span>
                  </button>
                )}
                {/* Nav items with text labels */}
                {NAV_ITEMS.slice(0, 1).map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleNavigate(item.href, item.titleKey, item.iconValue, item.settingsSection)}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                      "transition-colors duration-200",
                      "text-popover-foreground/70 hover:bg-accent hover:text-popover-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
                    <span>{t(item.titleKey)}</span>
                  </button>
                ))}
                {/* Console button */}
                <button
                  type="button"
                  onClick={() => {
                    setConsoleOpen(true);
                    handleOpenChange(false);
                  }}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                    "transition-colors duration-200",
                    "text-popover-foreground/70 hover:bg-accent hover:text-popover-foreground"
                  )}
                >
                  <Terminal className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
                  <span>{t("nav.console")}</span>
                </button>
                {/* Remaining nav items */}
                {NAV_ITEMS.slice(1).map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleNavigate(item.href, item.titleKey, item.iconValue, item.settingsSection)}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                      "transition-colors duration-200",
                      "text-popover-foreground/70 hover:bg-accent hover:text-popover-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
                    <span>{t(item.titleKey)}</span>
                  </button>
                ))}
                {/* Gateway description */}
                <Separator className="my-0.5" />
                <p className="px-3 py-1.5 text-xs text-muted-foreground leading-relaxed">
                  {gatewayDescription}
                </p>
              </div>
            </PopoverContent>
          </div>
        </Popover>
        <ConsoleDialog open={consoleOpen} onOpenChange={setConsoleOpen} />
      </>
    );
  }

  // Expanded sidebar
  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <PopoverTrigger asChild>
            <div>
              <GatewayStatusIndicator collapsed={false} disableTooltip={isOpen} />
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={4}
            className="w-[var(--radix-popover-trigger-width)] p-1"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex flex-col gap-0.5">
              {/* User info */}
              {user && (
                <button
                  type="button"
                  onClick={() => window.open("https://viben-web.vercel.app/profile", "_blank")}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                    "transition-colors duration-200",
                    "hover:bg-accent"
                  )}
                >
                  <Avatar size="default">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                    <AvatarFallback>{getInitials(user.displayName || user.username)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-popover-foreground">{user.displayName || user.username}</span>
                </button>
              )}
              {/* Nav items — same gap-3 px-3 py-2 rounded-lg text-sm as NavItemComponent */}
              {NAV_ITEMS.slice(0, 1).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleNavigate(item.href, item.titleKey, item.iconValue, item.settingsSection)}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                    "transition-colors duration-200",
                    "text-popover-foreground/70 hover:bg-accent hover:text-popover-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
                  <span>{t(item.titleKey)}</span>
                </button>
              ))}
              {/* Console button */}
              <button
                type="button"
                onClick={() => {
                  setConsoleOpen(true);
                  handleOpenChange(false);
                }}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                  "transition-colors duration-200",
                  "text-popover-foreground/70 hover:bg-accent hover:text-popover-foreground"
                )}
              >
                <Terminal className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
                <span>{t("nav.console")}</span>
              </button>
              {/* Remaining nav items */}
              {NAV_ITEMS.slice(1).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleNavigate(item.href, item.titleKey, item.iconValue, item.settingsSection)}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-left",
                    "transition-colors duration-200",
                    "text-popover-foreground/70 hover:bg-accent hover:text-popover-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
                  <span>{t(item.titleKey)}</span>
                </button>
              ))}
              {/* Gateway description */}
              <Separator className="my-0.5" />
              <p className="px-3 py-1.5 text-xs text-muted-foreground leading-relaxed">
                {gatewayDescription}
              </p>
            </div>
          </PopoverContent>
        </div>
      </Popover>
      <ConsoleDialog open={consoleOpen} onOpenChange={setConsoleOpen} />
    </>
  );
}
