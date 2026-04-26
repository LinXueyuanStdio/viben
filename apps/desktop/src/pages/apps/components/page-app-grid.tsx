/**
 * PageAppGrid Component
 *
 * iPad home screen-style grid for workspace pages.
 * Displays pages as app icons with folder overlay support.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { usePages, useDeletePage } from "@/hooks/use-pages";
import { usePageTabs } from "@/hooks/use-page-tabs";
import { CreatePageDialog } from "./create-page-dialog";
import { PagePermissionsDialog } from "./page-permissions-dialog";
import { PageAppIcon } from "./page-app-icon";
import { buildPageTree } from "../utils";
import type { PageTreeNode } from "../utils";
import type { PageConfig } from "@/hooks/use-pages";

// =============================================================================
// Types
// =============================================================================

export interface PageAppGridProps {
  workspaceId: string;
  workspacePath: string;
}

// =============================================================================
// Component
// =============================================================================

export function PageAppGrid({ workspaceId, workspacePath }: PageAppGridProps) {
  const { t } = useTranslation();
  const { openPageTab, openPageInNewTab } = usePageTabs();
  const { data: pages, isLoading, error } = usePages(workspacePath);
  const deletePageMutation = useDeletePage();

  // Dialog states
  const [pageToDelete, setPageToDelete] = useState<PageConfig | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentSlug, setCreateParentSlug] = useState<string | undefined>(undefined);
  const [permissionsPage, setPermissionsPage] = useState<PageConfig | null>(null);

  // Folder overlay state
  const [openFolder, setOpenFolder] = useState<PageTreeNode | null>(null);

  // Build tree
  const pageTree = useMemo(() => {
    if (!pages || pages.length === 0) return [];
    return buildPageTree(pages);
  }, [pages]);

  // Handlers
  const handlePageClick = useCallback(
    (page: PageConfig) => {
      openPageTab(page, workspaceId);
    },
    [openPageTab, workspaceId]
  );

  const handleOpenInNewTab = useCallback(
    (page: PageConfig) => {
      openPageInNewTab(page, workspaceId);
    },
    [openPageInNewTab, workspaceId]
  );

  const handleDeletePage = async () => {
    if (!pageToDelete) return;
    try {
      await deletePageMutation.mutateAsync({
        workspacePath,
        slug: pageToDelete.slug,
      });
      toast.success(t("page.deleteSuccess"));
    } catch (err) {
      console.error("Failed to delete page:", err);
      toast.error(t("page.deleteFailed"));
    } finally {
      setPageToDelete(null);
    }
  };

  const handleCreateSubpage = useCallback((parentSlug: string) => {
    setCreateParentSlug(parentSlug);
    setCreateDialogOpen(true);
  }, []);

  const handleCreatePage = useCallback(() => {
    setCreateParentSlug(undefined);
    setCreateDialogOpen(true);
  }, []);

  const handleCreateSuccess = useCallback(
    (slug: string) => {
      const newPage = pages?.find((p) => p.slug === slug);
      if (newPage) {
        openPageTab(newPage, workspaceId);
      } else {
        openPageTab(
          {
            slug,
            name: slug,
            type: "static",
            file: "index.html",
            permission: ["read", "write"],
            path: `pages/${slug}`,
          } as PageConfig,
          workspaceId
        );
      }
    },
    [pages, openPageTab, workspaceId]
  );

  const handleNodeClick = useCallback(
    (node: PageTreeNode) => {
      if (node.children.length > 0) {
        setOpenFolder(node);
      } else {
        handlePageClick(node.page);
      }
    },
    [handlePageClick]
  );

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2
          className="h-6 w-6 animate-spin"
          style={{ color: "rgba(255, 255, 255, 0.5)" }}
        />
      </div>
    );
  }

  // Error
  if (error) {
    const errorMessage = error instanceof Error ? error.message : t("common.error");
    return (
      <div className="flex items-center justify-center h-full">
        <p
          className="text-sm"
          style={{ color: "rgba(255, 255, 255, 0.5)" }}
        >
          {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto px-8 py-6">
        {pageTree.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <button
              type="button"
              onClick={handleCreatePage}
              className={cn(
                "w-[60px] h-[60px] rounded-[14px] flex items-center justify-center",
                "transition-transform duration-150 ease-out",
                "hover:scale-105 active:scale-95"
              )}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                border: "2px dashed rgba(255, 255, 255, 0.3)",
              }}
            >
              <Plus className="h-6 w-6" style={{ color: "rgba(255, 255, 255, 0.6)" }} />
            </button>
            <p
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {t("page.noPages")}
            </p>
          </div>
        ) : (
          /* Page grid */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-y-5 gap-x-2 justify-items-center">
            {pageTree.map((node) => (
              <PageAppIcon
                key={node.page.slug}
                node={node}
                workspacePath={workspacePath}
                onClick={() => handleNodeClick(node)}
                onOpenInNewTab={handleOpenInNewTab}
                onCreateSubpage={handleCreateSubpage}
                onDeleteClick={setPageToDelete}
                onPermissionsClick={setPermissionsPage}
              />
            ))}
            {/* Add page button */}
            <button
              type="button"
              onClick={handleCreatePage}
              className={cn(
                "flex flex-col items-center gap-1.5 w-[76px]",
                "transition-transform duration-150 ease-out",
                "hover:scale-105 active:scale-95"
              )}
            >
              <div
                className="w-[60px] h-[60px] rounded-[14px] flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "2px dashed rgba(255, 255, 255, 0.25)",
                }}
              >
                <Plus className="h-6 w-6" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
              </div>
              <span
                className="text-[11px]"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                {t("page.createPage")}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Folder overlay */}
      {openFolder && (
        <FolderOverlay
          folder={openFolder}
          workspacePath={workspacePath}
          onPageClick={handlePageClick}
          onOpenInNewTab={handleOpenInNewTab}
          onCreateSubpage={handleCreateSubpage}
          onDeleteClick={setPageToDelete}
          onPermissionsClick={setPermissionsPage}
          onClose={() => setOpenFolder(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pageToDelete}
        onOpenChange={(open) => !open && setPageToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.delete")} &quot;{pageToDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspace.deleteConfirmDescription", {
                name: pageToDelete?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePageMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              disabled={deletePageMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePageMutation.isPending
                ? t("common.deleting")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create dialog */}
      <CreatePageDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspacePath={workspacePath}
        parentSlug={createParentSlug}
        onSuccess={handleCreateSuccess}
      />

      {/* Permissions dialog */}
      <PagePermissionsDialog
        open={!!permissionsPage}
        onOpenChange={(open) => !open && setPermissionsPage(null)}
        page={permissionsPage}
        workspacePath={workspacePath}
      />
    </>
  );
}

// =============================================================================
// Folder Overlay
// =============================================================================

interface FolderOverlayProps {
  folder: PageTreeNode;
  workspacePath: string;
  onPageClick: (page: PageConfig) => void;
  onOpenInNewTab: (page: PageConfig) => void;
  onCreateSubpage: (parentSlug: string) => void;
  onDeleteClick: (page: PageConfig) => void;
  onPermissionsClick: (page: PageConfig) => void;
  onClose: () => void;
}

function FolderOverlay({
  folder,
  workspacePath,
  onPageClick,
  onOpenInNewTab,
  onCreateSubpage,
  onDeleteClick,
  onPermissionsClick,
  onClose,
}: FolderOverlayProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close when clicking outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleChildClick = useCallback(
    (node: PageTreeNode) => {
      if (node.children.length > 0) {
        // Nested folders: just open the page
        onPageClick(node.page);
      } else {
        onPageClick(node.page);
      }
      onClose();
    },
    [onPageClick, onClose]
  );

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20 flex items-center justify-center animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative max-w-sm w-full mx-4 rounded-2xl p-5 animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" style={{ color: "rgba(255, 255, 255, 0.6)" }} />
        </button>

        {/* Folder name */}
        <h3
          className="text-base font-semibold text-center mb-4"
          style={{
            color: "rgba(255, 255, 255, 0.9)",
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
          }}
        >
          {folder.page.name}
        </h3>

        {/* Child pages grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-y-5 gap-x-2 justify-items-center">
          {folder.children.map((child) => (
            <PageAppIcon
              key={child.page.slug}
              node={child}
              workspacePath={workspacePath}
              onClick={() => handleChildClick(child)}
              onOpenInNewTab={onOpenInNewTab}
              onCreateSubpage={onCreateSubpage}
              onDeleteClick={onDeleteClick}
              onPermissionsClick={onPermissionsClick}
            />
          ))}
          {/* Add subpage button */}
          <button
            type="button"
            onClick={() => {
              onCreateSubpage(folder.page.slug);
              onClose();
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 w-[76px]",
              "transition-transform duration-150 ease-out",
              "hover:scale-105 active:scale-95"
            )}
          >
            <div
              className="w-[60px] h-[60px] rounded-[14px] flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "2px dashed rgba(255, 255, 255, 0.25)",
              }}
            >
              <Plus className="h-5 w-5" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
            </div>
            <span
              className="text-[11px]"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {t("page.createSubpage")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
