/**
 * @viben/chat - Chat UI components
 *
 * A collection of reusable chat components for building
 * conversational interfaces. All components are platform-agnostic
 * and use callback props for platform-specific features.
 */

// Types
export * from "./types";

// Utilities
export { cn, isImageFile, formatTokens } from "./utils";

// ChatInput - Main chat input component
export {
  ChatInput,
  ChatInputToolbar,
  ChatInputConfigBar,
  AttachmentPreview,
  SlashCommandMenu,
  WritingMode,
  useAttachments,
  useSlashCommands,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./chat-input";
export type {
  ChatInputProps,
  AgentOption,
  ModelOption,
  ExecutorOption,
  GlobalChatConfig,
  ChatConfigVisibility,
} from "./chat-input";

// Auxiliary components
export { EmojiPicker } from "./emoji-picker";
export type { EmojiPickerProps } from "./emoji-picker";

export { ToolsConfigPopover } from "./tools-config-popover";
export type { ToolsConfigPopoverProps } from "./tools-config-popover";

export { SkillsConfigPopover } from "./skills-config-popover";
export type { SkillsConfigPopoverProps } from "./skills-config-popover";

export { ContextDetailsPopover } from "./context-details-popover";
export type { ContextDetailsPopoverProps } from "./context-details-popover";

// Message components
export { MessageList } from "./message-list";
export type { MessageListProps } from "./message-list";
export { MessageItem } from "./message-item";
export type { MessageItemProps } from "./message-item";
export { ToolExecutionItem } from "./tool-execution-item";
export { PlanApproval } from "./plan-approval";
export { QuestionInput } from "./question-input";
