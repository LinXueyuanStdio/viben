"use client";

import { useTheme } from "next-themes";
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
import { usePreferencesSectionState } from "../assistant/preferences-section";

type ThemePreference = "system" | "light" | "dark";

const SANDBOX_OPTIONS: Array<{ id: SandboxType; name: string }> = [
  { id: "vercel", name: "Vercel" },
];

const THEME_OPTIONS: Array<{ id: ThemePreference; name: string }> = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
];

const DIFF_MODE_OPTIONS: Array<{ id: DiffMode; name: string }> = [
  { id: "unified", name: "Unified" },
  { id: "split", name: "Split" },
];

function isThemePreference(value: string): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function SandboxSectionSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          General
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
  const state = usePreferencesSectionState();
  const { theme, setTheme } = useTheme();

  if (state.loading) {
    return <SandboxSectionSkeleton />;
  }

  const {
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
  } = state;

  const handleThemeChange = (nextTheme: string) => {
    if (isThemePreference(nextTheme)) {
      setTheme(nextTheme);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── General: Theme, Sandbox, Diff, Toggles ── */}
      <div className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          General
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Left column: dropdowns */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="appearance">Theme</Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger id="appearance" className="w-full">
                  <SelectValue placeholder="Select an appearance" />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Saved in your current browser.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sandbox">Default Sandbox</Label>
              <Select
                value={preferences?.defaultSandboxType ?? DEFAULT_SANDBOX_TYPE}
                onValueChange={(value) =>
                  handleSandboxChange(value as SandboxType)
                }
                disabled={isSaving}
              >
                <SelectTrigger id="sandbox" className="w-full">
                  <SelectValue placeholder="Select a sandbox type" />
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
              <Label htmlFor="diff-mode">Default Diff Mode</Label>
              <Select
                value={preferences?.defaultDiffMode ?? "unified"}
                onValueChange={(value) =>
                  handleDiffModeChange(value as DiffMode)
                }
                disabled={isSaving}
              >
                <SelectTrigger id="diff-mode" className="w-full">
                  <SelectValue placeholder="Select a diff mode" />
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
                <Label htmlFor="auto-commit-push">Auto commit &amp; push</Label>
                <p className="text-xs text-muted-foreground">
                  Commit and push when an agent turn finishes.
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
                <Label htmlFor="auto-create-pr">Auto create PR</Label>
                <p className="text-xs text-muted-foreground">
                  Open a pull request after auto commit.
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
                <Label htmlFor="alerts-enabled">Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Notify when a background agent finishes.
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
                  <Label htmlFor="alert-sound-enabled">Alert sound</Label>
                  <p className="text-xs text-muted-foreground">
                    Play a sound with alerts.
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
                  Public usage profile
                </Label>
                <p className="text-xs text-muted-foreground">
                  Publish a shareable wrapped page at <code>/u/username</code>.
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
                  <Label htmlFor="public-usage-url">Public profile URL</Label>
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
                      {copiedPublicProfile ? "Copied" : "Copy URL"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share filtered snapshots with <code>?date=30d</code> or
                    <code> ?date=2026-01-01..2026-01-31</code>.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
