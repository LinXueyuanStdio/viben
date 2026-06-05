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
export { cn, isImageFile, formatTokens, getMimeType, getDisplayPath } from "./utils";
export { useMinDisplayTime } from "./use-min-display-time";

// Model icons
export { getModelIcon } from "./model-icons";
export type { ModelIconOptions } from "./model-icons";

// ChatInput - Main chat input component
export {
  ChatInput,
  ChatInputToolbar,
  ChatInputConfigBar,
  AttachmentPreview,
  SlashCommandMenu,
  WritingMode,
  useAttachments,
  useSlashCommandMenu,
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

// Slash Commands
export {
  filterSlashCommands,
  findSlashCommand,
  getSlashCommandQuery,
  mergeSlashCommands,
  parseSlashCommandInput,
  useSlashCommands,
} from "./slash-commands";
export type {
  ParsedSlashCommandInput,
  SlashCommand,
  SlashCommandArgument,
  SlashCommandDefinition,
  SlashCommandProvider,
  SlashCommandProviderContext,
  SlashCommandSelection,
  UseSlashCommandsOptions,
  UseSlashCommandsReturn,
} from "./slash-commands";

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
export type { MessageListProps, MessageListHandle } from "./message-list";
export { MessageItem } from "./message-item";
export type { MessageItemProps } from "./message-item";
export { ToolExecutionItem } from "./tool-execution-item";
export type { ToolExecutionItemProps, ToolExecutionStatus, ArtifactInfo } from "./tool-execution-item";
export { PlanApproval } from "./plan-approval";
export { QuestionInput } from "./question-input";
export { CollapsedToolGroup } from "./collapsed-tool-group";
export type { CollapsedToolGroupProps } from "./collapsed-tool-group";

// Command Queue
export { useCommandQueue, CommandQueuePanel } from "./command-queue";
export type {
  CommandQueueItem,
  UseCommandQueueOptions,
  UseCommandQueueReturn,
  CommandQueuePanelProps,
} from "./command-queue";

// Message Queue
export { useMessageQueue } from "./message-queue";
export type {
  MessageQueueItem,
  UseMessageQueueOptions,
  UseMessageQueueReturn,
} from "./message-queue";

// Subagent Sheet (side panel)
export { SubagentSheet } from "./subagent-sheet";
export type { SubagentSheetProps } from "./subagent-sheet";

// Exec Approval
export { ExecApproval } from "./exec-approval";
export type { ExecApprovalProps, PendingExecApproval } from "./exec-approval";

// Streaming Text
export { StreamingTextBlock } from "./streaming-text-block";
export type { StreamingTextBlockProps } from "./streaming-text-block";

// Message Lookups (performance utilities)
export { buildMessageLookups, updateMessageLookupsIncremental, EMPTY_LOOKUPS } from "./message-lookups";
export type { MessageLookups } from "./message-lookups";
export { MessageLookupsProvider, useMessageLookups } from "./message-lookups-context";

// Message Preprocessing Pipeline
export { preprocessMessages, normalizeMessages, collapseConsecutiveTools, buildPipelineLookups } from "./preprocessing";
export type {
  ProcessedMessages,
  ProcessedItem,
  CollapsedGroup,
  CollapsedCounts,
  ToolPair,
  PipelineLookups,
} from "./preprocessing";

// Virtual Scroll
export { useVirtualScroll } from "./hooks/use-virtual-scroll";
export type { UseVirtualScrollOptions, UseVirtualScrollResult } from "./hooks/use-virtual-scroll";
