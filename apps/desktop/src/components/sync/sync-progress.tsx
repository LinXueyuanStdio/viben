import { Package, Download, Trash2, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface SyncProgressProps {
  /** Whether sync is in progress */
  syncing: boolean;
  /** Progress info: packages synced, installed, removed */
  progress: {
    synced: number;
    installed: number;
    removed: number;
  } | null;
  /** Callback to cancel the sync (optional) */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Progress bar and stats during sync operations.
 */
export function SyncProgress({
  syncing,
  progress,
  onCancel,
  className,
}: SyncProgressProps) {
  const { t } = useTranslation();

  // Calculate total operations
  const totalOps = progress
    ? progress.synced + progress.installed + progress.removed
    : 0;

  // Determine completion status
  const isComplete = !syncing && progress !== null;

  if (!syncing && !progress) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Check className="h-4 w-4 text-green-600" />
          )}
          <span className="text-sm font-medium">
            {syncing ? t("sync.syncInProgress") : t("sync.syncComplete")}
          </span>
        </div>

        {syncing && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {syncing && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 animate-pulse"
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Stats Grid */}
      {progress && (
        <div className="grid grid-cols-3 gap-3">
          {/* Synced */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Package className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("sync.synced")}</p>
              <p className="text-sm font-medium">{progress.synced}</p>
            </div>
          </div>

          {/* Installed */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-green-500/10">
              <Download className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("sync.installed")}</p>
              <p className="text-sm font-medium">{progress.installed}</p>
            </div>
          </div>

          {/* Removed */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="p-1.5 rounded-md bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("sync.removed")}</p>
              <p className="text-sm font-medium">{progress.removed}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {isComplete && (
        <p className="text-xs text-muted-foreground text-center">
          {t("sync.totalPackagesProcessed", { count: totalOps })}
        </p>
      )}
    </div>
  );
}

SyncProgress.displayName = "SyncProgress";
