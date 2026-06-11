/**
 * PageIcon Component
 *
 * iPad-style app icon for a workspace page.
 * - Regular pages: gradient background square + icon + name
 * - Folder pages: frosted glass with 2x2 child icon preview
 */

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Shield,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { IconDisplay } from "@/components/ui/icon-picker";
import type { PageConfig } from "@/hooks/use-pages";
import type { PageTreeNode } from "../utils";
import { getPageGradientColors } from "../utils";

// =============================================================================
// Types
// =============================================================================

export interface PageIconProps {
  node: PageTreeNode;
  workspacePath: string;
  onClick: () => void;
  onOpenInNewTab: (page: PageConfig) => void;
  onCreateSubpage: (parentUid: string) => void;
  onDeleteClick: (page: PageConfig) => void;
  onPermissionsClick: (page: PageConfig) => void;
  onEditClick?: (page: PageConfig) => void;
}

// =============================================================================
// Component
// =============================================================================

export const PageIcon = memo(function PageIcon({
  node,
  workspacePath,
  onClick,
  onOpenInNewTab,
  onCreateSubpage,
  onDeleteClick,
  onPermissionsClick,
  onEditClick,
}: PageIconProps) {
  const { t } = useTranslation();
  const { page, children } = node;
  const isFolder = children.length > 0;
  const gradientColors = getPageGradientColors(page.name);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onClick();
    },
    [onClick]
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "flex flex-col items-center gap-1.5 w-[76px]",
            "transition-transform duration-150 ease-out",
            "hover:scale-105 active:scale-95",
            "outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl"
          )}
        >
          {/* Icon square */}
          {isFolder ? (
            <FolderIcon childNodes={children} workspacePath={workspacePath} />
          ) : (
            <PageIconSquare page={page} gradientColors={gradientColors} workspacePath={workspacePath} />
          )}

          {/* App name */}
          <span
            className="w-full text-center text-[11px] leading-tight line-clamp-2 break-words"
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
            }}
          >
            {page.name}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onOpenInNewTab(page)}>
          <ExternalLink className="mr-2 h-4 w-4" />
          {t("page.openInNewTab")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCreateSubpage(page.uid)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("page.createSubpage")}
        </ContextMenuItem>
        {onEditClick && (
          <ContextMenuItem onClick={() => onEditClick(page)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("common.edit", "Edit")}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onPermissionsClick(page)}>
          <Shield className="mr-2 h-4 w-4" />
          {t("page.permissions")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDeleteClick(page)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("common.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}, (prev, next) => {
  // Compare identity and display-relevant props only; skip callback functions
  return (
    prev.node.page.uid === next.node.page.uid &&
    prev.node.page.name === next.node.page.name &&
    prev.node.page.icon === next.node.page.icon &&
    prev.node.children.length === next.node.children.length &&
    prev.workspacePath === next.workspacePath
  );
});

// =============================================================================
// Sub-components
// =============================================================================

/** Regular page icon: gradient square with centered icon */
function PageIconSquare({
  page,
  gradientColors,
  workspacePath,
}: {
  page: PageConfig;
  gradientColors: { from: string; to: string };
  workspacePath: string;
}) {
  return (
    <div className="relative">
      <div
        className="w-[60px] h-[60px] rounded-[14px] flex items-center justify-center"
        style={{
          background: `linear-gradient(to bottom right, ${gradientColors.from}, ${gradientColors.to})`,
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        <span className="text-white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}>
          <IconDisplay
            icon={page.icon}
            size={28}
            workspacePath={workspacePath}
            className="text-white"
          />
        </span>
      </div>
      {/* Shine overlay */}
      <div
        className="absolute inset-x-1 top-0.5 h-5 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)",
          borderRadius: "12px 12px 0 0",
        }}
      />
    </div>
  );
}

/** Folder icon: frosted glass with 2x2 mini-grid of child icons */
function FolderIcon({
  childNodes,
  workspacePath,
}: {
  childNodes: PageTreeNode[];
  workspacePath: string;
}) {
  // Show up to 4 child icons in a 2x2 grid
  const previewChildren = childNodes.slice(0, 4);

  return (
    <div
      className="w-[60px] h-[60px] rounded-[14px] grid grid-cols-2 grid-rows-2 gap-1 p-2"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.18)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
      }}
    >
      {previewChildren.map((child) => {
        const childGradient = getPageGradientColors(child.page.name);
        return (
          <div
            key={child.page.uid}
            className="rounded-[4px] flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, ${childGradient.from}, ${childGradient.to})`,
            }}
          >
            <IconDisplay
              icon={child.page.icon}
              size={12}
              workspacePath={workspacePath}
              className="text-white"
            />
          </div>
        );
      })}
      {/* Empty slots */}
      {Array.from({ length: 4 - previewChildren.length }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="rounded-[4px]"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
        />
      ))}
    </div>
  );
}
