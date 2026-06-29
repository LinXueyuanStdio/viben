import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { RefreshCw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { DesktopBreadcrumbBar } from "@/components/navigation/desktop-breadcrumb-bar";
import {
  useDesktopRouting,
  useDesktopRoutingHeaderSync,
} from "@/hooks/use-desktop-routing";
import { useOptionalNavigationShell } from "@/components/navigation/navigation-shell";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";
import type { BreadcrumbSegment } from "./workspace-breadcrumb";
import type { Workspace } from "@/types";

interface WorkspaceHeaderProps {
  workspace: Workspace;
  segments?: BreadcrumbSegment[] | undefined;
  onRefresh?: () => void;
  onRemove?: () => Promise<void>;
  isRefreshing?: boolean;
  showRefresh?: boolean;
  showRemove?: boolean;
  className?: string;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
}

export function WorkspaceHeader({
  workspace,
  segments,
  onRefresh,
  onRemove,
  isRefreshing = false,
  showRefresh = true,
  showRemove = true,
  className,
  centerContent,
  rightContent,
}: WorkspaceHeaderProps) {
  const { t } = useTranslation();
  const routing = useDesktopRouting();
  const { openRoute } = routing;
  const navigationShell = useOptionalNavigationShell();
  const ownerId = useId();
  const latestHeaderRef = useRef<{
    workspace: Workspace;
    segments?: BreadcrumbSegment[];
    className?: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { logEvent } = useAnalytics();

  const isGlobal = workspace.id === "global";

  const handleDelete = async () => {
    if (!onRemove || isGlobal) return;

    setIsDeleting(true);
    try {
      await onRemove();
      try {
        const ageMs = Date.now() - new Date(workspace.created_at).getTime();
        const workspaceAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        logEvent(AnalyticsEvents.WORKSPACE_DELETED, {
          workspace_id: workspace.id,
          workspace_age_days: workspaceAgeDays,
          task_count: 0,
        });
      } catch { /* ignore analytics errors */ }
      openRoute("/workspace");
    } catch {
      // Error handled in hook
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const actionSlot = useMemo(
    () => (
      <>
        {rightContent}

        {showRefresh && onRefresh ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">
              {isRefreshing ? t("workspace.discovering") : t("common.refresh")}
            </span>
          </Button>
        ) : null}

        {showRemove && !isGlobal && onRemove ? (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{t("common.remove")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("workspace.removeWorkspace")}</DialogTitle>
                <DialogDescription>
                  {t("workspace.removeWorkspaceConfirm", {
                    name: workspace.name,
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("common.remove")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </>
    ),
    [
      deleteDialogOpen,
      handleDelete,
      isDeleting,
      isGlobal,
      isRefreshing,
      onRefresh,
      onRemove,
      openRoute,
      rightContent,
      showRefresh,
      showRemove,
      t,
      workspace.name,
    ]
  );

  const shouldRenderRightSlot = Boolean(
    rightContent || showRefresh || (showRemove && !isGlobal && onRemove)
  );

  useDesktopRoutingHeaderSync(
    routing,
    navigationShell ? centerContent ?? null : null,
    navigationShell && shouldRenderRightSlot ? actionSlot : null
  );

  useEffect(() => {
    latestHeaderRef.current = {
      workspace,
      segments,
      className: cn("", className),
    };
  }, [
    className,
    segments,
    workspace,
  ]);

  useEffect(() => {
    if (!navigationShell || !latestHeaderRef.current) {
      return;
    }

    navigationShell.setHeader(ownerId, latestHeaderRef.current);
  }, [navigationShell, ownerId, workspace.id, workspace.name, className, segments]);

  useEffect(() => {
    if (!navigationShell) {
      return;
    }

    return () => {
      navigationShell.clearHeader(ownerId);
    };
  }, [navigationShell, ownerId]);

  if (navigationShell) {
    return null;
  }

  return (
    <DesktopBreadcrumbBar
      workspace={workspace}
      segments={segments ?? []}
      className={cn("", className)}
      centerSlot={centerContent}
      rightSlot={actionSlot}
    />
  );
}
