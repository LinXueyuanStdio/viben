/**
 * Python Section Component for EnvCheck
 *
 * Displays Python version selection UI within the environment check flow.
 * Extracted from step-python.tsx for use in EnvCheckStepItem expandable content.
 */

import { useTranslation } from "react-i18next";
import { Check, AlertCircle, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PythonInfo } from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface PythonSectionProps {
  /** List of detected Python versions */
  pythonVersions: PythonInfo[];
  /** Currently selected Python path */
  selectedPath: string | null;
  /** Callback when a Python version is selected */
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
  /** Whether loading Python versions */
  isLoading?: boolean;
  /** Callback to refresh Python versions */
  onRefresh?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function PythonSection({
  pythonVersions,
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
}: PythonSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Python list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t("onboarding.python.detected")}</Label>
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

        {isLoading && pythonVersions.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-sm">{t("onboarding.python.detecting")}</span>
          </div>
        ) : pythonVersions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t("onboarding.python.noPython")}
          </div>
        ) : (
          <div className="space-y-2">
            {pythonVersions.map((python) => (
              <button
                key={python.path}
                type="button"
                onClick={() => onSelect(python.path)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  selectedPath === python.path
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  !python.is_valid && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      python.is_valid
                        ? "bg-green-500/10 text-green-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {python.is_valid ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      Python {python.version || t("common.unknown")}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                      {python.path}
                    </div>
                  </div>
                </div>
                {!python.is_valid && (
                  <span className="text-xs text-muted-foreground">
                    {t("settings.requires310")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom path input */}
      <div className="space-y-2">
        <Label className="text-sm">{t("onboarding.python.customPath")}</Label>
        <div className="flex gap-2">
          <Input
            placeholder={t("settings.customPathPlaceholder")}
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
                t("onboarding.python.check")
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
