/**
 * PageSection Component
 *
 * Sidebar section for displaying workspace pages in a tree structure.
 * Supports CRUD operations: create, delete pages.
 * Supports drag-and-drop reordering within the same level.
 * Supports right-click context menu with "Copy Link" action.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Files,
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
  pointerWithin,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { getEventCoordinates } from "@dnd-kit/utilities";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { usePages, useCreatePage, useDeletePage, useDuplicatePage, useReorderPages } from "@/hooks/use-pages";
import type { PageIndex } from "@/lib/gateway/types/page";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { EditPageDialog } from "@/pages/apps/components/edit-page-dialog";
import { PagePermissionsDialog } from "@/pages/apps/components/page-permissions-dialog";
import { IconDisplay } from "@/components/ui/icon-picker";
import type { PageConfig } from "@/hooks/use-pages";
import {
  buildPageTree,
  getPageHref,
} from "@/pages/apps/utils";
import type { PageTreeNode } from "@/pages/apps/utils";
import { registry } from "@/navigation/route-registry";
import {
  buildPageDropPreview,
  buildPageDropPlan,
  getStaticSortableTransform,
  getPageProjectedDepthForRow,
  getPageDropPosition,
  PAGE_ROOT_DROP_START_UID,
  PAGE_ROOT_DROP_TAIL_UID,
  PAGE_TREE_DEPTH_STEP_PX,
  type PageDropPreview,
  type PageVisibleRow,
} from "./page-section-dnd";

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
  expandedPageUids: Record<string, boolean>;
  onToggleExpanded: (uid: string) => void;
  onPageClick: (page: PageConfig) => void;
  onOpenInNewTab: (page: PageConfig) => void;
  onDeleteClick: (page: PageConfig) => void;
  onCreateSubpage: (parentUid: string) => void;
  onEditClick: (page: PageConfig) => void;
  onPermissionsClick: (page: PageConfig) => void;
  onCopyLink: (page: PageConfig) => void;
  onDuplicate: (page: PageConfig) => void;
  isDragActive?: boolean;
  dropPreview?: PageDropPreview | null;
}

interface PageTreePopupProps {
  pageTree: PageTreeNode[];
  workspaceId: string;
  workspacePath: string;
  onPageClick: (page: PageConfig) => void;
  onCreatePage: () => void;
  onOpenChange?: (open: boolean) => void;
}

function PageTreePopupItem({
  node,
  workspaceId,
  workspacePath,
  depth,
  onPageClick,
}: {
  node: PageTreeNode;
  workspaceId: string;
  workspacePath: string;
  depth: number;
  onPageClick: (page: PageConfig) => void;
}) {
  const location = useLocation();
  const hasChildren = node.children.length > 0;
  const currentMatch = useMemo(
    () => registry.match(`${location.pathname}${location.search}${location.hash}`),
    [location.hash, location.pathname, location.search]
  );
  const isActive =
    currentMatch?.pattern === "/workspace/:workspaceId/page/:uid" &&
    currentMatch.params.workspaceId === workspaceId &&
    currentMatch.params.uid === node.page.uid;

  return (
    <>
      <button
        type="button"
        aria-label={node.page.name}
        onClick={() => onPageClick(node.page)}
        className={cn(
          "group flex h-8 w-full min-w-0 items-center gap-2 rounded-md pr-2 text-left text-sm",
          "transition-colors duration-150",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * PAGE_TREE_DEPTH_STEP_PX}px` }}
      >
        {hasChildren ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/45" />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-hover:text-primary">
          <IconDisplay
            icon={node.page.icon}
            size="sm"
            workspacePath={workspacePath}
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {node.page.name}
        </span>
      </button>

      {node.children.map((child) => (
        <PageTreePopupItem
          key={child.page.uid}
          node={child}
          workspaceId={workspaceId}
          workspacePath={workspacePath}
          depth={depth + 1}
          onPageClick={onPageClick}
        />
      ))}
    </>
  );
}

function PageTreePopup({
  pageTree,
  workspaceId,
  workspacePath,
  onPageClick,
  onCreatePage,
  onOpenChange,
}: PageTreePopupProps) {
  const { t } = useTranslation();

  return (
    <div className="w-72">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-3 py-2">
        <div className="text-sm font-medium text-sidebar-foreground">
          {t("page.pages")}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t("page.createPage")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                onCreatePage();
                onOpenChange?.(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t("page.createPage")}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {pageTree.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {t("page.noPages")}
          </div>
        ) : (
          <nav className="flex flex-col gap-0.5">
            {pageTree.map((node) => (
              <PageTreePopupItem
                key={node.page.uid}
                node={node}
                workspaceId={workspaceId}
                workspacePath={workspacePath}
                depth={0}
                onPageClick={(page) => {
                  onPageClick(page);
                  onOpenChange?.(false);
                }}
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

function PageTreeItemContent({
  node,
  workspaceId,
  workspacePath,
  depth,
  ancestors,
  expandedPageUids,
  onToggleExpanded,
  onPageClick,
  onOpenInNewTab,
  onDeleteClick,
  onCreateSubpage,
  onEditClick,
  onPermissionsClick,
  onCopyLink,
  onDuplicate,
  isDragActive,
  dropPreview,
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
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPageUids[node.page.uid] ?? true;

  // Show action buttons when hovered OR when dropdown menu is open
  const showActions = isHovered || isMenuOpen;

  // Check if page is read-only (has read but not write permission)
  const isReadOnly = node.page.permission.includes("read") && !node.page.permission.includes("write");

  const currentMatch = useMemo(
    () => registry.match(`${location.pathname}${location.search}${location.hash}`),
    [location.hash, location.pathname, location.search]
  );
  const isActive =
    currentMatch?.pattern === "/workspace/:workspaceId/page/:uid" &&
    currentMatch.params.workspaceId === workspaceId &&
    currentMatch.params.uid === node.page.uid;
  const isDropTarget = dropPreview?.uid === node.page.uid;
  const isInvalidDropTarget = isDropTarget && !!dropPreview?.isInvalid;
  const isDropIntoTarget = isDropTarget && dropPreview?.position === "inside" && !dropPreview.isInvalid;
  const isParentChangeTarget =
    dropPreview?.position !== "inside" &&
    !!dropPreview?.changesParent &&
    dropPreview.targetParentUid === node.page.uid;
  const isDropLineTarget = dropPreview?.lineUid === node.page.uid;
  const previewDepth = dropPreview?.lineDepth ?? dropPreview?.projectedDepth ?? depth;
  const rowInset = 8 + depth * PAGE_TREE_DEPTH_STEP_PX;
  const dropLineInset = 8 + previewDepth * PAGE_TREE_DEPTH_STEP_PX;

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
      onToggleExpanded(node.page.uid);
    } else {
      onPageClick(node.page);
    }
  }, [hasChildren, node.page, onPageClick, onToggleExpanded]);

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
              "group relative flex h-7 items-center gap-1 rounded-md text-sm",
              "transition-all duration-200",
              isDragging && "opacity-50",
              isInvalidDropTarget && [
                "bg-destructive/10 text-destructive",
                "shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive)_55%,transparent)]",
                "cursor-not-allowed",
              ],
              (isDropIntoTarget || isParentChangeTarget) && [
                "bg-primary/10 text-sidebar-accent-foreground",
                "shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_58%,transparent)]",
              ],
              isActive
                ? [
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                  ]
                : [
                    "text-sidebar-foreground/70",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  ]
            )}
            style={{ paddingLeft: `${rowInset}px` }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {isDropLineTarget && dropPreview?.linePosition && (
              <span
                className={cn(
                  "pointer-events-none absolute right-2 h-0.5 rounded-full shadow-[0_0_0_1px_color-mix(in_oklch,var(--background)_70%,transparent)]",
                  dropPreview.isInvalid ? "bg-destructive" : "bg-primary",
                  dropPreview.linePosition === "before" ? "top-0" : "bottom-0"
                )}
                style={{ left: `${dropLineInset}px` }}
              >
                <span
                  className={cn(
                    "absolute -left-0.5 -top-0.5 h-1.5 w-1.5 rounded-full",
                    dropPreview.isInvalid ? "bg-destructive" : "bg-primary"
                  )}
                />
              </span>
            )}

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
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={4}
                  className="max-w-xs pointer-events-none"
                >
                  <p className="text-xs">{node.page.description}</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Read-only indicator - hidden when actions are shown */}
            {isReadOnly && !showActions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0 items-center pr-1 text-muted-foreground/50">
                    <Lock className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("page.readOnly")}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Action buttons - absolutely positioned to overlay right side on hover */}
            <div
              className={cn(
                "absolute right-0 top-0 flex h-full shrink-0 items-center gap-0.5 rounded-r-md pr-1 pl-4",
                "bg-gradient-to-l from-sidebar-accent from-70% to-transparent",
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
                      onCreateSubpage(node.page.uid);
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
                    onClick={() => onCreateSubpage(node.page.uid)}
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
          <ContextMenuItem onClick={() => onOpenInNewTab(node.page)}>
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
          <ContextMenuItem onClick={() => onCreateSubpage(node.page.uid)}>
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
              key={child.page.uid}
              node={child}
              workspaceId={workspaceId}
              workspacePath={workspacePath}
              depth={depth + 1}
              ancestors={[...ancestors, node]}
              expandedPageUids={expandedPageUids}
              onToggleExpanded={onToggleExpanded}
              onPageClick={onPageClick}
              onOpenInNewTab={onOpenInNewTab}
              onDeleteClick={onDeleteClick}
              onCreateSubpage={onCreateSubpage}
              onEditClick={onEditClick}
              onPermissionsClick={onPermissionsClick}
              onCopyLink={onCopyLink}
              onDuplicate={onDuplicate}
              isDragActive={isDragActive}
              dropPreview={dropPreview}
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
  } = useSortable({ id: props.node.page.uid });

  const style: React.CSSProperties = {
    transform: getStaticSortableTransform(transform, !!props.isDragActive),
    transition: props.isDragActive ? undefined : transition,
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

function RootDropZone({
  id,
  placement,
  dropPreview,
}: {
  id: typeof PAGE_ROOT_DROP_START_UID | typeof PAGE_ROOT_DROP_TAIL_UID;
  placement: "start" | "tail";
  dropPreview?: PageDropPreview | null;
}) {
  const { setNodeRef } = useDroppable({ id });
  const isRootTarget = dropPreview?.lineUid === id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-md transition-colors duration-150",
        placement === "start" ? "h-1" : "h-2",
        isRootTarget && "bg-primary/5"
      )}
    >
      {isRootTarget && dropPreview?.linePosition && (
        <span
          className={cn(
            "pointer-events-none absolute left-2 right-2 h-0.5 rounded-full shadow-[0_0_0_1px_color-mix(in_oklch,var(--background)_70%,transparent)]",
            placement === "start" ? "top-0" : "top-1",
            dropPreview.isInvalid ? "bg-destructive" : "bg-primary"
          )}
        >
          <span
            className={cn(
              "absolute -left-0.5 -top-0.5 h-1.5 w-1.5 rounded-full",
              dropPreview.isInvalid ? "bg-destructive" : "bg-primary"
            )}
          />
        </span>
      )}
    </div>
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
  const { openWorkspacePage } = useDesktopRouting();
  const { data: pagesData, isLoading, error } = usePages(workspacePath);
  const pages = pagesData?.pages;
  const serverIndex = pagesData?.index;
  // Only show loading spinner on initial load, not on refetch or when we have cached data
  const showLoading = isLoading && !pages;
  const createPageMutation = useCreatePage();
  const deletePageMutation = useDeletePage();
  const duplicatePageMutation = useDuplicatePage();
  const reorderPagesMutation = useReorderPages();

  // Delete confirmation state
  const [pageToDelete, setPageToDelete] = useState<PageConfig | null>(null);

  // Edit page dialog state
  const [editPage, setEditPage] = useState<PageConfig | null>(null);

  // Permissions dialog state
  const [permissionsPage, setPermissionsPage] = useState<PageConfig | null>(null);

  // DnD state
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<PageDropPreview | null>(null);
  const [expandedPageUids, setExpandedPageUids] = useState<Record<string, boolean>>({});
  const [collapsedPagesOpen, setCollapsedPagesOpen] = useState(false);
  const collapsedPagesCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingEmptyPageRef = useRef(false);

  const cancelCollapsedPagesClose = useCallback(() => {
    if (collapsedPagesCloseTimeoutRef.current) {
      clearTimeout(collapsedPagesCloseTimeoutRef.current);
      collapsedPagesCloseTimeoutRef.current = null;
    }
  }, []);

  const openCollapsedPages = useCallback(() => {
    cancelCollapsedPagesClose();
    setCollapsedPagesOpen(true);
  }, [cancelCollapsedPagesClose]);

  const scheduleCollapsedPagesClose = useCallback(() => {
    cancelCollapsedPagesClose();
    collapsedPagesCloseTimeoutRef.current = setTimeout(() => {
      setCollapsedPagesOpen(false);
      collapsedPagesCloseTimeoutRef.current = null;
    }, 120);
  }, [cancelCollapsedPagesClose]);

  useEffect(() => {
    return () => cancelCollapsedPagesClose();
  }, [cancelCollapsedPagesClose]);

  // Custom page index (optimistic local state overrides server index during drag)
  const [localIndex, setLocalIndex] = useState<PageIndex | undefined>(undefined);

  // The effective index: local optimistic override if set, otherwise server index
  const effectiveIndex = localIndex ?? serverIndex ?? { root: [] };

  // When server index updates (after refetch), clear the local optimistic override
  useEffect(() => {
    if (serverIndex) {
      setLocalIndex(undefined);
    }
  }, [serverIndex]);

  // Build tree structure from pages
  const pageTree = useMemo(() => {
    if (!pages || pages.length === 0) return [];
    return buildPageTree(pages, effectiveIndex);
  }, [pages, effectiveIndex]);

  // Build a flat map of uid -> node for drag overlay
  const nodeMap = useMemo(() => {
    const map = new Map<string, PageTreeNode>();
    function walk(nodes: PageTreeNode[]) {
      for (const n of nodes) {
        map.set(n.page.uid, n);
        walk(n.children);
      }
    }
    walk(pageTree);
    return map;
  }, [pageTree]);

  const visibleRows = useMemo(() => {
    const rows: PageVisibleRow[] = [];

    function walk(nodes: PageTreeNode[], depth: number, parentUid: string | null) {
      for (const node of nodes) {
        rows.push({ uid: node.page.uid, depth, parentUid });
        if (expandedPageUids[node.page.uid] ?? true) {
          walk(node.children, depth + 1, node.page.uid);
        }
      }
    }

    walk(pageTree, 0, null);
    return rows;
  }, [expandedPageUids, pageTree]);

  const visibleUids = useMemo(() => visibleRows.map((row) => row.uid), [visibleRows]);

  // The node currently being dragged
  const activeNode = activeUid ? nodeMap.get(activeUid) : undefined;

  // DnD sensors - PointerSensor with 5px activation distance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Root-level uid IDs for SortableContext
  const rootUids = useMemo(() => pageTree.map((n) => n.page.uid), [pageTree]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveUid(event.active.id as string);
    setDropPreview(null);
  }, []);

  const handleToggleExpanded = useCallback((uid: string) => {
    setExpandedPageUids((current) => ({
      ...current,
      [uid]: !(current[uid] ?? true),
    }));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, activatorEvent, delta, over } = event;

    if (!over) {
      setDropPreview(null);
      return;
    }

    const coordinates = getEventCoordinates(activatorEvent);
    if (!coordinates) {
      setDropPreview(null);
      return;
    }

    const activeRow = visibleRows.find((row) => row.uid === active.id);
    if (!activeRow) {
      setDropPreview(null);
      return;
    }

    const overId = over.id as string;
    const isRootStartDrop = overId === PAGE_ROOT_DROP_START_UID;
    const isRootTailDrop = overId === PAGE_ROOT_DROP_TAIL_UID;
    const isRootDrop = isRootStartDrop || isRootTailDrop;
    const dropPosition = isRootStartDrop
      ? "before"
      : isRootTailDrop
        ? "after"
      : getPageDropPosition(coordinates.y + delta.y, over.rect);
    const preview = buildPageDropPreview({
      index: effectiveIndex,
      activeUid: active.id as string,
      overUid: overId,
      dropPosition,
      rootUids,
      visibleRows,
      projectedDepth: dropPosition === "inside"
        ? undefined
        : isRootDrop
          ? 0
          : getPageProjectedDepthForRow(visibleRows, overId, activeRow.depth, delta.x),
    });
    setDropPreview(preview);
  }, [effectiveIndex, rootUids, visibleRows]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, activatorEvent, delta, over } = event;
      setActiveUid(null);
      setDropPreview(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;
      const coordinates = getEventCoordinates(activatorEvent);
      if (!coordinates) return;

      const activeRow = visibleRows.find((row) => row.uid === activeId);
      if (!activeRow) return;

      const isRootStartDrop = overId === PAGE_ROOT_DROP_START_UID;
      const isRootTailDrop = overId === PAGE_ROOT_DROP_TAIL_UID;
      const isRootDrop = isRootStartDrop || isRootTailDrop;
      const dropPosition = isRootStartDrop
        ? "before"
        : isRootTailDrop
          ? "after"
        : getPageDropPosition(coordinates.y + delta.y, over.rect);
      const plan = buildPageDropPlan({
        index: effectiveIndex,
        activeUid: activeId,
        overUid: overId,
        dropPosition,
        rootUids,
        visibleRows,
        projectedDepth: dropPosition === "inside"
          ? undefined
          : isRootDrop
            ? 0
            : getPageProjectedDepthForRow(visibleRows, overId, activeRow.depth, delta.x),
      });
      if (!plan) return;

      if (dropPosition === "inside") {
        setExpandedPageUids((current) => ({
          ...current,
          [overId]: true,
        }));
      }

      setLocalIndex(plan.nextIndex);
      for (const request of plan.reorderRequests) {
        reorderPagesMutation.mutate({
          workspace_path: workspacePath,
          parent_uid: request.parentUid,
          ordered_uids: request.orderedUids,
        });
      }
    },
    [effectiveIndex, reorderPagesMutation, rootUids, visibleRows, workspacePath]
  );

  // Handle delete page
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
          type: "markdown",
          icon: { type: "lucide", value: "file-text" },
          parent_uid: parentUid,
        });

        if (result.page?.uid) {
          openWorkspacePage(workspaceId, result.page.uid, {
            title: result.page.name,
            icon: result.page.icon,
            focus: "title",
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

  // Handle create subpage
  const handleCreateSubpage = useCallback((parentUid: string) => {
    void createEmptyMarkdownPage(parentUid);
  }, [createEmptyMarkdownPage]);

  // Handle create new page
  const handleCreatePage = useCallback(() => {
    void createEmptyMarkdownPage();
  }, [createEmptyMarkdownPage]);

  // Handle page click - opens page in tab system
  const handlePageClick = useCallback((page: PageConfig) => {
    openWorkspacePage(workspaceId, page.uid, {
      title: page.name,
      icon: page.icon,
    });
  }, [openWorkspacePage, workspaceId]);

  // Handle open in new tab
  const handleOpenInNewTab = useCallback((page: PageConfig) => {
    openWorkspacePage(workspaceId, page.uid, {
      openMode: "new-tab",
      title: page.name,
      icon: page.icon,
    });
  }, [openWorkspacePage, workspaceId]);

  // Handle copy link
  const handleCopyLink = useCallback((page: PageConfig) => {
    const href = getPageHref(workspaceId, page.uid);
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
      { workspace_path: workspacePath, uid: page.uid },
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

  // Collapsed state: show icon buttons only
  if (collapsed) {
    // Loading - show spinner icon
    if (showLoading) {
      return (
        <div className="grid place-items-center w-full">
          <SidebarIconButton
            icon={<Loader2 className="h-4 w-4 animate-spin" />}
            tooltip={t("common.loading")}
            onClick={() => {}}
          />
        </div>
      );
    }

    // Error - show pages entry without editing actions
    if (error) {
      return (
        <div className="grid place-items-center w-full">
          <SidebarIconButton
            icon={<Files className="h-4 w-4" />}
            tooltip={t("page.pages")}
            onClick={() => {}}
          />
        </div>
      );
    }

    return (
        <Popover open={collapsedPagesOpen} onOpenChange={setCollapsedPagesOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("page.pages")}
              className={cn(
                "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                "hover:bg-sidebar-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsedPagesOpen && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onMouseEnter={openCollapsedPages}
              onMouseLeave={scheduleCollapsedPagesClose}
            >
              <Files className="h-4 w-4" />
            </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-auto overflow-hidden p-0"
          onMouseEnter={openCollapsedPages}
          onMouseLeave={scheduleCollapsedPagesClose}
        >
          <PageTreePopup
            pageTree={pageTree}
            workspaceId={workspaceId}
            workspacePath={workspacePath}
            onPageClick={handlePageClick}
            onCreatePage={handleCreatePage}
            onOpenChange={setCollapsedPagesOpen}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Expanded state: Loading
  if (showLoading) {
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

  // Expanded state: Error - show error message for real errors
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
        <div className="px-2 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      </SidebarSection>
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
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="px-2 py-2">
              <RootDropZone id={PAGE_ROOT_DROP_TAIL_UID} placement="tail" dropPreview={dropPreview} />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                onClick={handleCreatePage}
              >
                <Plus className="h-4 w-4" />
                {t("page.createPage")}
              </Button>
            </div>
          </DndContext>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleUids} strategy={verticalListSortingStrategy}>
              <nav
                className={cn(
                  "flex flex-col gap-0.5 rounded-md transition-colors duration-150",
                  dropPreview?.targetParentUid === null &&
                    dropPreview.changesParent &&
                    !dropPreview.isInvalid &&
                    "bg-primary/5 shadow-[inset_2px_0_0_var(--primary)]"
                )}
              >
                <RootDropZone id={PAGE_ROOT_DROP_START_UID} placement="start" dropPreview={dropPreview} />
                {pageTree.map((node) => (
                  <PageTreeItem
                    key={node.page.uid}
                    node={node}
                    workspaceId={workspaceId}
                    workspacePath={workspacePath}
                    depth={0}
                    ancestors={[]}
                    expandedPageUids={expandedPageUids}
                    onToggleExpanded={handleToggleExpanded}
                    onPageClick={handlePageClick}
                    onOpenInNewTab={handleOpenInNewTab}
                    onDeleteClick={setPageToDelete}
                    onCreateSubpage={handleCreateSubpage}
                    onEditClick={handleEditClick}
                    onPermissionsClick={handlePermissionsClick}
                    onCopyLink={handleCopyLink}
                    onDuplicate={handleDuplicate}
                    isDragActive={!!activeUid}
                    dropPreview={dropPreview}
                  />
                ))}
                <RootDropZone id={PAGE_ROOT_DROP_TAIL_UID} placement="tail" dropPreview={dropPreview} />
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
