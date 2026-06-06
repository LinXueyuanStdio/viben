/**
 * ChatInput Types
 *
 * Type definitions for the ChatInput component and its sub-components.
 * Platform-specific features are handled via callback props.
 */

import type { ReactNode } from "react";
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

  // === Custom Content Slots ===
  /** Extra content to render at the left side of the config bar (after built-in selectors) */
  configBarLeftExtra?: ReactNode;
  /** Render an emoji picker UI when the toolbar emoji button is opened. */
  renderEmojiPicker?: (props: { onSelect: (emoji: string) => void }) => ReactNode;
  /** Replace the default top toolbar content. */
  renderTopToolbar?: (props: ChatInputToolbarRenderProps) => ReactNode;
  /** Replace or extend the default bottom toolbar content. */
  renderBottomToolbar?: (props: ChatInputBottomToolbarRenderProps) => ReactNode;
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
  /** Show top toolbar (emoji, file/screenshot, expand) */
  showTopToolbar?: boolean;
  /** Show bottom toolbar/config bar (agent, model, tools, skills, context, send) */
  showConfigBar?: boolean;
  /**
   * Input layout. "expanded" renders top toolbar, editor, bottom toolbar.
   * "compact" renders the editor inline inside the bottom toolbar.
   */
  layoutVariant?: "expanded" | "compact";
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
  /** Enable fullscreen writing mode */
  enableWritingMode?: boolean;

  // === Selector Visibility Override ===
  /** Force hide agent selector even if showConfigBar is true */
  hideAgentSelector?: boolean;
  /** Force hide model selector even if showConfigBar is true */
  hideModelSelector?: boolean;
  /** Force hide executor selector even if showConfigBar is true */
  hideExecutorSelector?: boolean;

  // === Agent/Model/Executor Selection ===
  /** Available agents for selection */
  agents?: AgentOption[];
  /** Currently selected agent ID */
  selectedAgentId?: string | null;
  /** Callback when agent is selected */
  onAgentChange?: (agentId: string) => void;
  /** Callback when agent settings button is clicked */
  onAgentSettings?: (agentId: string) => void;
  /** Available models for selection */
  models?: ModelOption[];
  /** Currently selected model ID */
  selectedModelId?: string | null;
  /** Callback when model is selected */
  onModelChange?: (modelId: string) => void;
  /** Available executors for selection */
  executors?: ExecutorOption[];
  /** Currently selected executor ID */
  selectedExecutor?: string;
  /** Callback when executor is selected */
  onExecutorChange?: (executorId: string) => void;

  // === Tools/Skills ===
  /** Available tools for configuration */
  tools?: ToolConfig[];
  /** Callback when tool is toggled */
  onToggleTool?: (toolId: string, enabled: boolean) => void;
  /** Number of enabled tools (used when tools array not provided) */
  enabledToolsCount?: number;
  /** Callback when tools button is clicked (when no inline config) */
  onToolsClick?: () => void;
  /** Available skills for configuration */
  skills?: SkillConfig[];
  /** Callback when skill is toggled */
  onToggleSkill?: (skillId: string, enabled: boolean) => void;
  /** Number of enabled skills (used when skills array not provided) */
  enabledSkillsCount?: number;
  /** Callback when skills button is clicked (when no inline config) */
  onSkillsClick?: () => void;

  // === Context ===
  /** Current context token count */
  contextTokens?: number;
  /** Context token breakdown for details popover */
  contextBreakdown?: ContextTokenBreakdown;
  /** Callback when context button is clicked */
  onContextClick?: () => void;

  // === Platform-specific Callbacks ===
  /**
   * Screenshot callback. If not provided, screenshot button is hidden.
   * @param hideWindow - Whether to hide the window before taking screenshot
   * @returns Promise resolving to attachment or null
   */
  onScreenshot?: (hideWindow?: boolean) => Promise<MessageAttachment | null>;
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
}

export interface ChatInputToolbarRenderProps {
  onEmojiSelect: (emoji: string) => void;
  onFileClick: () => void;
  onScreenshot?: (hideWindow?: boolean) => void;
  onExpandClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  isScreenshotCapturing?: boolean;
}

export interface ChatInputBottomToolbarRenderProps {
  leftContent: ReactNode;
  editor?: ReactNode;
  submitControl: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  canSubmit: boolean;
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
