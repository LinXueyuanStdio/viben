import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { LayoutGroup } from "framer-motion"
import { useTranslation } from "react-i18next"
import {
  EmojiPicker,
  useCommandQueue,
  useCommandQueueInputRecall,
} from "@viben/chat"
import type { AgentMessage, ChatInputProps, MessageListHandle, CommandQueueItem, MessageAttachment, SlashCommand, SlashCommandSelection } from "@viben/chat"
import type { ExpandSubagentHandler, SubagentOpenContext } from "@viben/chat"
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap, Sun, Moon, ChevronDown, Bot, MessageSquare, Maximize2, Languages, GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import {
  demoAgents,
  demoModels,
  demoTools,
  demoSkills,
  demoSlashCommands,
  demoContextBreakdown,
  demoCommandQueueItems,
  demoBackgroundTaskItems,
  demoExecApprovals,
  demoPlan,
  demoQuestions,
  demoTodoListMessages,
  parseSessionJsonl,
  parseSessionFolder,
} from "./demo-data"
import { demoSteps } from "./demo-steps"
import { useStepPlayer } from "./use-step-player"
import {
  CHAT_APP_COMPACT_GREETING_COUNT,
  CHAT_APP_COMPACT_GREETING_FALLBACKS,
  CLAUDE_CODE_SESSIONS,
  loadClaudeCodeSession,
  loadClaudeCodeSubagent,
  type ClaudeCodeSessionManifestItem,
  type LoadedClaudeCodeSession,
  type ParseStats,
} from "./claudecode-log-provider"
import { ChatApp, ChatAppFullscreenPanel } from "./ChatApp"
import type { ChatAppMode, ChatAppSessionItem, CompactActivitySummary } from "./ChatApp"
import { PlayerButton, ModeButton, SectionLabel, SidebarPageButton } from "./components/common"
import { PlayerPage } from "./pages/PlayerPage"
import { UIShowCasesPage, UIShowcaseDemoOverlay } from "./pages/UIShowCasesPage"
import { UI_DESIGN_SHOWCASE_DEMOS } from "./UIDesignShowcaseData"
import type { UIShowcaseDemoId } from "./UIDesignShowcaseData"
import {
  EXAMPLE_SIDEBAR_COLLAPSED_WIDTH,
  EXAMPLE_SIDEBAR_EXPANDED_WIDTH,
  FULLSCREEN_LAYOUT_DELAY_MS,
  SPEEDS,
  buildClaudeCodePlaybackSteps,
  clampFullscreenChatWidth,
  isAgentBusy,
  messagesToSteps,
  readStoredFullscreenChatWidth,
  storeFullscreenChatWidth,
} from "./hooks/app-utils"
import type { ExampleLanguage, ExampleSidebarPage, FullscreenEntryGeometry } from "./hooks/app-utils"

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
  const [fullscreenDockVisible, setFullscreenDockVisible] = useState(false)
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
  const fullscreenModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync speed to player
  useEffect(() => {
    player.setSpeed(SPEEDS[speedIdx])
  }, [speedIdx, player.setSpeed])

  useEffect(() => {
    if (chatAppMode !== "full") {
      setRenderedChatAppMode(chatAppMode)
      setFullscreenDockVisible(false)
      return
    }

    const sidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH
    setFullscreenChatWidth((width) => clampFullscreenChatWidth(width, sidebarWidth))
    setRenderedChatAppMode("full")
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

  useEffect(() => {
    return () => {
      if (fullscreenModeTimerRef.current) {
        clearTimeout(fullscreenModeTimerRef.current)
      }
    }
  }, [])

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
  const shouldShowFullscreenDock = isChatAppFull || fullscreenDockVisible
  const isUiShowcasePage = sidebarPage === "ui-showcase"
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
    const targetHeight = Math.max(1, shellRect.height)

    return {
      x: expandedRect.left - targetLeft,
      y: expandedRect.top - targetTop,
      width: Math.min(expandedRect.width, targetWidth),
      height: Math.min(expandedRect.height, targetHeight),
    }
  }, [introSidebarOpen])
  const handleChatAppModeChange = useCallback((nextMode: ChatAppMode) => {
    if (fullscreenModeTimerRef.current) {
      clearTimeout(fullscreenModeTimerRef.current)
      fullscreenModeTimerRef.current = null
    }

    if (nextMode === "full") {
      const sidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH
      const nextWidth = clampFullscreenChatWidth(fullscreenChatWidth, sidebarWidth)
      setFullscreenChatWidth(nextWidth)
      storeFullscreenChatWidth(nextWidth)
      setFullscreenEntryGeometry(getFullscreenEntryGeometry(nextWidth))
      setFullscreenDockVisible(true)
      fullscreenModeTimerRef.current = setTimeout(() => {
        setRenderedChatAppMode("full")
        setChatAppMode("full")
        setFullscreenDockVisible(false)
        fullscreenModeTimerRef.current = null
      }, FULLSCREEN_LAYOUT_DELAY_MS)
      return
    } else {
      setFullscreenDockVisible(false)
      setFullscreenEntryGeometry(null)
      setRenderedChatAppMode(nextMode)
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
  const compactIdleGreeting = useMemo(() => {
    const index = Math.min(CHAT_APP_COMPACT_GREETING_COUNT - 1, Math.floor(Math.random() * CHAT_APP_COMPACT_GREETING_COUNT))
    return t(`chat_app.greetings.${index}`, CHAT_APP_COMPACT_GREETING_FALLBACKS[index])
  }, [t])
  const compactActivity = useMemo<CompactActivitySummary>(() => {
    const formatToolPath = (value: unknown): string => {
      if (!value) return "file"
      const raw = String(value)
      const packageIndex = raw.indexOf("packages/")
      return packageIndex >= 0 ? raw.slice(packageIndex) : raw.split("/").filter(Boolean).slice(-3).join("/") || "file"
    }
    const truncate = (value: string, maxLength: number): string =>
      value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
    const latest = [...player.messages].reverse().find((message) =>
      (message.type === "text" || message.type === "thinking" || message.type === "tool_use" || message.type === "error") &&
      (message.content || message.message || message.name)
    )

    if (!latest) return { kind: "plain", text: compactIdleGreeting }
    if (latest.type === "thinking") {
      return { kind: "thinking", text: latest.content || t("chat_app.activity.thinking", "Thinking...") }
    }
    if (latest.type === "error") {
      return { kind: "plain", text: latest.message || latest.content || t("chat_app.activity.needs_attention", "Something needs attention.") }
    }
    if (latest.type !== "tool_use") {
      return { kind: "plain", text: latest.content || latest.message || t("chat_app.activity.working", "Working...") }
    }

    const input = latest.input
    switch (latest.name) {
      case "Bash": {
        const command = input?.command ? truncate(String(input.command).trim(), 72) : ""
        return {
          kind: "plain",
          text: command
            ? t("chat_app.activity.running_command_named", "Running {{command}}", { command })
            : t("chat_app.activity.running_command", "Running command..."),
        }
      }
      case "Read":
        return { kind: "plain", text: t("chat_app.activity.reading_file", "Reading {{file}}...", { file: formatToolPath(input?.file_path) }) }
      case "Write":
        return { kind: "plain", text: t("chat_app.activity.writing_file", "Writing {{file}}...", { file: formatToolPath(input?.file_path) }) }
      case "Edit":
      case "MultiEdit":
        return { kind: "plain", text: t("chat_app.activity.editing_file", "Editing {{file}}...", { file: formatToolPath(input?.file_path) }) }
      case "Grep": {
        const pattern = input?.pattern ? truncate(String(input.pattern), 48) : ""
        return {
          kind: "plain",
          text: pattern
            ? t("chat_app.activity.searching_for", "Searching for \"{{pattern}}\"...", { pattern })
            : t("chat_app.activity.searching_workspace", "Searching workspace..."),
        }
      }
      case "Glob": {
        const pattern = input?.pattern ? truncate(String(input.pattern), 48) : ""
        return {
          kind: "plain",
          text: pattern
            ? t("chat_app.activity.finding", "Finding {{pattern}}...", { pattern })
            : t("chat_app.activity.finding_files", "Finding files..."),
        }
      }
      case "WebSearch":
        return { kind: "plain", text: t("chat_app.activity.searching_web", "Searching the web...") }
      case "WebFetch":
        return { kind: "plain", text: t("chat_app.activity.fetching_page", "Fetching page content...") }
      case "Task":
      case "Agent":
        return { kind: "plain", text: t("chat_app.activity.running_agent_task", "Running a delegated agent task...") }
      default:
        return {
          kind: "plain",
          text: latest.name
            ? t("chat_app.activity.running_tool", "Running {{name}}...", { name: latest.name })
            : t("chat_app.activity.working", "Working..."),
        }
    }
  }, [compactIdleGreeting, player.messages, t])
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
  const activeDemoId = activeComponentDemo?.id ?? null
  const introSidebarWidth = introSidebarOpen ? EXAMPLE_SIDEBAR_EXPANDED_WIDTH : EXAMPLE_SIDEBAR_COLLAPSED_WIDTH

  const componentDemoOverlay = (
    <UIShowcaseDemoOverlay
      activeDemoId={activeDemoId}
      activeComponentLabel={activeComponentDemo?.label ?? null}
      plan={demoPlan}
      questions={demoQuestions}
      execApprovals={demoExecApprovals}
      todoListMessages={demoTodoListMessages}
      backgroundTaskItems={demoBackgroundTaskItems}
      approvalDemoIdx={approvalDemoIdx}
      approvalFeedback={approvalFeedback}
      standaloneQueueItems={standaloneQueueItems}
      standaloneQueuePaused={standaloneQueuePaused}
      onDismiss={dismissComponentDemo}
      onPlanApprove={() => setShowPlan(false)}
      onPlanReject={() => setShowPlan(false)}
      onQuestionsSubmit={(answers) => {
        console.log("Answers:", answers)
        setShowQuestions(false)
      }}
      onEmojiSelect={(emoji) => console.log("Selected:", emoji)}
      onExecDecision={(decision, feedback) => {
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
      onAddQueueItem={() => {
        const newItem: CommandQueueItem = {
          id: `cmd-${Date.now()}`,
          content: t("example.command_queue.demo_task", "Task {{count}}: Run automated check", { count: standaloneQueueItems.length + 1 }),
          createdAt: Date.now(),
        }
        setStandaloneQueueItems(prev => [...prev, newItem])
      }}
      onToggleQueuePaused={() => setStandaloneQueuePaused(p => !p)}
      onClearQueue={() => setStandaloneQueueItems([])}
      onRemoveQueueItem={(id) => setStandaloneQueueItems(prev => prev.filter(it => it.id !== id))}
      onPauseQueue={() => setStandaloneQueuePaused(true)}
      onResumeQueue={() => setStandaloneQueuePaused(false)}
    />
  )

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
      compactActivity={compactActivity}
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
      {isUiShowcasePage ? (
        <UIShowCasesPage
          isChatAppFull={isChatAppFull}
          activeComponentLabel={activeComponentDemo?.label ?? null}
          componentDemoItems={componentDemoItems}
          standaloneQueueItems={standaloneQueueItems}
          models={demoModels}
          tools={tools}
          skills={skills}
          contextBreakdown={demoContextBreakdown}
          showToolsPanel={showToolsPanel}
          showSkillsPanel={showSkillsPanel}
          showContextPanel={showContextPanel}
          onToggleToolsPanel={() => setShowToolsPanel(!showToolsPanel)}
          onToggleSkillsPanel={() => setShowSkillsPanel(!showSkillsPanel)}
          onToggleContextPanel={() => setShowContextPanel(!showContextPanel)}
          onToggleTool={handleToggleTool}
          onToggleSkill={handleToggleSkill}
        />
      ) : (
        <PlayerPage
          isChatAppFull={isChatAppFull}
          messages={player.messages}
          sessionInfo={sessionInfo}
          sessionLoadError={sessionLoadError}
          sessions={CLAUDE_CODE_SESSIONS}
          activeSession={activeClaudeSession}
          isLoadingSession={isLoadingSession}
          progress={progress}
          stepIndex={player.stepIndex}
          totalSteps={player.totalSteps}
          speedLabel={`${SPEEDS[speedIdx]}x`}
          isPlaying={isPlaying}
          isAwaiting={isAwaiting}
          renderChatAppModeControls={() => (
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
          )}
          renderPlayerControls={() => (
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
          )}
          onFileLoad={handleFileLoad}
          onFolderLoad={handleFolderLoad}
          onSessionLoad={handleClaudeSessionLoad}
          onSeek={player.seek}
        />
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

        {shouldShowFullscreenDock && (
          <div
            data-testid={isChatAppFull ? "chat-app-stage" : "fullscreen-chat-dock"}
            data-transition-origin="expanded-bottom-left"
            data-entry-geometry={fullscreenEntryGeometry ? "measured" : "fallback"}
            className="relative h-full min-w-0 flex-none overflow-hidden border-r bg-background transition-[width] duration-300"
            style={{ width: fullscreenChatWidth }}
          >
            {isChatAppFull ? chatAppNode : null}
          </div>
        )}

        {shouldShowFullscreenDock && (
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
        </main>

        {!isChatAppFull && (
          <div
            data-testid="chat-app-stage"
            className="pointer-events-none absolute inset-y-0 right-0 z-40 overflow-visible bg-transparent"
            style={{ left: introSidebarWidth }}
          >
            <div className="pointer-events-auto">
              {chatAppNode}
            </div>
          </div>
        )}
      </div>
    </div>
    </LayoutGroup>
  )
}
