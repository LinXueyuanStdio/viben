// ============================================================================
// Desktop-specific wrappers (recommended for new code)
// ============================================================================

// Desktop ChatInput - provides Tauri screenshot and file dialog
export { DesktopChatInput } from "./desktop-chat-input";
export type { DesktopChatInputProps } from "./desktop-chat-input";

// Desktop MessageList - provides Tauri shell link handling
export { DesktopMessageList } from "./desktop-message-list";
export type { DesktopMessageListProps } from "./desktop-message-list";

// ============================================================================
// Legacy exports (for backward compatibility)
// ============================================================================

// Old ChatInput - will be deprecated after migration
export { ChatInput } from "./chat-input";
export type { ChatInputProps, SlashCommand } from "./chat-input";

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
