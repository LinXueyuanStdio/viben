"use client";

import { useTranslation } from "react-i18next";
import {
  DEFAULT_SANDBOX_TYPE,
  type SandboxType,
} from "@/components/assistant/sandbox-selector-compact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { DiffMode } from "@/hooks/assistant/use-user-preferences";
import { useGeneralPreferences } from "@/hooks/assistant/use-general-preferences";

const SANDBOX_OPTIONS: Array<{ id: SandboxType; name: string }> = [
  { id: "vercel", name: "Vercel" },
];

const DIFF_MODE_OPTIONS: Array<{ id: DiffMode; name: string }> = [
  { id: "unified", name: "Unified" },
  { id: "split", name: "Split" },
];

export function SandboxSectionSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("settings.sandbox.general")}
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

export function SandboxSection() {
  const { t } = useTranslation();
  const {
    loading,
    preferences,
    isSaving,
    copiedPublicProfile,
    publicProfilePath,
    handleSandboxChange,
    handleDiffModeChange,
    handleAutoCommitPushChange,
    handleAutoCreatePrChange,
    handleAlertsEnabledChange,
    handleAlertSoundEnabledChange,
    handlePublicUsageEnabledChange,
    handleCopyPublicProfileUrl,
  } = useGeneralPreferences();

  if (loading) {
    return <SandboxSectionSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* ── General: Theme, Sandbox, Diff, Toggles ── */}
      <div className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("settings.sandbox.general")}
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Left column: dropdowns */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="sandbox">{t("settings.sandbox.defaultSandbox")}</Label>
              <Select
                value={preferences?.defaultSandboxType ?? DEFAULT_SANDBOX_TYPE}
                onValueChange={(value) =>
                  handleSandboxChange(value as SandboxType)
                }
                disabled={isSaving}
              >
                <SelectTrigger id="sandbox" className="w-full">
                  <SelectValue placeholder={t("settings.sandbox.selectSandboxType")} />
                </SelectTrigger>
                <SelectContent>
                  {SANDBOX_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="diff-mode">{t("settings.sandbox.defaultDiffMode")}</Label>
              <Select
                value={preferences?.defaultDiffMode ?? "unified"}
                onValueChange={(value) =>
                  handleDiffModeChange(value as DiffMode)
                }
                disabled={isSaving}
              >
                <SelectTrigger id="diff-mode" className="w-full">
                  <SelectValue placeholder={t("settings.sandbox.selectDiffMode")} />
                </SelectTrigger>
                <SelectContent>
                  {DIFF_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right column: toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-commit-push">{t("settings.sandbox.autoCommitLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.sandbox.autoCommitHint")}
                </p>
              </div>
              <Switch
                id="auto-commit-push"
                checked={preferences?.autoCommitPush ?? false}
                onCheckedChange={handleAutoCommitPushChange}
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-create-pr">{t("settings.sandbox.autoCreatePrLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.sandbox.autoCreatePrHint")}
                </p>
              </div>
              <Switch
                id="auto-create-pr"
                checked={preferences?.autoCreatePr ?? false}
                onCheckedChange={handleAutoCreatePrChange}
                disabled={isSaving || !(preferences?.autoCommitPush ?? false)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="alerts-enabled">{t("settings.sandbox.alertsLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.sandbox.alertsHint")}
                </p>
              </div>
              <Switch
                id="alerts-enabled"
                checked={preferences?.alertsEnabled ?? true}
                onCheckedChange={handleAlertsEnabledChange}
                disabled={isSaving}
              />
            </div>
            {(preferences?.alertsEnabled ?? true) && (
              <div className="flex items-center justify-between gap-4 pl-4">
                <div className="space-y-0.5">
                  <Label htmlFor="alert-sound-enabled">{t("settings.sandbox.alertSoundLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.sandbox.alertSoundHint")}
                  </p>
                </div>
                <Switch
                  id="alert-sound-enabled"
                  checked={preferences?.alertSoundEnabled ?? true}
                  onCheckedChange={handleAlertSoundEnabledChange}
                  disabled={isSaving}
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="public-usage-enabled">
                  {t("settings.sandbox.publicUsageLabel")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.sandbox.publicUsageHint")}
                </p>
              </div>
              <Switch
                id="public-usage-enabled"
                checked={preferences?.publicUsageEnabled ?? false}
                onCheckedChange={handlePublicUsageEnabledChange}
                disabled={isSaving}
              />
            </div>
            {(preferences?.publicUsageEnabled ?? false) &&
              publicProfilePath && (
                <div className="grid gap-2 pl-4">
                  <Label htmlFor="public-usage-url">{t("settings.sandbox.publicProfileUrl")}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="public-usage-url"
                      readOnly
                      value={publicProfilePath}
                      className="font-mono text-xs sm:text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyPublicProfileUrl}
                      disabled={isSaving}
                    >
                      {copiedPublicProfile ? t("common.copied") : t("settings.sandbox.copyUrl")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.sandbox.shareFilteredHint")}
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
