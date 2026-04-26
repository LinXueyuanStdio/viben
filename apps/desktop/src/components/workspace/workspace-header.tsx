import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { cn } from "@/lib/utils";
import { WorkspaceBreadcrumb, type BreadcrumbSegment } from "./workspace-breadcrumb";
import type { Workspace } from "@/types";

interface WorkspaceHeaderProps {
  workspace: Workspace;
  segments?: BreadcrumbSegment[];
  onRefresh?: () => void;
  onRemove?: () => Promise<void>;
  isRefreshing?: boolean;
  showRefresh?: boolean;
  showRemove?: boolean;
  className?: string;
  rightContent?: React.ReactNode;
}

export function WorkspaceHeader({
  workspace,
  segments = [],
  onRefresh,
  onRemove,
  isRefreshing = false,
  showRefresh = true,
  showRemove = true,
  className,
  rightContent,
}: WorkspaceHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isGlobal = workspace.type === "global";

  const handleDelete = async () => {
    if (!onRemove || isGlobal) return;

    setIsDeleting(true);
    try {
      await onRemove();
      navigate("/mcp-services/dashboard");
    } catch {
      // Error handled in hook
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <header
      className={cn(
        "flex h-14 items-center gap-4 px-4 border-b bg-background",
        className
      )}
    >
      {/* Left: Breadcrumb - scrollable container */}
      <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
        <WorkspaceBreadcrumb workspace={workspace} segments={segments} />
      </div>

      {/* Right: Actions - fixed, never shrink */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {rightContent}

        {showRefresh && onRefresh && (
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
        )}

        {showRemove && !isGlobal && onRemove && (
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
                  {isDeleting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("common.remove")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </header>
  );
}
