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
  GripVertical,
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
  AgentMessage,
  Artifact,
  BackgroundTaskItem,
  BackgroundTasksSummary,
  ChatAppMode,
  ChatInputProps,
  ContentBlock,
  ContextTokenBreakdown,
  MessageAttachment,
  QueuedInputRecallItem,
  SelectorOption,
  SlashCommand,
  SlashCommandSelection,
  TasksSummary,
  TripleSelectorValue,
  DisplayLabelFormatParams,
} from "@viben/chat";
import type { PermissionMode } from "@/lib/gateway/types/agent";
import { PetSprite } from "@viben/pet";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
} from "@viben/ui";
import { usePet } from "@/hooks";
import { openAndReadFiles } from "@/lib/tauri-file-attach";
import { EmojiTab } from "@/components/ui/icon-picker/tabs/emoji-tab";
import { ScreenshotDropdown } from "@/components/chat/screenshot-dropdown";
import { useScreenshot } from "@/hooks/use-screenshot";
import { useVoiceAgent } from "@/hooks/use-voice-agent";
import { useChatConfigStore } from "@/stores/chat-config-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { getGatewayUrl, getInputHistory } from "@/lib/gateway";
import { useAcpSession } from "./use-acp-session";
import { ContextSettingsPopup } from "./context-settings-popup";
import { useChatDrag } from "@/hooks/use-chat-drag";
import { ChatDragProvider } from "@/contexts/chat-drag-context";
import type { SnapPosition } from "@/stores/chat-position-store";
import { DraggableExpandedHeader } from "./draggable-expanded-header";
import { ChatWindowControls } from "./chat-window-controls";
import type { AcpSessionListItem } from "./use-acp-session";

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
  console.log("[AcpChat] openChatWindow called");
  try {
    const chatWindow = await WebviewWindow.getByLabel("chat-window");
    console.log("[AcpChat] getByLabel result:", chatWindow);
    if (chatWindow) {
      console.log("[AcpChat] Existing window found, showing...");
      try { await chatWindow.unminimize(); } catch {}
      await chatWindow.show();
      await chatWindow.setFocus();
      try { await chatWindow.center(); } catch {}
      console.log("[AcpChat] Window shown and focused");
      return;
    }
    console.log("[AcpChat] No existing window, creating new one...");
    const newWindow = new WebviewWindow("chat-window", {
      url: "/chat-window.html",
      title: "Chat",
      width: 420,
      height: 600,
      minWidth: 360,
      minHeight: 400,
      titleBarStyle: "overlay",
      hiddenTitle: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      shadow: true,
      focus: true,
      center: true,
    });
    console.log("[AcpChat] WebviewWindow constructor returned:", newWindow);
    newWindow.once("tauri://created", () => {
      console.log("[AcpChat] Chat window created successfully");
    });
    newWindow.once("tauri://error", (e) => {
      console.error("[AcpChat] Chat window creation error:", e.payload);
    });
  } catch (err) {
    console.error("[AcpChat] Failed to open chat window:", err);
  }
}


interface AcpHeaderSessionMenuProps {
  title: string;
  onOpenSessionList: () => void;
}

function AcpHeaderSessionMenu({ title, onOpenSessionList }: AcpHeaderSessionMenuProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="flex h-8 max-w-44 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent"
      data-no-drag
      aria-label={t("chat.acp.openSessionList", "Open session list")}
      onClick={onOpenSessionList}
    >
      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{title}</span>
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

interface AcpHeaderNewSessionMenuProps {
  onCreateSession: () => void;
  onOpenInNewWindow: () => void;
  onCreateSessionWithAgent: (agentId: string) => void;
  agentOptions: SelectorOption[];
  workspaceName?: string;
}

function AcpHeaderNewSessionMenu({
  onCreateSession,
  onOpenInNewWindow,
  onCreateSessionWithAgent,
  agentOptions,
  workspaceName,
}: AcpHeaderNewSessionMenuProps) {
  const { t } = useTranslation();

  const workspaceAgents = agentOptions.filter((a) => a.badge === "workspace");
  const globalAgents = agentOptions.filter((a) => a.badge === "global");

  return (
    <div className="flex h-7 shrink-0 items-center rounded-md border border-border bg-background">
      <button
        type="button"
        className="flex h-full w-7 items-center justify-center rounded-l-[5px] text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onCreateSession}
        aria-label={t("chat.newSession", "New session")}
        data-no-drag
      >
        <Plus className="size-3.5" />
      </button>
      <div className="h-full w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-full w-6 items-center justify-center rounded-r-[5px] text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("chat.openSessionMenu", "Open session menu")}
            data-no-drag
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={onCreateSession} className="gap-2">
            <FolderPlus className="size-4" />
            {t("chat.newSession", "New session")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenInNewWindow} className="gap-2">
            <ExternalLink className="size-4" />
            {t("chat.newSessionInWindow", "New session in window")}
          </DropdownMenuItem>

          {workspaceAgents.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
                {workspaceName || t("chat.workspace", "Workspace")}
              </DropdownMenuLabel>
              {workspaceAgents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => onCreateSessionWithAgent(agent.id)}
                  className="gap-2 pl-4"
                >
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="truncate">{t("chat.newSessionWith", "New session: {{name}}", { name: agent.label })}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {globalAgents.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t("chat.global", "Global")}
              </DropdownMenuLabel>
              {globalAgents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => onCreateSessionWithAgent(agent.id)}
                  className="gap-2 pl-4"
                >
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="truncate">{t("chat.newSessionWith", "New session: {{name}}", { name: agent.label })}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
  queuedCount: number,
  t: (key: string, options?: Record<string, unknown>) => string
): React.ReactNode {
  if (queuedCount > 0) {
    return t("chat.acp.queuedPrompts", { count: queuedCount });
  }
  if (streamingText?.trim()) {
    return truncateText(streamingText.trim(), 120);
  }
  const latest = [...messages]
    .reverse()
    .find((message) => message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error");
  if (!latest) return t("chat.acp.readyWhenYouAre");
  if (latest.type === "tool_use") {
    return isAgentRunning
      ? t("chat.acp.runningTool", { name: latest.name ?? t("chat.acp.tool") })
      : t("chat.acp.toolCall", { name: latest.name ?? t("chat.acp.call") });
  }
  if (latest.type === "error") return truncateText(latest.message ?? latest.content ?? t("chat.acp.needsAttention"), 120);
  return truncateText(latest.content ?? latest.message ?? t("chat.acp.working"), 120);
}

export function AcpChat({ mode, onModeChange, contained = false, className, wsUrl, defaultCwd, enableFullResize = false, windowMode = false }: AcpChatProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get active workspace name
  const activeWorkspace = useWorkspaceStore((state) => state.getActiveWorkspace());
  const workspaceName = activeWorkspace?.name;
  const { openWorkspaceAgentDetail } = useDesktopRouting();

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
    acpSessionList,
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
    // Agent/Provider/Model config (from integrated useAcpChatConfig)
    agentOptions,
    providerOptions,
    modelOptions,
    selectedAgentId,
    effectiveSelectedProviderId,
    effectiveSelectedModel,
    configLoading,
    configError,
    // Actions
    connect,
    createSession,
    loadSession,
    refreshSessionList,
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
    subagentStreamingState,
    handleExpandSubagent,
    closeSubagentSheet,
    toolInspectState,
    handleInspectTool,
    closeToolInspect,
    artifactDialogState,
    handleArtifactClick,
    closeArtifactDialog,
    handleLoadSubagentDetails,
  } = acp;

  const sessionId = activeSessionId;
  const activeTitle = sessions.find((session) => session.id === sessionId)?.title ?? "ACP Chat";
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false);
  const [isSessionDrawerMounted, setIsSessionDrawerMounted] = useState(false);
  const [selectedSessionListIndex, setSelectedSessionListIndex] = useState(0);

  const openSessionDrawer = useCallback(() => {
    setIsSessionDrawerMounted(true);
    window.requestAnimationFrame(() => setIsSessionDrawerOpen(true));
    void refreshSessionList().then((items) => {
      setSelectedSessionListIndex((current) => {
        if (items.length === 0) return 0;
        const activeIndex = sessionId ? items.findIndex((item) => item.sessionId === sessionId) : -1;
        if (activeIndex >= 0) return activeIndex;
        return Math.min(current, items.length - 1);
      });
    });
  }, [refreshSessionList, sessionId]);

  const closeSessionDrawer = useCallback(() => {
    setIsSessionDrawerOpen(false);
  }, []);

  const closeSessionDrawerAndFocusInput = useCallback(() => {
    setIsSessionDrawerOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleSessionListAttach = useCallback(async (targetSessionId: string) => {
    closeSessionDrawer();
    await loadSession(targetSessionId);
  }, [closeSessionDrawer, loadSession]);

  useEffect(() => {
    if (!isSessionDrawerOpen) return;
    setSelectedSessionListIndex((current) => {
      if (acpSessionList.length === 0) return 0;
      return Math.min(current, acpSessionList.length - 1);
    });
  }, [acpSessionList.length, isSessionDrawerOpen]);

  useEffect(() => {
    if (isSessionDrawerOpen || !isSessionDrawerMounted) return;
    const timer = window.setTimeout(() => setIsSessionDrawerMounted(false), 240);
    return () => window.clearTimeout(timer);
  }, [isSessionDrawerMounted, isSessionDrawerOpen]);

  const sessionDrawer = isSessionDrawerMounted ? (
    <AcpSessionListDrawer
      open={isSessionDrawerOpen}
      sessions={acpSessionList}
      activeSessionId={sessionId}
      selectedIndex={selectedSessionListIndex}
      onSelectedIndexChange={setSelectedSessionListIndex}
      onAttach={handleSessionListAttach}
      onClose={closeSessionDrawerAndFocusInput}
    />
  ) : null;

  // Attachments state
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);

  // Settings state
  const [worktree, setWorktree] = useState(false);
  const [backgroundTask, setBackgroundTask] = useState(false);

  // Context permission state
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");
  const [isContextPopupOpen, setIsContextPopupOpen] = useState(false);
  const [isContextPopupPinned, setIsContextPopupPinned] = useState(false);
  const contextPopupHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [inputHistoryItems, setInputHistoryItems] = useState<string[]>([]);

  const refreshInputHistory = useCallback(async () => {
    try {
      const history = await getInputHistory(getGatewayUrl(), { limit: 200 });
      setInputHistoryItems(history.entries);
    } catch (historyError) {
      console.warn("[AcpChat] Failed to load input history:", historyError);
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    void refreshInputHistory();
  }, [connected, refreshInputHistory]);

  const handleSend = useCallback(
    (content: string, _messageAttachments?: MessageAttachment[]) => {
      // TODO: ACP session doesn't support attachments yet
      // When supported, merge: [...attachments, ...(messageAttachments ?? [])]
      // Clear attachments after sending
      setAttachments([]);

      if (isTurnActive) {
        void sendSteerPrompt(content).then(refreshInputHistory).catch((steerError) => {
          console.error("[AcpChat] Failed to send steer prompt:", steerError);
        });
        return;
      }
      window.setTimeout(() => {
        void refreshInputHistory();
      }, 300);
      void sendPrompt(content).then(refreshInputHistory).catch((sendError) => {
        console.error("[AcpChat] Failed to send prompt:", sendError);
      });
    },
    [isTurnActive, refreshInputHistory, sendPrompt, sendSteerPrompt]
  );

  const handleSlashCommandSelect = useCallback(
    (command: SlashCommand, selection: SlashCommandSelection) => {
      if (isTurnActive) {
        const args = selection.args.trim();
        void sendSteerPrompt(`/${command.name}${args ? ` ${args}` : ""}`).then(refreshInputHistory).catch((steerError) => {
          console.error("[AcpChat] Failed to send steer prompt:", steerError);
        });
        return;
      }
      handleSlashCommand(command, selection);
    },
    [handleSlashCommand, isTurnActive, refreshInputHistory, sendSteerPrompt]
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

  // TripleSelector 当前值
  const tripleSelectorValue = useMemo<TripleSelectorValue>(
    () => ({
      first: selectedAgentId ?? executorType,
      second: effectiveSelectedProviderId,
      third: effectiveSelectedModel || null,
    }),
    [selectedAgentId, executorType, effectiveSelectedProviderId, effectiveSelectedModel]
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
          return;
        } else {
          setExecutorType(value.first);
          return;
        }
      }
      // 2. Provider 变更
      if (value.second !== effectiveSelectedProviderId) {
        setSelectedProviderId(value.second);
      }
      // 3. Model 变更
      if (value.third && value.third !== effectiveSelectedModel) {
        setModel(value.third);
      }
    },
    [selectedAgentId, executorType, effectiveSelectedProviderId, effectiveSelectedModel, agentOptions, setSelectedAgentId, setExecutorType, setSelectedProviderId, setModel]
  );

  const handleAssistantAvatarClick = useCallback((_message: AgentMessage) => {
    const workspaceId = activeWorkspace?.id;
    const agentId = selectedAgentId;
    if (workspaceId && agentId) {
      openWorkspaceAgentDetail(workspaceId, agentId);
    }
  }, [activeWorkspace?.id, selectedAgentId, openWorkspaceAgentDetail]);

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
      thirdOptions={modelOptions}
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

  // Extract latest usage_update from ACP message stream
  const latestUsage = useMemo(() => {
    let used = 0;
    let size = 128000;
    let cost: { amount: number; currency: string } | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as { type?: string; summary?: Record<string, unknown> };
      if (msg.type === "summary" && msg.summary?.sessionUpdate === "usage_update") {
        used = (msg.summary.used as number) ?? 0;
        size = (msg.summary.size as number) ?? 128000;
        const rawCost = msg.summary.cost as { amount: number; currency: string } | undefined;
        cost = rawCost ?? null;
        break;
      }
    }
    return { used, size, cost };
  }, [messages]);

  // Context breakdown from ACP usage_update
  const contextBreakdown = useMemo<ContextTokenBreakdown>(() => ({
    used: latestUsage.used,
    size: latestUsage.size,
    cost: latestUsage.cost,
  }), [latestUsage.used, latestUsage.size, latestUsage.cost]);



  const handleContextPopupMouseEnter = useCallback(() => {
    if (contextPopupHoverTimeoutRef.current) {
      clearTimeout(contextPopupHoverTimeoutRef.current);
      contextPopupHoverTimeoutRef.current = null;
    }
    setIsContextPopupOpen(true);
  }, []);

  const handleContextPopupMouseLeave = useCallback(() => {
    if (isContextPopupPinned) return;
    contextPopupHoverTimeoutRef.current = setTimeout(() => {
      setIsContextPopupOpen(false);
    }, 150);
  }, [isContextPopupPinned]);

  const handleContextPopupClick = useCallback(() => {
    if (isContextPopupPinned) {
      setIsContextPopupPinned(false);
      setIsContextPopupOpen(false);
    } else {
      setIsContextPopupPinned(true);
      setIsContextPopupOpen(true);
    }
  }, [isContextPopupPinned]);

  // Escape key shortcut to interrupt active turn
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !sessionId || !isTurnActive) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[role="dialog"]')) return;
      event.preventDefault();
      void interrupt();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interrupt, isTurnActive, sessionId]);

  const handleCompactContext = useCallback(() => {
    handleSend("/compact");
  }, [handleSend]);

  // Combined bottom toolbar left content
  const bottomToolbarLeftContent = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        {tripleSelectorNode}
        <div
          className="relative"
          onMouseEnter={handleContextPopupMouseEnter}
          onMouseLeave={handleContextPopupMouseLeave}
        >
          {isContextPopupOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-50 pb-1">
              <ContextSettingsPopup
                hasSession={!!sessionId}
                used={latestUsage.used}
                size={latestUsage.size}
                cost={latestUsage.cost}
                permissionMode={permissionMode}
                onPermissionModeChange={setPermissionMode}
                sandbox={sandboxConfig.enabled}
                onSandboxChange={setSandboxEnabled}
                worktree={worktree}
                onWorktreeChange={setWorktree}
                backgroundTask={backgroundTask}
                onBackgroundTaskChange={setBackgroundTask}
                onCompact={handleCompactContext}
              />
            </div>
          )}
          {sessionId ? (
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors",
                "hover:bg-muted/50",
                "text-muted-foreground hover:text-foreground"
              )}
              onClick={handleContextPopupClick}
            >
              <Settings2 className="h-4 w-4" />
              <span>{Math.round(contextBreakdown.usedPercent)}%</span>
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center h-8 w-8 rounded-md text-xs transition-colors",
                "hover:bg-muted/50",
                "text-muted-foreground hover:text-foreground"
              )}
              onClick={handleContextPopupClick}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex-1" />
        {voiceInputNode}
      </div>
    ),
    [
      permissionMode,
      backgroundTask,
      contextBreakdown,
      handleCompactContext,
      handleContextPopupClick,
      handleContextPopupMouseEnter,
      handleContextPopupMouseLeave,
      isContextPopupOpen,
      latestUsage,
      sandboxConfig.enabled,
      sessionId,
      setSandboxEnabled,
      tripleSelectorNode,
      voiceInputNode,
      worktree,
    ]
  );

  const bottomToolbar = useMemo(
    () => (
      <ChatInputBottomToolbar
        leftContent={bottomToolbarLeftContent}
        onSend={() => handleSend(inputValue)}
        onCancel={interrupt}
        isLoading={isTurnActive}
        canSubmit={connected && inputValue.trim().length > 0}
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
      inputHistoryItems,
      onRecallSessionList: openSessionDrawer,
      isLoading: isTurnActive,
      allowSendWhileLoading: true,
      sendDisabled: !connected,
      sendBlockedReason: !connected
        ? t("chat.acp.connectFirst")
        : undefined,
      placeholder: isTurnActive
        ? t("chat.acp.steeringPlaceholder")
        : t("chat.inputPlaceholder"),
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
      inputHistoryItems,
      handleSlashCommandSelect,
      interrupt,
      isTurnActive,
      openSessionDrawer,
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
            <AcpHeaderNewSessionMenu onCreateSession={createSession} onOpenInNewWindow={openChatWindow} onCreateSessionWithAgent={createSession} agentOptions={agentOptions} workspaceName={workspaceName} />
            <AcpHeaderSessionMenu title={activeTitle} onOpenSessionList={openSessionDrawer} />
          </>
        )
      }
      centerContent={null}
      rightContent={
        isMacOS ? (
          // macOS: 右侧放菜单
          <>
            <AcpHeaderNewSessionMenu onCreateSession={createSession} onOpenInNewWindow={openChatWindow} onCreateSessionWithAgent={createSession} agentOptions={agentOptions} workspaceName={workspaceName} />
            <AcpHeaderSessionMenu title={activeTitle} onOpenSessionList={openSessionDrawer} />
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
          <AcpHeaderSessionMenu title={activeTitle} onOpenSessionList={openSessionDrawer} />
          <AcpHeaderNewSessionMenu onCreateSession={createSession} onOpenInNewWindow={openChatWindow} onCreateSessionWithAgent={createSession} agentOptions={agentOptions} workspaceName={workspaceName} />
        </>
      }
      centerContent={null}
      rightContent={
        <ExpandedHeaderModeControls
          mode={mode}
          onModeChange={onModeChange}
          moreMenuContent={
            <>
              <DropdownMenuItem onClick={() => onModeChange("compact")} className="gap-2">
                <Minimize2 className="size-4" />
                {t("chat.acp.compactMode")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onModeChange("expanded")} className="gap-2">
                <MessageSquare className="size-4" />
                {t("chat.acp.expandedMode")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onModeChange("full")} className="gap-2">
                <Maximize2 className="size-4" />
                {t("chat.acp.fullscreenMode")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openChatWindow} className="gap-2">
                <ExternalLink className="size-4" />
                {t("chat.acp.openInNewWindow")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!connected ? (
                <DropdownMenuItem onClick={connect} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                  {t("chat.acp.connect")}
                </DropdownMenuItem>
              ) : null}
              {connected && !sessionId ? (
                <DropdownMenuItem onClick={() => { void createSession(); }} className="gap-2">
                  <FolderPlus className="size-4" />
                  {t("chat.newSession")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => {
                  const value = steerQueueItems.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
                  handleRecallQueue(steerQueueItems, value);
                }}
                disabled={steerQueueItems.length === 0 || !sessionId}
                className="gap-2"
              >
                <RotateCcw className="size-4" />
                {t("chat.acp.recallQueue")}
              </DropdownMenuItem>
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
          onInspectTool={handleInspectTool}
          onArtifactClick={handleArtifactClick}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleQuestionAnswers}
          onAssistantAvatarClick={handleAssistantAvatarClick}
          welcomeTitle={t("chat.acp.welcomeTitle")}
          welcomeDescription={t("chat.acp.welcomeDescription")}
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
    compactSummaryContent: buildAcpCompactSummary(messages, streamingText, isAgentRunning, steerQueueItems.length, t),
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
    onInspectTool: handleInspectTool,
    onArtifactClick: handleArtifactClick,
    loadSubagentDetails: handleLoadSubagentDetails,
    subagentSheet: subagentSheet
      ? {
          open: true,
          onClose: closeSubagentSheet,
          title: subagentSheet.title,
          subagentType: subagentSheet.subagentType,
          messages: subagentSheet.messages,
          liveMessages: liveSubagentMessages,
          messageUpdates: subagentStreamingState.messageUpdates,
          isStreamingOutput: subagentStreamingState.isStreaming,
          streamingText: subagentStreamingState.streamingText,
          answer: subagentSheet.answer,
          context: subagentSheet.context,
          loadSubagentDetails: handleLoadSubagentDetails,
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

  // Determine mode-specific content
  let modeContent: React.ReactNode;

  // For standalone window mode: render full-screen, no floating wrapper.
  // macOS uses the native title bar overlay, matching the main desktop window.
  if (windowMode) {
    modeContent = (
      <ChatDragProvider value={dragContextValue}>
        <div className={cn("relative flex h-full w-full flex-col overflow-visible bg-background", className)}>
          {displayError && (
            <div className="absolute left-4 right-4 top-14 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
              {displayError}
            </div>
          )}
          {sessionDrawer}
          <ChatApp contained {...chatAppProps} />
        </div>
      </ChatDragProvider>
    );
  } else if (isFloatingMode) {
    modeContent = (
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
            className="pointer-events-auto relative overflow-visible"
            style={floatingStyle ?? { position: "absolute" }}
            animate={isDragging ? undefined : positionConfig}
            transition={isDragging ? { duration: 0 } : SNAP_SPRING}
            data-testid="draggable-chat"
            data-dragging={isDragging}
            data-position={snapPosition}
          >
            {sessionDrawer}
            <ChatApp contained {...chatAppProps} />
          </motion.div>
        </div>
      </ChatDragProvider>
    );
  } else {
    const fullModeStyle: React.CSSProperties = enableFullResize
      ? { width: fullWidth, flexShrink: 0 }
      : {};
    const fullModeProps = { ...chatAppProps, enableFullResize: false };

    modeContent = (
      <ChatDragProvider value={dragContextValue}>
        <div
          className={cn(
            "group/resize relative h-full min-h-[560px] overflow-visible bg-background",
            enableFullResize && "flex-shrink-0",
            className
          )}
          style={fullModeStyle}
        >
          {sessionDrawer}
          <ChatApp contained={contained} {...fullModeProps} />
          {enableFullResize && (
            <div
              className={cn(
                "absolute right-0 top-0 bottom-0 z-50 translate-x-1/2",
                "w-3 cursor-ew-resize",
                "group/handle"
              )}
              onMouseDown={handleFullResizeStart}
              data-resize-handle="full-right"
            >
              <div
                className={cn(
                  "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 transition-all duration-150",
                  isFullResizing
                    ? "bg-primary"
                    : "bg-transparent group-hover/handle:bg-border"
                )}
              />
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

  return (
    <>
      {modeContent}
      <ToolInspectDialog state={toolInspectState} onClose={closeToolInspect} />
      <ArtifactDialog state={artifactDialogState} onClose={closeArtifactDialog} />
    </>
  );
}

function resolveOutputContentBlocks(output: AgentMessage["output"]): ContentBlock[] | null {
  if (!output) return null;
  if (Array.isArray(output)) {
    if (output.length === 0) return null;
    if (output.every((b) => typeof b === "object" && b !== null && "type" in b && (b.type === "text" || b.type === "image"))) {
      return output as ContentBlock[];
    }
    return null;
  }
  if (typeof output !== "string") return null;
  const trimmed = output.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (parsed.every((b: unknown) => typeof b === "object" && b !== null && "type" in b && ((b as { type: string }).type === "text" || (b as { type: string }).type === "image"))) {
      return parsed as ContentBlock[];
    }
    return null;
  } catch {
    return null;
  }
}

interface AcpSessionListDrawerProps {
  open: boolean;
  sessions: AcpSessionListItem[];
  activeSessionId: string | null;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onAttach: (sessionId: string) => void | Promise<void>;
  onClose: () => void;
}

function AcpSessionListDrawer({
  open,
  sessions,
  activeSessionId,
  selectedIndex,
  onSelectedIndexChange,
  onAttach,
  onClose,
}: AcpSessionListDrawerProps) {
  const { t } = useTranslation();
  const selectedSession = sessions[selectedIndex];

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (sessions.length === 0) return;
      onSelectedIndexChange(Math.max(0, selectedIndex - 1));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (sessions.length === 0) return;
      onSelectedIndexChange(Math.min(sessions.length - 1, selectedIndex + 1));
      return;
    }
    if (event.key === "Enter" && selectedSession) {
      event.preventDefault();
      void onAttach(selectedSession.sessionId);
    }
  }, [onAttach, onClose, onSelectedIndexChange, selectedIndex, selectedSession, sessions.length]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden" role="presentation">
      <div
        className={cn(
          "absolute bottom-0 left-0 top-0 flex h-full w-[360px] max-w-[88vw] flex-col border-r border-border bg-background shadow-2xl transition-transform duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        )}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        ref={(node) => {
          if (open) node?.focus();
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {t("chat.acp.sessionList", "Sessions")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("chat.acp.sessionListCount", "{{count}} sessions", { count: sessions.length })}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("common.close", "Close")}
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {sessions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("chat.acp.noSessions", "No sessions")}
              </div>
            ) : sessions.map((session, index) => {
              const selected = index === selectedIndex;
              const running = isRunningSession(session);
              return (
                <button
                  key={session.sessionId}
                  type="button"
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-transparent hover:border-border hover:bg-muted/60"
                  )}
                  onMouseEnter={() => onSelectedIndexChange(index)}
                  onClick={() => { void onAttach(session.sessionId); }}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-medium">
                      {session.title || shortSessionId(session.sessionId)}
                    </div>
                    <Badge variant={running ? "default" : "secondary"} className="shrink-0 text-[10px]">
                      {running ? t("chat.acp.running", "Running") : t("chat.acp.resume", "Resume")}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {session.sessionId}
                  </div>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{session.agent || session.agentExecutorType || t("chat.acp.unknownAgent", "Unknown agent")}</span>
                    {activeSessionId === session.sessionId ? <span className="shrink-0 text-primary">{t("chat.acp.current", "Current")}</span> : null}
                  </div>
                  {session.initialPrompt ? (
                    <div className="mt-2 line-clamp-2 text-xs leading-snug text-foreground/80">
                      {session.initialPrompt}
                    </div>
                  ) : null}
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {running ? t("chat.acp.enterAttach", "Enter to attach") : t("chat.acp.enterResume", "Enter to resume")}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function isRunningSession(session: AcpSessionListItem): boolean {
  return Boolean(session.promptRunning) || session.status === "active" || session.status === "initializing";
}

function shortSessionId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function toolOutputToJson(output: AgentMessage["output"]): string {
  if (output == null) return "No output";
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (!trimmed) return "";
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try { return JSON.stringify(JSON.parse(trimmed), null, 2); } catch { return trimmed; }
    }
    return trimmed;
  }
  return JSON.stringify(output, null, 2);
}

function RichOutputBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === "image" && block.source?.type === "base64") {
          return (
            <img
              key={i}
              src={`data:${block.source.media_type};base64,${block.source.data}`}
              alt="tool output"
              className="max-w-full max-h-[400px] rounded-lg border border-border"
            />
          );
        }
        if (block.type === "text") {
          return (
            <pre key={i} className="whitespace-pre-wrap break-words text-xs">
              <code>{block.text}</code>
            </pre>
          );
        }
        return null;
      })}
    </div>
  );
}

function ToolInspectDialog({
  state,
  onClose,
}: {
  state: { message: AgentMessage; result?: AgentMessage } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [outputView, setOutputView] = useState<"rich" | "json">("rich");
  if (!state) return null;
  const { message, result } = state;
  const output = result?.output ?? message.output;
  const isError = Boolean(result?.isError ?? message.isError);
  const contentBlocks = resolveOutputContentBlocks(output);
  const hasRichContent = contentBlocks !== null;

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{message.name ?? "Tool Call"}</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {message.toolUseId ?? message.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {result ? "completed" : "pending"}
            </span>
            {isError && (
              <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                error
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("chat.acpDetail.tool")}</dt>
            <dd className="font-mono">{message.name ?? "unknown"}</dd>
            <dt className="text-muted-foreground">{t("chat.acpDetail.callId")}</dt>
            <dd className="font-mono break-all">{message.toolUseId ?? "none"}</dd>
            {message.subagentId && (
              <>
                <dt className="text-muted-foreground">{t("chat.acpDetail.subagent")}</dt>
                <dd className="font-mono break-all">{message.subagentId}</dd>
              </>
            )}
          </dl>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("chat.acpDetail.input")}</div>
            <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
              {typeof message.input === "string"
                ? message.input
                : JSON.stringify(message.input, null, 2) ?? "null"}
            </pre>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("chat.acpDetail.output")}</span>
              {hasRichContent && (
                <div className="flex h-6 rounded-md border border-border overflow-hidden text-[10px]">
                  <button
                    type="button"
                    className={cn(
                      "px-2 transition-colors",
                      outputView === "rich" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setOutputView("rich")}
                  >
                    {t("chat.acpDetail.richView")}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-2 border-l border-border transition-colors",
                      outputView === "json" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setOutputView("json")}
                  >
                    {t("chat.acpDetail.jsonView")}
                  </button>
                </div>
              )}
            </div>
            {hasRichContent && outputView === "rich" ? (
              <div className="max-h-[400px] overflow-auto rounded-lg border border-border bg-muted/30 p-3">
                <RichOutputBlocks blocks={contentBlocks} />
              </div>
            ) : (
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
                {toolOutputToJson(output)}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArtifactDialog({
  state,
  onClose,
}: {
  state: { artifact: Artifact; message?: AgentMessage } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!state) return null;
  const { artifact, message } = state;

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t("chat.acpDetail.artifact")}</DialogTitle>
          <DialogDescription>{artifact.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">{t("chat.acpDetail.id")}</dt>
            <dd className="break-all font-mono">{artifact.id}</dd>
            <dt className="text-muted-foreground">{t("chat.acpDetail.type")}</dt>
            <dd>{artifact.type}</dd>
            {artifact.toolName && (
              <>
                <dt className="text-muted-foreground">{t("chat.acpDetail.tool")}</dt>
                <dd>{artifact.toolName}</dd>
              </>
            )}
            {artifact.sourceMessageId && (
              <>
                <dt className="text-muted-foreground">{t("chat.acpDetail.source")}</dt>
                <dd className="break-all font-mono">{artifact.sourceMessageId}</dd>
              </>
            )}
          </dl>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {message ? t("chat.acpDetail.sourceMessage") : t("chat.acpDetail.artifactData")}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(message ?? artifact, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
