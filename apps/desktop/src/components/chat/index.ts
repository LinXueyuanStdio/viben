// ============================================================================
// Desktop-specific wrappers (recommended for new code)
// ============================================================================

// Desktop ChatInput - provides Tauri screenshot and file dialog
export { DesktopChatInput } from "./desktop-chat-input";
export type { DesktopChatInputProps } from "./desktop-chat-input";

// Desktop MessageList - provides Tauri shell link handling
export { DesktopMessageList } from "./desktop-message-list";
export type { DesktopMessageListProps } from "./desktop-message-list";

// Re-export types from @viben/chat for convenience
export type { SlashCommand, ChatInputProps, MessageListProps } from "@viben/chat";

// ============================================================================
// Legacy exports (for backward compatibility)
// ============================================================================

// Old ChatInput - will be deprecated after migration
export { ChatInput } from "./chat-input";

// Old MessageList/MessageItem - will be deprecated after migration
export { MessageList } from "./message-list";
export { MessageItem } from "./message-item";

// ============================================================================
// Shared components (not platform-specific)
// ============================================================================

export { ToolExecutionItem } from "./tool-execution-item";
export { PlanApproval } from "./plan-approval";
export { QuestionInput } from "./question-input";
export { RightSidebar } from "./right-sidebar";
export { VitePreview } from "./vite-preview";
export { DebugChatPanel } from "./debug-chat-panel";
export { EmojiPicker } from "./emoji-picker";
export { ToolsConfigPopover, type ToolConfig } from "./tools-config-popover";
export { SkillsConfigPopover, type SkillConfig } from "./skills-config-popover";
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

// List Item components
export { ListItem, getGradientByName, formatRelativeTime, gradients } from "./list-item";
export type { ListItemProps, ListItemAction, ListItemBadge, ListItemSource } from "./list-item";
export { AgentListItem } from "./agent-list-item";
export type { AgentListItemProps } from "./agent-list-item";
export { ExecutorListItem, getExecutorDisplayName, getExecutorGradient } from "./executor-list-item";
export type { ExecutorListItemProps } from "./executor-list-item";

// Source Tooltip
export { SourceTooltip, SourceBadge } from "./source-tooltip";
export type { SourceTooltipProps, SourceBadgeProps, SourceType } from "./source-tooltip";

// Collapsible Section
export { CollapsibleSection } from "./collapsible-section";
export type { CollapsibleSectionProps } from "./collapsible-section";

// Detail Panels
export { ExecutorDetailPanel } from "./executor-detail-panel";
export type { ExecutorDetailPanelProps, ExecutorDetailData } from "./executor-detail-panel";
export { AgentDetailPanel } from "./agent-detail-panel";
export type { AgentDetailPanelProps, AgentDetailData, ModelOption } from "./agent-detail-panel";

// Background Task Indicator
export { BackgroundTaskIndicator } from "./background-task-indicator";
