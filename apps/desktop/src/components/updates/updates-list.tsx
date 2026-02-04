import * as React from "react";
import {
  ArrowUpCircle,
  Package,
  Sparkles,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PackageUpdate } from "@/hooks/use-package-updates";

// ============================================================================
// Types
// ============================================================================

export interface UpdatesListProps {
  /** List of available updates */
  updates: PackageUpdate[];
  /** Whether checking for updates */
  checking?: boolean;
  /** Whether currently updating packages */
  updating?: boolean;
  /** ID of package being updated */
  updatingPackageId?: string | null;
  /** Last check timestamp */
  lastChecked?: Date | null;
  /** Error message */
  error?: string | null;
  /** Callback to check for updates */
  onCheckUpdates?: () => void;
  /** Callback to update a single package */
  onUpdatePackage?: (id: string, type: "mcp" | "skill") => void;
  /** Callback to update all packages */
  onUpdateAll?: () => void;
  /** Maximum height for the list */
  maxHeight?: string | number;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface UpdateItemProps {
  update: PackageUpdate;
  isUpdating: boolean;
  onUpdate?: () => void;
}

const UpdateItem = React.forwardRef<HTMLDivElement, UpdateItemProps>(
  ({ update, isUpdating, onUpdate }, ref) => {
    const { t } = useTranslation();
    const Icon = update.packageType === "mcp" ? Package : Sparkles;

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg",
          "border border-border bg-card/50",
          "transition-colors hover:bg-accent/50"
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            update.packageType === "mcp"
              ? "bg-blue-500/10 text-blue-500"
              : "bg-purple-500/10 text-purple-500"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{update.name}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {update.packageType.toUpperCase()}
            </Badge>
          </div>

          {/* Version info */}
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{update.currentVersion}</span>
            <ArrowUpCircle className="h-3 w-3 text-amber-500" />
            <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
              {update.latestVersion}
            </span>
          </div>

          {/* Release notes preview */}
          {update.releaseNotes && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {update.releaseNotes}
            </p>
          )}
        </div>

        {/* Update button */}
        <Button
          size="sm"
          variant="outline"
          onClick={onUpdate}
          disabled={isUpdating}
          className="shrink-0"
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("common.loading")}
            </>
          ) : (
            <>
              <ArrowUpCircle className="h-3 w-3" />
              {t("common.update")}
            </>
          )}
        </Button>
      </div>
    );
  }
);
UpdateItem.displayName = "UpdateItem";

// ============================================================================
// Main Component
// ============================================================================

/**
 * UpdatesList - Displays a list of available package updates
 *
 * Shows all packages with available updates, allowing users to update
 * individual packages or all at once.
 */
const UpdatesList = React.forwardRef<HTMLDivElement, UpdatesListProps>(
  (
    {
      updates,
      checking = false,
      updating = false,
      updatingPackageId = null,
      lastChecked,
      error,
      onCheckUpdates,
      onUpdatePackage,
      onUpdateAll,
      maxHeight = "400px",
      className,
    },
    ref
  ) => {
    const { t } = useTranslation();

    // Format last checked time
    const lastCheckedText = React.useMemo(() => {
      if (!lastChecked) return null;

      const now = new Date();
      const diff = now.getTime() - lastChecked.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);

      if (minutes < 1) return t("updates.justNow", "Just now");
      if (minutes < 60) return t("updates.minutesAgo", { count: minutes });
      if (hours < 24) return t("updates.hoursAgo", { count: hours });
      return lastChecked.toLocaleDateString();
    }, [lastChecked, t]);

    return (
      <Card ref={ref} className={cn("w-full", className)} interactive={false}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-amber-500" />
                {t("updates.title", "Package Updates")}
              </CardTitle>
              <CardDescription>
                {updates.length > 0
                  ? t("updates.available", {
                      count: updates.length,
                      defaultValue: `${updates.length} update(s) available`,
                    })
                  : t("updates.upToDate", "All packages are up to date")}
              </CardDescription>
            </div>

            {/* Check for updates button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onCheckUpdates}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="sr-only">{t("updates.checkForUpdates", "Check for updates")}</span>
            </Button>
          </div>

          {/* Last checked info */}
          {lastCheckedText && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("updates.lastChecked", "Last checked")}: {lastCheckedText}
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading state */}
          {checking && updates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">{t("updates.checking", "Checking for updates...")}</p>
            </div>
          )}

          {/* Empty state */}
          {!checking && updates.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Check className="h-12 w-12 text-green-500 mb-2" />
              <p className="font-medium text-foreground">
                {t("updates.allUpToDate", "All packages up to date")}
              </p>
              <p className="text-sm">
                {t("updates.noUpdates", "There are no pending updates")}
              </p>
            </div>
          )}

          {/* Updates list */}
          {updates.length > 0 && (
            <ScrollArea style={{ maxHeight }} className="pr-4">
              <div className="space-y-2">
                {updates.map((update) => (
                  <UpdateItem
                    key={`${update.packageType}-${update.packageId}`}
                    update={update}
                    isUpdating={
                      updating && updatingPackageId === update.packageId
                    }
                    onUpdate={() =>
                      onUpdatePackage?.(update.packageId, update.packageType)
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>

        {/* Footer with Update All button */}
        {updates.length > 1 && (
          <CardFooter className="pt-3 border-t">
            <Button
              className="w-full"
              onClick={onUpdateAll}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("updates.updating", "Updating...")}
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4" />
                  {t("updates.updateAll", "Update All")} ({updates.length})
                </>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }
);
UpdatesList.displayName = "UpdatesList";

export { UpdatesList, UpdateItem };
