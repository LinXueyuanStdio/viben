/**
 * AcpChat - Main ACP Chat component for desktop application
 *
 * This component wraps ChatApp and provides ACP WebSocket client integration
 * for communicating with the Viben Gateway's ACP endpoint.
 */

// ReactNode is used in callback render prop types
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  EthernetPort,
  ExternalLink,
  FolderPlus,
  FolderTree,
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
import { useAcpChatConfig } from "./use-acp-chat-config";
import { DraggableExpandedHeader } from "./draggable-expanded-header";

// Executor 后端选项
const BACKEND_OPTIONS = [
  { value: "CLAUDE_CODE", label: "Claude ACP" },
  { value: "OPENCLAW", label: "OpenClaw ACP" },
  { value: "OPENCODE", label: "OpenCode" },
  { value: "CODEX", label: "Codex ACP" },
  { value: "GEMINI", label: "Gemini" },
  { value: "QWEN_CODE", label: "Qwen Code" },
];

const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface AcpChatProps {
  mode: ChatAppMode;
  onModeChange: (mode: ChatAppMode) => void;
  contained?: boolean;
  className?: string;
  /** WebSocket URL for ACP connection */
  wsUrl?: string;
  /** Default working directory */
  defaultCwd?: string;
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
  onSelectExecutor: (executorType: string) => void;
}

function AcpHeaderNewSessionMenu({ onCreateSession, onSelectExecutor }: AcpHeaderNewSessionMenuProps) {
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
        <div className="my-1 border-t border-border" />
        {BACKEND_OPTIONS.map((backend) => (
          <MenuActionButton key={backend.value} onClick={() => onSelectExecutor(backend.value)}>
            {backend.label}
          </MenuActionButton>
        ))}
      </div>
    </div>
  );
}

async function openFloatingWindow() {
  try {
    const petWindow = await WebviewWindow.getByLabel("pet-window");
    if (petWindow) {
      await petWindow.show();
      await petWindow.setFocus();
    }
  } catch (err) {
    console.error("[AcpChat] Failed to open floating window:", err);
  }
}

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
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

export function AcpChat({ mode, onModeChange, contained = false, className, wsUrl, defaultCwd }: AcpChatProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Provider state (用于 provider/model 级联选择)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // 使用 ACP Chat 配置 hook，从 API 获取 provider/model 数据并处理约束
  const {
    providerOptions,
    modelOptions: apiModelOptions,
    isLoading: configLoading,
    error: configError,
  } = useAcpChatConfig({
    executorType,
    selectedProviderId,
    selectedModelId: model,
    onProviderChange: setSelectedProviderId,
    onModelChange: setModel,
  });

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
      return (
        <div className="flex size-full items-center justify-center overflow-hidden rounded-full">
          <PetSprite pet={pet} rowId="idle" size={mode === "floating" ? 56 : 36} />
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
      return (
        <div className="flex size-full items-center justify-center overflow-hidden rounded-full">
          <PetSprite pet={pet} rowId="alert" size={mode === "floating" ? 56 : 36} />
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
  // 1. Executor 选项 (静态列表)
  const executorSelectorOptions = useMemo<SelectorOption[]>(
    () =>
      BACKEND_OPTIONS.map((backend) => ({
        id: backend.value,
        label: backend.label,
      })),
    []
  );

  // 2. Provider 选项 (从 API 获取，已根据 executor 约束过滤)
  // providerOptions 来自 useAcpChatConfig hook

  // 3. Model 选项 (从 API 获取，已根据 executor 和 provider 过滤)
  // 如果 API 没有返回数据，使用本地 fallback
  const modelSelectorOptions = useMemo<SelectorOption[]>(() => {
    if (apiModelOptions.length > 0) {
      return apiModelOptions;
    }
    // Fallback: 使用静态模型列表
    const fallbackModels = buildModelOptions(model);
    return fallbackModels.map((m) => ({
      id: m.id,
      label: m.name,
    }));
  }, [apiModelOptions, model]);

  // TripleSelector 当前值
  const tripleSelectorValue = useMemo<TripleSelectorValue>(
    () => ({
      first: executorType,
      second: selectedProviderId,
      third: model,
    }),
    [executorType, selectedProviderId, model]
  );

  // TripleSelector 变更处理
  const handleTripleSelectorChange = useCallback(
    (value: TripleSelectorValue) => {
      // 1. Executor 变更
      if (value.first && value.first !== executorType) {
        setExecutorType(value.first);
        // Provider 和 Model 会在 useAcpChatConfig hook 中自动调整
      }
      // 2. Provider 变更
      if (value.second !== selectedProviderId) {
        setSelectedProviderId(value.second);
        // Model 会在 useAcpChatConfig hook 中自动调整
      }
      // 3. Model 变更
      if (value.third && value.third !== model) {
        setModel(value.third);
      }
    },
    [executorType, selectedProviderId, model, setExecutorType, setModel]
  );

  const tripleSelectorNode = (
    <TripleSelector
      compact
      firstOptions={executorSelectorOptions}
      firstLabel={t("chat.executor", "Executor")}
      firstPlaceholder={t("chat.selectExecutor", "Select executor...")}
      secondOptions={providerOptions}
      secondLabel={t("chat.provider", "Provider")}
      secondPlaceholder={t("chat.selectProvider", "Select provider...")}
      thirdOptions={modelSelectorOptions}
      thirdLabel={t("chat.model", "Model")}
      thirdPlaceholder={t("chat.selectModel", "Select model...")}
      value={tripleSelectorValue}
      onChange={handleTripleSelectorChange}
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
              "h-7 w-7 flex items-center justify-center rounded-full",
              "bg-muted/50 hover:bg-muted/80 transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
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
                <FolderTree className="h-3.5 w-3.5" />
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
                <ListTodo className="h-3.5 w-3.5" />
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
          "h-7 w-7 flex items-center justify-center rounded-full",
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
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : voice.isConnected ? (
          <MicOff className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
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

  const headerContent = (
    <DraggableExpandedHeader
      leftContent={
        <>
          <AcpHeaderSessionMenu title={activeTitle} sessions={sessions} onSelectSession={selectSession} />
          <AcpHeaderNewSessionMenu onCreateSession={createSession} onSelectExecutor={setExecutorType} />
        </>
      }
      centerContent={
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {sessionId ? `session ${shortId(sessionId)}` : connected ? "No active session" : "Disconnected"}
        </div>
      }
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
              <MenuActionButton onClick={openFloatingWindow} icon={<ExternalLink size={14} />}>
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

  // Determine container styles based on mode
  const isFloatingMode = mode === "floating" || mode === "compact" || mode === "expanded";

  // For floating modes in contained context:
  // ChatApp handles its own absolute positioning (bottom-6 left-6)
  // No wrapper div needed - ChatApp renders directly as a positioned element
  if (isFloatingMode && contained) {
    return (
      <>
        {displayError && (
          <div className="absolute left-4 right-4 top-4 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
            {displayError}
          </div>
        )}
        <ChatApp
          contained
          mode={mode}
          title={activeTitle}
          messages={messages}
          messageUpdates={messageUpdates}
          isStreaming={isAgentRunning}
          streamingText={streamingText}
          pendingUserMessageCount={steerQueueItems.length}
          dynamicAssistantAvatar={dynamicAssistantAvatar}
          staticAssistantAvatar={staticAssistantAvatar}
          artifacts={artifacts}
          compactSummaryContent={buildAcpCompactSummary(messages, streamingText, isAgentRunning, steerQueueItems.length)}
          headerContent={headerContent}
          inputProps={sharedInputProps}
          bottomToolbarLeftContent={bottomToolbarLeftContent}
          statusContent={statusContent}
          fullscreenContent={fullscreenContent}
          pendingPlan={pendingPlan}
          pendingApproval={pendingApproval}
          pendingQuestion={pendingQuestion}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onApprovalDecision={handleApprovalDecision}
          onAnswerQuestions={handleQuestionAnswers}
          subagentSheet={
            subagentSheet
              ? {
                  open: true,
                  onClose: closeSubagentSheet,
                  title: subagentSheet.title,
                  subagentType: subagentSheet.subagentType,
                  messages: subagentSheet.messages,
                  liveMessages: liveSubagentMessages,
                  context: subagentSheet.context,
                }
              : undefined
          }
          onExpandSubagent={handleExpandSubagent}
          onModeChange={onModeChange}
          onSend={handleSend}
          onCancel={interrupt}
        />
      </>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full min-h-[560px] overflow-hidden bg-background",
        className
      )}
    >
      <ChatApp
        contained={contained}
        mode={mode}
        title={activeTitle}
        messages={messages}
        messageUpdates={messageUpdates}
        isStreaming={isAgentRunning}
        streamingText={streamingText}
        pendingUserMessageCount={steerQueueItems.length}
        dynamicAssistantAvatar={dynamicAssistantAvatar}
        staticAssistantAvatar={staticAssistantAvatar}
        artifacts={artifacts}
        compactSummaryContent={buildAcpCompactSummary(messages, streamingText, isAgentRunning, steerQueueItems.length)}
        headerContent={headerContent}
        inputProps={sharedInputProps}
        bottomToolbarLeftContent={bottomToolbarLeftContent}
        statusContent={statusContent}
        fullscreenContent={fullscreenContent}
        pendingPlan={pendingPlan}
        pendingApproval={pendingApproval}
        pendingQuestion={pendingQuestion}
        onApprovePlan={handleApprovePlan}
        onRejectPlan={handleRejectPlan}
        onApprovalDecision={handleApprovalDecision}
        onAnswerQuestions={handleQuestionAnswers}
        subagentSheet={
          subagentSheet
            ? {
                open: true,
                onClose: closeSubagentSheet,
                title: subagentSheet.title,
                subagentType: subagentSheet.subagentType,
                messages: subagentSheet.messages,
                liveMessages: liveSubagentMessages,
                context: subagentSheet.context,
              }
            : undefined
        }
        onExpandSubagent={handleExpandSubagent}
        onModeChange={onModeChange}
        onSend={handleSend}
        onCancel={interrupt}
      />
    </div>
  );
}
