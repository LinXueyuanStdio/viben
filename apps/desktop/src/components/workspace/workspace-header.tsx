import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { usePageTabs } from "@/hooks/use-page-tabs";
import {
  useNavigationShellSlots,
  useOptionalNavigationShell,
} from "@/components/navigation";
import { cn } from "@/lib/utils";
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
  const { openGlobalView } = usePageTabs();
  const navigationShell = useOptionalNavigationShell();
  const navigationShellSlots = useNavigationShellSlots();
  const ownerId = useId();
  const latestHeaderRef = useRef<{
    workspace: Workspace;
    segments?: BreadcrumbSegment[];
    className?: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isGlobal = workspace.type === "global";

  const handleDelete = async () => {
    if (!onRemove || isGlobal) return;

    setIsDeleting(true);
    try {
      await onRemove();
      openGlobalView("/mcp-services/dashboard", t("nav.dashboard"), {
        type: "lucide",
        value: "layout-dashboard",
      });
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
      openGlobalView,
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
    return (
      <>
        {centerContent && navigationShellSlots?.centerHost
          ? createPortal(centerContent, navigationShellSlots.centerHost)
          : null}
        {shouldRenderRightSlot && navigationShellSlots?.rightHost
          ? createPortal(actionSlot, navigationShellSlots.rightHost)
          : null}
      </>
    );
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
