/**
 * Generic List Item Component
 *
 * A reusable list item component for workspace sidebars.
 * Used by: AgentListItem, GroupChatListItem, ExecutorListItem, etc.
 *
 * Avatar badge positions:
 * - Top-right: count badge (e.g., member count)
 * - Bottom-right: online indicator (green dot)
 * - Bottom-left: source badge (workspace/global/project)
 */

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SourceBadge, type SourceType } from "./source-tooltip";

// ============================================================================
// Types
// ============================================================================

export interface ListItemAction {
  /** Action label */
  label: string;
  /** Action icon */
  icon?: LucideIcon;
  /** Click handler */
  onClick: () => void;
  /** Whether action is destructive (red text) */
  destructive?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Whether to show separator before this action */
  separator?: boolean;
}

export interface ListItemBadge {
  /** Badge text */
  label: string;
  /** Badge variant */
  variant?: "default" | "primary" | "secondary" | "destructive" | "outline";
}

export interface ListItemSource {
  /** Source type (workspace/global/project) */
  type: SourceType;
  /** Path to display in tooltip */
  path: string;
  /** Optional label override */
  label?: string;
}

export interface ListItemProps {
  /** Primary display name */
  name: string;
  /** Secondary description text */
  description?: string;

  // Avatar configuration
  avatar: {
    /** Icon to display in avatar */
    icon: LucideIcon;
    /** Gradient class (e.g., "from-blue-500 to-cyan-400") */
    gradient: string;
  };

  // Avatar indicators (badge positions around avatar)
  indicators?: {
    /** Show online indicator - green dot at bottom-right */
    online?: boolean;
    /** Count badge at top-right (e.g., member count) */
    count?: number | string;
    /** Source badge at bottom-left with tooltip */
    source?: ListItemSource;
  };

  // Badges next to name
  badges?: ListItemBadge[];

  // Right-side meta info
  meta?: {
    /** Timestamp or other short text */
    text?: string;
    /** Icon to show (e.g., muted indicator) */
    icon?: LucideIcon;
    /** Count badge (e.g., unread count) */
    count?: number;
  };

  // State
  /** Whether this item is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;

  // Actions
  /** Dropdown/context menu actions */
  actions?: ListItemAction[];
  /** Enable right-click context menu (default: false) */
  contextMenu?: boolean;

  /** Additional className */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get avatar gradient colors based on name
 */
export function getGradientByName(name: string): string {
  const colors = [
    "from-blue-500 to-cyan-400",
    "from-purple-500 to-pink-400",
    "from-green-500 to-emerald-400",
    "from-orange-500 to-yellow-400",
    "from-red-500 to-rose-400",
    "from-indigo-500 to-violet-400",
  ];
  const index = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[index];
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ============================================================================
// Badge Variant Styles
// ============================================================================

const badgeVariants: Record<NonNullable<ListItemBadge["variant"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border bg-transparent",
};

// ============================================================================
// Internal Components
// ============================================================================

interface ActionMenuItemsProps {
  actions: ListItemAction[];
  ItemComponent: typeof DropdownMenuItem | typeof ContextMenuPrimitive.Item;
  SeparatorComponent:
    | typeof DropdownMenuSeparator
    | typeof ContextMenuPrimitive.Separator;
  itemClassName?: string;
  separatorClassName?: string;
}

function ActionMenuItems({
  actions,
  ItemComponent,
  SeparatorComponent,
  itemClassName,
  separatorClassName,
}: ActionMenuItemsProps) {
  return (
    <>
      {actions.map((action, index) => (
        <React.Fragment key={index}>
          {action.separator && (
            <SeparatorComponent className={separatorClassName} />
          )}
          <ItemComponent
            className={cn(
              itemClassName,
              action.destructive && "text-destructive focus:text-destructive",
              action.disabled && "opacity-50 pointer-events-none"
            )}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
            {action.label}
          </ItemComponent>
        </React.Fragment>
      ))}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function ListItemContent({
  name,
  description,
  avatar,
  indicators,
  badges,
  meta,
  isSelected = false,
  onClick,
  actions,
  className,
}: Omit<ListItemProps, "contextMenu">) {
  const Icon = avatar.icon;
  const hasActions = actions && actions.length > 0;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all rounded-lg",
        isSelected ? "bg-accent" : "hover:bg-muted/50",
        className
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
          avatar.gradient
        )}
      >
        <Icon className="h-5 w-5 text-white" />

        {/* Top-right: Count badge (e.g., member count) */}
        {indicators?.count !== undefined && (
          <div className="absolute -top-1 -right-1 bg-background border rounded-full px-1.5 py-0.5 text-[10px] font-medium min-w-[18px] text-center">
            {indicators.count}
          </div>
        )}

        {/* Bottom-right: Online indicator (green dot) */}
        {indicators?.online && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        )}

        {/* Bottom-left: Source badge with tooltip */}
        {indicators?.source && (
          <div className="absolute -bottom-0.5 -left-0.5">
            <SourceBadge
              type={indicators.source.type}
              path={indicators.source.path}
              label={indicators.source.label}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-sm truncate">{name}</span>
            {/* Badges */}
            {badges?.map((badge, index) => (
              <span
                key={index}
                className={cn(
                  "shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium",
                  badgeVariants[badge.variant || "default"]
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
          {/* Meta text (timestamp) */}
          {meta?.text && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {meta.text}
            </span>
          )}
        </div>
        {description && (
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate">
              {description}
            </p>
            {/* Unread count */}
            {meta?.count !== undefined && meta.count > 0 && (
              <span className="shrink-0 bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {meta.count > 99 ? "99+" : meta.count}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Meta icon (e.g., muted indicator) */}
      {meta?.icon && (
        <meta.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      {/* Hover actions */}
      {hasActions && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            "bg-background/80 backdrop-blur-sm rounded-md px-1 py-0.5"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <ActionMenuItems
                actions={actions!}
                ItemComponent={DropdownMenuItem}
                SeparatorComponent={DropdownMenuSeparator}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export Component
// ============================================================================

export function ListItem(props: ListItemProps) {
  const { contextMenu = false, actions, ...contentProps } = props;

  // Without context menu
  if (!contextMenu || !actions || actions.length === 0) {
    return <ListItemContent {...contentProps} actions={actions} />;
  }

  // With context menu
  const contextMenuItemClass = cn(
    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
    "transition-colors focus:bg-accent focus:text-accent-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
  );

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        <div>
          <ListItemContent {...contentProps} actions={actions} />
        </div>
      </ContextMenuPrimitive.Trigger>

      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
          <ActionMenuItems
            actions={actions}
            ItemComponent={ContextMenuPrimitive.Item}
            SeparatorComponent={ContextMenuPrimitive.Separator}
            itemClassName={contextMenuItemClass}
            separatorClassName="-mx-1 my-1 h-px bg-muted"
          />
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

// ============================================================================
// Preset Gradients
// ============================================================================

export const gradients = {
  // Executor types
  claudeCode: "from-amber-500 to-orange-400",
  codex: "from-green-500 to-emerald-400",
  cursor: "from-purple-500 to-violet-400",
  windsurf: "from-blue-500 to-cyan-400",
  vscode: "from-sky-500 to-blue-400",
  continue: "from-pink-500 to-rose-400",
  zed: "from-yellow-500 to-amber-400",
  unknown: "from-gray-500 to-slate-400",

  // General purpose
  blue: "from-blue-500 to-cyan-400",
  purple: "from-purple-500 to-pink-400",
  green: "from-green-500 to-emerald-400",
  orange: "from-orange-500 to-yellow-400",
  red: "from-red-500 to-rose-400",
  indigo: "from-indigo-500 to-violet-400",
} as const;
