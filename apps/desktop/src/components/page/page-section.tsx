/**
 * PageSection Component
 *
 * Sidebar section for displaying workspace pages in a tree structure.
 * Supports CRUD operations: create, delete pages.
 */

import { useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Loader2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarSection } from "@/components/layout/sidebar-section";
import { SidebarIconButton } from "@/components/layout/sidebar-icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePages, useDeletePage } from "@/hooks/use-pages";
import { usePageTabs } from "@/hooks/use-page-tabs";
import { CreatePageDialog } from "./create-page-dialog";
import { PagePermissionsDialog } from "./page-permissions-dialog";
import type { PageConfig } from "@/hooks/use-pages";

// =============================================================================
// Types
// =============================================================================

export interface PageSectionProps {
  workspaceId: string;
  workspacePath: string;
  collapsed?: boolean;
}

interface PageTreeNode {
  page: PageConfig;
  children: PageTreeNode[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a tree structure from flat page list.
 * Pages with slugs like "parent/child" are nested under "parent".
 */
function buildPageTree(pages: PageConfig[]): PageTreeNode[] {
  // Sort pages by slug for consistent ordering
  const sortedPages = [...pages].sort((a, b) => a.slug.localeCompare(b.slug));

  // Map to store nodes by their slug
  const nodeMap = new Map<string, PageTreeNode>();
  const rootNodes: PageTreeNode[] = [];

  // First pass: create all nodes
  for (const page of sortedPages) {
    nodeMap.set(page.slug, { page, children: [] });
  }

  // Second pass: build tree structure
  for (const page of sortedPages) {
    const node = nodeMap.get(page.slug)!;
    const parts = page.slug.split("/");

    if (parts.length === 1) {
      // Root level page
      rootNodes.push(node);
    } else {
      // Find parent by removing last part
      const parentSlug = parts.slice(0, -1).join("/");
      const parentNode = nodeMap.get(parentSlug);

      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Parent doesn't exist, treat as root
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
}

/**
 * Get the page path for NavLink
 * Per spec: /workspace/page?workspace_id=<id>&page_path=pages/xxx/SKILL.md
 */
function getPageHref(workspaceId: string, pageSlug: string): string {
  const pagePath = `pages/${pageSlug}/SKILL.md`;
  return `/workspace/page?workspace_id=${encodeURIComponent(workspaceId)}&page_path=${encodeURIComponent(pagePath)}`;
}

// =============================================================================
// Sub-components
// =============================================================================

interface PageTreeItemProps {
  node: PageTreeNode;
  workspaceId: string;
  workspacePath: string;
  depth: number;
  onPageClick: (page: PageConfig) => void;
  onDeleteClick: (page: PageConfig) => void;
  onCreateSubpage: (parentSlug: string) => void;
  onPermissionsClick: (page: PageConfig) => void;
}

function PageTreeItem({
  node,
  workspaceId,
  workspacePath,
  depth,
  onPageClick,
  onDeleteClick,
  onCreateSubpage,
  onPermissionsClick,
}: PageTreeItemProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const href = getPageHref(workspaceId, node.page.slug);
  const isActive = location.pathname + location.search === href;

  // Handle page click - opens page in tab system
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onPageClick(node.page);
  }, [node.page, onPageClick]);

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-md text-sm h-7",
          "transition-all duration-200",
          isActive
            ? [
                "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              ]
            : [
                "text-sidebar-foreground/70",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              ]
        )}
        style={{ paddingLeft: depth === 0 ? "8px" : `${depth * 8 + 8}px` }}
      >
        {/* Expand/Collapse toggle - only show for items with children */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-sidebar-accent"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Page link - click to open in tab */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handlePageClick}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-[13px]">{node.page.name}</span>
            </button>
          </TooltipTrigger>
          {node.page.description && (
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{node.page.description}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* Action buttons (visible on hover) */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Create subpage button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCreateSubpage(node.page.slug);
                }}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-sidebar-accent"
              >
                <Plus className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("page.createSubpage")}
            </TooltipContent>
          </Tooltip>

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-sidebar-accent"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => onPermissionsClick(node.page)}
              >
                <Shield className="mr-2 h-4 w-4" />
                {t("page.permissions")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteClick(node.page)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.page.slug}
              node={child}
              workspaceId={workspaceId}
              workspacePath={workspacePath}
              depth={depth + 1}
              onPageClick={onPageClick}
              onDeleteClick={onDeleteClick}
              onCreateSubpage={onCreateSubpage}
              onPermissionsClick={onPermissionsClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PageSection({
  workspaceId,
  workspacePath,
  collapsed = false,
}: PageSectionProps) {
  const { t } = useTranslation();
  const { openPageTab } = usePageTabs();
  const { data: pages, isLoading, error } = usePages(workspacePath);
  const deletePageMutation = useDeletePage();

  // Delete confirmation state
  const [pageToDelete, setPageToDelete] = useState<PageConfig | null>(null);

  // Create page dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentSlug, setCreateParentSlug] = useState<string | undefined>(undefined);

  // Permissions dialog state
  const [permissionsPage, setPermissionsPage] = useState<PageConfig | null>(null);

  // Build tree structure from pages
  const pageTree = useMemo(() => {
    if (!pages || pages.length === 0) return [];
    return buildPageTree(pages);
  }, [pages]);

  // Handle delete page
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

  // Handle create subpage
  const handleCreateSubpage = useCallback((parentSlug: string) => {
    setCreateParentSlug(parentSlug);
    setCreateDialogOpen(true);
  }, []);

  // Handle create new page
  const handleCreatePage = useCallback(() => {
    setCreateParentSlug(undefined);
    setCreateDialogOpen(true);
  }, []);

  // Handle page click - opens page in tab system
  const handlePageClick = useCallback((page: PageConfig) => {
    openPageTab(page, workspaceId);
  }, [openPageTab, workspaceId]);

  // Handle page creation success - open new page in tab
  const handleCreateSuccess = useCallback((slug: string) => {
    // Find the newly created page from the pages list
    const newPage = pages?.find(p => p.slug === slug);
    if (newPage) {
      openPageTab(newPage, workspaceId);
    } else {
      // Fallback: create a minimal page object and open
      openPageTab({
        slug,
        name: slug,
        type: "static",
        file: "index.html",
        permission: ["read", "write"],
        path: `pages/${slug}`,
      } as PageConfig, workspaceId);
    }
  }, [pages, openPageTab, workspaceId]);

  // Handle permissions click
  const handlePermissionsClick = useCallback((page: PageConfig) => {
    setPermissionsPage(page);
  }, []);

  // Header action - create new page button
  const headerAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCreatePage}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {t("page.createPage")}
      </TooltipContent>
    </Tooltip>
  );

  // Loading state
  if (isLoading) {
    return (
      <SidebarSection
        title={t("page.pages")}
        collapsible
        defaultOpen
        collapsed={collapsed}
      >
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </SidebarSection>
    );
  }

  // Error state
  if (error) {
    const errorMessage = error instanceof Error ? error.message : t("common.error");
    return (
      <SidebarSection
        title={t("page.pages")}
        collapsible
        defaultOpen
        collapsed={collapsed}
        headerAction={headerAction}
      >
        <div className="px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      </SidebarSection>
    );
  }

  // Collapsed state: show single "Pages" icon button
  if (collapsed) {
    return (
      <div className="grid place-items-center w-full">
        <SidebarIconButton
          icon={<FileText className="h-4 w-4" />}
          tooltip={t("page.pages")}
          onClick={handleCreatePage}
        />
      </div>
    );
  }

  return (
    <>
      <SidebarSection
        title={t("page.pages")}
        collapsible
        defaultOpen
        collapsed={collapsed}
        headerAction={headerAction}
      >
        {pageTree.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {t("page.noPages")}
          </div>
        ) : (
          <nav className="flex flex-col gap-0.5">
            {pageTree.map((node) => (
              <PageTreeItem
                key={node.page.slug}
                node={node}
                workspaceId={workspaceId}
                workspacePath={workspacePath}
                depth={0}
                onPageClick={handlePageClick}
                onDeleteClick={setPageToDelete}
                onCreateSubpage={handleCreateSubpage}
                onPermissionsClick={handlePermissionsClick}
              />
            ))}
          </nav>
        )}
      </SidebarSection>

      {/* Delete Page Confirmation Dialog */}
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

      {/* Create Page Dialog */}
      <CreatePageDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspacePath={workspacePath}
        parentSlug={createParentSlug}
        onSuccess={handleCreateSuccess}
      />

      {/* Permissions Dialog */}
      <PagePermissionsDialog
        open={!!permissionsPage}
        onOpenChange={(open) => !open && setPermissionsPage(null)}
        page={permissionsPage}
        workspacePath={workspacePath}
      />
    </>
  );
}

export default PageSection;
