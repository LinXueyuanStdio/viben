/**
 * Shared Conversation Components
 *
 * Components that are used across multiple pages and components.
 * These were moved from pages/conversation/components to fix inverted dependencies.
 */

// ============================================================================
// Resize Handle
// ============================================================================

export { ResizeHandle } from "./resize-handle";
export type { ResizeHandleProps } from "./resize-handle";

// ============================================================================
// Vite Preview
// ============================================================================

export { VitePreview } from "./vite-preview";

// ============================================================================
// Desktop Message List
// ============================================================================

export { DesktopMessageList } from "./desktop-message-list";
export type { DesktopMessageListProps, DesktopMessageListHandle } from "./desktop-message-list";

// ============================================================================
// List Item Components
// ============================================================================

export { ListItem, getGradientByName, gradients } from "./list-item";
export type { ListItemProps, ListItemAction, ListItemBadge, ListItemSource } from "./list-item";

export { ExecutorListItem, getExecutorDisplayName, getExecutorGradient } from "./executor-list-item";
export type { ExecutorListItemProps, ExecutorItemData } from "./executor-list-item";

// ============================================================================
// Source Tooltip
// ============================================================================

export { SourceTooltip, SourceBadge } from "./source-tooltip";
export type { SourceTooltipProps, SourceBadgeProps, SourceType } from "./source-tooltip";
