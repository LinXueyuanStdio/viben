/**
 * PageSection Component
 *
 * Sidebar section for displaying workspace pages in a tree structure.
 * Supports CRUD operations: create, delete pages.
 * Supports drag-and-drop reordering within the same level.
 * Supports right-click context menu with "Copy Link" action.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
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
  Pencil,
  Link,
  Copy,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { usePages, usePageOrder, useDeletePage, useDuplicatePage, useReorderPages } from "@/hooks/use-pages";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { CreatePageDialog } from "./create-page-dialog";
import { EditPageDialog } from "./edit-page-dialog";
import { PagePermissionsDialog } from "./page-permissions-dialog";
import { IconDisplay } from "@/components/ui/icon-picker";
import type { PageConfig } from "@/hooks/use-pages";
import { buildPageTree, getPageHref } from "../utils";
import type { PageTreeNode, PageOrderMap } from "../utils";
import { createBreadcrumbItem } from "@/navigation/breadcrumb-stack";
import type { BreadcrumbStackItem } from "@/navigation/view-target";
import { urlToLocation } from "@/navigation/location";

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
  ancestors: PageTreeNode[];
  onPageClick: (page: PageConfig, stack: BreadcrumbStackItem[]) => void;
  onOpenInNewTab: (page: PageConfig, stack: BreadcrumbStackItem[]) => void;
  onDeleteClick: (page: PageConfig) => void;
  onCreateSubpage: (parentSlug: string) => void;
  onEditClick: (page: PageConfig) => void;
  onPermissionsClick: (page: PageConfig) => void;
  onCopyLink: (page: PageConfig) => void;
  onDuplicate: (page: PageConfig) => void;
}

function PageTreeItemContent({
  node,
  workspaceId,
  workspacePath,
  depth,
  ancestors,
  onPageClick,
  onOpenInNewTab,
  onDeleteClick,
  onCreateSubpage,
  onEditClick,
  onPermissionsClick,
  onCopyLink,
  onDuplicate,
  isDragging,
  sortableStyle,
  sortableRef,
  sortableAttributes,
  sortableListeners,
}: PageTreeItemProps & {
  isDragging?: boolean;
  sortableStyle?: React.CSSProperties;
  sortableRef?: (node: HTMLElement | null) => void;
  sortableAttributes?: Record<string, unknown>;
  sortableListeners?: Record<string, unknown>;
}) {
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

  const currentLocation = useMemo(
    () => urlToLocation(`${location.pathname}${location.search}${location.hash}`),
    [location.hash, location.pathname, location.search]
  );
  const isActive =
    currentLocation?.kind === "workspace-page" &&
    currentLocation.workspaceId === workspaceId &&
    currentLocation.pageSlug === node.page.slug;

  const pageStack = useMemo(
    () =>
      [
        createBreadcrumbItem({
          id: `workspace:${workspaceId}`,
          kind: "workspace-root",
          label: workspaceId,
          meta: { workspaceId },
          location: {
            kind: "workspace-home",
            workspaceId,
          },
        }),
        createBreadcrumbItem({
          id: `${workspaceId}:pages`,
          kind: "virtual-folder",
          label: t("page.pages"),
          meta: { workspaceId },
        }),
        ...[...ancestors, node].map((item) =>
          createBreadcrumbItem({
            id: `${workspaceId}:page:${item.page.slug}`,
            kind: "workspace-page",
            label: item.page.name,
            icon: item.page.icon,
            meta: {
              workspaceId,
              pageSlug: item.page.slug,
            },
            location: {
              kind: "workspace-page",
              workspaceId,
              pageSlug: item.page.slug,
            },
          })
        ),
      ] satisfies BreadcrumbStackItem[],
    [ancestors, node, t, workspaceId]
  );

  // Handle page click - opens page in tab system
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onPageClick(node.page, pageStack);
  }, [node.page, onPageClick, pageStack]);

  // Handle icon click - toggle expand/collapse if has children, otherwise open page
  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      onPageClick(node.page, pageStack);
    }
  }, [hasChildren, isExpanded, node.page, onPageClick, pageStack]);

  return (
    <div
      ref={sortableRef}
      style={sortableStyle}
      {...sortableAttributes}
      {...sortableListeners}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group relative flex h-7 items-center gap-1 rounded-md pr-2 text-sm",
              "transition-all duration-200",
              isDragging && "opacity-50",
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
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
                >
                  <span className="truncate text-[13px]">{node.page.name}</span>
                </button>
              </TooltipTrigger>
              {node.page.description && (
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={72}
                  className="max-w-xs pointer-events-none"
                >
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
                "flex shrink-0 items-center gap-0.5",
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
                    onClick={() => onOpenInNewTab(node.page, pageStack)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("page.openInNewTab")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCopyLink(node.page)}
                  >
                    <Link className="mr-2 h-4 w-4" />
                    {t("page.copyLink")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDuplicate(node.page)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t("page.duplicate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCreateSubpage(node.page.slug)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t("page.createSubpage")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onEditClick(node.page)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("common.edit", "Edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
          <ContextMenuItem onClick={() => onOpenInNewTab(node.page, pageStack)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("page.openInNewTab")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyLink(node.page)}>
            <Link className="mr-2 h-4 w-4" />
            {t("page.copyLink")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate(node.page)}>
            <Copy className="mr-2 h-4 w-4" />
            {t("page.duplicate")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateSubpage(node.page.slug)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("page.createSubpage")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onEditClick(node.page)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("common.edit", "Edit")}
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
              ancestors={[...ancestors, node]}
              onPageClick={onPageClick}
              onOpenInNewTab={onOpenInNewTab}
              onDeleteClick={onDeleteClick}
              onCreateSubpage={onCreateSubpage}
              onEditClick={onEditClick}
              onPermissionsClick={onPermissionsClick}
              onCopyLink={onCopyLink}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sortable wrapper for PageTreeItemContent.
 * Uses @dnd-kit/sortable to enable drag-and-drop reordering.
 */
function PageTreeItem(props: PageTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.node.page.slug });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <PageTreeItemContent
      {...props}
      isDragging={isDragging}
      sortableStyle={style}
      sortableRef={setNodeRef}
      sortableAttributes={attributes as unknown as Record<string, unknown>}
      sortableListeners={listeners as unknown as Record<string, unknown>}
    />
  );
}

/**
 * Drag overlay content shown while dragging.
 * Renders a simplified version of the page item.
 */
function DragOverlayContent({
  node,
  workspacePath,
}: {
  node: PageTreeNode;
  workspacePath: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md text-sm h-7 px-2",
        "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
        "shadow-lg ring-1 ring-border/50"
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <IconDisplay
          icon={node.page.icon}
          size="sm"
          workspacePath={workspacePath}
        />
      </span>
      <span className="truncate text-[13px]">{node.page.name}</span>
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
  const { openWorkspacePage, pushChildPage } = useDesktopRouting();
  const { data: pages, isLoading, error } = usePages(workspacePath);
  const { data: serverPageOrder } = usePageOrder(workspacePath);
  const deletePageMutation = useDeletePage();
  const duplicatePageMutation = useDuplicatePage();
  const reorderPagesMutation = useReorderPages();

  // Delete confirmation state
  const [pageToDelete, setPageToDelete] = useState<PageConfig | null>(null);

  // Create page dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentSlug, setCreateParentSlug] = useState<string | undefined>(undefined);

  // Edit page dialog state
  const [editPage, setEditPage] = useState<PageConfig | null>(null);

  // Permissions dialog state
  const [permissionsPage, setPermissionsPage] = useState<PageConfig | null>(null);

  // DnD state
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // Custom page order (optimistic local state overrides server order during drag)
  const [localOrder, setLocalOrder] = useState<PageOrderMap | undefined>(undefined);

  // The effective order: local optimistic override if set, otherwise server order
  const effectiveOrder = localOrder ?? serverPageOrder;

  // When server order updates (after refetch), clear the local optimistic override
  useEffect(() => {
    if (serverPageOrder) {
      setLocalOrder(undefined);
    }
  }, [serverPageOrder]);

  // Build tree structure from pages
  const pageTree = useMemo(() => {
    if (!pages || pages.length === 0) return [];
    return buildPageTree(pages, effectiveOrder);
  }, [pages, effectiveOrder]);

  // Build a flat map of slug -> node for drag overlay
  const nodeMap = useMemo(() => {
    const map = new Map<string, PageTreeNode>();
    function walk(nodes: PageTreeNode[]) {
      for (const n of nodes) {
        map.set(n.page.slug, n);
        walk(n.children);
      }
    }
    walk(pageTree);
    return map;
  }, [pageTree]);

  // The node currently being dragged
  const activeNode = activeSlug ? nodeMap.get(activeSlug) : undefined;

  // DnD sensors - PointerSensor with 5px activation distance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Root-level slug IDs for SortableContext
  const rootSlugs = useMemo(() => pageTree.map((n) => n.page.slug), [pageTree]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveSlug(event.active.id as string);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSlug(null);

      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find which level these items are on
      // Both must be at the same level for reordering
      const activeSlugParts = activeId.split("/");
      const overSlugParts = overId.split("/");

      // Determine parent: for root items it's null, for nested items it's the parent slug
      const activeParent = activeSlugParts.length > 1
        ? activeSlugParts.slice(0, -1).join("/")
        : null;
      const overParent = overSlugParts.length > 1
        ? overSlugParts.slice(0, -1).join("/")
        : null;

      // Only allow reordering within the same level
      if (activeParent !== overParent) return;

      // Find the sibling list at this level
      const parentKey = activeParent ?? "root";
      let siblings: PageTreeNode[];
      if (activeParent === null) {
        siblings = pageTree;
      } else {
        const parentNode = nodeMap.get(activeParent);
        if (!parentNode) return;
        siblings = parentNode.children;
      }

      // Find indices
      const oldIndex = siblings.findIndex((n) => n.page.slug === activeId);
      const newIndex = siblings.findIndex((n) => n.page.slug === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      // Compute new order
      const newSlugs = siblings.map((n) => n.page.slug);
      const [moved] = newSlugs.splice(oldIndex, 1);
      newSlugs.splice(newIndex, 0, moved);

      // Optimistic update
      const newOrder: PageOrderMap = { ...effectiveOrder, [parentKey]: newSlugs };
      setLocalOrder(newOrder);

      // Persist to backend
      reorderPagesMutation.mutate({
        workspace_path: workspacePath,
        parent_slug: activeParent,
        ordered_slugs: newSlugs,
      });
    },
    [pageTree, nodeMap, effectiveOrder, reorderPagesMutation, workspacePath]
  );

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
  const handlePageClick = useCallback((page: PageConfig, stack: BreadcrumbStackItem[]) => {
    const leaf = stack[stack.length - 1];
    if (leaf) {
      pushChildPage(
        leaf,
        {
          kind: "workspace-page",
          workspaceId,
          pageSlug: page.slug,
        },
        { mode: "replace" }
      );
      return;
    }

    openWorkspacePage(workspaceId, page.slug);
  }, [openWorkspacePage, pushChildPage, workspaceId]);

  // Handle open in new tab
  const handleOpenInNewTab = useCallback((page: PageConfig, stack: BreadcrumbStackItem[]) => {
    const leaf = stack[stack.length - 1];
    if (leaf) {
      pushChildPage(
        leaf,
        {
          kind: "workspace-page",
          workspaceId,
          pageSlug: page.slug,
        },
        { mode: "replace", openMode: "new-tab" }
      );
      return;
    }

    openWorkspacePage(workspaceId, page.slug, { openMode: "new-tab" });
  }, [openWorkspacePage, pushChildPage, workspaceId]);

  // Handle copy link
  const handleCopyLink = useCallback((page: PageConfig) => {
    const href = getPageHref(workspaceId, page.slug);
    const fullUrl = `${window.location.origin}${href}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success(t("page.linkCopied"));
    }).catch(() => {
      // Fallback: try with just the path
      navigator.clipboard.writeText(href).then(() => {
        toast.success(t("page.linkCopied"));
      }).catch((err) => {
        console.error("Failed to copy link:", err);
        toast.error(t("common.error"));
      });
    });
  }, [workspaceId, t]);

  // Handle duplicate page
  const handleDuplicate = useCallback((page: PageConfig) => {
    if (!workspacePath) return;
    duplicatePageMutation.mutate(
      { workspace_path: workspacePath, slug: page.slug },
      {
        onSuccess: (result) => {
          if (result.success && result.page) {
            toast.success(t("page.duplicateSuccess"));
          }
        },
        onError: () => {
          toast.error(t("common.error"));
        },
      }
    );
  }, [workspacePath, duplicatePageMutation, t]);

  // Handle page creation success - open new page in tab
  const handleCreateSuccess = useCallback((slug: string) => {
    // Find the newly created page from the pages list
    const newPage = pages?.find(p => p.slug === slug);
    if (newPage) {
      openWorkspacePage(workspaceId, newPage.slug);
    } else {
      openWorkspacePage(workspaceId, slug);
    }
  }, [openWorkspacePage, pages, workspaceId]);

  // Handle edit click
  const handleEditClick = useCallback((page: PageConfig) => {
    setEditPage(page);
  }, []);

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
            onClick={() =>
              handlePageClick(node.page, [
                createBreadcrumbItem({
                  id: `workspace:${workspaceId}`,
                  kind: "workspace-root",
                  label: workspaceId,
                  meta: { workspaceId },
                  location: {
                    kind: "workspace-home",
                    workspaceId,
                  },
                }),
                createBreadcrumbItem({
                  id: `${workspaceId}:pages`,
                  kind: "virtual-folder",
                  label: t("page.pages"),
                  icon: { type: "lucide", value: "files" },
                  meta: { workspaceId },
                }),
                createBreadcrumbItem({
                  id: `${workspaceId}:page:${node.page.slug}`,
                  kind: "workspace-page",
                  label: node.page.name,
                  icon: node.page.icon,
                  meta: {
                    workspaceId,
                    pageSlug: node.page.slug,
                  },
                  location: {
                    kind: "workspace-page",
                    workspaceId,
                    pageSlug: node.page.slug,
                  },
                }),
              ])
            }
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={rootSlugs} strategy={verticalListSortingStrategy}>
              <nav className="flex flex-col gap-0.5">
                {pageTree.map((node) => (
                  <PageTreeItem
                    key={node.page.slug}
                    node={node}
                    workspaceId={workspaceId}
                    workspacePath={workspacePath}
                    depth={0}
                    ancestors={[]}
                    onPageClick={handlePageClick}
                    onOpenInNewTab={handleOpenInNewTab}
                    onDeleteClick={setPageToDelete}
                    onCreateSubpage={handleCreateSubpage}
                    onEditClick={handleEditClick}
                    onPermissionsClick={handlePermissionsClick}
                    onCopyLink={handleCopyLink}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </nav>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeNode ? (
                <DragOverlayContent
                  node={activeNode}
                  workspacePath={workspacePath}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
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

      {/* Edit Page Dialog */}
      <EditPageDialog
        open={!!editPage}
        onOpenChange={(open) => !open && setEditPage(null)}
        page={editPage}
        workspacePath={workspacePath}
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
