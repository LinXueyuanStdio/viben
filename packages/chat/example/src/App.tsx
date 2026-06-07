import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { LayoutGroup, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import {
  PlanApproval,
  QuestionInput,
  EmojiPicker,
  ToolsConfigPopover,
  SkillsConfigPopover,
  ContextDetailsPopover,
  ToolExecutionItem,
  CommandQueuePanel,
  ExecApproval,
  useCommandQueue,
  useCommandQueueInputRecall,
  getModelIcon,
} from "@viben/chat"
import type { AgentMessage, ChatInputProps, MessageListHandle, CommandQueueItem, MessageAttachment, SlashCommand, SlashCommandSelection } from "@viben/chat"
import type { ExpandSubagentHandler, SubagentOpenContext } from "@viben/chat"
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap, Upload, Sun, Moon, ChevronDown, Plus, Bot, MessageSquare, Maximize2, Languages, X, GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { JsonView, darkStyles } from "react-json-view-lite"
import "react-json-view-lite/dist/index.css"
import {
  demoPlan,
  demoQuestions,
  demoAgents,
  demoModels,
  demoTools,
  demoSkills,
  demoSlashCommands,
  demoContextBreakdown,
  demoCommandQueueItems,
  demoExecApprovals,
  parseSessionJsonl,
  parseSessionFolder,
} from "./demo-data"
import { demoSteps } from "./demo-steps"
import { useStepPlayer } from "./use-step-player"
import type { DemoStep } from "./use-step-player"
import {
  CLAUDE_CODE_SESSIONS,
  loadClaudeCodeSession,
  loadClaudeCodeSubagent,
  type ClaudeCodeSessionManifestItem,
  type LoadedClaudeCodeSession,
  type ParseStats,
  type SubagentPreviewEvent,
} from "./claudecode-log-provider"
import { ChatApp, ChatAppFullscreenPanel } from "./ChatApp"
import type { ChatAppMode, ChatAppSessionItem } from "./ChatApp"
import { UI_DESIGN_SHOWCASE_DEMOS, UI_DESIGN_SHOWCASE_GROUPS } from "./UIDesignShowcaseData"
import type { UIShowcaseDemoId } from "./UIDesignShowcaseData"

// ============================================================================
// Agent Busy Detection
// ============================================================================

/**
 * Derive agent busy state from message content.
 * Agent is busy when there are unresolved tool_use calls (no matching tool_result).
 * This drives command queue behavior: busy → enqueue, idle → auto-dequeue.
 */
function isAgentBusy(messages: AgentMessage[]): boolean {
  const pendingToolUseIds = new Set<string>()
  for (const msg of messages) {
    if (msg.type === "tool_use" && msg.toolUseId) {
      pendingToolUseIds.add(msg.toolUseId)
    }
    if (msg.type === "tool_result" && msg.toolUseId) {
      pendingToolUseIds.delete(msg.toolUseId)
    }
  }
  return pendingToolUseIds.size > 0
}

// ============================================================================
// Player Speeds
// ============================================================================

const SPEEDS = [0.5, 1, 2, 4, 8]
const FULLSCREEN_LAYOUT_DELAY_MS = 40
const EXAMPLE_SIDEBAR_EXPANDED_WIDTH = 280
const EXAMPLE_SIDEBAR_COLLAPSED_WIDTH = 56
const FULLSCREEN_CHAT_MIN_WIDTH = 440
const FULLSCREEN_CHAT_DEFAULT_WIDTH = 720
const FULLSCREEN_CHAT_MAX_WIDTH = 1040
const DEMO_PANEL_MIN_WIDTH = 360
const FULLSCREEN_CHAT_WIDTH_STORAGE_KEY = "viben.chat.example.fullscreen_chat_width"
type ExampleLanguage = "en" | "zh-CN"
type ExampleSidebarPage = "player" | "ui-showcase"
type FullscreenEntryGeometry = {
  x: number
  y: number
  width: number
  height: number
}

function getFullscreenChatMaxWidth(sidebarWidth: number) {
  if (typeof window === "undefined") return FULLSCREEN_CHAT_MAX_WIDTH
  return Math.min(
    FULLSCREEN_CHAT_MAX_WIDTH,
    Math.max(FULLSCREEN_CHAT_MIN_WIDTH, window.innerWidth - sidebarWidth - DEMO_PANEL_MIN_WIDTH)
  )
}

function clampFullscreenChatWidth(width: number, sidebarWidth: number) {
  return Math.min(getFullscreenChatMaxWidth(sidebarWidth), Math.max(FULLSCREEN_CHAT_MIN_WIDTH, width))
}

function readStoredFullscreenChatWidth() {
  if (typeof window === "undefined") return FULLSCREEN_CHAT_DEFAULT_WIDTH
  const stored = window.localStorage.getItem(FULLSCREEN_CHAT_WIDTH_STORAGE_KEY)
  const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN
  return Number.isFinite(parsed) ? parsed : FULLSCREEN_CHAT_DEFAULT_WIDTH
}

function storeFullscreenChatWidth(width: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FULLSCREEN_CHAT_WIDTH_STORAGE_KEY, String(Math.round(width)))
}

function getFullscreenEntryInitial(geometry: FullscreenEntryGeometry | null) {
  return geometry
    ? {
        opacity: 0.98,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
      }
    : {
        opacity: 0.96,
        x: -28,
        y: 32,
        width: FULLSCREEN_CHAT_DEFAULT_WIDTH,
        height: "75%",
      }
}

// ============================================================================
// Convert flat messages to simple steps (for .jsonl loading)
// ============================================================================

function messagesToSteps(messages: AgentMessage[]): DemoStep[] {
  return messages.map((msg) => ({
    messages: [msg],
    delayMs: msg.type === "user" ? 800 : msg.type === "text" ? 1200 : msg.type === "thinking" ? 600 : 400,
  }))
}

function buildClaudeCodePlaybackSteps(
  messages: AgentMessage[],
  events: SubagentPreviewEvent[]
): DemoStep[] {
  if (events.length === 0) return messagesToSteps(messages)

  const eventsByParent = new Map<string, SubagentPreviewEvent[]>()
  for (const event of events) {
    const list = eventsByParent.get(event.parentToolUseId) ?? []
    list.push(event)
    eventsByParent.set(event.parentToolUseId, list)
  }

  const steps: DemoStep[] = []
  const updates: Record<string, Partial<AgentMessage>> = {}

  for (const message of messages) {
    steps.push({
      messages: [message],
      delayMs: message.type === "user" ? 800 : message.type === "text" ? 1200 : message.type === "thinking" ? 600 : 400,
      messageUpdates: { ...updates },
    })

    if (message.type === "tool_use" && (message.name === "Agent" || message.name === "Task") && message.toolUseId && message.id) {
      const previewMessages: AgentMessage[] = []
      for (const event of eventsByParent.get(message.toolUseId) ?? []) {
        previewMessages.push(...event.messages)
        updates[message.id] = { subagentPreviewMessages: [...previewMessages] }
        steps.push({
          messages: [],
          delayMs: 450,
          messageUpdates: { ...updates },
        })
      }
    }

    if (message.type === "tool_result" && message.toolUseId) {
      for (const agentMessage of messages) {
        if (
          agentMessage.type === "tool_use" &&
          (agentMessage.name === "Agent" || agentMessage.name === "Task") &&
          agentMessage.toolUseId === message.toolUseId &&
          agentMessage.id
        ) {
          delete updates[agentMessage.id]
          steps[steps.length - 1] = {
            ...steps[steps.length - 1],
            messageUpdates: { ...updates },
          }
          break
        }
      }
    }
  }

  return steps
}

// ============================================================================
// App
// ============================================================================

export function App() {
  const { t, i18n } = useTranslation()
  // Theme
  const [dark, setDark] = useState(true)
  const [language, setLanguage] = useState<ExampleLanguage>(i18n.language.startsWith("zh") ? "zh-CN" : "en")

  // Step player (event-driven state machine)
  const player = useStepPlayer(demoSteps)

  // Session info display
  const [sessionInfo, setSessionInfo] = useState(() =>
    t("example.session.default_info", "Demo · {{count}} steps", { count: demoSteps.length })
  )
  const [activeClaudeSession, setActiveClaudeSession] = useState<ClaudeCodeSessionManifestItem | null>(null)
  const [loadedClaudeSession, setLoadedClaudeSession] = useState<LoadedClaudeCodeSession | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null)

  // Speed index (maps to SPEEDS array)
  const [speedIdx, setSpeedIdx] = useState(1)

  // Derive agent busy state from messages (unresolved tool calls)
  const agentBusy = useMemo(() => isAgentBusy(player.messages), [player.messages])
  // Command Queue (event-driven, auto-dequeue when agent becomes idle)
  const commandQueue = useCommandQueue({
    id: "demo-session",
    enabled: true,
    isBusy: agentBusy,
    supportsSteer: false,
    onSend: async (content, attachments) => {
      // Dequeued message → inject as user message into the conversation
      player.injectMessage({
        id: `user-q-${Date.now()}`,
        type: "user",
        content,
        attachments,
        timestamp: Date.now(),
      })
    },
    onSteer: async () => {},
    onQueued: (item) => console.log("Queued:", item.content),
  })

  // Interactive state for standalone component demos
  const [selectedAgentId, setSelectedAgentId] = useState("coder")
  const [selectedModelId, setSelectedModelId] = useState("claude-opus-4-6")
  const [tools, setTools] = useState(demoTools)
  const [skills, setSkills] = useState(demoSkills)

  // Standalone component demos
  const [showPlan, setShowPlan] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showExecApproval, setShowExecApproval] = useState(false)
  const [showCommandQueue, setShowCommandQueue] = useState(false)
  const [standaloneQueueItems, setStandaloneQueueItems] = useState<CommandQueueItem[]>(demoCommandQueueItems)
  const [standaloneQueuePaused, setStandaloneQueuePaused] = useState(false)
  const [chatInputValue, setChatInputValue] = useState("")
  const [chatAppMode, setChatAppMode] = useState<ChatAppMode>("floating")
  const [renderedChatAppMode, setRenderedChatAppMode] = useState<ChatAppMode>("floating")
  const [selectedChatAppSessionTitle, setSelectedChatAppSessionTitle] = useState("Viben session")
  const [sidebarPage, setSidebarPage] = useState<ExampleSidebarPage>("player")
  const [introSidebarOpen, setIntroSidebarOpen] = useState(true)
  const [fullscreenChatWidth, setFullscreenChatWidth] = useState(() =>
    clampFullscreenChatWidth(readStoredFullscreenChatWidth(), EXAMPLE_SIDEBAR_EXPANDED_WIDTH)
  )
  const [fullscreenEntryGeometry, setFullscreenEntryGeometry] = useState<FullscreenEntryGeometry | null>(null)
  const isResizingChatRef = useRef(false)

  // ExecApproval cycling demo
  const [approvalDemoIdx, setApprovalDemoIdx] = useState(0)
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null)
  const approvalFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sidebar collapsible sections
  const [showToolsPanel, setShowToolsPanel] = useState(false)
  const [showSkillsPanel, setShowSkillsPanel] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(false)

  // Subagent sheet state
  const [sheetData, setSheetData] = useState<{
    title: string
    subagentType?: string
    messages: AgentMessage[]
    context?: SubagentOpenContext
  } | null>(null)

  // Refs
  const messageListRef = useRef<MessageListHandle>(null)
  const chatExampleShellRef = useRef<HTMLDivElement>(null)

  // Sync speed to player
  useEffect(() => {
    player.setSpeed(SPEEDS[speedIdx])
  }, [speedIdx, player.setSpeed])

  useEffect(() => {
    if (chatAppMode !== "full") {
      setRenderedChatAppMode(chatAppMode)
      return
    }

    const sidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH
    setFullscreenChatWidth((width) => clampFullscreenChatWidth(width, sidebarWidth))

    const timer = setTimeout(() => {
      setRenderedChatAppMode("full")
    }, FULLSCREEN_LAYOUT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [chatAppMode, introSidebarOpen])

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isResizingChatRef.current) return
      const sidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH
      const nextWidth = clampFullscreenChatWidth(event.clientX - sidebarWidth, sidebarWidth)
      setFullscreenChatWidth(nextWidth)
      storeFullscreenChatWidth(nextWidth)
    }

    const stopResize = () => {
      isResizingChatRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", stopResize)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", stopResize)
      stopResize()
    }
  }, [introSidebarOpen])

  // ===== Implicit user message routing =====
  // When a step emits user messages, route based on agent busy state:
  // - Agent busy (unresolved tool calls) → queue (shows in CommandQueuePanel)
  // - Agent idle → inject directly into message list
  // Queue auto-dequeues when tool_result arrives (agentBusy becomes false).
  useEffect(() => {
    if (player.pendingUserMessages.length === 0) return
    if (agentBusy) {
      for (const msg of player.pendingUserMessages) {
        commandQueue.send(msg.content || "", msg.attachments)
      }
    } else {
      for (const msg of player.pendingUserMessages) {
        player.injectMessage(msg)
      }
    }
    player.consumePendingUsers()
  }, [player.pendingUserMessages, agentBusy, commandQueue, player.injectMessage, player.consumePendingUsers])

  // ===== File Load =====
  const handleFileLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then(text => {
      const parsed = parseSessionJsonl(text)
      const steps = messagesToSteps(parsed)
      player.loadSteps(steps)
      setSessionInfo(t("example.session.file_info", "{{name}} · {{count}} steps", { name: file.name, count: steps.length }))
    })
  }, [player.loadSteps, t])

  // ===== Folder Load (with sub-agent support) =====
  const handleFolderLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    parseSessionFolder(Array.from(files)).then(({ messages, sessionName, subagentCount }) => {
      const steps = messagesToSteps(messages)
      player.loadSteps(steps)
      const subInfo = subagentCount > 0 ? t("example.session.folder_subagents", " · {{count}} sub-agents", { count: subagentCount }) : ""
      setSessionInfo(t("example.session.folder_info", "{{name}} · {{count}} steps", { name: sessionName, count: steps.length }) + subInfo)
    })
  }, [player.loadSteps, t])

  const formatStats = useCallback((stats: ParseStats, subagentCount?: number) => {
    const skipped = stats.skippedLines > 0 ? t("example.session.stats.skipped", " · {{count}} skipped", { count: stats.skippedLines }) : ""
    const subagents = subagentCount ? t("example.session.stats.subagents", " · {{count}} subagents", { count: subagentCount }) : ""
    return t("example.session.stats.summary", "{{messages}} messages · {{handled}}/{{total}} records handled", {
      messages: stats.emittedMessages,
      handled: stats.handledLines,
      total: stats.totalLines,
    }) + skipped + subagents
  }, [t])

  const handleClaudeSessionLoad = useCallback(async (session: ClaudeCodeSessionManifestItem) => {
    setIsLoadingSession(true)
    setSessionLoadError(null)
    setActiveClaudeSession(session)
    setLoadedClaudeSession(null)
    setSelectedChatAppSessionTitle(session.label)
    setSheetData(null)
    try {
      const loaded = await loadClaudeCodeSession(session)
      player.loadSteps(buildClaudeCodePlaybackSteps(loaded.messages, loaded.subagentPreviewEvents))
      setLoadedClaudeSession(loaded)
      setSessionInfo(`${loaded.label} · ${formatStats(loaded.stats, loaded.subagentCount)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSessionLoadError(message)
      setSessionInfo(t("example.session.load_failed", "Failed to load {{label}}", { label: session.label }))
    } finally {
      setIsLoadingSession(false)
    }
  }, [formatStats, player.loadSteps])

  const chatAppSessions = useMemo<ChatAppSessionItem[]>(
    () => CLAUDE_CODE_SESSIONS.map((session) => ({
      id: session.id,
      title: session.label,
      subtitle: `${session.id.slice(0, 8)}...jsonl`,
    })),
    []
  )

  const handleChatAppSessionSelect = useCallback((session: ChatAppSessionItem) => {
    setSelectedChatAppSessionTitle(session.title)
    const claudeSession = CLAUDE_CODE_SESSIONS.find((item) => item.id === session.id)
    if (claudeSession) {
      void handleClaudeSessionLoad(claudeSession)
    }
  }, [handleClaudeSessionLoad])

  const handleExpandSubagent = useCallback<ExpandSubagentHandler>((title, subagentType, messages, context) => {
    setSheetData({ title, subagentType, messages, context })
  }, [])

  const activeSheetLiveMessages = useMemo(() => {
    const toolUseId = sheetData?.context?.toolUseId
    if (!toolUseId) return undefined

    const parentMessage = player.messages.find((message) =>
      message.type === "tool_use" &&
      (message.name === "Agent" || message.name === "Task") &&
      message.toolUseId === toolUseId &&
      message.id
    )
    if (!parentMessage?.id) return undefined

    return player.messageUpdates[parentMessage.id]?.subagentPreviewMessages
  }, [player.messageUpdates, player.messages, sheetData?.context?.toolUseId])

  const loadSubagentDetails = useCallback(async (context: SubagentOpenContext) => {
    if (!context.subagentId || !activeClaudeSession) {
      throw new Error("No Claude Code subagent log is available for this card")
    }

    const loaded = await loadClaudeCodeSubagent(activeClaudeSession, context.subagentId)
    return {
      title: loaded.meta?.description,
      subagentType: loaded.meta?.agentType,
      messages: loaded.messages,
    }
  }, [activeClaudeSession])

  // ===== ChatInput handlers =====
  const handleSend = useCallback((content: string, attachments?: MessageAttachment[]) => {
    // Route through command queue: if busy, it queues; if idle, it sends immediately
    commandQueue.send(content, attachments)
  }, [commandQueue])

  const handleSlashCommand = useCallback((command: SlashCommand, selection: SlashCommandSelection) => {
    const suffix = selection.args ? ` ${selection.args}` : ""
    commandQueue.send(`/${command.name}${suffix}`)
  }, [commandQueue])

  const commandQueueInputRecall = useCommandQueueInputRecall({
    value: chatInputValue,
    onValueChange: setChatInputValue,
    recall: commandQueue.recall,
  })

  const handleToggleTool = useCallback((toolId: string) => {
    setTools(prev => prev.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t))
  }, [])

  const handleToggleSkill = useCallback((skillId: string) => {
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, enabled: !s.enabled } : s))
  }, [])

  const progress = player.totalSteps > 0 ? player.stepIndex / player.totalSteps : 0
  const isPlaying = player.status === "playing"
  const isAwaiting = player.isAwaiting
  const isChatAppFull = chatAppMode === "full"
  const isUiShowcasePage = sidebarPage === "ui-showcase"
  const hasStandaloneDemoOpen = showPlan || showQuestions || showEmojiPicker || showExecApproval || showCommandQueue
  const dismissComponentDemo = useCallback(() => {
    setShowPlan(false)
    setShowQuestions(false)
    setShowEmojiPicker(false)
    setShowExecApproval(false)
    setShowCommandQueue(false)
    setApprovalFeedback(null)
  }, [])
  const getFullscreenEntryGeometry = useCallback((targetWidth: number): FullscreenEntryGeometry | null => {
    const expandedElement = document.querySelector<HTMLElement>("[data-testid='expanded-overlay']")
    const shellElement = chatExampleShellRef.current
    if (!expandedElement || !shellElement) return null

    const expandedRect = expandedElement.getBoundingClientRect()
    const shellRect = shellElement.getBoundingClientRect()
    const sidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH
    const targetLeft = shellRect.left + sidebarWidth
    const targetTop = shellRect.top

    return {
      x: expandedRect.left - targetLeft,
      y: expandedRect.top - targetTop,
      width: expandedRect.width,
      height: expandedRect.height,
    }
  }, [introSidebarOpen])
  const handleChatAppModeChange = useCallback((nextMode: ChatAppMode) => {
    if (nextMode === "full") {
      const sidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH
      const nextWidth = clampFullscreenChatWidth(fullscreenChatWidth, sidebarWidth)
      setFullscreenChatWidth(nextWidth)
      storeFullscreenChatWidth(nextWidth)
      setFullscreenEntryGeometry(getFullscreenEntryGeometry(nextWidth))
    } else {
      setFullscreenEntryGeometry(null)
    }
    setChatAppMode(nextMode)
  }, [fullscreenChatWidth, getFullscreenEntryGeometry, introSidebarOpen])
  const handleLanguageChange = useCallback((nextLanguage: ExampleLanguage) => {
    setLanguage(nextLanguage)
    void i18n.changeLanguage(nextLanguage)
  }, [i18n])
  const sharedChatInputProps: ChatInputProps = {
    value: chatInputValue,
    onValueChange: setChatInputValue,
    onRecallQueuedInput: commandQueueInputRecall.onRecallQueuedInput,
    onSend: handleSend,
    onCancel: player.pause,
    isLoading: player.isStreaming,
    allowSendWhileLoading: true,
    placeholder: player.isStreaming ? t("example.chat_input.placeholder.queue", "Type to queue a message...") : t("example.chat_input.placeholder.default", "Type a message..."),
    layoutVariant: "expanded",
    showTopToolbar: true,
    showConfigBar: true,
    renderEmojiPicker: (props) => <EmojiPicker {...props} />,
    hideExecutorSelector: true,
    agents: demoAgents.map(a => ({ ...a, model: undefined })),
    selectedAgentId,
    onAgentChange: setSelectedAgentId,
    models: demoModels,
    selectedModelId,
    onModelChange: setSelectedModelId,
    tools,
    onToggleTool: handleToggleTool,
    enabledToolsCount: tools.filter(t => t.enabled).length,
    skills,
    onToggleSkill: handleToggleSkill,
    enabledSkillsCount: skills.filter(s => s.enabled).length,
    contextTokens: 20000,
    contextBreakdown: demoContextBreakdown,
    slashCommands: demoSlashCommands,
    onSlashCommand: handleSlashCommand,
  }
  const isComponentDemoActive = (id: UIShowcaseDemoId) => {
    switch (id) {
      case "plan":
        return showPlan
      case "question":
        return showQuestions
      case "emoji":
        return showEmojiPicker
      case "exec":
        return showExecApproval
      case "queue":
        return showCommandQueue
      default:
        return false
    }
  }
  const handleComponentDemoClick = (id: UIShowcaseDemoId) => {
    switch (id) {
      case "plan":
        setShowPlan(!showPlan)
        setShowQuestions(false)
        setShowEmojiPicker(false)
        setShowExecApproval(false)
        setShowCommandQueue(false)
        break
      case "question":
        setShowQuestions(!showQuestions)
        setShowPlan(false)
        setShowEmojiPicker(false)
        setShowExecApproval(false)
        setShowCommandQueue(false)
        break
      case "emoji":
        setShowEmojiPicker(!showEmojiPicker)
        setShowPlan(false)
        setShowQuestions(false)
        setShowExecApproval(false)
        setShowCommandQueue(false)
        break
      case "exec":
        setApprovalDemoIdx(showExecApproval ? (approvalDemoIdx + 1) % demoExecApprovals.length : 0)
        setApprovalFeedback(null)
        setShowExecApproval(!showExecApproval)
        setShowPlan(false)
        setShowQuestions(false)
        setShowEmojiPicker(false)
        setShowCommandQueue(false)
        break
      case "queue":
        setShowCommandQueue(!showCommandQueue)
        setShowPlan(false)
        setShowQuestions(false)
        setShowEmojiPicker(false)
        setShowExecApproval(false)
        break
      default:
        break
    }
  }
  const componentDemoItems = UI_DESIGN_SHOWCASE_DEMOS
    .filter((demo) => demo.interactive)
    .map((demo) => ({
      id: demo.id,
      label: t(demo.labelKey, demo.labelFallback),
      description: demo.id === "exec" && showExecApproval
        ? demoExecApprovals[approvalDemoIdx % demoExecApprovals.length].tool_call.kind || t("example.components.execute_fallback", "execute")
        : t(demo.descriptionKey, demo.descriptionFallback, demo.id === "queue" ? { count: standaloneQueueItems.length } : undefined),
      active: isComponentDemoActive(demo.id),
      onClick: () => handleComponentDemoClick(demo.id),
    }))
  const activeComponentDemo = componentDemoItems.find((item) => item.active)
  const introSidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH

  const componentDemoOverlay = hasStandaloneDemoOpen ? (
    <div className="pointer-events-auto absolute inset-0 z-40 flex min-h-0 items-center justify-center bg-background/80 p-5 backdrop-blur-sm">
      {showPlan ? (
        <ComponentDemoSurface
          title={activeComponentDemo?.label ?? t("example.components.plan_approval", "Plan approval")}
          onDismiss={dismissComponentDemo}
          dismissLabel={t("example.components.dismiss", "Dismiss component demo")}
        >
          <div className="w-full max-w-lg">
            <PlanApproval
              plan={demoPlan}
              isPending
              onApprove={() => setShowPlan(false)}
              onReject={() => setShowPlan(false)}
            />
          </div>
        </ComponentDemoSurface>
      ) : showQuestions ? (
        <ComponentDemoSurface
          title={activeComponentDemo?.label ?? t("example.components.question_input", "Question input")}
          onDismiss={dismissComponentDemo}
          dismissLabel={t("example.components.dismiss", "Dismiss component demo")}
        >
          <div className="w-full max-w-lg">
            <QuestionInput
              questions={demoQuestions}
              onSubmit={(answers) => {
                console.log("Answers:", answers)
                setShowQuestions(false)
              }}
            />
          </div>
        </ComponentDemoSurface>
      ) : showEmojiPicker ? (
        <ComponentDemoSurface
          title={activeComponentDemo?.label ?? t("example.components.emoji_picker", "Emoji picker")}
          onDismiss={dismissComponentDemo}
          dismissLabel={t("example.components.dismiss", "Dismiss component demo")}
        >
          <EmojiPicker
            onSelect={(emoji) => console.log("Selected:", emoji)}
          />
        </ComponentDemoSurface>
      ) : showExecApproval ? (
        <ComponentDemoSurface
          title={activeComponentDemo?.label ?? t("example.components.exec_approval", "Exec approval")}
          onDismiss={dismissComponentDemo}
          dismissLabel={t("example.components.dismiss", "Dismiss component demo")}
        >
          <div className="w-full max-w-lg space-y-3">
            <ExecApproval
              approval={demoExecApprovals[approvalDemoIdx % demoExecApprovals.length]}
              onDecision={(decision, feedback) => {
                console.log("Decision:", decision, "Feedback:", feedback)
                const label = decision === "allow_once"
                  ? t("example.exec_feedback.allowed_once", "Allowed")
                  : decision === "allow_always"
                    ? t("example.exec_feedback.allowed_always", "Always allowed")
                    : t("example.exec_feedback.rejected", "Rejected")
                setApprovalFeedback(label + (feedback ? ` - "${feedback}"` : ""))
                if (approvalFeedbackTimerRef.current) clearTimeout(approvalFeedbackTimerRef.current)
                approvalFeedbackTimerRef.current = setTimeout(() => {
                  setApprovalFeedback(null)
                  setApprovalDemoIdx(i => (i + 1) % demoExecApprovals.length)
                }, 1500)
              }}
            />
            {approvalFeedback && (
              <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-center text-sm text-muted-foreground animate-in fade-in duration-200">
                {approvalFeedback}
              </div>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              {t("example.exec_feedback.cycle_hint", "Click sidebar button to cycle through {{count}} scenarios ({{current}}/{{total}})", {
                count: demoExecApprovals.length,
                current: approvalDemoIdx + 1,
                total: demoExecApprovals.length,
              })}
            </p>
          </div>
        </ComponentDemoSurface>
      ) : showCommandQueue ? (
        <ComponentDemoSurface
          title={activeComponentDemo?.label ?? t("example.components.command_queue", "Command queue")}
          onDismiss={dismissComponentDemo}
          dismissLabel={t("example.components.dismiss", "Dismiss component demo")}
        >
          <div className="w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("example.command_queue.demo_title", "Command Queue Demo")}</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const newItem: CommandQueueItem = {
                      id: `cmd-${Date.now()}`,
                      content: t("example.command_queue.demo_task", "Task {{count}}: Run automated check", { count: standaloneQueueItems.length + 1 }),
                      createdAt: Date.now(),
                    }
                    setStandaloneQueueItems(prev => [...prev, newItem])
                  }}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-3" />
                  {t("example.command_queue.add_item", "Add item")}
                </button>
                <button
                  onClick={() => setStandaloneQueuePaused(p => !p)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground ${standaloneQueuePaused ? "text-amber-500" : "text-muted-foreground"}`}
                >
                  {standaloneQueuePaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                  {standaloneQueuePaused ? t("example.command_queue.resume", "Resume") : t("example.command_queue.pause", "Pause")}
                </button>
                <button
                  onClick={() => setStandaloneQueueItems([])}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  {t("example.command_queue.clear_all", "Clear all")}
                </button>
              </div>
            </div>
            <CommandQueuePanel
              items={standaloneQueueItems}
              isPaused={standaloneQueuePaused}
              onRemove={(id) => setStandaloneQueueItems(prev => prev.filter(it => it.id !== id))}
              onClear={() => setStandaloneQueueItems([])}
              onPause={() => setStandaloneQueuePaused(true)}
              onResume={() => setStandaloneQueuePaused(false)}
            />
            {standaloneQueueItems.length === 0 && (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                {t("example.command_queue.empty_hint", "Queue is empty. Click \"Add item\" to add demo items.")}
              </p>
            )}
          </div>
        </ComponentDemoSurface>
      ) : null}
    </div>
  ) : null

  const chatAppNode = (
    <ChatApp
      contained
      mode={renderedChatAppMode}
      title={selectedChatAppSessionTitle}
      messages={player.messages}
      messageUpdates={player.messageUpdates}
      isStreaming={player.isStreaming}
      playerStatus={player.status}
      pendingUserMessageCount={commandQueue.items.length}
      sessions={chatAppSessions}
      headerActions={{
        onSelectSession: handleChatAppSessionSelect,
        onCreateSession: () => handleChatAppModeChange("expanded"),
        onSettingsClick: () => setShowToolsPanel((open) => !open),
      }}
      inputValue={chatInputValue}
      onInputValueChange={setChatInputValue}
      messageListRef={messageListRef}
      onExpandSubagent={handleExpandSubagent}
      loadSubagentDetails={loadSubagentDetails}
      subagentSheet={sheetData ? {
        open: true,
        onClose: () => setSheetData(null),
        title: sheetData.title,
        subagentType: sheetData.subagentType,
        messages: sheetData.messages,
        liveMessages: activeSheetLiveMessages,
        context: sheetData.context,
      } : undefined}
      onModeChange={handleChatAppModeChange}
      onSend={handleSend}
      onCancel={player.pause}
      inputProps={sharedChatInputProps}
      fullscreenContent={(
        <ChatAppFullscreenPanel
          messages={player.messages}
          messageUpdates={player.messageUpdates}
          isStreaming={player.isStreaming}
          pendingPlan={player.pendingPlan}
          pendingApproval={player.pendingApproval}
          pendingQuestion={player.pendingQuestion}
          commandQueueItems={commandQueue.items}
          commandQueuePaused={commandQueue.isPaused}
          messageListRef={messageListRef}
          onExpandSubagent={handleExpandSubagent}
          onApprovePlan={() => {
            console.log("Plan approved")
            player.resolvePlan(true)
          }}
          onRejectPlan={() => {
            console.log("Plan rejected")
            player.resolvePlan(false)
          }}
          onApprovalDecision={(decision, feedback) => {
            console.log("Exec decision:", decision, "Feedback:", feedback)
            player.resolveApproval(decision, feedback)
          }}
          onAnswerQuestions={(answers) => {
            console.log("Answers:", answers)
            player.resolveQuestion(answers)
          }}
          onCommandQueueRemove={commandQueue.remove}
          onCommandQueueClear={commandQueue.clear}
          onCommandQueuePause={commandQueue.pause}
          onCommandQueueResume={commandQueue.resume}
          inputProps={sharedChatInputProps}
        />
      )}
    />
  )

  const demoPanelContent = (
    <div className={isChatAppFull ? "space-y-4" : "grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(360px,1fr)_minmax(320px,420px)]"}>
      {isUiShowcasePage && (
        <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-3 xl:col-span-3"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground">{t("example.ui_showcase.title", "UI design showcase")}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("example.ui_showcase.subtitle", "Display-only component states are grouped separately from the player.")}
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {t("example.components.available_count", "{{count}} demos", { count: UI_DESIGN_SHOWCASE_DEMOS.length })}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {UI_DESIGN_SHOWCASE_GROUPS.map((group) => (
              <div key={group.id} className="rounded-md border bg-background p-3">
                <SectionLabel>{t(group.labelKey, group.labelFallback)}</SectionLabel>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {t(group.descriptionKey, group.descriptionFallback)}
                </p>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {!isUiShowcasePage && (
      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-4"}>
        {!isChatAppFull && (
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">{t("example.title", "Chat component lab")}</h1>
            <p className="text-sm text-muted-foreground">{t("example.subtitle", "Replay sessions, inspect component states, and switch overlay modes from one control surface.")}</p>
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Upload className="size-3.5" />
            .jsonl
            <input type="file" accept=".jsonl" hidden onChange={handleFileLoad} />
          </label>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Upload className="size-3.5" />
            {t("example.load.session_folder", "Session Folder")}
            {/* @ts-expect-error webkitdirectory is non-standard but widely supported */}
            <input type="file" hidden webkitdirectory="true" onChange={handleFolderLoad} />
          </label>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">{sessionInfo}</p>
        {sessionLoadError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
            {sessionLoadError}
          </p>
        )}

        <div className="space-y-1.5">
          <SectionLabel>{t("example.sections.sessions", "Claude Code Sessions")}</SectionLabel>
          {CLAUDE_CODE_SESSIONS.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => handleClaudeSessionLoad(session)}
              disabled={isLoadingSession}
              className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                activeClaudeSession?.id === session.id
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              } disabled:cursor-wait disabled:opacity-60`}
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{session.label}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {t("example.session.meta", "{{count}} subagents · real JSONL", { count: session.subagents.length })}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <SectionLabel>{t("example.sections.chatAppMode", "Chat App Mode")}</SectionLabel>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            <ModeButton active={chatAppMode === "floating"} onClick={() => handleChatAppModeChange("floating")} title={t("example.chat_app_mode.float", "Float")}>
              <Bot className="size-3.5" />
            </ModeButton>
            <ModeButton active={chatAppMode === "compact"} onClick={() => handleChatAppModeChange("compact")} title={t("example.chat_app_mode.compact", "Compact")}>
              <MessageSquare className="size-3.5" />
            </ModeButton>
            <ModeButton active={chatAppMode === "expanded"} onClick={() => handleChatAppModeChange("expanded")} title={t("example.chat_app_mode.expanded", "Expanded")}>
              <ChevronDown className="size-3.5 rotate-180" />
            </ModeButton>
            <ModeButton active={chatAppMode === "full"} onClick={() => handleChatAppModeChange("full")} title={t("example.chat_app_mode.fullscreen", "Fullscreen")}>
              <Maximize2 className="size-3.5" />
            </ModeButton>
          </div>
        </div>

        {isAwaiting && (
          <div className="flex items-center justify-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1">
            <div className="size-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {t("example.status.waiting", "Waiting for user action")}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-1">
          <PlayerButton onClick={player.replay} title={t("example.player.replay", "Replay")}>
            <RotateCcw className="size-3.5" />
          </PlayerButton>
          <PlayerButton onClick={player.prev} title={t("example.player.previous", "Previous")}>
            <SkipBack className="size-3.5" />
          </PlayerButton>
          <button
            onClick={isPlaying ? player.pause : player.play}
            disabled={isAwaiting}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
          </button>
          <PlayerButton onClick={player.next} title={t("example.player.next", "Next")}>
            <SkipForward className="size-3.5" />
          </PlayerButton>
          <PlayerButton onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)} title={t("example.player.speed", "Speed")}>
            <Zap className="size-3.5" />
          </PlayerButton>
          <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {SPEEDS[speedIdx]}x
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="h-1 flex-1 cursor-pointer rounded-full bg-muted"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              player.seek((e.clientX - rect.left) / rect.width)
            }}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {player.stepIndex}/{player.totalSteps}
          </span>
        </div>
      </DashboardCard>
      )}

      {!isUiShowcasePage && player.messages.length > 0 && (
        <DashboardCard className={isChatAppFull ? "space-y-2" : "space-y-2 xl:col-start-2 xl:row-span-2"}>
          <SectionLabel>{t("example.sections.nowPlaying", "Now Playing")}</SectionLabel>
          <div className="max-h-[240px] overflow-x-auto overflow-y-auto rounded-lg border bg-muted/30 p-2 text-[10px] [&_*]:!text-[10px] [&_*]:!leading-relaxed">
            <JsonView data={player.messages[player.messages.length - 1]} style={darkStyles} />
          </div>
        </DashboardCard>
      )}

      {isUiShowcasePage && (
      <>
      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-3 xl:col-start-2"}>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{t("example.sections.components", "Components")}</SectionLabel>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {activeComponentDemo?.label ?? t("example.components.none_selected", "No demo selected")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {componentDemoItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-pressed={item.active}
              className={`min-h-14 rounded-md border px-2.5 py-2 text-left transition-colors ${
                item.active
                  ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="block truncate text-xs font-medium">{item.label}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <span>{t("example.components.available_count", "{{count}} demos", { count: componentDemoItems.length })}</span>
          <span>{t("example.components.active_hint", "Selection opens on the right")}</span>
        </div>
      </DashboardCard>

      <DashboardCard className={isChatAppFull ? "space-y-3" : "space-y-3 xl:col-start-1 xl:row-start-2"}>
        <SectionLabel>{t("example.ui_showcase.grouped_states", "Grouped UI states")}</SectionLabel>
        <div className="space-y-3">
          {UI_DESIGN_SHOWCASE_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-foreground">{t(group.labelKey, group.labelFallback)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {UI_DESIGN_SHOWCASE_DEMOS.filter((demo) => demo.groupId === group.id).length}
                </span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {UI_DESIGN_SHOWCASE_DEMOS.filter((demo) => demo.groupId === group.id).map((demo) => (
                  <div key={demo.id} className="rounded-md border bg-background p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{t(demo.labelKey, demo.labelFallback)}</span>
                      {demo.interactive && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          {t("example.ui_showcase.interactive", "Interactive")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {t(demo.descriptionKey, demo.descriptionFallback, demo.id === "queue" ? { count: standaloneQueueItems.length } : undefined)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {demo.stateLabels.map((stateLabel) => (
                        <span key={stateLabel} className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                          {stateLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <SectionLabel>{t("example.sections.modelIcons", "Model Icons")}</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {demoModels.map(m => (
            <div key={m.id} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {getModelIcon(m.id, { size: 12 })}
              <span>{m.name.split(" ").pop()}</span>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <SectionLabel>{t("example.sections.toolExecution", "ToolExecutionItem (4 states)")}</SectionLabel>
        <div className="space-y-1">
          <ToolExecutionItem name="Grep" displayName="Grep" input={{ pattern: "TODO" }} status="queued" compact />
          <ToolExecutionItem name="Bash" displayName="Bash" input={{ command: "pnpm test" }} status="executing" compact />
          <ToolExecutionItem name="Read" displayName="Read" input={{ file_path: "/src/App.tsx" }} output="File content here..." status="success" compact />
          <ToolExecutionItem name="Write" displayName="Write" input={{ file_path: "/src/utils.ts" }} output="Permission denied" status="error" isError compact />
        </div>
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <SectionLabel>{t("example.sections.configPanels", "Config Panels")}</SectionLabel>
        <div className="space-y-2">
          <CollapsibleSection
            title={t("example.config.tools", "Tools ({{enabled}}/{{total}})", { enabled: tools.filter(t => t.enabled).length, total: tools.length })}
            open={showToolsPanel}
            onToggle={() => setShowToolsPanel(!showToolsPanel)}
          >
            <ToolsConfigPopover
              tools={tools}
              onToggleTool={(toolId, _enabled) => handleToggleTool(toolId)}
              className="!w-full"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={t("example.config.skills", "Skills ({{enabled}}/{{total}})", { enabled: skills.filter(s => s.enabled).length, total: skills.length })}
            open={showSkillsPanel}
            onToggle={() => setShowSkillsPanel(!showSkillsPanel)}
          >
            <SkillsConfigPopover
              skills={skills}
              onToggleSkill={(skillId, _enabled) => handleToggleSkill(skillId)}
              className="!w-full"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={t("example.config.context_details", "Context Details")}
            open={showContextPanel}
            onToggle={() => setShowContextPanel(!showContextPanel)}
          >
            <ContextDetailsPopover
              breakdown={demoContextBreakdown}
              className="!w-full"
            />
          </CollapsibleSection>
        </div>
      </DashboardCard>
      </>
      )}
    </div>
  )

  return (
    <LayoutGroup id="viben-chat-overlay-demo">
    <div className="flex h-screen flex-col bg-background">
      <header data-testid="app-header" className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-5">
        <div className="min-w-0">
          <span className="block text-sm font-semibold">@viben/chat</span>
          <span className="block truncate text-xs text-muted-foreground">{t("example.kicker", "Control surface")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1" aria-label={t("example.language.label", "Language")}>
            <Languages className="ml-1 size-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                language.startsWith("en") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t("example.language.english", "English")}
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("zh-CN")}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                language.startsWith("zh") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {t("example.language.chinese", "中文")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={dark ? t("example.theme.light", "Light mode") : t("example.theme.dark", "Dark mode")}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      <div
        ref={chatExampleShellRef}
        className="relative flex min-h-0 flex-1 overflow-hidden bg-background"
        data-testid="chat-example-shell"
      >
        <aside
          data-testid="intro-sidebar"
          className="flex h-full shrink-0 flex-col overflow-hidden border-r bg-muted/20 transition-[width] duration-300"
          style={{ width: introSidebarWidth }}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            {introSidebarOpen ? (
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t("example.sidebar.title", "Example guide")}</span>
                <span className="block truncate text-xs text-muted-foreground">{t("example.sidebar.subtitle", "Project overview")}</span>
              </div>
            ) : (
              <span className="text-sm font-semibold">@</span>
            )}
            <button
              type="button"
              data-testid="intro-sidebar-toggle"
              aria-label={introSidebarOpen ? t("example.sidebar.collapse", "Collapse sidebar") : t("example.sidebar.expand", "Expand sidebar")}
              onClick={() => setIntroSidebarOpen((open) => !open)}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {introSidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {introSidebarOpen ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
                  <SidebarPageButton
                    active={sidebarPage === "player"}
                    onClick={() => {
                      setSidebarPage("player")
                      dismissComponentDemo()
                    }}
                  >
                    {t("example.sidebar.page.player", "Player")}
                  </SidebarPageButton>
                  <SidebarPageButton
                    active={sidebarPage === "ui-showcase"}
                    onClick={() => setSidebarPage("ui-showcase")}
                  >
                    {t("example.sidebar.page.ui_showcase", "UI design showcase")}
                  </SidebarPageButton>
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-base font-semibold text-foreground">{t("example.title", "Chat component lab")}</h1>
                  <p>{t("example.sidebar.description", "A focused playground for the @viben/chat message list, input, session playback, and overlay modes.")}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <SectionLabel>{t("example.sidebar.layout_title", "Layout")}</SectionLabel>
                  <p className="mt-2 text-xs leading-relaxed">
                    {t("example.sidebar.layout_description", "Floating modes live over the demo area. Fullscreen mode docks the ChatApp between this guide and the control cards.")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {isChatAppFull && (
          <motion.div
            data-testid="chat-app-stage"
            data-transition-origin="expanded-bottom-left"
            data-entry-geometry={fullscreenEntryGeometry ? "measured" : "fallback"}
            initial={getFullscreenEntryInitial(fullscreenEntryGeometry)}
            animate={{ opacity: 1, x: 0, y: 0, width: fullscreenChatWidth, height: "100%" }}
            exit={{ opacity: 0.96, x: fullscreenEntryGeometry?.x ?? -20, y: fullscreenEntryGeometry?.y ?? 24 }}
            transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
            className="relative h-full min-w-0 flex-none overflow-hidden border-r bg-background transition-[width] duration-300"
            style={{ width: fullscreenChatWidth }}
          >
            <div className="contents">
              {chatAppNode}
            </div>
          </motion.div>
        )}

        {isChatAppFull && (
          <button
            type="button"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("example.resize_chat_app", "Resize ChatApp width")}
            data-testid="fullscreen-chat-resize-handle"
            onPointerDown={(event) => {
              event.preventDefault()
              isResizingChatRef.current = true
              document.body.style.cursor = "col-resize"
              document.body.style.userSelect = "none"
            }}
            className="group relative z-30 flex h-full w-3 shrink-0 cursor-col-resize items-center justify-center border-r bg-background transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary/50" />
            <GripVertical className="relative size-3.5 text-muted-foreground" />
          </button>
        )}

        <main data-testid="right-demo-panel" className="relative min-w-0 flex-1 overflow-hidden bg-background">
          <div className="h-full overflow-y-auto p-5">
            {demoPanelContent}
          </div>
          {componentDemoOverlay}
          {!isChatAppFull && (
            <div
              data-testid="chat-app-stage"
              className="pointer-events-none absolute inset-0 z-20 overflow-visible bg-transparent"
            >
              <div className="pointer-events-auto">
                {chatAppNode}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    </LayoutGroup>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function Divider() {
  return <div className="mx-4 border-t" />
}

function DashboardCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border bg-card p-4 shadow-sm ${className ?? ""}`}>
      {children}
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </h3>
  )
}

function SidebarPageButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-8 rounded-md px-2 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function ComponentDemoSurface({
  title,
  dismissLabel,
  onDismiss,
  children,
}: {
  title: string
  dismissLabel: string
  onDismiss: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="relative w-full max-w-xl rounded-lg border bg-background p-4 shadow-xl" data-testid="component-demo-surface">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{title}</span>
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex justify-center">
          {children}
        </div>
      </div>
    </div>
  )
}

function PlayerButton({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-accent text-foreground"
          : "text-foreground/70 hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function ModeButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-8 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent/50"
      >
        {title}
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t p-3">
          {children}
        </div>
      )}
    </div>
  )
}
