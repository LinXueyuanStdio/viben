/**
 * Node.js Section Component for EnvCheck
 *
 * Displays Node.js version selection UI within the environment check flow.
 * Shows detected Node.js installations and allows custom path input.
 */

import { useTranslation } from "react-i18next";
import { Check, AlertCircle, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NodeInfo } from "@/hooks/use-node-installer";

// ============================================================================
// Types
// ============================================================================

export interface NodejsSectionProps {
  /** List of detected Node.js versions */
  nodeVersions: NodeInfo[];
  /** Currently selected Node.js path */
  selectedPath: string | null;
  /** Callback when a Node.js version is selected */
  onSelect: (path: string) => void;
  /** Custom path input value */
  customPath: string;
  /** Callback when custom path input changes */
  onCustomPathChange: (path: string) => void;
  /** Callback when browse button is clicked */
  onBrowse: () => void;
  /** Whether checking custom path */
  isCheckingCustomPath?: boolean;
  /** Custom path error message */
  customPathError?: string | null;
  /** Callback to check custom path */
  onCheckCustomPath?: () => void;
  /** Whether loading Node.js versions */
  isLoading?: boolean;
  /** Callback to refresh Node.js versions */
  onRefresh?: () => void;
  /** Required Node.js version */
  requiredVersion?: string;
}

// ============================================================================
// Helper
// ============================================================================

function getSourceLabel(source: string): string {
  switch (source) {
    case "nvm":
      return "nvm";
    case "fnm":
      return "fnm";
    case "volta":
      return "Volta";
    case "homebrew":
      return "Homebrew";
    case "system":
      return "System";
    case "current":
      return "当前使用";
    case "custom":
      return "自定义";
    case "other":
      return "其他";
    default:
      return source;
  }
}

// ============================================================================
// Component
// ============================================================================

export function NodejsSection({
  nodeVersions,
  selectedPath,
  onSelect,
  customPath,
  onCustomPathChange,
  onBrowse,
  isCheckingCustomPath,
  customPathError,
  onCheckCustomPath,
  isLoading,
  onRefresh,
  requiredVersion = "22.16.0",
}: NodejsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Node.js list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t("onboarding.nodejs.detected")}</Label>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("common.refresh")
              )}
            </Button>
          )}
        </div>

        {isLoading && nodeVersions.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-sm">{t("onboarding.nodejs.detecting")}</span>
          </div>
        ) : nodeVersions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t("onboarding.nodejs.noNode")}
          </div>
        ) : (
          <div className="space-y-2">
            {nodeVersions.map((node) => (
              <button
                key={node.path}
                type="button"
                onClick={() => onSelect(node.path)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  selectedPath === node.path
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  !node.is_valid && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      node.is_valid
                        ? "bg-green-500/10 text-green-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {node.is_valid ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>Node.js {node.version || t("common.unknown")}</span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        {getSourceLabel(node.source)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                      {node.path}
                    </div>
                  </div>
                </div>
                {!node.is_valid && (
                  <span className="text-xs text-muted-foreground">
                    {t("onboarding.nodejs.requiresVersion", { version: requiredVersion })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom path input */}
      <div className="space-y-2">
        <Label className="text-sm">{t("onboarding.nodejs.customPath")}</Label>
        <div className="flex gap-2">
          <Input
            placeholder={t("onboarding.nodejs.customPathPlaceholder")}
            value={customPath}
            onChange={(e) => onCustomPathChange(e.target.value)}
            disabled={isCheckingCustomPath}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={onBrowse}
            disabled={isCheckingCustomPath}
            title={t("common.browse")}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
          {onCheckCustomPath && (
            <Button
              onClick={onCheckCustomPath}
              disabled={isCheckingCustomPath || !customPath.trim()}
              size="sm"
            >
              {isCheckingCustomPath ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("onboarding.nodejs.check")
              )}
            </Button>
          )}
        </div>
        {customPathError && (
          <p className="text-sm text-destructive">{customPathError}</p>
        )}
      </div>
    </div>
  );
}
