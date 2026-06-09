import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@viben/ui";
import { BackgroundTaskList, buildBackgroundTasksFromMessages } from "./background-task-list";
import {
  ChatInput,
  ChatInputTopToolbar,
  ChatInputBottomToolbar,
  WritingMode,
  useAttachments,
  useIMEComposition,
} from "./chat-input";
import { CommandQueuePanel } from "./command-queue";
import { ResizeHandles } from "./components/resize-handles";
import { EmojiPicker } from "./emoji-picker";
import { ExecApproval } from "./exec-approval";
import { useResizablePanel } from "./hooks/use-resizable-panel";
import type { ResizeDirection } from "./hooks/use-resizable-panel";
import { MessageList } from "./message-list";
import { PlanApproval } from "./plan-approval";
import { QuestionInput } from "./question-input";
import { SubagentSheet } from "./subagent-sheet";
import { TodoListPanel, buildTodoListItemsFromMessages } from "./todo-list";
import type { BackgroundTaskItem } from "./background-task-list";
import type { ChatInputProps } from "./chat-input";
import type { TasksSummary, BackgroundTasksSummary } from "./chat-input/top-toolbar";
import type { CommandQueueItem } from "./command-queue";
import type { PendingExecApproval } from "./exec-approval";
import type { Artifact } from "./message-list";
import type {
  AgentMessage,
  ExpandSubagentHandler,
  InspectToolHandler,
  LoadSubagentDetails,
  MessageAttachment,
  PendingQuestion,
  SubagentOpenContext,
  TaskPlan,
} from "./types";

export type ChatAppMode = "floating" | "compact" | "expanded" | "full";

export interface ExpandedHeaderProps {
  leftContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export interface ExpandedHeaderModeControlsProps {
  mode: ChatAppMode;
  onModeChange: (mode: ChatAppMode) => void;
  moreMenuContent?: React.ReactNode;
}

export interface ChatAppProps {
  mode: ChatAppMode;
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming: boolean;
  streamingText?: string | null;
  contained?: boolean;
  title?: string;
  pendingUserMessageCount?: number;
  dynamicAssistantAvatar?: React.ReactNode;
  staticAssistantAvatar?: React.ReactNode;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  inputProps?: Partial<ChatInputProps>;
  /** Custom top toolbar content for expanded mode. If not provided, uses default. */
  topToolbar?: React.ReactNode;
  /** Custom bottom toolbar content for expanded mode. If not provided, uses default. */
  bottomToolbar?: React.ReactNode;
  /** Left content slot for default bottom toolbar (used when bottomToolbar is not provided) */
  bottomToolbarLeftContent?: React.ReactNode;
  /** Enable fullscreen writing mode in expanded mode */
  enableWritingMode?: boolean;
  /** Screenshot callback for toolbar */
  onScreenshot?: (hideWindow?: boolean) => Promise<MessageAttachment | null>;
  /** Open file dialog callback */
  onOpenFile?: () => Promise<MessageAttachment[] | null>;
  headerContent?: React.ReactNode;
  fullscreenContent?: React.ReactNode;
  surfaceOverlay?: React.ReactNode;
  statusContent?: React.ReactNode;
  compactSummaryContent?: React.ReactNode;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  artifacts?: Artifact[];
  onExpandSubagent?: ExpandSubagentHandler;
  onInspectTool?: InspectToolHandler;
  subagentSheet?: ChatAppSubagentSheetState;
  loadSubagentDetails?: LoadSubagentDetails;
  onArtifactClick?: (artifactId: string) => void;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
  onModeChange: (mode: ChatAppMode) => void;
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel: () => void;
  /** Enable resize handles for expanded mode (default: true) */
  enableExpandedResize?: boolean;
  /** Storage key for persisting expanded panel size */
  expandedSizeStorageKey?: string;
  /** Default width for expanded mode (default: 440) */
  expandedDefaultWidth?: number;
  /** Default height for expanded mode (default: 560) */
  expandedDefaultHeight?: number;
  /** Minimum width for expanded mode (default: 320) */
  expandedMinWidth?: number;
  /** Maximum width for expanded mode (default: 800) */
  expandedMaxWidth?: number;
  /** Minimum height for expanded mode (default: 400) */
  expandedMinHeight?: number;
  /** Maximum height for expanded mode (default: 900) */
  expandedMaxHeight?: number;
}

export interface ChatAppSubagentSheetState {
  open: boolean;
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  liveMessages?: AgentMessage[];
  context?: SubagentOpenContext;
  loadSubagentDetails?: LoadSubagentDetails;
  onClose: () => void;
}

export interface ChatAppFullscreenPanelProps {
  messageContent: React.ReactNode;
  inputContent: React.ReactNode;
  statusContent?: React.ReactNode;
}

export interface ChatAppFullscreenMessagePanelProps {
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming?: boolean;
  streamingText?: string | null;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  assistantAvatar?: React.ReactNode;
  artifacts?: Artifact[];
  welcomeTitle?: string;
  welcomeDescription?: string;
  maxMessageWidth?: string;
  onExpandSubagent?: ExpandSubagentHandler;
  onInspectTool?: InspectToolHandler;
  onArtifactClick?: (artifactId: string) => void;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
}

export interface ChatAppFullscreenCommandQueueProps {
  commandQueueItems?: CommandQueueItem[];
  onCommandQueueRemove?: (id: string) => void;
  onCommandQueueClear?: () => void;
  hideItemRemove?: boolean;
  onCommandQueueRecall?: (items: CommandQueueItem[]) => void;
}

export interface ChatAppFullscreenInputPanelProps {
  inputProps: ChatInputProps;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
}

const OVERLAY_TRANSITION = {
  type: "tween",
  duration: 0.34,
  ease: [0.4, 0, 0.2, 1],
} as const;

const OVERLAY_AVATAR_TRANSITION = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1],
} as const;

const FLOAT_OVERLAY_TRANSITION = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
} as const;

const INTERNAL_LAYOUT_TRANSITION = {
  type: "tween",
  duration: 0.28,
  ease: [0.4, 0, 0.2, 1],
} as const;

const OVERLAY_RADIUS = {
  floating: 999,
  compact: 24,
  expanded: 16,
  full: 0,
} as const;

const OVERLAY_PANEL_WIDTH_CLASS = "w-[min(440px,calc(100dvw_-_2rem))]";
const EXPANDED_PANEL_HEIGHT_CLASS = "h-[75dvh]";

export function ChatApp({
  mode,
  messages,
  messageUpdates,
  isStreaming,
  streamingText,
  contained = false,
  title = "Viben session",
  pendingUserMessageCount = 0,
  dynamicAssistantAvatar,
  staticAssistantAvatar,
  inputValue,
  onInputValueChange,
  inputProps,
  topToolbar,
  bottomToolbar,
  bottomToolbarLeftContent,
  enableWritingMode = true,
  onScreenshot,
  onOpenFile,
  headerContent,
  fullscreenContent,
  surfaceOverlay,
  statusContent,
  compactSummaryContent,
  messageListRef,
  artifacts,
  onExpandSubagent,
  onInspectTool,
  subagentSheet,
  loadSubagentDetails,
  onArtifactClick,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
  onModeChange,
  onSend,
  onCancel,
  enableExpandedResize = true,
  expandedSizeStorageKey = "viben_chat_expanded_size",
  expandedDefaultWidth = 440,
  expandedDefaultHeight = 560,
  expandedMinWidth = 320,
  expandedMaxWidth = 800,
  expandedMinHeight = 400,
  expandedMaxHeight = 900,
}: ChatAppProps) {
  const { t } = useTranslation();
  const [uncontrolledInput, setUncontrolledInput] = React.useState("");
  const [isWritingMode, setIsWritingMode] = React.useState(false);
  const [isScreenshotCapturing, setIsScreenshotCapturing] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Resizable panel for expanded mode
  const {
    width: expandedWidth,
    height: expandedHeight,
    isResizing,
    handleResizeStart,
  } = useResizablePanel({
    storageKey: expandedSizeStorageKey,
    defaultWidth: expandedDefaultWidth,
    defaultHeight: expandedDefaultHeight,
    minWidth: expandedMinWidth,
    maxWidth: expandedMaxWidth,
    minHeight: expandedMinHeight,
    maxHeight: expandedMaxHeight,
    enabled: enableExpandedResize && mode === "expanded",
  });

  // Wrapped resize handler for ResizeHandles component
  const handleResizeStartWrapper = React.useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      handleResizeStart(e, direction);
    },
    [handleResizeStart]
  );

  const content = inputValue ?? uncontrolledInput;
  const setContent = React.useCallback((value: string) => {
    if (inputValue === undefined) setUncontrolledInput(value);
    onInputValueChange?.(value);
  }, [inputValue, onInputValueChange]);

  const {
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    isAnyLoading: isAttachmentLoading,
  } = useAttachments();

  const { isComposing, handleCompositionStart, handleCompositionEnd } = useIMEComposition();

  const compactActivitySummary = compactSummaryContent ?? t("chat_app.activity.ready", "Ready when you are.");
  const hasCompactDraft = content.trim().length > 0;

  // Tasks summary for top toolbar
  const todoItems = React.useMemo(
    () => buildTodoListItemsFromMessages(messages, messageUpdates),
    [messageUpdates, messages]
  );

  const backgroundTasks = React.useMemo(
    () => buildBackgroundTasksFromMessages(messages).map(({ now: _now, ...task }) => task),
    [messages]
  );

  const tasksSummary: TasksSummary | undefined = React.useMemo(() => {
    if (todoItems.length === 0) return undefined;
    const completedCount = todoItems.filter((item) => item.status === "completed").length;
    return {
      items: todoItems,
      completedCount,
      totalCount: todoItems.length,
    };
  }, [todoItems]);

  const backgroundTasksSummary: BackgroundTasksSummary | undefined = React.useMemo(() => {
    if (backgroundTasks.length === 0) return undefined;
    const runningCount = backgroundTasks.filter((task) => task.status === "running").length;
    return {
      items: backgroundTasks,
      runningCount,
      totalCount: backgroundTasks.length,
    };
  }, [backgroundTasks]);

  const handleBackgroundTaskClick = React.useCallback((task: BackgroundTaskItem) => {
    onExpandSubagent?.(
      task.description,
      task.kind,
      task.messages ?? [],
      {
        subagentId: task.sourceMessage?.subagentId,
        toolUseId: task.sourceMessage?.toolUseId ?? task.id,
        parentMessage: task.sourceMessage,
        messages: task.messages,
      }
    );
  }, [onExpandSubagent]);

  const renderTasksPopup = React.useCallback(() => (
    <div className="rounded-lg border border-border bg-popover shadow-xl">
      <TodoListPanel items={todoItems} defaultExpanded />
    </div>
  ), [todoItems]);

  const renderBackgroundTasksPopup = React.useCallback(() => (
    <div className="rounded-lg border border-border bg-popover shadow-xl">
      <BackgroundTaskList tasks={backgroundTasks} onTaskClick={handleBackgroundTaskClick} defaultExpanded />
    </div>
  ), [backgroundTasks, handleBackgroundTaskClick]);

  // Screenshot handler
  const handleScreenshot = React.useCallback(
    async (hideWindow?: boolean) => {
      if (!onScreenshot) return;
      setIsScreenshotCapturing(true);
      try {
        const attachment = await onScreenshot(hideWindow);
        if (attachment) {
          addAttachment(attachment);
        }
      } catch (error) {
        console.error("[ChatApp] Screenshot failed:", error);
      } finally {
        setIsScreenshotCapturing(false);
      }
    },
    [onScreenshot, addAttachment]
  );

  // Insert emoji at cursor
  const insertEmoji = React.useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent(content + emoji);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        if (textarea) {
          const newPosition = start + emoji.length;
          textarea.setSelectionRange(newPosition, newPosition);
          textarea.focus();
        }
      });
    },
    [content, setContent]
  );

  // File click handler for top toolbar
  const handleFileClick = React.useCallback(async () => {
    if (onOpenFile) {
      const openedAttachments = await onOpenFile();
      if (openedAttachments && openedAttachments.length > 0) {
        openedAttachments.forEach((a) => addAttachment(a));
      }
    }
  }, [onOpenFile, addAttachment]);

  const canSubmit = (content.trim().length > 0 || attachments.length > 0) && !isAttachmentLoading;

  const handleSubmit = React.useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setContent("");
    clearAttachments();
    setIsWritingMode(false);
  }, [content, attachments, onSend, setContent, clearAttachments]);

  // WritingMode keyboard handler
  const handleWritingModeKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        setIsWritingMode(false);
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !isComposing) {
        event.preventDefault();
        if (canSubmit) {
          handleSubmit();
        }
      }
    },
    [isComposing, canSubmit, handleSubmit]
  );

  // WritingMode paste handler
  const handleWritingModePaste = React.useCallback(
    async (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const reader = new FileReader();
            reader.onload = (e) => {
              const data = e.target?.result as string;
              if (data) {
                addAttachment({
                  id,
                  type: "image",
                  name: file.name || "pasted-image.png",
                  data,
                  mimeType: file.type || "image/png",
                });
              }
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    },
    [addAttachment]
  );

  // Default top toolbar (for ChatInput)
  const defaultTopToolbar = (
    <ChatInputTopToolbar
      onEmojiSelect={insertEmoji}
      onFileClick={handleFileClick}
      onScreenshot={onScreenshot ? handleScreenshot : undefined}
      onExpandClick={enableWritingMode ? () => setIsWritingMode(true) : undefined}
      isLoading={isStreaming}
      disabled={false}
      isScreenshotCapturing={isScreenshotCapturing}
      showExpand={enableWritingMode}
      tasksSummary={tasksSummary}
      backgroundTasksSummary={backgroundTasksSummary}
      renderTasksPopup={renderTasksPopup}
      renderBackgroundTasksPopup={renderBackgroundTasksPopup}
      renderEmojiPicker={(pickerProps) => <EmojiPicker {...pickerProps} />}
    />
  );

  // WritingMode top toolbar (no expand button since already in fullscreen)
  const writingModeTopToolbar = (
    <ChatInputTopToolbar
      onEmojiSelect={insertEmoji}
      onFileClick={handleFileClick}
      onScreenshot={onScreenshot ? handleScreenshot : undefined}
      isLoading={isStreaming}
      disabled={false}
      isScreenshotCapturing={isScreenshotCapturing}
      showExpand={false}
      tasksSummary={tasksSummary}
      backgroundTasksSummary={backgroundTasksSummary}
      renderTasksPopup={renderTasksPopup}
      renderBackgroundTasksPopup={renderBackgroundTasksPopup}
      renderEmojiPicker={(pickerProps) => <EmojiPicker {...pickerProps} />}
    />
  );

  // Default bottom toolbar with external leftContent slot
  const defaultBottomToolbar = (
    <ChatInputBottomToolbar
      leftContent={bottomToolbarLeftContent}
      onSend={handleSubmit}
      onCancel={onCancel}
      isLoading={isStreaming}
      canSubmit={canSubmit}
      allowSendWhileLoading
    />
  );

  const resolvedTopToolbar = topToolbar ?? inputProps?.topToolbar ?? defaultTopToolbar;
  const resolvedBottomToolbar = bottomToolbar ?? inputProps?.bottomToolbar ?? defaultBottomToolbar;
  const resolvedWritingModeTopToolbar = topToolbar ?? inputProps?.topToolbar ?? writingModeTopToolbar;


  const expandedInputProps: ChatInputProps = {
    ...inputProps,
    value: content,
    onValueChange: setContent,
    onSend: handleSubmit,
    onCancel,
    isLoading: isStreaming,
    allowSendWhileLoading: true,
    placeholder: inputProps?.placeholder ?? (
      isStreaming
        ? t("chat_app.input.placeholder.queue", "Queue a message...")
        : t("chat_app.input.placeholder.default", "Ask Viben...")
    ),
    layoutVariant: "expanded",
    showTopToolbar: true,
    showBottomToolbar: true,
    topToolbar: resolvedTopToolbar,
    bottomToolbar: resolvedBottomToolbar,
    attachments,
    onAttachmentsChange: (newAttachments) => {
      // Attachments are managed by useAttachments hook
    },
    isAttachmentLoading,
    textareaRef,
    className: `bg-background ${inputProps?.className ?? ""}`,
  };

  const compactInputProps: ChatInputProps = {
    ...inputProps,
    value: content,
    onValueChange: setContent,
    onSend: handleSubmit,
    onCancel,
    isLoading: isStreaming,
    allowSendWhileLoading: true,
    placeholder: inputProps?.placeholder ?? (
      isStreaming
        ? t("chat_app.input.placeholder.queue", "Queue a message...")
        : t("chat_app.input.placeholder.default", "Ask Viben...")
    ),
    layoutVariant: "compact",
    onRequestExpand: () => onModeChange("expanded"),
    showTopToolbar: false,
    showBottomToolbar: false,
    onOpenFile,
    attachments,
    onAttachmentsChange: (newAttachments) => {
      // Sync attachments - ChatInput manages them internally but we keep track
    },
    isAttachmentLoading,
    textareaRef,
    className: `bg-background ${inputProps?.className ?? ""}`,
  };

  const defaultExpandedBody = (
    <>
      <motion.div
        layoutId="viben-overlay-message-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain border-y border-border/70"
        data-shared-element="overlay-message-panel"
        data-testid="expanded-message-panel"
      >
        <ChatAppMessagePanel
          messageListRef={messageListRef}
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isStreaming}
          streamingText={streamingText}
          assistantAvatar={staticAssistantAvatar}
          maxMessageWidth="100%"
          artifacts={artifacts}
          onExpandSubagent={onExpandSubagent}
          onInspectTool={onInspectTool}
          onArtifactClick={onArtifactClick}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={onApprovePlan}
          onRejectPlan={onRejectPlan}
          onApprovalDecision={onApprovalDecision}
          onAnswerQuestions={onAnswerQuestions}
        />
        {statusContent}
      </motion.div>
      <motion.div
        layoutId="viben-overlay-input-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="w-full shrink-0 border-t border-border"
        data-shared-element="overlay-input-panel"
        data-testid="expanded-chat-input-container"
      >
        <ChatAppPendingInputContent
          inputProps={expandedInputProps}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={onApprovePlan}
          onRejectPlan={onRejectPlan}
          onApprovalDecision={onApprovalDecision}
          onAnswerQuestions={onAnswerQuestions}
        />
      </motion.div>
    </>
  );

  const expandedContent = (
    <>
      {headerContent ? (
        <motion.div
          layoutId="viben-overlay-header"
          transition={INTERNAL_LAYOUT_TRANSITION}
          className="shrink-0"
          data-shared-element="overlay-header"
        >
          {headerContent}
        </motion.div>
      ) : null}
      {mode === "full" && fullscreenContent ? fullscreenContent : defaultExpandedBody}
    </>
  );

  const subagentSheetNode = subagentSheet ? (
    <SubagentSheet
      contained
      open={subagentSheet.open}
      onClose={subagentSheet.onClose}
      title={subagentSheet.title}
      subagentType={subagentSheet.subagentType}
      messages={subagentSheet.messages}
      liveMessages={subagentSheet.liveMessages}
      context={subagentSheet.context}
      loadSubagentDetails={subagentSheet.loadSubagentDetails ?? loadSubagentDetails}
      onExpandSubagent={onExpandSubagent}
      onInspectTool={onInspectTool}
    />
  ) : null;

  // WritingMode overlay - contained within ChatApp container
  const writingModeNode = enableWritingMode && isWritingMode ? (
    <WritingMode
      isOpen={isWritingMode}
      onClose={() => setIsWritingMode(false)}
      content={content}
      onContentChange={setContent}
      attachments={attachments}
      onRemoveAttachment={removeAttachment}
      onKeyDown={handleWritingModeKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handleWritingModePaste}
      topToolbar={resolvedWritingModeTopToolbar}
      bottomToolbar={resolvedBottomToolbar}
      contained
      isLoading={isStreaming}
      disabled={false}
      placeholder={inputProps?.placeholder ?? t("chat_app.input.placeholder.default", "Ask Viben...")}
      textareaRef={textareaRef}
    />
  ) : null;

  if (mode === "full") {
    return (
      <motion.div
        layoutId="viben-overlay-surface"
        transition={OVERLAY_TRANSITION}
        initial={false}
        data-transition-role="expand-to-full"
        className={`overlay-shared-surface flex min-h-0 w-full flex-col overflow-hidden bg-background shadow-none ${
          contained ? "absolute inset-y-0 right-0 z-30 h-full" : "fixed inset-y-0 right-0 z-50 h-full"
        }`}
        style={{ borderRadius: OVERLAY_RADIUS.full }}
        data-testid="full-overlay"
      >
        {expandedContent}
        {subagentSheetNode}
        {surfaceOverlay}
        {writingModeNode}
      </motion.div>
    );
  }

  // For floating mode, WritingMode should expand to full mode first
  if (mode === "floating") {
    return (
      <div className={contained ? "z-20" : "fixed bottom-6 left-6 z-50"} data-testid="floating-overlay">
        <motion.button
          type="button"
          aria-label={t("chat_app.overlay.open_compact", "Open compact chat")}
          onClick={() => onModeChange("compact")}
          onMouseEnter={() => onModeChange("compact")}
          initial={{ opacity: 0, x: 10, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 14, y: -14 }}
          transition={FLOAT_OVERLAY_TRANSITION}
          data-transition-role="float-fade"
          data-testid="floating-overlay-surface"
          className="overlay-shared-surface overlay-breathing-surface relative flex size-20 items-center justify-center rounded-full border border-border bg-popover shadow-2xl transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ borderRadius: OVERLAY_RADIUS.floating }}
        >
          <motion.div
            className="size-14"
            data-testid="floating-overlay-avatar"
            data-shared-element="overlay-avatar"
            data-transition-role="avatar-fade"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={OVERLAY_AVATAR_TRANSITION}
          >
            {dynamicAssistantAvatar}
          </motion.div>
          {pendingUserMessageCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {pendingUserMessageCount > 9 ? "9+" : pendingUserMessageCount}
            </span>
          )}
        </motion.button>
      </div>
    );
  }

  // Compact mode - WritingMode not shown (too small), user should expand first
  if (mode === "compact") {
    return (
      <motion.div
        layoutId="viben-overlay-surface"
        transition={OVERLAY_TRANSITION}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        data-shared-surface="overlay"
        data-transition-role="panel-fade"
        onMouseLeave={() => {
          if (!hasCompactDraft) onModeChange("floating");
        }}
        className={`overlay-shared-surface flex ${OVERLAY_PANEL_WIDTH_CLASS} flex-col gap-2 rounded-3xl ${
          contained ? "z-20" : "fixed bottom-5 left-5 z-50"
        }`}
        style={{ borderRadius: OVERLAY_RADIUS.compact }}
        data-testid="compact-overlay"
      >
        <AgentPopup
          avatar={dynamicAssistantAvatar}
          title={title}
          summary={compactActivitySummary}
          showMinimize={hasCompactDraft}
          onExpand={() => onModeChange("expanded")}
          onMinimize={() => onModeChange("floating")}
        />
        <section
          data-testid="compact-chat-input"
          data-variant="compact"
          className={`overlay-input-shell overflow-hidden rounded-xl border border-border bg-background shadow-2xl ${isStreaming ? "overlay-input-shell--running" : ""}`}
        >
          <ChatAppPendingInputContent
            inputProps={compactInputProps}
            pendingPlan={pendingPlan}
            pendingApproval={pendingApproval}
            pendingQuestion={pendingQuestion}
            onApprovePlan={onApprovePlan}
            onRejectPlan={onRejectPlan}
            onApprovalDecision={onApprovalDecision}
            onAnswerQuestions={onAnswerQuestions}
          />
        </section>
      </motion.div>
    );
  }

  // expanded mode (default)
  // Use dynamic size from useResizablePanel when resize is enabled
  const expandedStyle: React.CSSProperties = enableExpandedResize
    ? {
        width: expandedWidth,
        height: expandedHeight,
        borderRadius: OVERLAY_RADIUS.expanded,
      }
    : { borderRadius: OVERLAY_RADIUS.expanded };

  // Class names for expanded mode - use fixed classes when resize is disabled
  const expandedClassName = enableExpandedResize
    ? `overlay-shared-surface pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ${
        contained ? "z-20" : "fixed bottom-5 left-5 z-50"
      }`
    : `overlay-shared-surface pointer-events-auto flex min-h-0 ${EXPANDED_PANEL_HEIGHT_CLASS} ${OVERLAY_PANEL_WIDTH_CLASS} flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ${
        contained ? "z-20" : "fixed bottom-5 left-5 z-50"
      }`;

  return (
    <motion.div
      layoutId="viben-overlay-surface"
      transition={OVERLAY_TRANSITION}
      initial={false}
      data-transition-role="expand-to-full"
      className={expandedClassName}
      style={expandedStyle}
      data-testid="expanded-overlay"
    >
      {expandedContent}
      {subagentSheetNode}
      {surfaceOverlay}
      {writingModeNode}
      {/* Resize handles for expanded mode */}
      {enableExpandedResize && (
        <ResizeHandles
          onResizeStart={handleResizeStartWrapper}
          isResizing={isResizing}
        />
      )}
    </motion.div>
  );
}

export function ChatAppFullscreenPanel({
  messageContent,
  statusContent,
  inputContent,
}: ChatAppFullscreenPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        layoutId="viben-overlay-message-panel"
        transition={INTERNAL_LAYOUT_TRANSITION}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        data-shared-element="overlay-message-panel"
        data-testid="fullscreen-message-panel"
      >
        {messageContent}
        {statusContent}
      </motion.div>
      {inputContent}
    </div>
  );
}

export function ChatAppFullscreenMessagePanel({
  messages,
  messageUpdates,
  isStreaming = false,
  streamingText,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  messageListRef,
  assistantAvatar,
  artifacts,
  welcomeTitle,
  welcomeDescription,
  maxMessageWidth = "760px",
  onExpandSubagent,
  onInspectTool,
  onArtifactClick,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
}: ChatAppFullscreenMessagePanelProps) {
  const { t } = useTranslation();

  return (
    <ChatAppMessagePanel
      messageListRef={messageListRef}
      messages={messages}
      messageUpdates={messageUpdates}
      isStreaming={isStreaming}
      streamingText={streamingText}
      pendingPlan={pendingPlan}
      pendingApproval={pendingApproval}
      pendingQuestion={pendingQuestion}
      assistantAvatar={assistantAvatar}
      artifacts={artifacts}
      welcomeTitle={welcomeTitle ?? t("chat_app.fullscreen.welcome_title", "@viben/chat Session Player")}
      welcomeDescription={welcomeDescription ?? t("chat_app.fullscreen.welcome_description", "Press Play to replay the demo session, or load a .jsonl file.")}
      maxMessageWidth={maxMessageWidth}
      onExpandSubagent={onExpandSubagent}
      onInspectTool={onInspectTool}
      onArtifactClick={onArtifactClick}
      onApprovePlan={onApprovePlan}
      onRejectPlan={onRejectPlan}
      onApprovalDecision={onApprovalDecision}
      onAnswerQuestions={onAnswerQuestions}
    />
  );
}

export function ChatAppFullscreenCommandQueue({
  commandQueueItems = [],
  onCommandQueueRemove,
  onCommandQueueClear,
  hideItemRemove,
  onCommandQueueRecall,
}: ChatAppFullscreenCommandQueueProps) {
  const { t } = useTranslation();
  const noop = React.useCallback(() => {}, []);
  const noopRemove = React.useCallback((_id: string) => {}, []);

  if (commandQueueItems.length === 0) return null;

  return (
    <div className="w-full px-4 pb-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <div className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        <span>{t("chat_app.queue.will_send_when_finished", "Will send when agent finishes...")}</span>
      </div>
      <CommandQueuePanel
        items={commandQueueItems}
        onRemove={onCommandQueueRemove ?? noopRemove}
        onClear={onCommandQueueClear ?? noop}
        hideItemRemove={hideItemRemove}
        onRecall={onCommandQueueRecall}
      />
    </div>
  );
}

export function ChatAppFullscreenInputPanel({
  inputProps,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
}: ChatAppFullscreenInputPanelProps) {
  return (
    <motion.div
      layoutId="viben-overlay-input-panel"
      transition={INTERNAL_LAYOUT_TRANSITION}
      className="w-full border-t border-border"
      data-shared-element="overlay-input-panel"
      data-testid="fullscreen-chat-input-shell"
    >
      <div className="w-full" data-testid="fullscreen-chat-input-container">
        <ChatAppPendingInputContent
          inputProps={inputProps}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={onApprovePlan}
          onRejectPlan={onRejectPlan}
          onApprovalDecision={onApprovalDecision}
          onAnswerQuestions={onAnswerQuestions}
        />
      </div>
    </motion.div>
  );
}

function ChatAppPendingInputContent({
  inputProps,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
}: {
  inputProps: ChatInputProps;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      {pendingPlan ? (
        <PlanApproval
          key="plan"
          plan={pendingPlan}
          isPending
          onApprove={onApprovePlan}
          onReject={onRejectPlan}
        />
      ) : pendingApproval ? (
        <ExecApproval
          key="approval"
          approval={pendingApproval}
          onDecision={(decision, feedback) => onApprovalDecision?.(decision, feedback)}
          enableKeyboard
        />
      ) : pendingQuestion ? (
        <QuestionInput
          key="question"
          questions={pendingQuestion}
          onSubmit={(answers) => onAnswerQuestions?.(answers)}
        />
      ) : (
        <motion.div
          key="input"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          <ChatInput {...inputProps} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentPopup({
  avatar,
  title,
  summary,
  showMinimize,
  onExpand,
  onMinimize,
}: {
  avatar: React.ReactNode;
  title: string;
  summary: React.ReactNode;
  showMinimize: boolean;
  onExpand: () => void;
  onMinimize: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.section
      data-testid="agent-popup"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      onClick={onExpand}
    >
      <div className="flex items-start gap-3 p-3">
        <motion.div
          className="size-14 shrink-0"
          data-testid="agent-popup-avatar"
          data-shared-element="overlay-avatar"
          data-transition-role="avatar-fade"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={OVERLAY_AVATAR_TRANSITION}
        >
          {avatar}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground" data-testid="agent-popup-title">
                {title}
              </span>
            </div>
            {showMinimize && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={t("chat_app.overlay.minimize", "Minimize chat")}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMinimize();
                  }}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Minimize2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          <div
            className="mt-2 overflow-hidden truncate whitespace-nowrap text-sm leading-6 text-foreground/85"
            data-testid="agent-popup-summary"
          >
            {summary}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ChatAppMessagePanel({
  messages,
  messageUpdates,
  isStreaming,
  streamingText,
  pendingPlan,
  pendingApproval,
  pendingQuestion,
  messageListRef,
  assistantAvatar,
  artifacts,
  welcomeTitle,
  welcomeDescription,
  maxMessageWidth = "760px",
  onExpandSubagent,
  onInspectTool,
  onArtifactClick,
  onApprovePlan,
  onRejectPlan,
  onApprovalDecision,
  onAnswerQuestions,
}: {
  messages: AgentMessage[];
  messageUpdates?: Record<string, Partial<AgentMessage>>;
  isStreaming: boolean;
  streamingText?: string | null;
  pendingPlan?: TaskPlan | null;
  pendingApproval?: PendingExecApproval | null;
  pendingQuestion?: PendingQuestion | null;
  messageListRef?: React.ComponentPropsWithRef<typeof MessageList>["ref"];
  assistantAvatar?: React.ReactNode;
  artifacts?: Artifact[];
  welcomeTitle?: string;
  welcomeDescription?: string;
  maxMessageWidth?: string;
  onExpandSubagent?: ExpandSubagentHandler;
  onInspectTool?: InspectToolHandler;
  onArtifactClick?: (artifactId: string) => void;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
}) {
  const { t } = useTranslation();

  return (
    <MessageList
      ref={messageListRef}
      messages={messages}
      messageUpdates={messageUpdates}
      isStreaming={isStreaming}
      streamingText={streamingText}
      assistantAvatar={assistantAvatar}
      artifacts={artifacts}
      pendingPlan={pendingPlan}
      pendingApproval={pendingApproval}
      pendingQuestions={pendingQuestion}
      welcomeTitle={welcomeTitle ?? t("chat_app.fullscreen.welcome_title", "@viben/chat Session Player")}
      welcomeDescription={welcomeDescription ?? t("chat_app.fullscreen.welcome_description", "Press Play to replay the demo session, or load a .jsonl file.")}
      maxMessageWidth={maxMessageWidth}
      onExpandSubagent={onExpandSubagent}
      onInspectTool={onInspectTool}
      onArtifactClick={onArtifactClick}
      onApprovePlan={onApprovePlan}
      onRejectPlan={onRejectPlan}
      onApprovalDecision={onApprovalDecision}
      onAnswerQuestions={onAnswerQuestions}
    />
  );
}

export function ExpandedHeader({
  leftContent,
  centerContent,
  rightContent,
}: ExpandedHeaderProps) {
  return (
    <header
      data-testid="expanded-header"
      className="relative flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-3"
    >
      <div className="flex shrink-0 items-center gap-1.5" data-testid="expanded-header-left">
        {leftContent}
      </div>
      <div className="flex min-w-0 flex-1 items-center" data-testid="expanded-header-center">
        {centerContent}
      </div>
      <div className="flex shrink-0 items-center gap-1.5" data-testid="expanded-header-right">
        {rightContent}
      </div>
    </header>
  );
}

export function ExpandedHeaderModeControls({
  mode,
  onModeChange,
  moreMenuContent,
}: ExpandedHeaderModeControlsProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t("chat_app.header.switch_compact", "Switch to compact mode")}
        onClick={() => onModeChange("compact")}
        data-testid="compact-mode-button"
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Minimize2 className="size-4" />
      </button>

      {mode !== "full" && (
        <button
          type="button"
          aria-label={t("chat_app.header.switch_fullscreen", "Switch to fullscreen mode")}
          onClick={() => onModeChange("full")}
          data-testid="full-mode-button"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="size-4" />
        </button>
      )}

      <div className="relative" data-testid="more-actions-menu">
        <button
          type="button"
          aria-label={t("chat_app.header.more_actions", "More actions")}
          onClick={() => setMoreOpen((open) => !open)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {moreOpen && (
          <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
            {moreMenuContent}
          </div>
        )}
      </div>
    </>
  );
}
