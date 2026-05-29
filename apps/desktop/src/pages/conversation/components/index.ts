// ============================================================================
// Re-exports from @/components/conversation (moved for proper dependency flow)
// ============================================================================

// Desktop MessageList - provides Tauri shell link handling
export { DesktopMessageList } from "@/components/conversation/desktop-message-list";
export type { DesktopMessageListProps } from "@/components/conversation/desktop-message-list";

// VitePreview - live preview component
export { VitePreview } from "@/components/conversation/vite-preview";

// Resize Handle
export { ResizeHandle } from "@/components/conversation/resize-handle";
export type { ResizeHandleProps } from "@/components/conversation/resize-handle";

// List Item components
export { ListItem, getGradientByName, gradients } from "@/components/conversation/list-item";
export type { ListItemProps, ListItemAction, ListItemBadge, ListItemSource } from "@/components/conversation/list-item";
export { ExecutorListItem, getExecutorDisplayName, getExecutorGradient } from "@/components/conversation/executor-list-item";
export type { ExecutorListItemProps, ExecutorItemData } from "@/components/conversation/executor-list-item";

// Source Tooltip
export { SourceTooltip, SourceBadge } from "@/components/conversation/source-tooltip";
export type { SourceTooltipProps, SourceBadgeProps, SourceType } from "@/components/conversation/source-tooltip";

// ============================================================================
// Desktop-specific wrappers (recommended for new code)
// ============================================================================

// Desktop ChatInput - provides Tauri screenshot and file dialog
export { DesktopChatInput } from "./desktop-chat-input";
export type { DesktopChatInputProps } from "./desktop-chat-input";

// Re-export types from @viben/chat for convenience
export type { SlashCommand, ChatInputProps, MessageListProps } from "@viben/chat";

// ============================================================================
// Shared components (not platform-specific)
// ============================================================================

export { RightSidebar } from "./right-sidebar";
export { DebugChatPanel } from "./debug-chat-panel";
export {
  ContextDetailsPopover,
  type ContextTokenBreakdown,
} from "./context-details-popover";
export { SessionSelector, type Session } from "./session-selector";

// Group Chat components
export { CreateGroupChatDialog } from "./create-group-chat-dialog";
export { GroupChatMessageList } from "./group-chat-message-list";
export { GroupChatListItem } from "./group-chat-list-item";
export { GroupChatMembersDialog } from "./group-chat-members-dialog";
export { GroupChatSidebar } from "./group-chat-sidebar";

// Agent List Item (still in pages/conversation/components as it doesn't have inverted deps)
export { AgentListItem } from "./agent-list-item";
export type { AgentListItemProps } from "./agent-list-item";

// Collapsible Section
export { CollapsibleSection } from "./collapsible-section";
export type { CollapsibleSectionProps } from "./collapsible-section";

// Detail Panels
export { ExecutorDetailPanel } from "./executor-detail-panel";
export type { ExecutorDetailPanelProps, ExecutorDetailData } from "./executor-detail-panel";
export { AgentDetailPanel } from "./agent-detail-panel";
export type { AgentDetailPanelProps, AgentDetailData, ModelOption } from "./agent-detail-panel";

// Executor Capabilities (reusable)
export { ExecutorCapabilities } from "./executor-capabilities";
export type { ExecutorCapabilitiesProps, McpServerInfo, SkillPackageInfo } from "./executor-capabilities";

// Background Task Indicator
export { BackgroundTaskIndicator } from "./background-task-indicator";

// Sandbox Toggle
export { SandboxToggle } from "./sandbox-toggle";
