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
  useChatInput,
  ChatInputTopToolbar,
  ChatInputBottomToolbar,
  ChatInputSubmitControl,
  AttachmentPreview,
  SlashCommandMenu,
  WritingMode,
  WritingModeAttachments,
  WritingModeEditor,
  WritingModeFooter,
  WritingModeHeader,
  WritingModeRoot,
  WritingModeSubmitControl,
  WritingModeToolbar,
  useAttachments,
  useSlashCommandMenu,
  useResizableHeight,
  useIMEComposition,
  useAutoFocus,
} from "./chat-input";
export type {
  UseSlashCommandMenuOptions,
  UseSlashCommandMenuReturn,
} from "./chat-input";
export type {
  ChatInputProps,
  ChatInputContextValue,
  ChatInputTopToolbarProps,
  ChatInputBottomToolbarProps,
  ChatInputSubmitControlProps,
  SlashCommandMenuProps,
  AgentOption,
  ModelOption,
  ExecutorOption,
  GlobalChatConfig,
  ChatConfigVisibility,
  QueuedInputRecallItem,
  TasksSummary,
  BackgroundTasksSummary,
} from "./chat-input";

// WritingMode types (exported from writing-mode.tsx)
export type {
  WritingModeAttachmentsProps,
  WritingModeEditorProps,
  WritingModeFooterProps,
  WritingModeHeaderProps,
  WritingModeProps,
  WritingModeRootProps,
  WritingModeSubmitControlProps,
  WritingModeToolbarProps,
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
  SlashCommandHandler,
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

export { ContextApprovalButton, PERMISSION_MODE_CONFIG, useContextPermissionPopupProps } from "./context-approval-button";
export type { ContextApprovalButtonProps, ContextPopupRenderProps, PermissionMode } from "./context-approval-button";

export { ContextApprovalPopup } from "./context-approval-popup";
export type { ContextApprovalPopupProps } from "./context-approval-popup";

// Message components
export { MessageList } from "./message-list";
export type { Artifact, MessageListProps, MessageListHandle } from "./message-list";
export { MessageItem } from "./message-item";
export type { MessageItemProps } from "./message-item";
export { ToolExecutionItem } from "./tool-execution-item";
export type {
  ArtifactInfo,
  ToolExecutionItemProps,
  ToolExecutionStatus,
} from "./tool-execution-item";
export { PlanApproval } from "./plan-approval";
export { QuestionInput } from "./question-input";
export { CollapsedToolGroup } from "./collapsed-tool-group";
export type { CollapsedToolGroupProps } from "./collapsed-tool-group";

// Command Queue
export { useCommandQueue, useCommandQueueInputRecall, mergeQueuedInputRecallItems, CommandQueuePanel } from "./command-queue";
export type {
  CommandQueueItem,
  UseCommandQueueInputRecallOptions,
  UseCommandQueueInputRecallReturn,
  UseCommandQueueOptions,
  UseCommandQueueReturn,
  CommandQueuePanelProps,
} from "./command-queue";

// Todo List
export { TodoList, TodoListPanel, buildTodoListItems, buildTodoListItemsFromMessages } from "./todo-list";
export type {
  TodoListItem,
  TodoListItemStatus,
  TodoListProps,
  TodoListPanelProps,
} from "./todo-list";

// Background Task List
export { BackgroundTaskList, buildBackgroundTasksFromMessages } from "./background-task-list";
export type {
  BackgroundTaskItem,
  BackgroundTaskKind,
  BackgroundTaskListProps,
  BackgroundTaskStatus,
  BackgroundTaskUsage,
} from "./background-task-list";

// Message Queue
export { useMessageQueue } from "./message-queue";
export type {
  MessageQueueItem,
  UseMessageQueueOptions,
  UseMessageQueueReturn,
} from "./message-queue";

// Chat App Composition
export {
  ChatApp,
  ChatAppFullscreenCommandQueue,
  ChatAppFullscreenInputPanel,
  ChatAppFullscreenMessagePanel,
  ChatAppFullscreenPanel,
  ExpandedHeader,
  ExpandedHeaderModeControls,
} from "./chat-app";
export type {
  ChatAppFullscreenCommandQueueProps,
  ChatAppFullscreenInputPanelProps,
  ChatAppFullscreenMessagePanelProps,
  ChatAppFullscreenPanelProps,
  ChatAppMode,
  ChatAppProps,
  ChatAppSubagentSheetState,
  ExpandedHeaderModeControlsProps,
  ExpandedHeaderProps,
} from "./chat-app";

// Subagent Sheet (side panel)
export { SubagentSheet } from "./subagent-sheet";
export type { SubagentSheetProps, SubagentMessageListConfig } from "./subagent-sheet";

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

// Resizable Panel
export { useResizablePanel } from "./hooks/use-resizable-panel";
export type {
  ResizeDirection,
  UseResizablePanelOptions,
  UseResizablePanelReturn,
} from "./hooks/use-resizable-panel";
export { ResizeHandles } from "./components/resize-handles";
export type { ResizeHandlesProps } from "./components/resize-handles";

// Selectors
export { SingleSelector, TripleSelector } from "./selector";
export type {
  SelectorOption,
  SingleSelectorProps,
  TripleSelectorProps,
  TripleSelectorValue,
  DisplayLabelFormatParams,
} from "./selector";
