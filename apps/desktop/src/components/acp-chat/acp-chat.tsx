/**
 * AcpChat - Main ACP Chat component for desktop application
 *
 * This component wraps ChatApp and provides ACP WebSocket client integration
 * for communicating with the Viben Gateway's ACP endpoint.
 */

// ReactNode is used in callback render prop types
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ChevronDown,
  EthernetPort,
  ExternalLink,
  FolderPlus,
  FolderTree,
  GripVertical,
  ListTodo,
  Loader2,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  Plug,
  Plus,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { platform } from "@tauri-apps/plugin-os";
import {
  buildBackgroundTasksFromMessages,
  buildTodoListItemsFromMessages,
  BackgroundTaskList,
  ChatApp,
  ChatAppFullscreenCommandQueue,
  ChatAppFullscreenInputPanel,
  ChatAppFullscreenMessagePanel,
  ChatAppFullscreenPanel,
  ChatInputBottomToolbar,
  ChatInputTopToolbar,
  ExpandedHeaderModeControls,
  TodoListPanel,
  TripleSelector,
} from "@viben/chat";
import type {
  BackgroundTaskItem,
  BackgroundTasksSummary,
  ChatAppMode,
  ChatInputProps,
  MessageAttachment,
  QueuedInputRecallItem,
  SelectorOption,
  SlashCommand,
  SlashCommandSelection,
  TasksSummary,
  TripleSelectorValue,
  DisplayLabelFormatParams,
} from "@viben/chat";
import { PetSprite } from "@viben/pet";
import { cn, Popover, PopoverContent, PopoverTrigger, Switch, Label } from "@viben/ui";
import { usePet } from "@/hooks";
import { openAndReadFiles } from "@/lib/tauri-file-attach";
import { EmojiTab } from "@/components/ui/icon-picker/tabs/emoji-tab";
import { ScreenshotDropdown } from "@/components/chat/screenshot-dropdown";
import { useScreenshot } from "@/hooks/use-screenshot";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { useAcpSession } from "./use-acp-session";
import { useChatDrag } from "@/hooks/use-chat-drag";
import { ChatDragProvider } from "@/contexts/chat-drag-context";
import type { SnapPosition } from "@/stores/chat-position-store";
import { DraggableExpandedHeader } from "./draggable-expanded-header";
import { ChatWindowControls } from "./chat-window-controls";

const DEFAULT_MODEL = "claude-sonnet-4-6";
/** 浮动模式下的边距 */
const FLOATING_MARGIN = 20;

/** 吸附动画配置 */
const SNAP_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
};

/** Full 模式下的默认宽度配置 */
const FULL_MODE_DEFAULT_WIDTH = 420;
const FULL_MODE_MIN_WIDTH = 320;
const FULL_MODE_MAX_WIDTH = 800;
const FULL_MODE_STORAGE_KEY = "viben_acp_chat_full_width";

/** 根据吸附位置获取动画的初始/目标位置 */
function getPositionConfig(position: SnapPosition, margin: number) {
  switch (position) {
    case "bottom-left":
      return { bottom: margin, left: margin, top: "auto", right: "auto" };
    case "bottom-right":
      return { bottom: margin, right: margin, top: "auto", left: "auto" };
    case "top-left":
      return { top: margin, left: margin, bottom: "auto", right: "auto" };
    case "top-right":
      return { top: margin, right: margin, bottom: "auto", left: "auto" };
    default:
      return { bottom: margin, left: margin, top: "auto", right: "auto" };
  }
}

export interface AcpChatProps {
  mode: ChatAppMode;
  onModeChange: (mode: ChatAppMode) => void;
  contained?: boolean;
  className?: string;
  /** WebSocket URL for ACP connection */
  wsUrl?: string;
  /** Default working directory */
  defaultCwd?: string;
  /** When true, renders window controls in header (for standalone window mode) */
  windowMode?: boolean;
  /** Enable resize handle for full mode (default: false) */
  enableFullResize?: boolean;
}

async function openChatWindow() {
  try {
    const chatWindow = await WebviewWindow.getByLabel("chat-window");
    if (chatWindow) {
      await chatWindow.show();
      await chatWindow.setFocus();
    }
  } catch (err) {
    console.error("[AcpChat] Failed to open chat window:", err);
  }
}

interface MenuActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function MenuActionButton({ children, onClick, disabled, icon }: MenuActionButtonProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

interface AcpHeaderSessionMenuProps {
  title: string;
  sessions: Array<{ id: string; title: string; subtitle?: string }>;
  onSelectSession: (id: string) => void;
}

function AcpHeaderSessionMenu({ title, sessions, onSelectSession }: AcpHeaderSessionMenuProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        className="flex h-8 max-w-44 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        <span className="truncate">{title}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </button>
      <div className="absolute left-0 top-10 z-30 hidden w-72 rounded-lg border border-border bg-popover p-1.5 shadow-xl group-focus-within:block group-hover:block">
        {sessions.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">No sessions</div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="flex w-full min-w-0 flex-col rounded-md px-2 py-2 text-left hover:bg-accent"
              onClick={() => onSelectSession(session.id)}
            >
              <span className="truncate text-sm font-medium text-foreground">{session.title}</span>
              <span className="truncate text-[11px] text-muted-foreground">{session.subtitle ?? session.id}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface AcpHeaderNewSessionMenuProps {
  onCreateSession: () => void;
  onSelectAgent: (agentId: string) => void;
  agentOptions: SelectorOption[];
}

function AcpHeaderNewSessionMenu({ onCreateSession, onSelectAgent, agentOptions }: AcpHeaderNewSessionMenuProps) {
  return (
    <div className="relative group flex h-8 shrink-0 overflow-hidden rounded-md border border-border bg-background">
      <button
        type="button"
        className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onCreateSession}
        aria-label="Create session"
      >
        <Plus className="size-4" />
      </button>
      <div className="h-full border-l border-border" />
      <button
        type="button"
        className="flex w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Open session menu"
      >
        <ChevronDown className="size-4" />
      </button>
      <div className="absolute left-0 top-10 z-30 hidden w-64 rounded-lg border border-border bg-popover p-1.5 shadow-xl group-focus-within:block group-hover:block">
        <MenuActionButton onClick={onCreateSession} icon={<FolderPlus size={14} />}>
          New session
        </MenuActionButton>
        {agentOptions.length > 0 && (
          <>
            <div className="my-1 border-t border-border" />
            {agentOptions.map((agent) => (
              <MenuActionButton key={agent.id} onClick={() => onSelectAgent(agent.id)}>
                {agent.label}
                {agent.badge && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{agent.badge}</span>
                )}
              </MenuActionButton>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;
}

function buildAcpCompactSummary(
  messages: Array<{ type?: string; content?: string; message?: string; name?: string }>,
  streamingText: string | null | undefined,
  isAgentRunning: boolean,
  queuedCount: number
): React.ReactNode {
  if (queuedCount > 0) {
    return `${queuedCount} queued prompt${queuedCount === 1 ? "" : "s"}`;
  }
  if (streamingText?.trim()) {
    return truncateText(streamingText.trim(), 120);
  }
  const latest = [...messages]
    .reverse()
    .find((message) => message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error");
  if (!latest) return "Ready when you are.";
  if (latest.type === "tool_use") {
    return isAgentRunning ? `Running ${latest.name ?? "tool"}...` : `Tool ${latest.name ?? "call"}`;
  }
  if (latest.type === "error") return truncateText(latest.message ?? latest.content ?? "Something needs attention.", 120);
  return truncateText(latest.content ?? latest.message ?? "Working...", 120);
}

function buildModelOptions(currentModel: string) {
  const models = [currentModel, DEFAULT_MODEL, "claude-opus-4-5", "claude-haiku-4-5"].filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  return Array.from(new Set(models)).map((id) => ({
    id,
    name: id,
    provider: id.includes("claude") ? "Anthropic" : undefined,
  }));
}

export function AcpChat({ mode, onModeChange, contained = false, className, wsUrl, defaultCwd, enableFullResize = false, windowMode = false }: AcpChatProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Platform detection for macOS traffic light spacing
  const [isMacOS, setIsMacOS] = useState(false);
  useEffect(() => {
    if (!windowMode) return;
    try {
      const platformName = platform();
      setIsMacOS(platformName === "macos");
    } catch {
      // Fallback: assume not macOS
      setIsMacOS(false);
    }
  }, [windowMode]);

  // Full mode resize state (external handle, width only)
  const [fullWidth, setFullWidth] = useState(FULL_MODE_DEFAULT_WIDTH);
  const [isFullResizing, setIsFullResizing] = useState(false);
  const fullResizeRef = useRef({
    isDragging: false,
    startX: 0,
    startWidth: FULL_MODE_DEFAULT_WIDTH,
    latestWidth: FULL_MODE_DEFAULT_WIDTH,
  });

  // Load saved width from localStorage on mount
  useEffect(() => {
    if (!enableFullResize) return;
    try {
      const saved = localStorage.getItem(FULL_MODE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.width === "number") {
          const savedWidth = Math.min(Math.max(parsed.width, FULL_MODE_MIN_WIDTH), FULL_MODE_MAX_WIDTH);
          setFullWidth(savedWidth);
          fullResizeRef.current.latestWidth = savedWidth;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [enableFullResize]);

  // Full mode resize handlers
  const handleFullResizeStart = useCallback((e: React.MouseEvent) => {
    if (!enableFullResize) return;
    e.preventDefault();
    e.stopPropagation();

    fullResizeRef.current = {
      isDragging: true,
      startX: e.clientX,
      startWidth: fullWidth,
      latestWidth: fullWidth,
    };
    setIsFullResizing(true);

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!fullResizeRef.current.isDragging) return;

      const deltaX = moveEvent.clientX - fullResizeRef.current.startX;
      const newWidth = Math.min(
        Math.max(fullResizeRef.current.startWidth + deltaX, FULL_MODE_MIN_WIDTH),
        FULL_MODE_MAX_WIDTH
      );
      fullResizeRef.current.latestWidth = newWidth;
      setFullWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (fullResizeRef.current.isDragging) {
        fullResizeRef.current.isDragging = false;
        setIsFullResizing(false);

        // Save to localStorage using the latest width from ref
        try {
          localStorage.setItem(FULL_MODE_STORAGE_KEY, JSON.stringify({ width: fullResizeRef.current.latestWidth }));
        } catch {
          // Ignore localStorage errors
        }
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [enableFullResize, fullWidth]);

  // Draggable chat support for floating modes
  const isFloatingMode = mode === "floating" || mode === "compact" || mode === "expanded";
  const {
    position: snapPosition,
    isDragging,
    dragPosition,
    dragHandlers,
  } = useChatDrag({
    containerRef,
    margin: FLOATING_MARGIN,
    elementSize: { width: 440, height: 560 },
  });

  // Context value for drag handlers (allows child components like DraggableExpandedHeader to use drag)
  const dragContextValue = useMemo(
    () => ({
      dragHandlers: isFloatingMode ? dragHandlers : null,
      isDragging,
      enabled: isFloatingMode,
    }),
    [isFloatingMode, dragHandlers, isDragging]
  );
  const acp = useAcpSession({
    wsUrl,
    defaultCwd,
  });

  const {
    connected,
    busy,
    error,
    activeSessionId,
    sessions,
    messages,
    streamingText,
    messageUpdates,
    pendingPlan,
    pendingApproval,
    pendingQuestion,
    slashCommands,
    artifacts,
    steerQueueItems,
    isTurnActive,
    isAgentRunning,
    executorType,
    model,
    // Agent/Provider/Model config (from integrated useAcpChatConfig)
    agentOptions,
    providerOptions,
    modelOptions,
    selectedAgentId,
    selectedProviderId,
    configLoading,
    configError,
    // Actions
    connect,
    createSession,
    selectSession,
    sendPrompt,
    sendSteerPrompt,
    interrupt,
    handleSlashCommand,
    handleApprovalDecision,
    handleQuestionAnswers,
    handleApprovePlan,
    handleRejectPlan,
    removeSteerQueueItem,
    clearSteerQueue,
    recallSteerQueue,
    setExecutorType,
    setModel,
    setSelectedAgentId,
    setSelectedProviderId,
    subagentSheet,
    liveSubagentMessages,
    handleExpandSubagent,
    closeSubagentSheet,
  } = acp;

  const sessionId = activeSessionId;
  const activeTitle = sessions.find((session) => session.id === sessionId)?.title ?? "ACP Chat";

  // Attachments state
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);

  // Settings state
  const [worktree, setWorktree] = useState(false);
  const [backgroundTask, setBackgroundTask] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sandbox config from store
  const { sandboxConfig, setSandboxEnabled } = useChatConfigStore();

  // Combine session error with config error for display
  const displayError = error || configError;

  // Screenshot hook
  const {
    takeScreenshot,
    startRegionScreenshot,
    listMonitors,
    listWindows,
    takeWindowScreenshot,
    isCapturing: isScreenshotCapturing,
  } = useScreenshot({
    onSuccess: (attachment) => {
      setAttachments((prev) => [...prev, attachment]);
    },
    onError: (error) => {
      console.error("[AcpChat] Screenshot failed:", error);
    },
  });

  // Voice agent hook
  const voice = useVoiceAgent();

  // Handle emoji insertion (ChatInputTopToolbar manages its own popover state)
  const handleEmojiInsert = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const currentValue = ta.value;
      const newContent = currentValue.slice(0, start) + emoji + currentValue.slice(end);
      // Trigger change event for ChatInput
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(ta, newContent);
        const event = new Event("input", { bubbles: true });
        ta.dispatchEvent(event);
      }
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    }
  }, []);

  // Handle file attachment
  const handleAttachFile = useCallback(async () => {
    const result = await openAndReadFiles();
    if (result) {
      setAttachments((prev) => [...prev, ...result]);
    }
  }, []);

  const { pet } = usePet();

  const staticAssistantAvatar = useMemo(() => {
    if (pet) {
      if (mode === "floating") {
        return (
          <div className="flex size-full items-center justify-center overflow-hidden">
            <PetSprite pet={pet} rowId="idle" size={56} />
          </div>
        );
      }
      return (
        <div className="flex size-full items-center justify-center overflow-hidden rounded-full">
          <PetSprite pet={pet} rowId="idle" size={36} />
        </div>
      );
    }
    return (
      <div className="flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground">
        <EthernetPort size={mode === "floating" ? 28 : 18} />
      </div>
    );
  }, [mode, pet]);

  const dynamicAssistantAvatar = useMemo(() => {
    if (pet) {
      if (mode === "floating") {
        return (
          <div className="flex size-full items-center justify-center overflow-hidden">
            <PetSprite pet={pet} rowId="waving" size={56} />
          </div>
        );
      }
      return (
        <div className="flex size-full items-center justify-center overflow-hidden rounded-full">
          <PetSprite pet={pet} rowId="waving" size={36} />
        </div>
      );
    }
    return (
      <div className="flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground">
        <EthernetPort size={mode === "floating" ? 28 : 18} />
      </div>
    );
  }, [mode, pet]);

  // Track input value locally for submit control
  const inputValue = "";

  const handleSend = useCallback(
    (content: string, _messageAttachments?: MessageAttachment[]) => {
      // TODO: ACP session doesn't support attachments yet
      // When supported, merge: [...attachments, ...(messageAttachments ?? [])]
      // Clear attachments after sending
      setAttachments([]);

      if (isTurnActive) {
        void sendSteerPrompt(content);
        return;
      }
      void sendPrompt(content);
    },
    [isTurnActive, sendPrompt, sendSteerPrompt]
  );

  const handleSlashCommandSelect = useCallback(
    (command: SlashCommand, selection: SlashCommandSelection) => {
      if (isTurnActive) {
        const args = selection.args.trim();
        void sendSteerPrompt(`/${command.name}${args ? ` ${args}` : ""}`);
        return;
      }
      handleSlashCommand(command, selection);
    },
    [handleSlashCommand, isTurnActive, sendSteerPrompt]
  );

  const handleRecallQueue = useCallback(
    (items: QueuedInputRecallItem[], _value: string) => {
      void recallSteerQueue(items);
    },
    [recallSteerQueue]
  );

  // TripleSelector options
  // 1. Agent 选项 (从 API 获取，包含工作空间和全局 agents)
  // agentOptions 来自 useAcpSession hook

  // 2. Provider 选项 (从 API 获取，已根据 executor 约束过滤)
  // providerOptions 来自 useAcpSession hook

  // 3. Model 选项 (从 API 获取，已根据 executor 和 provider 过滤)
  // 如果 API 没有返回数据，使用本地 fallback
  const modelSelectorOptions = useMemo<SelectorOption[]>(() => {
    if (modelOptions.length > 0) {
      return modelOptions;
    }
    // Fallback: 使用静态模型列表
    const fallbackModels = buildModelOptions(model);
    return fallbackModels.map((m) => ({
      id: m.id,
      label: m.name,
    }));
  }, [modelOptions, model]);

  // TripleSelector 当前值
  const tripleSelectorValue = useMemo<TripleSelectorValue>(
    () => ({
      first: selectedAgentId ?? executorType,
      second: selectedProviderId,
      third: model,
    }),
    [selectedAgentId, executorType, selectedProviderId, model]
  );

  // TripleSelector 变更处理
  const handleTripleSelectorChange = useCallback(
    (value: TripleSelectorValue) => {
      // 1. Agent 变更 (also updates executorType via setSelectedAgentId)
      if (value.first && value.first !== (selectedAgentId ?? executorType)) {
        // Check if it's an agent ID or raw executor type
        const isAgentId = agentOptions.some((a) => a.id === value.first);
        if (isAgentId) {
          setSelectedAgentId(value.first);
        } else {
          setExecutorType(value.first);
        }
      }
      // 2. Provider 变更
      if (value.second !== selectedProviderId) {
        setSelectedProviderId(value.second);
      }
      // 3. Model 变更
      if (value.third && value.third !== model) {
        setModel(value.third);
      }
    },
    [selectedAgentId, executorType, selectedProviderId, model, agentOptions, setSelectedAgentId, setExecutorType, setSelectedProviderId, setModel]
  );

  const formatDisplayLabel = useCallback(
    ({ first, third }: DisplayLabelFormatParams): string => {
      if (!first && !third) return "";
      if (!first) return third?.label ?? "";
      if (!third) return first?.label ?? "";
      return `${first.label} / ${third.label}`; // Display 'agent / model' together
    },
    []
  );

  const tripleSelectorNode = (
    <TripleSelector
      compact
      firstOptions={agentOptions}
      firstLabel={t("chat.agent", "Agent")}
      firstPlaceholder={t("chat.selectAgent", "Select agent...")}
      secondOptions={providerOptions}
      secondLabel={t("chat.provider", "Provider")}
      secondPlaceholder={t("chat.selectProvider", "Select provider...")}
      thirdOptions={modelSelectorOptions}
      thirdLabel={t("chat.model", "Model")}
      thirdPlaceholder={t("chat.selectModel", "Select model...")}
      value={tripleSelectorValue}
      onChange={handleTripleSelectorChange}
      formatDisplayLabel={formatDisplayLabel}
      isLoading={configLoading}
    />
  );

  // Build todo items and background tasks from messages
  const todoItems = useMemo(() => buildTodoListItemsFromMessages(messages, messageUpdates), [messages, messageUpdates]);

  const backgroundTasks = useMemo(
    () => buildBackgroundTasksFromMessages(messages).map(({ now: _now, ...task }) => task),
    [messages]
  );

  const tasksSummary: TasksSummary | undefined = useMemo(() => {
    if (todoItems.length === 0) return undefined;
    const completedCount = todoItems.filter((item) => item.status === "completed").length;
    return {
      items: todoItems,
      completedCount,
      totalCount: todoItems.length,
    };
  }, [todoItems]);

  const backgroundTasksSummary: BackgroundTasksSummary | undefined = useMemo(() => {
    if (backgroundTasks.length === 0) return undefined;
    const runningCount = backgroundTasks.filter((task) => task.status === "running").length;
    return {
      items: backgroundTasks,
      runningCount,
      totalCount: backgroundTasks.length,
    };
  }, [backgroundTasks]);

  const handleBackgroundTaskClick = useCallback(
    (task: BackgroundTaskItem) => {
      handleExpandSubagent(task.description, task.kind, task.messages ?? [], {
        subagentId: task.sourceMessage?.subagentId,
        toolUseId: task.sourceMessage?.toolUseId ?? task.id,
        parentMessage: task.sourceMessage,
        messages: task.messages,
      });
    },
    [handleExpandSubagent]
  );

  const renderTasksPopup = useCallback(
    () => (
      <div className="rounded-lg border border-border bg-popover shadow-xl">
        <TodoListPanel items={todoItems} defaultExpanded />
      </div>
    ),
    [todoItems]
  );

  const renderBackgroundTasksPopup = useCallback(
    () => (
      <div className="rounded-lg border border-border bg-popover shadow-xl">
        <BackgroundTaskList tasks={backgroundTasks} onTaskClick={handleBackgroundTaskClick} defaultExpanded />
      </div>
    ),
    [backgroundTasks, handleBackgroundTaskClick]
  );

  // Render emoji picker for top toolbar
  const renderEmojiPicker = useCallback(
    (props: { onSelect: (emoji: string) => void }) => (
      <EmojiTab onSelect={props.onSelect} />
    ),
    []
  );

  // Screenshot dropdown for top toolbar extraActions
  const screenshotDropdownNode = useMemo(
    () => (
      <ScreenshotDropdown
        takeScreenshot={takeScreenshot}
        startRegionScreenshot={startRegionScreenshot}
        listMonitors={listMonitors}
        listWindows={listWindows}
        takeWindowScreenshot={takeWindowScreenshot}
        isCapturing={isScreenshotCapturing}
        contentClassName="z-[10001]"
      />
    ),
    [takeScreenshot, startRegionScreenshot, listMonitors, listWindows, takeWindowScreenshot, isScreenshotCapturing]
  );

  const topToolbar = useMemo(
    () => (
      <ChatInputTopToolbar
        onEmojiSelect={handleEmojiInsert}
        renderEmojiPicker={renderEmojiPicker}
        onFileClick={handleAttachFile}
        isLoading={isTurnActive}
        disabled={false}
        tasksSummary={tasksSummary}
        backgroundTasksSummary={backgroundTasksSummary}
        renderTasksPopup={renderTasksPopup}
        renderBackgroundTasksPopup={renderBackgroundTasksPopup}
        extraActions={screenshotDropdownNode}
      />
    ),
    [
      backgroundTasksSummary,
      handleAttachFile,
      handleEmojiInsert,
      isTurnActive,
      renderBackgroundTasksPopup,
      renderEmojiPicker,
      renderTasksPopup,
      screenshotDropdownNode,
      tasksSummary,
    ]
  );

  // Settings popover node
  const settingsPopoverNode = useMemo(
    () => (
      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-full",
              "bg-muted/50 hover:bg-muted/80 transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-3 z-[10001]" side="top" align="center">
          <div className="space-y-3">
            {/* Sandbox toggle */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="acp-sandbox"
                className={cn(
                  "text-xs font-medium cursor-pointer transition-colors",
                  sandboxConfig.enabled ? "text-amber-500" : "text-muted-foreground"
                )}
              >
                {t("chat.sandbox")}
              </Label>
              <Switch
                id="acp-sandbox"
                checked={sandboxConfig.enabled}
                onCheckedChange={setSandboxEnabled}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
            {/* Worktree toggle */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="acp-worktree"
                className={cn(
                  "text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors",
                  worktree ? "text-blue-500" : "text-muted-foreground"
                )}
              >
                <FolderTree className="h-4 w-4" />
                {t("chat.worktree")}
              </Label>
              <Switch
                id="acp-worktree"
                checked={worktree}
                onCheckedChange={setWorktree}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            {/* Background task toggle */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="acp-background-task"
                className={cn(
                  "text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors",
                  backgroundTask ? "text-green-500" : "text-muted-foreground"
                )}
              >
                <ListTodo className="h-4 w-4" />
                {t("chat.backgroundTask.title")}
              </Label>
              <Switch
                id="acp-background-task"
                checked={backgroundTask}
                onCheckedChange={setBackgroundTask}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    ),
    [backgroundTask, sandboxConfig.enabled, setSandboxEnabled, settingsOpen, t, worktree]
  );

  // Voice input button node
  const voiceInputNode = useMemo(
    () => (
      <button
        type="button"
        onClick={async () => {
          if (voice.isConnected) {
            await voice.disconnect();
          } else {
            await voice.connect();
          }
        }}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-full",
          "transition-colors",
          voice.isListening
            ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse"
            : voice.state === "connecting"
              ? "bg-amber-500/20 text-amber-500"
              : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
        )}
        title={
          voice.isListening
            ? t("chat.voiceListening")
            : voice.state === "connecting"
              ? t("chat.voiceConnecting")
              : t("chat.voiceInput")
        }
      >
        {voice.state === "connecting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : voice.isConnected ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
    ),
    [t, voice]
  );

  // Combined bottom toolbar left content
  const bottomToolbarLeftContent = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        {tripleSelectorNode}
        {settingsPopoverNode}
        <div className="flex-1" />
        {voiceInputNode}
      </div>
    ),
    [settingsPopoverNode, tripleSelectorNode, voiceInputNode]
  );

  const bottomToolbar = useMemo(
    () => (
      <ChatInputBottomToolbar
        leftContent={bottomToolbarLeftContent}
        onSend={() => handleSend(inputValue)}
        onCancel={interrupt}
        isLoading={isTurnActive}
        canSubmit={connected && !!sessionId && inputValue.trim().length > 0}
        allowSendWhileLoading
      />
    ),
    [bottomToolbarLeftContent, connected, handleSend, inputValue, interrupt, isTurnActive, sessionId]
  );

  const sharedInputProps = useMemo<Partial<ChatInputProps>>(
    () => ({
      onSend: handleSend,
      onCancel: interrupt,
      queuedInputRecallItems: steerQueueItems,
      onQueuedInputRecall: handleRecallQueue,
      isLoading: isTurnActive,
      allowSendWhileLoading: true,
      sendDisabled: !connected || !sessionId,
      sendBlockedReason: !connected
        ? "Connect first to send prompts."
        : !sessionId
          ? "Create or load a session before sending."
          : undefined,
      placeholder: isTurnActive ? "Type steering while the agent is running..." : "Type a message...",
      slashCommands,
      onSlashCommand: handleSlashCommandSelect,
      showTopToolbar: true,
      showBottomToolbar: true,
      topToolbar,
      bottomToolbar,
      showResizeHandle: true,
      defaultHeight: 132,
      minHeight: 96,
      maxHeight: 360,
      heightStorageKey: "viben_acp_chat_input_height",
      // Attachments
      attachments,
      onAttachmentsChange: setAttachments,
      // Platform-specific callbacks for file dialog
      onOpenFile: openAndReadFiles,
      // Expose textarea ref for emoji insertion
      textareaRef,
    }),
    [
      attachments,
      bottomToolbar,
      connected,
      handleRecallQueue,
      handleSend,
      handleSlashCommandSelect,
      interrupt,
      isTurnActive,
      sessionId,
      slashCommands,
      steerQueueItems,
      topToolbar,
    ]
  );

  const statusContent = (
    <ChatAppFullscreenCommandQueue
      commandQueueItems={steerQueueItems}
      onCommandQueueRemove={removeSteerQueueItem}
      onCommandQueueClear={clearSteerQueue}
      hideItemRemove
      onCommandQueueRecall={(items) => {
        const value = items.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
        handleRecallQueue(items, value);
      }}
    />
  );

  // Window mode header: platform-aware
  // - macOS: uses native traffic lights via titleBarStyle: "Overlay", reserve left space
  // - Windows/Linux: uses ChatWindowControls component on the right
  const windowModeHeader = (
    <DraggableExpandedHeader
      windowMode
      leftContent={
        isMacOS ? (
          // macOS: 为原生红绿灯按钮预留空间 (约 70px)
          <div className="w-[70px] shrink-0" />
        ) : (
          // Windows/Linux: 左侧放菜单
          <>
            <AcpHeaderNewSessionMenu onCreateSession={createSession} onSelectAgent={setSelectedAgentId} agentOptions={agentOptions} />
            <AcpHeaderSessionMenu title={activeTitle} sessions={sessions} onSelectSession={selectSession} />
          </>
        )
      }
      centerContent={null}
      rightContent={
        isMacOS ? (
          // macOS: 右侧放菜单
          <>
            <AcpHeaderNewSessionMenu onCreateSession={createSession} onSelectAgent={setSelectedAgentId} agentOptions={agentOptions} />
            <AcpHeaderSessionMenu title={activeTitle} sessions={sessions} onSelectSession={selectSession} />
          </>
        ) : (
          // Windows/Linux: 右侧放窗口控件
          <ChatWindowControls />
        )
      }
    />
  );

  // Standard header for floating/expanded modes in main window
  const standardHeader = (
    <DraggableExpandedHeader
      leftContent={
        <>
          <AcpHeaderSessionMenu title={activeTitle} sessions={sessions} onSelectSession={selectSession} />
          <AcpHeaderNewSessionMenu onCreateSession={createSession} onSelectAgent={setSelectedAgentId} agentOptions={agentOptions} />
        </>
      }
      centerContent={null}
      rightContent={
        <ExpandedHeaderModeControls
          mode={mode}
          onModeChange={onModeChange}
          moreMenuContent={
            <>
              <MenuActionButton onClick={() => onModeChange("compact")} icon={<Minimize2 size={14} />}>
                Compact mode
              </MenuActionButton>
              <MenuActionButton onClick={() => onModeChange("expanded")} icon={<MessageSquare size={14} />}>
                Expanded mode
              </MenuActionButton>
              <MenuActionButton onClick={() => onModeChange("full")} icon={<Maximize2 size={14} />}>
                Fullscreen mode
              </MenuActionButton>
              <MenuActionButton onClick={openChatWindow} icon={<ExternalLink size={14} />}>
                Open in new window
              </MenuActionButton>
              <div className="my-1 border-t border-border" />
              {!connected ? (
                <MenuActionButton
                  onClick={connect}
                  disabled={busy}
                  icon={busy ? <Loader2 className="animate-spin" size={14} /> : <Plug size={14} />}
                >
                  Connect
                </MenuActionButton>
              ) : null}
              {connected && !sessionId ? (
                <MenuActionButton onClick={createSession} icon={<FolderPlus size={14} />}>
                  New session
                </MenuActionButton>
              ) : null}
              <MenuActionButton
                onClick={() => {
                  const value = steerQueueItems.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
                  handleRecallQueue(steerQueueItems, value);
                }}
                disabled={steerQueueItems.length === 0 || !sessionId}
                icon={<RotateCcw size={14} />}
              >
                Recall queue
              </MenuActionButton>
            </>
          }
        />
      }
    />
  );

  const headerContent = windowMode ? windowModeHeader : standardHeader;

  const fullscreenContent = (
    <ChatAppFullscreenPanel
      messageContent={
        <ChatAppFullscreenMessagePanel
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isAgentRunning}
          streamingText={streamingText}
          assistantAvatar={staticAssistantAvatar}
          artifacts={artifacts}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onExpandSubagent={handleExpandSubagent}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleQuestionAnswers}
          welcomeTitle="ACP Chat"
          welcomeDescription="Connect, create or resume a session, then talk to an ACP backend."
        />
      }
      statusContent={statusContent}
      inputContent={
        <ChatAppFullscreenInputPanel
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleQuestionAnswers}
          inputProps={sharedInputProps as ChatInputProps}
        />
      }
    />
  );

  // Shared ChatApp props
  const chatAppProps = {
    mode,
    title: activeTitle,
    messages,
    messageUpdates,
    isStreaming: isAgentRunning,
    streamingText,
    pendingUserMessageCount: steerQueueItems.length,
    dynamicAssistantAvatar,
    staticAssistantAvatar,
    artifacts,
    compactSummaryContent: buildAcpCompactSummary(messages, streamingText, isAgentRunning, steerQueueItems.length),
    headerContent,
    inputProps: sharedInputProps,
    bottomToolbarLeftContent,
    statusContent,
    fullscreenContent,
    pendingPlan,
    pendingApproval,
    pendingQuestion,
    onApprovePlan: handleApprovePlan,
    onRejectPlan: handleRejectPlan,
    onApprovalDecision: handleApprovalDecision,
    onAnswerQuestions: handleQuestionAnswers,
    subagentSheet: subagentSheet
      ? {
          open: true,
          onClose: closeSubagentSheet,
          title: subagentSheet.title,
          subagentType: subagentSheet.subagentType,
          messages: subagentSheet.messages,
          liveMessages: liveSubagentMessages,
          context: subagentSheet.context,
        }
      : undefined,
    onExpandSubagent: handleExpandSubagent,
    onModeChange,
    onSend: handleSend,
    onCancel: interrupt,
    enableFullResize,
  };

  // Calculate position style based on drag state
  // 使用单一组件避免重新挂载，通过 style 切换位置
  const floatingStyle = useMemo(() => {
    if (isDragging && dragPosition) {
      // 拖拽中：使用固定的 left/top 坐标
      return {
        position: "absolute" as const,
        left: dragPosition.x,
        top: dragPosition.y,
        right: "auto",
        bottom: "auto",
      };
    }
    // 非拖拽：返回 undefined，让 animate 处理位置
    return undefined;
  }, [isDragging, dragPosition]);

  // 吸附位置配置（仅在非拖拽时使用）
  const positionConfig = getPositionConfig(snapPosition, FLOATING_MARGIN);

  // For standalone window mode: render full-screen, no floating wrapper
  // 添加圆角以配合 decorations: false 的无边框窗口
  if (windowMode) {
    return (
      <ChatDragProvider value={dragContextValue}>
        <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-background", className)}>
          {displayError && (
            <div className="absolute left-4 right-4 top-14 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
              {displayError}
            </div>
          )}
          <ChatApp contained {...chatAppProps} />
        </div>
      </ChatDragProvider>
    );
  }

  // For floating modes: render with draggable container and snap animation
  if (isFloatingMode) {
    return (
      <ChatDragProvider value={dragContextValue}>
        <div
          ref={containerRef}
          className={cn("absolute inset-0 pointer-events-none z-20", className)}
          data-testid="draggable-chat-container"
        >
          {displayError && (
            <div className="pointer-events-auto absolute left-4 right-4 top-4 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
              {displayError}
            </div>
          )}
          <motion.div
            className="pointer-events-auto"
            style={floatingStyle ?? { position: "absolute" }}
            animate={isDragging ? undefined : positionConfig}
            transition={isDragging ? { duration: 0 } : SNAP_SPRING}
            data-testid="draggable-chat"
            data-dragging={isDragging}
            data-position={snapPosition}
          >
            <ChatApp contained {...chatAppProps} />
          </motion.div>
        </div>
      </ChatDragProvider>
    );
  }

  // For full mode or non-contained: render with external resize handle
  // We use our own resize handle instead of ChatApp's internal one
  const fullModeStyle: React.CSSProperties = enableFullResize
    ? { width: fullWidth, flexShrink: 0 }
    : {};

  // Don't pass enableFullResize to ChatApp - we handle it externally
  const fullModeProps = { ...chatAppProps, enableFullResize: false };

  return (
    <ChatDragProvider value={dragContextValue}>
      <div
        className={cn(
          "group/resize relative h-full min-h-[560px] bg-background",
          enableFullResize ? "flex-shrink-0" : "overflow-hidden",
          className
        )}
        style={fullModeStyle}
      >
        <ChatApp contained={contained} {...fullModeProps} />

        {/*
          External resize handle:
          - Positioned at right edge, extends 2px into adjacent element for easier targeting
          - Zero visual width when not hovered (doesn't push content)
          - Shows line + grip on hover
        */}
        {enableFullResize && (
          <div
            className={cn(
              // Position: right-0 places left edge at container's right edge
              // Then we use translate to center the handle across the boundary
              "absolute right-0 top-0 bottom-0 z-50 translate-x-1/2",
              // Width for hover detection area
              "w-3 cursor-ew-resize",
              "group/handle"
            )}
            onMouseDown={handleFullResizeStart}
            data-resize-handle="full-right"
          >
            {/* Visual indicator line - shows on hover/drag */}
            <div
              className={cn(
                "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 transition-all duration-150",
                isFullResizing
                  ? "bg-primary"
                  : "bg-transparent group-hover/handle:bg-border"
              )}
            />

            {/* Grip handle - appears on hover, centered vertically */}
            <div
              className={cn(
                "absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2",
                "flex h-8 w-4 items-center justify-center rounded-md",
                "transition-all duration-150",
                isFullResizing
                  ? "bg-primary text-primary-foreground opacity-100"
                  : "bg-muted/90 border border-border text-muted-foreground opacity-0 group-hover/handle:opacity-100"
              )}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>
    </ChatDragProvider>
  );
}
