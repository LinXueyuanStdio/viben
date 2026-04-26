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
  Plus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Loader2,
  Shield,
  ExternalLink,
  Lock,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { IconDisplay } from "@/components/ui/icon-picker";
import type { PageConfig } from "@/hooks/use-pages";
import { buildPageTree, getPageHref } from "../utils";
import type { PageTreeNode } from "../utils";

// =============================================================================
// Types
// =============================================================================

export interface PageSectionProps {
  workspaceId: string;
  workspacePath: string;
  collapsed?: boolean;
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
  onOpenInNewTab: (page: PageConfig) => void;
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
  onOpenInNewTab,
  onDeleteClick,
  onCreateSubpage,
  onPermissionsClick,
}: PageTreeItemProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  // Show action buttons when hovered OR when dropdown menu is open
  const showActions = isHovered || isMenuOpen;

  // Check if page is read-only (has read but not write permission)
  const isReadOnly = node.page.permission.includes("read") && !node.page.permission.includes("write");

  const href = getPageHref(workspaceId, node.page.slug);
  const isActive = location.pathname + location.search === href;

  // Handle page click - opens page in tab system
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onPageClick(node.page);
  }, [node.page, onPageClick]);

  // Handle icon click - toggle expand/collapse if has children, otherwise open page
  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      onPageClick(node.page);
    }
  }, [hasChildren, isExpanded, node.page, onPageClick]);

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Combined icon: smooth crossfade between page icon and expand/collapse icon */}
            <span
              role="button"
              tabIndex={0}
              onClick={handleIconClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleIconClick(e as unknown as React.MouseEvent);
                }
              }}
              className={cn(
                "relative flex h-4 w-4 shrink-0 items-center justify-center rounded cursor-pointer",
                "transition-transform duration-150 ease-out",
                hasChildren && "hover:bg-sidebar-accent hover:scale-110"
              )}
            >
              {/* Page icon (custom or default) - fades out on hover when has children */}
              <span
                className={cn(
                  "absolute flex items-center justify-center text-muted-foreground",
                  "transition-all duration-150 ease-out",
                  hasChildren && isHovered
                    ? "opacity-0 scale-75"
                    : "opacity-100 scale-100"
                )}
              >
                <IconDisplay
                  icon={node.page.icon}
                  size="sm"
                  workspacePath={workspacePath}
                />
              </span>
              {/* Expand/collapse icon - fades in on hover when has children */}
              {hasChildren && (
                <span
                  className={cn(
                    "absolute flex items-center justify-center",
                    "transition-all duration-150 ease-out",
                    isHovered
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-75"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              )}
            </span>

            {/* Page link - click to open in tab */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handlePageClick}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left"
                >
                  <span className="truncate text-[13px]">{node.page.name}</span>
                </button>
              </TooltipTrigger>
              {node.page.description && (
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{node.page.description}</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Read-only indicator */}
            {isReadOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0 items-center text-muted-foreground/50">
                    <Lock className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("page.readOnly")}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Action buttons - only use opacity for show/hide to avoid layout shifts */}
            <div
              className={cn(
                "flex shrink-0 items-center gap-0.5 pr-1",
                "transition-opacity duration-150 ease-out",
                showActions
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              )}
            >
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
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded",
                      "transition-all duration-150 ease-out",
                      "hover:bg-sidebar-accent hover:scale-110",
                      "active:scale-95"
                    )}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("page.createSubpage")}
                </TooltipContent>
              </Tooltip>

              {/* More actions menu */}
              <DropdownMenu onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded",
                      "transition-all duration-150 ease-out",
                      "hover:bg-sidebar-accent hover:scale-110",
                      "active:scale-95"
                    )}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  sideOffset={4}
                  className="w-40"
                >
                  <DropdownMenuItem
                    onClick={() => onOpenInNewTab(node.page)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("page.openInNewTab")}
                  </DropdownMenuItem>
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => onOpenInNewTab(node.page)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("page.openInNewTab")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateSubpage(node.page.slug)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("page.createSubpage")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onPermissionsClick(node.page)}>
            <Shield className="mr-2 h-4 w-4" />
            {t("page.permissions")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDeleteClick(node.page)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("common.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
              onOpenInNewTab={onOpenInNewTab}
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
  const { openPageTab, openPageInNewTab } = usePageTabs();
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

  // Handle open in new tab
  const handleOpenInNewTab = useCallback((page: PageConfig) => {
    openPageInNewTab(page, workspaceId);
  }, [openPageInNewTab, workspaceId]);

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
      <TooltipContent side="bottom">
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

  // Collapsed state: show "Create Page" button + first-level page icons
  if (collapsed) {
    return (
      <>
        {/* Create Page Button */}
        <div className="grid place-items-center w-full">
          <SidebarIconButton
            icon={<Plus className="h-4 w-4" />}
            tooltip={t("page.createPage")}
            onClick={handleCreatePage}
          />
        </div>
        {/* First-level page icons - use page's custom icon */}
        {pageTree.map((node) => (
          <div key={node.page.slug} className="grid place-items-center w-full">
            <SidebarIconButton
              icon={<IconDisplay icon={node.page.icon} size="md" workspacePath={workspacePath} />}
              tooltip={node.page.name}
              onClick={() => handlePageClick(node.page)}
            />
          </div>
        ))}
        {/* Create Page Dialog - must be rendered even in collapsed state */}
        <CreatePageDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          workspacePath={workspacePath}
          parentSlug={createParentSlug}
          onSuccess={handleCreateSuccess}
        />
      </>
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
                onOpenInNewTab={handleOpenInNewTab}
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
