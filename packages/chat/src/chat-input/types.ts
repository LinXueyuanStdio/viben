/**
 * ChatInput Types
 *
 * Type definitions for the ChatInput component and its sub-components.
 * Platform-specific features are handled via callback props.
 */

import type { ReactNode, RefObject } from "react";
import type {
  MessageAttachment,
  SlashCommand,
  SlashCommandHandler,
  ToolConfig,
  SkillConfig,
  ContextTokenBreakdown,
} from "../types";

// ============================================================================
// Agent/Model/Executor Option Types
// ============================================================================

/** Agent option for selector */
export interface AgentOption {
  id: string;
  name: string;
  description?: string;
  /** The model configured for this agent */
  model?: string;
  icon?: ReactNode;
}

/** Model option for selector */
export interface ModelOption {
  id: string;
  name: string;
  provider?: string;
  icon?: ReactNode;
}

/** Executor option for selector (generic) */
export interface ExecutorOption {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
}

/** Minimal queued input item shape used by ChatInput ArrowUp recall. */
export interface QueuedInputRecallItem {
  id?: string;
  /** Text content to merge back into the input for editing. */
  content: string;
  /** Optional attachments carried by queue implementations. */
  attachments?: MessageAttachment[];
  createdAt?: number;
}

// ============================================================================
// Global Config Types
// ============================================================================

/** Global chat configuration */
export interface GlobalChatConfig {
  agentId?: string | null;
  modelId?: string | null;
  executor?: string | null;
  enabledTools?: string[];
  enabledSkills?: string[];
}

/** Visibility settings for chat config selectors */
export interface ChatConfigVisibility {
  showAgentSelector: boolean;
  showModelSelector: boolean;
  showExecutorSelector: boolean;
}

// ============================================================================
// ChatInput Props
// ============================================================================

export interface ChatInputProps {
  // === Basic Props ===
  /** Callback when message is sent */
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  /** Controlled textarea value. */
  value?: string;
  /** Initial textarea value for uncontrolled usage. */
  defaultValue?: string;
  /** Callback when textarea value changes. */
  onValueChange?: (value: string) => void;
  /**
   * Callback when ArrowUp is pressed while the input is empty.
   * Prefer queuedInputRecallItems/onQueuedInputRecall for built-in queue recall.
   */
  onRecallQueuedInput?: (currentValue: string) => void;
  /** Queued input items to recall into the editor when ArrowUp is pressed on empty input. */
  queuedInputRecallItems?: QueuedInputRecallItem[];
  /** Joiner used when multiple queued inputs are recalled. Defaults to a blank line. */
  queuedInputRecallJoiner?: string;
  /** Called after queued inputs are merged into the editor. Use this to clear/cancel the backing queue. */
  onQueuedInputRecall?: (items: QueuedInputRecallItem[], value: string) => void;
  /**
   * Previously sent input values, ordered oldest to newest.
   * ArrowUp recalls the newest entry when the input is empty; ArrowUp/ArrowDown then navigate history.
   */
  inputHistoryItems?: string[];
  /** Callback when ArrowLeft is pressed while the input is empty. */
  onRecallSessionList?: () => void;

  // === Toolbar Slots ===
  /** Top toolbar content. Shown when showTopToolbar is true. */
  topToolbar?: ReactNode;
  /** Bottom toolbar content. Shown when showBottomToolbar is true. */
  bottomToolbar?: ReactNode;

  /** Callback when cancel/stop button is clicked */
  onCancel?: () => void;
  /** Whether the chat is in loading/streaming state */
  isLoading?: boolean;
  /** Allow sending messages while loading (for steering/intervention) */
  allowSendWhileLoading?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** When set, shows a subtle message above the input explaining why it's disabled */
  blockedReason?: string;
  /** Whether sending is disabled while the textarea remains editable */
  sendDisabled?: boolean;
  /** Optional reason to show when sending is disabled */
  sendBlockedReason?: string;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Additional CSS class */
  className?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;

  // === Layout Control ===
  /** Show top toolbar area */
  showTopToolbar?: boolean;
  /** Show the bottom toolbar. Defaults to true. */
  showBottomToolbar?: boolean;
  /**
   * Input layout. "expanded" renders top toolbar, editor, bottom toolbar.
   * "compact" renders a single-line input with + button (left) and submit (right).
   */
  layoutVariant?: "expanded" | "compact";
  /**
   * Called when user requests multi-line mode (shift+enter in compact mode).
   * ChatApp should switch to expanded mode when this fires.
   */
  onRequestExpand?: () => void;
  /** Show resize handle for adjustable height */
  showResizeHandle?: boolean;
  /** Initial height in pixels when resize handle is enabled */
  defaultHeight?: number;
  /** Minimum height in pixels when resize handle is enabled */
  minHeight?: number;
  /** Maximum height in pixels when resize handle is enabled */
  maxHeight?: number;
  /** Optional localStorage key for persisted resize height */
  heightStorageKey?: string;

  // === Attachments ===
  /** Controlled attachments list */
  attachments?: MessageAttachment[];
  /** Callback when attachments change */
  onAttachmentsChange?: (attachments: MessageAttachment[]) => void;
  /** Whether any attachment is loading */
  isAttachmentLoading?: boolean;

  // === Platform-specific Callbacks ===
  /**
   * Open file dialog callback. If not provided, uses native file input.
   * @returns Promise resolving to attachments or null
   */
  onOpenFile?: () => Promise<MessageAttachment[] | null>;
  /**
   * Paste handler callback for platform-specific paste behavior.
   * If not provided, uses default browser paste handling.
   */
  onPaste?: (event: React.ClipboardEvent) => Promise<MessageAttachment[] | null>;

  // === Slash Commands ===
  /** Available slash commands */
  slashCommands?: SlashCommand[];
  /** Callback when a slash command is selected */
  onSlashCommand?: SlashCommandHandler;
  /** Custom slash command menu renderer. If omitted, ChatInput renders the default menu. */
  renderSlashCommandMenu?: (props: SlashCommandMenuProps) => ReactNode;

  // === Refs (for external control) ===
  /** Ref to the textarea element */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  /** Ref to the container element */
  containerRef?: RefObject<HTMLDivElement | null>;
}

/** Context provided to toolbar components via ChatInputContext */
export interface ChatInputContextValue {
  content: string;
  setContent: (value: string | ((prev: string) => string)) => void;
  attachments: MessageAttachment[];
  addAttachment: (attachment: MessageAttachment) => void;
  addFiles: (files: FileList | File[], isImage?: boolean) => Promise<void>;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  isAnyLoading: boolean;
  canSubmit: boolean;
  handleSend: () => void;
  handleFileClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (text: string) => void;
}

// ============================================================================
// Sub-component Props
// ============================================================================

/** Props for the top toolbar */
export interface ChatInputToolbarProps {
  onEmojiSelect: (emoji: string) => void;
  onFileClick: () => void;
  onScreenshot?: (hideWindow?: boolean) => void;
  onExpandClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  isScreenshotCapturing?: boolean;
  showExpand?: boolean;
}

/** Props for the config bar */
export interface ChatInputConfigBarProps {
  // Agent
  agents: AgentOption[];
  selectedAgentId: string | null;
  onAgentChange?: (agentId: string) => void;
  showAgentSelector: boolean;
  // Model
  models: ModelOption[];
  selectedModelId: string | null;
  onModelChange?: (modelId: string) => void;
  showModelSelector: boolean;
  // Executor
  executors: ExecutorOption[];
  selectedExecutor: string;
  onExecutorChange?: (executorId: string) => void;
  showExecutorSelector: boolean;
  // Tools
  tools: ToolConfig[];
  onToggleTool?: (toolId: string, enabled: boolean) => void;
  enabledToolsCount: number;
  onToolsClick?: () => void;
  // Skills
  skills: SkillConfig[];
  onToggleSkill?: (skillId: string, enabled: boolean) => void;
  enabledSkillsCount: number;
  onSkillsClick?: () => void;
  // Context
  contextTokens: number;
  contextBreakdown?: ContextTokenBreakdown;
  onContextClick?: () => void;
  // Send
  onSend: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  canSubmit: boolean;
}

/** Props for the attachment preview */
export interface AttachmentPreviewProps {
  attachments: MessageAttachment[];
  onRemove: (id: string) => void;
}

/** Props for the slash command menu */
export interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
  isOpen: boolean;
  query: string;
  anchorRef?: React.RefObject<HTMLElement>;
}
