import { Settings, Clock, RefreshCw, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { SyncSettings as SyncSettingsType } from "@/hooks/use-workspace-sync";

interface SyncSettingsProps {
  /** Current sync settings */
  settings: SyncSettingsType;
  /** Callback when settings change */
  onSettingsChange: (settings: Partial<SyncSettingsType>) => void;
  /** Whether workspace is selected (settings are disabled without a workspace) */
  hasWorkspace: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Settings panel for auto-sync, interval, and conflict resolution.
 */
export function SyncSettings({
  settings,
  onSettingsChange,
  hasWorkspace,
  className,
}: SyncSettingsProps) {
  const { t } = useTranslation();

  const handleAutoSyncToggle = (enabled: boolean) => {
    onSettingsChange({ autoSyncEnabled: enabled });
  };

  const handleIntervalChange = (minutes: number) => {
    onSettingsChange({ autoSyncIntervalMinutes: minutes });
  };

  const handleConflictResolutionChange = (value: "local" | "cloud") => {
    onSettingsChange({ conflictResolution: value });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">{t("sync.syncSettings")}</h4>
      </div>

      {/* Auto-sync Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm">{t("sync.autoSync")}</p>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {t("sync.autoSyncDesc")}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoSyncEnabled}
            onChange={(e) => handleAutoSyncToggle(e.target.checked)}
            disabled={!hasWorkspace}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"></div>
        </label>
      </div>

      {/* Sync Interval */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm">{t("sync.syncInterval")}</p>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {t("sync.syncIntervalDesc")}
          </p>
        </div>
        <select
          value={settings.autoSyncIntervalMinutes}
          onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
          disabled={!hasWorkspace || !settings.autoSyncEnabled}
          className="rounded-xl border bg-background px-3 py-1.5 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value={15}>{t("sync.intervalMinutes", { count: 15 })}</option>
          <option value={30}>{t("sync.intervalMinutes", { count: 30 })}</option>
          <option value={60}>{t("sync.intervalHour", { count: 1 })}</option>
          <option value={120}>{t("sync.intervalHours", { count: 2 })}</option>
          <option value={360}>{t("sync.intervalHours", { count: 6 })}</option>
        </select>
      </div>

      {/* Conflict Resolution */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm">{t("sync.conflictResolution")}</p>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {t("sync.conflictResolutionDesc")}
          </p>
        </div>
        <select
          value={settings.conflictResolution}
          onChange={(e) =>
            handleConflictResolutionChange(e.target.value as "local" | "cloud")
          }
          disabled={!hasWorkspace}
          className="rounded-xl border bg-background px-3 py-1.5 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="cloud">{t("sync.preferCloud")}</option>
          <option value="local">{t("sync.preferLocal")}</option>
        </select>
      </div>

      {/* Info Note */}
      {!hasWorkspace && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {t("sync.selectWorkspaceToEnableSettings")}
        </p>
      )}
    </div>
  );
}

SyncSettings.displayName = "SyncSettings";
