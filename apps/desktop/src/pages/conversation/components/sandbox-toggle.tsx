/**
 * Sandbox Toggle Component
 *
 * A toggle button for enabling/disabling sandbox mode in chat,
 * with provider selection in a popover.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  ChevronDown,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSandbox, type SandboxProviderType } from "@/hooks/use-sandbox";
import { useChatConfigStore } from "@/stores/chat-config-store";

// Provider icon based on type
function ProviderIcon({
  type,
  className,
}: {
  type: SandboxProviderType;
  className?: string;
}) {
  switch (type) {
    case "codex":
      return <ShieldCheck className={className} />;
    case "claude":
      return <Shield className={className} />;
    case "native":
    default:
      return <ShieldOff className={className} />;
  }
}

// Provider display name
function getProviderDisplayName(
  type: SandboxProviderType,
  t: (key: string) => string
): string {
  switch (type) {
    case "codex":
      return t("sandbox.providerNames.codex");
    case "claude":
      return t("sandbox.providerNames.claude");
    case "native":
      return t("sandbox.providerNames.native");
  }
}

export function SandboxToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const {
    providers,
    providerDetails,
    isLoading,
    isProviderAvailable,
    refreshProviders,
  } = useSandbox();
  const {
    sandboxConfig,
    setSandboxEnabled,
    setSandboxProvider,
  } = useChatConfigStore();

  const [isOpen, setIsOpen] = React.useState(false);

  // Get current provider info
  const currentProvider = sandboxConfig.provider || "native";

  // Determine if sandbox is actually available
  const hasAvailableProviders = providers.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 h-8 px-2",
            sandboxConfig.enabled && "text-primary",
            className
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sandboxConfig.enabled ? (
            <ProviderIcon type={currentProvider} className="h-4 w-4" />
          ) : (
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs hidden sm:inline">
            {sandboxConfig.enabled
              ? getProviderDisplayName(currentProvider, t)
              : t("sandbox.off", "Sandbox")}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Header with enable toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                {t("sandbox.sandboxMode", "Sandbox Mode")}
              </span>
            </div>
            <Switch
              checked={sandboxConfig.enabled}
              onCheckedChange={setSandboxEnabled}
              disabled={!hasAvailableProviders}
            />
          </div>

          {/* No providers warning */}
          {!hasAvailableProviders && !isLoading && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              {t(
                "sandbox.noProvidersWarning",
                "No sandbox providers available. Check gateway connection."
              )}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs ml-1"
                onClick={() => refreshProviders()}
              >
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}

          {/* Provider selection */}
          {sandboxConfig.enabled && hasAvailableProviders && (
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {t("sandbox.selectProvider", "Select Provider")}
              </span>

              <div className="space-y-1">
                {providerDetails.map((provider) => {
                  const available = isProviderAvailable(provider.type);
                  const isSelected = currentProvider === provider.type;

                  return (
                    <button
                      key={provider.type}
                      onClick={() => {
                        if (available) {
                          setSandboxProvider(provider.type);
                        }
                      }}
                      disabled={!available}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                        available
                          ? "hover:bg-accent cursor-pointer"
                          : "opacity-50 cursor-not-allowed",
                        isSelected && "bg-accent"
                      )}
                    >
                      <ProviderIcon
                        type={provider.type}
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {provider.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {t("common.selected", "Selected")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {provider.capabilities.isolation}
                          </span>
                          {provider.capabilities.supportsNetworking ? (
                            <Wifi className="h-3 w-3 text-green-600" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info text */}
          {sandboxConfig.enabled && (
            <p className="text-[10px] text-muted-foreground pt-1">
              {t(
                "sandbox.infoText",
                "Commands will be executed in an isolated environment for security."
              )}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
