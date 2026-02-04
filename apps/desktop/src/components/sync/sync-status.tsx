import {
  Cloud,
  CloudOff,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { SyncStatus as SyncStatusType, CloudWorkspace } from "@/hooks/use-workspace-sync";

interface SyncStatusProps {
  /** Current sync status from the backend */
  syncStatus: SyncStatusType | null;
  /** Currently selected workspace */
  selectedWorkspace: CloudWorkspace | null;
  /** Whether a sync is in progress */
  syncing: boolean;
  /** Callback to trigger sync */
  onSync: () => void;
  /** Format last sync time for display */
  formatLastSyncTime: (timestamp: string | null) => string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays current sync state, last sync time, and provides a sync button.
 */
export function SyncStatus({
  syncStatus,
  selectedWorkspace,
  syncing,
  onSync,
  formatLastSyncTime,
  className,
}: SyncStatusProps) {
  const { t } = useTranslation();

  // Determine sync state
  const isSyncing = syncing || syncStatus?.isSyncing;
  const hasError = syncStatus?.lastSyncError;
  const isSynced = syncStatus?.lastSyncAt && !hasError;
  const lastSyncTime = syncStatus?.lastSyncAt
    ? formatLastSyncTime(syncStatus.lastSyncAt)
    : t("sync.never");

  // Determine status variant
  const getStatusVariant = (): "success" | "warning" | "destructive" | "secondary" => {
    if (isSyncing) return "secondary";
    if (hasError) return "destructive";
    if (isSynced) return "success";
    return "secondary";
  };

  // Determine status text
  const getStatusText = (): string => {
    if (isSyncing) return t("sync.syncing");
    if (hasError) return t("sync.error");
    if (isSynced) return t("sync.synced");
    return t("sync.notSynced");
  };

  // Determine status icon
  const StatusIcon = () => {
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (hasError) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (isSynced) {
      return <Check className="h-4 w-4" />;
    }
    return <CloudOff className="h-4 w-4" />;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium">{t("sync.workspaceSync")}</h4>
            <p className="text-xs text-muted-foreground">
              {selectedWorkspace
                ? selectedWorkspace.name
                : t("sync.noWorkspaceSelected")}
            </p>
          </div>
        </div>

        <Badge variant={getStatusVariant()} className="flex items-center gap-1">
          <StatusIcon />
          <span>{getStatusText()}</span>
        </Badge>
      </div>

      {/* Last Sync Time */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          {t("sync.lastSynced")}: {lastSyncTime}
        </span>
      </div>

      {/* Error Message */}
      {hasError && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          {syncStatus.lastSyncError}
        </div>
      )}

      {/* Sync Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={isSyncing || !selectedWorkspace}
        className="w-full rounded-xl"
      >
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("sync.syncing")}
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("sync.syncNow")}
          </>
        )}
      </Button>
    </div>
  );
}

SyncStatus.displayName = "SyncStatus";
