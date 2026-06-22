/**
 * PageIconGrid Component
 *
 * iPad home screen-style grid for workspace pages.
 * Displays pages as app icons with folder overlay support.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Plus, Loader2 } from "lucide-react";
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
import { usePages, useCreatePage, useDeletePage } from "@/hooks/use-pages";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { EditPageDialog } from "./edit-page-dialog";
import { PagePermissionsDialog } from "./page-permissions-dialog";
import { PageIcon } from "./page-app-icon";
import { FolderOverlay } from "./folder-overlay";
import { usePageDialogs } from "@/hooks/use-page-dialogs";
import { buildPageTree } from "../utils";
import type { PageTreeNode } from "../utils";
import type { PageConfig } from "@/hooks/use-pages";

// =============================================================================
// Types
// =============================================================================

export interface PageIconGridProps {
  workspaceId: string;
  workspacePath: string;
}

// =============================================================================
// Component
// =============================================================================

export function PageIconGrid({ workspaceId, workspacePath }: PageIconGridProps) {
  const { t } = useTranslation();
  const { openWorkspacePage } = useDesktopRouting();
  const { data, isLoading, error } = usePages(workspacePath);
  const pages = data?.pages ?? [];
  const index = data?.index ?? { root: [] };
  const createPageMutation = useCreatePage();
  const deletePageMutation = useDeletePage();
  const creatingEmptyPageRef = useRef(false);

  // Dialog states (extracted hook)
  const {
    pageToDelete,
    setPageToDelete,
    permissionsPage,
    setPermissionsPage,
    editPage,
    setEditPage,
  } = usePageDialogs();

  // Folder overlay state
  const [openFolder, setOpenFolder] = useState<PageTreeNode | null>(null);
  const [folderOrigin, setFolderOrigin] = useState<{ x: number; y: number } | null>(null);

  // Build tree
  const pageTree = useMemo(() => {
    if (pages.length === 0) return [];
    return buildPageTree(pages, index);
  }, [pages, index]);

  // Stable handlers
  const handlePageClick = useCallback(
    (page: PageConfig) => {
      openWorkspacePage(workspaceId, page.uid, {
        title: page.name,
        icon: page.icon,
      });
    },
    [openWorkspacePage, workspaceId]
  );

  const handleOpenInNewTab = useCallback(
    (page: PageConfig) => {
      openWorkspacePage(workspaceId, page.uid, {
        openMode: "new-tab",
        title: page.name,
        icon: page.icon,
      });
    },
    [openWorkspacePage, workspaceId]
  );

  const handleDeletePage = async () => {
    if (!pageToDelete) return;
    try {
      await deletePageMutation.mutateAsync({
        workspacePath,
        uid: pageToDelete.uid,
      });
      toast.success(t("page.deleteSuccess"));
    } catch (err) {
      console.error("Failed to delete page:", err);
      toast.error(t("page.deleteFailed"));
    } finally {
      setPageToDelete(null);
    }
  };

  const createEmptyMarkdownPage = useCallback(
    async (parentUid?: string) => {
      if (creatingEmptyPageRef.current) return;
      creatingEmptyPageRef.current = true;
      try {
        const result = await createPageMutation.mutateAsync({
          workspace_path: workspacePath,
          name: t("page.untitled", "Untitled"),
          type: "markdown",
          icon: { type: "lucide", value: "file-text" },
          parent_uid: parentUid,
          empty_body: true,
        });

        if (result.page?.uid) {
          openWorkspacePage(workspaceId, result.page.uid, {
            title: result.page.name,
            icon: result.page.icon,
          });
        }
      } catch (err) {
        console.error("Failed to create page:", err);
        toast.error(t("page.createFailed", "Failed to create page"));
      } finally {
        creatingEmptyPageRef.current = false;
      }
    },
    [createPageMutation, openWorkspacePage, t, workspaceId, workspacePath]
  );

  const handleCreateSubpage = useCallback(
    (parentUid: string) => {
      void createEmptyMarkdownPage(parentUid);
    },
    [createEmptyMarkdownPage]
  );

  const handleCreatePage = useCallback(() => {
    void createEmptyMarkdownPage();
  }, [createEmptyMarkdownPage]);

  const handleNodeClick = useCallback(
    (node: PageTreeNode, e?: React.MouseEvent) => {
      if (node.children.length > 0) {
        if (e) {
          const target = e.currentTarget as HTMLElement;
          const iconRect = target.getBoundingClientRect();
          setFolderOrigin({
            x: iconRect.left + iconRect.width / 2,
            y: iconRect.top + iconRect.height / 2,
          });
        }
        setOpenFolder(node);
      } else {
        openWorkspacePage(workspaceId, node.page.uid, {
          title: node.page.name,
          icon: node.page.icon,
        });
      }
    },
    [openWorkspacePage, workspaceId]
  );

  // Stable no-op for PageIcon onClick (click handled by parent wrapper)
  const noop = useCallback(() => {}, []);

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

  // Error - distinguish between real errors and "no pages" state
  // Real errors (network, workspace not found) should show error message
  // "Pages directory not found" should show create button (handled by empty pages array)
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
              <div
                key={node.page.uid}
                onClick={(e) => handleNodeClick(node, e)}
              >
                <PageIcon
                  node={node}
                  workspacePath={workspacePath}
                  onClick={noop}
                  onOpenInNewTab={handleOpenInNewTab}
                  onCreateSubpage={handleCreateSubpage}
                  onDeleteClick={setPageToDelete}
                  onPermissionsClick={setPermissionsPage}
                  onEditClick={setEditPage}
                />
              </div>
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

      {/* Folder overlay - fixed position covers entire viewport including dock */}
      <AnimatePresence>
        {openFolder && (
          <FolderOverlay
            folder={openFolder}
            origin={folderOrigin}
            workspacePath={workspacePath}
            onPageClick={handlePageClick}
            onOpenInNewTab={handleOpenInNewTab}
            onCreateSubpage={handleCreateSubpage}
            onDeleteClick={setPageToDelete}
            onPermissionsClick={setPermissionsPage}
            onEditClick={setEditPage}
            onClose={() => setOpenFolder(null)}
          />
        )}
      </AnimatePresence>

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

      {/* Permissions dialog */}
      <PagePermissionsDialog
        open={!!permissionsPage}
        onOpenChange={(open) => !open && setPermissionsPage(null)}
        page={permissionsPage}
        workspacePath={workspacePath}
      />

      {/* Edit page dialog */}
      <EditPageDialog
        open={!!editPage}
        onOpenChange={(open) => !open && setEditPage(null)}
        page={editPage}
        workspacePath={workspacePath}
      />
    </>
  );
}
