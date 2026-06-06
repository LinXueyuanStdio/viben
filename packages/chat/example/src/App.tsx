import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import {
  ChatInput,
  MessageList,
  PlanApproval,
  QuestionInput,
  EmojiPicker,
  ToolsConfigPopover,
  SkillsConfigPopover,
  ContextDetailsPopover,
  ToolExecutionItem,
  CommandQueuePanel,
  ExecApproval,
  SubagentSheet,
  useCommandQueue,
  useCommandQueueInputRecall,
  getModelIcon,
} from "@viben/chat"
import type { AgentMessage, MessageListHandle, CommandQueueItem, MessageAttachment, SlashCommand, SlashCommandSelection } from "@viben/chat"
import type { ExpandSubagentHandler, SubagentOpenContext } from "@viben/chat"
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap, Upload, Sun, Moon, ChevronDown, Plus, Bot, MessageSquare, Maximize2 } from "lucide-react"
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
import { OverlayDemo } from "./overlay-demo"
import type { OverlayMode, OverlaySessionItem } from "./overlay-demo"

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
  // Theme
  const [dark, setDark] = useState(true)

  // Step player (event-driven state machine)
  const player = useStepPlayer(demoSteps)

  // Session info display
  const [sessionInfo, setSessionInfo] = useState(`Demo · ${demoSteps.length} steps`)
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
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("floating")

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

  // Sync speed to player
  useEffect(() => {
    player.setSpeed(SPEEDS[speedIdx])
  }, [speedIdx, player.setSpeed])

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

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
      setSessionInfo(`${file.name} · ${steps.length} steps`)
    })
  }, [player.loadSteps])

  // ===== Folder Load (with sub-agent support) =====
  const handleFolderLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    parseSessionFolder(Array.from(files)).then(({ messages, sessionName, subagentCount }) => {
      const steps = messagesToSteps(messages)
      player.loadSteps(steps)
      const subInfo = subagentCount > 0 ? ` · ${subagentCount} sub-agents` : ""
      setSessionInfo(`${sessionName} · ${steps.length} steps${subInfo}`)
    })
  }, [player.loadSteps])

  const formatStats = useCallback((stats: ParseStats, subagentCount?: number) => {
    const skipped = stats.skippedLines > 0 ? ` · ${stats.skippedLines} skipped` : ""
    const subagents = subagentCount ? ` · ${subagentCount} subagents` : ""
    return `${stats.emittedMessages} messages · ${stats.handledLines}/${stats.totalLines} records handled${skipped}${subagents}`
  }, [])

  const handleClaudeSessionLoad = useCallback(async (session: ClaudeCodeSessionManifestItem) => {
    setIsLoadingSession(true)
    setSessionLoadError(null)
    setActiveClaudeSession(session)
    setLoadedClaudeSession(null)
    setSheetData(null)
    try {
      const loaded = await loadClaudeCodeSession(session)
      player.loadSteps(buildClaudeCodePlaybackSteps(loaded.messages, loaded.subagentPreviewEvents))
      setLoadedClaudeSession(loaded)
      setSessionInfo(`${loaded.label} · ${formatStats(loaded.stats, loaded.subagentCount)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSessionLoadError(message)
      setSessionInfo(`Failed to load ${session.label}`)
    } finally {
      setIsLoadingSession(false)
    }
  }, [formatStats, player.loadSteps])

  const overlaySessions = useMemo<OverlaySessionItem[]>(
    () => CLAUDE_CODE_SESSIONS.map((session) => ({
      id: session.id,
      title: session.label,
      subtitle: `${session.id.slice(0, 8)}...jsonl`,
    })),
    []
  )

  const handleOverlaySessionSelect = useCallback((session: OverlaySessionItem) => {
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
  const isOverlayFull = overlayMode === "full"

  return (
    <LayoutGroup id="viben-chat-overlay-demo">
    <div className="flex h-screen flex-col">
      <SubagentSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        title={sheetData?.title || ""}
        subagentType={sheetData?.subagentType}
        messages={sheetData?.messages || []}
        liveMessages={activeSheetLiveMessages}
        context={sheetData?.context}
        loadSubagentDetails={loadSubagentDetails}
        onExpandSubagent={handleExpandSubagent}
      />
      <div className="relative flex flex-1 overflow-hidden">
        <aside className={`flex h-full w-[280px] shrink-0 flex-col border-r bg-card transition-transform duration-300 ${
          isOverlayFull
            ? ""
            : "absolute left-1/2 top-1/2 z-10 max-h-[min(760px,calc(100vh-3rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border shadow-2xl"
        }`}>
          {/* Sidebar header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">@viben/chat</span>
            <button
              onClick={() => setDark(!dark)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>

          {/* Sidebar scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Player section */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Upload className="size-3.5" />
                  .jsonl
                  <input type="file" accept=".jsonl" hidden onChange={handleFileLoad} />
                </label>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <Upload className="size-3.5" />
                  Session Folder
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
                <SectionLabel>Claude Code Sessions</SectionLabel>
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
                        {session.subagents.length} subagents · real JSONL
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <SectionLabel>Overlay Mode</SectionLabel>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
                  <ModeButton active={overlayMode === "floating"} onClick={() => setOverlayMode("floating")} title="Floating">
                    <Bot className="size-3.5" />
                  </ModeButton>
                  <ModeButton active={overlayMode === "compact"} onClick={() => setOverlayMode("compact")} title="Compact">
                    <MessageSquare className="size-3.5" />
                  </ModeButton>
                  <ModeButton active={overlayMode === "expanded"} onClick={() => setOverlayMode("expanded")} title="Expanded">
                    <ChevronDown className="size-3.5 rotate-180" />
                  </ModeButton>
                  <ModeButton active={overlayMode === "full"} onClick={() => setOverlayMode("full")} title="Full">
                    <Maximize2 className="size-3.5" />
                  </ModeButton>
                </div>
              </div>

              {/* Status badge */}
              {isAwaiting && (
                <div className="flex items-center justify-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1">
                  <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    Waiting for user action
                  </span>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-1">
                <PlayerButton onClick={player.replay} title="Replay">
                  <RotateCcw className="size-3.5" />
                </PlayerButton>
                <PlayerButton onClick={player.prev} title="Previous">
                  <SkipBack className="size-3.5" />
                </PlayerButton>
                <button
                  onClick={isPlaying ? player.pause : player.play}
                  disabled={isAwaiting}
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
                </button>
                <PlayerButton onClick={player.next} title="Next">
                  <SkipForward className="size-3.5" />
                </PlayerButton>
                <PlayerButton onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)} title="Speed">
                  <Zap className="size-3.5" />
                </PlayerButton>
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {SPEEDS[speedIdx]}x
                </span>
              </div>

              {/* Progress bar */}
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
            </div>

            {/* Now Playing - current message raw JSON with syntax highlighting */}
            {player.messages.length > 0 && (
              <>
                <Divider />
                <div className="px-3 py-3 space-y-2">
                  <SectionLabel>Now Playing</SectionLabel>
                  <div className="rounded-lg border bg-muted/30 p-2 overflow-x-auto overflow-y-auto max-h-[240px] text-[10px] [&_*]:!text-[10px] [&_*]:!leading-relaxed">
                    <JsonView data={player.messages[player.messages.length - 1]} style={darkStyles} />
                  </div>
                </div>
              </>
            )}

            <Divider />

            {/* Component Demos */}
            <div className="px-4 py-4 space-y-1.5">
              <SectionLabel>Components</SectionLabel>
              <NavButton active={showPlan} onClick={() => { setShowPlan(!showPlan); setShowQuestions(false); setShowEmojiPicker(false); setShowExecApproval(false); setShowCommandQueue(false) }}>
                PlanApproval
              </NavButton>
              <NavButton active={showQuestions} onClick={() => { setShowQuestions(!showQuestions); setShowPlan(false); setShowEmojiPicker(false); setShowExecApproval(false); setShowCommandQueue(false) }}>
                QuestionInput
              </NavButton>
              <NavButton active={showEmojiPicker} onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowPlan(false); setShowQuestions(false); setShowExecApproval(false); setShowCommandQueue(false) }}>
                EmojiPicker
              </NavButton>
              <NavButton active={showExecApproval} onClick={() => {
                if (!showExecApproval) {
                  setApprovalDemoIdx(0)
                  setApprovalFeedback(null)
                } else {
                  setApprovalDemoIdx(i => (i + 1) % demoExecApprovals.length)
                  setApprovalFeedback(null)
                }
                setShowExecApproval(true); setShowPlan(false); setShowQuestions(false); setShowEmojiPicker(false); setShowCommandQueue(false)
              }}>
                ExecApproval
                {showExecApproval && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {demoExecApprovals[approvalDemoIdx % demoExecApprovals.length].tool_call.kind || "execute"}
                  </span>
                )}
              </NavButton>
              <NavButton active={showCommandQueue} onClick={() => { setShowCommandQueue(!showCommandQueue); setShowPlan(false); setShowQuestions(false); setShowEmojiPicker(false); setShowExecApproval(false) }}>
                CommandQueue
              </NavButton>
            </div>

            <Divider />

            {/* Model Icons */}
            <div className="px-4 py-4 space-y-3">
              <SectionLabel>Model Icons</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {demoModels.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {getModelIcon(m.id, { size: 12 })}
                    <span>{m.name.split(" ").pop()}</span>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            {/* ToolExecutionItem */}
            <div className="px-4 py-4 space-y-3">
              <SectionLabel>ToolExecutionItem (4 states)</SectionLabel>
              <div className="space-y-1">
                <ToolExecutionItem name="Grep" displayName="Grep" input={{ pattern: "TODO" }} status="queued" compact />
                <ToolExecutionItem name="Bash" displayName="Bash" input={{ command: "pnpm test" }} status="executing" compact />
                <ToolExecutionItem name="Read" displayName="Read" input={{ file_path: "/src/App.tsx" }} output="File content here..." status="success" compact />
                <ToolExecutionItem name="Write" displayName="Write" input={{ file_path: "/src/utils.ts" }} output="Permission denied" status="error" isError compact />
              </div>
            </div>

            <Divider />

            {/* Config Panels */}
            <div className="px-4 py-4 space-y-3">
              <SectionLabel>Config Panels</SectionLabel>
              <div className="space-y-2">
                <CollapsibleSection
                  title={`Tools (${tools.filter(t => t.enabled).length}/${tools.length})`}
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
                  title={`Skills (${skills.filter(s => s.enabled).length}/${skills.length})`}
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
                  title="Context Details"
                  open={showContextPanel}
                  onToggle={() => setShowContextPanel(!showContextPanel)}
                >
                  <ContextDetailsPopover
                    breakdown={demoContextBreakdown}
                    className="!w-full"
                  />
                </CollapsibleSection>
              </div>
            </div>
          </div>
        </aside>

        {/* ===== Chat Column ===== */}
        <div className={`relative flex min-w-0 flex-col bg-background transition-[width,opacity,transform] duration-300 ${
          isOverlayFull ? "w-0 flex-1 overflow-hidden opacity-100" : "absolute inset-0 overflow-visible opacity-100"
        }`}>
          {/* Content area */}
          <div className="flex min-h-0 flex-1 flex-col">
            {showPlan ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="w-full max-w-lg">
                  <PlanApproval
                    plan={demoPlan}
                    isPending
                    onApprove={() => setShowPlan(false)}
                    onReject={() => setShowPlan(false)}
                  />
                </div>
              </div>
            ) : showQuestions ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="w-full max-w-lg">
                  <QuestionInput
                    questions={demoQuestions}
                    onSubmit={(answers) => {
                      console.log("Answers:", answers)
                      setShowQuestions(false)
                    }}
                  />
                </div>
              </div>
            ) : showEmojiPicker ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmojiPicker
                  onSelect={(emoji) => console.log("Selected:", emoji)}
                />
              </div>
            ) : showExecApproval ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="w-full max-w-lg space-y-3">
                  <ExecApproval
                    approval={demoExecApprovals[approvalDemoIdx % demoExecApprovals.length]}
                    onDecision={(decision, feedback) => {
                      console.log("Decision:", decision, "Feedback:", feedback)
                      const label = decision === "allow_once" ? "Allowed" : decision === "allow_always" ? "Always allowed" : "Rejected"
                      setApprovalFeedback(label + (feedback ? ` — "${feedback}"` : ""))
                      if (approvalFeedbackTimerRef.current) clearTimeout(approvalFeedbackTimerRef.current)
                      approvalFeedbackTimerRef.current = setTimeout(() => {
                        setApprovalFeedback(null)
                        setApprovalDemoIdx(i => (i + 1) % demoExecApprovals.length)
                      }, 1500)
                    }}
                  />
                  {approvalFeedback && (
                    <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-sm text-muted-foreground text-center animate-in fade-in duration-200">
                      {approvalFeedback}
                    </div>
                  )}
                  <p className="text-center text-[11px] text-muted-foreground">
                    Click sidebar button to cycle through {demoExecApprovals.length} scenarios ({approvalDemoIdx + 1}/{demoExecApprovals.length})
                  </p>
                </div>
              </div>
            ) : showCommandQueue ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="w-full max-w-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Command Queue Demo</h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const newItem: CommandQueueItem = {
                            id: `cmd-${Date.now()}`,
                            content: `Task ${standaloneQueueItems.length + 1}: Run automated check`,
                            createdAt: Date.now(),
                          }
                          setStandaloneQueueItems(prev => [...prev, newItem])
                        }}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="size-3" />
                        Add item
                      </button>
                      <button
                        onClick={() => setStandaloneQueuePaused(p => !p)}
                        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground ${standaloneQueuePaused ? "text-amber-500" : "text-muted-foreground"}`}
                      >
                        {standaloneQueuePaused ? <Play className="size-3" /> : <Pause className="size-3" />}
                        {standaloneQueuePaused ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={() => setStandaloneQueueItems([])}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Clear all
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
                    <p className="text-center text-[11px] text-muted-foreground py-4">
                      Queue is empty. Click "Add item" to add demo items.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <MessageList
                  ref={messageListRef}
                  messages={player.messages}
                  messageUpdates={player.messageUpdates}
                  isStreaming={player.isStreaming}
                  pendingPlan={player.pendingPlan}
                  welcomeTitle="@viben/chat Session Player"
                  welcomeDescription="Press Play to replay the demo session, or load a .jsonl file."
                  maxMessageWidth="760px"
                  onExpandSubagent={handleExpandSubagent}
                />
                {/* Inline Command Queue (shows when items are queued) */}
                {commandQueue.items.length > 0 && (
                  <div className="mx-auto w-full max-w-[760px] px-4 pb-2">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Will send when agent finishes...</span>
                    </div>
                    <CommandQueuePanel
                      items={commandQueue.items}
                      isPaused={commandQueue.isPaused}
                      onRemove={commandQueue.remove}
                      onClear={commandQueue.clear}
                      onPause={commandQueue.pause}
                      onResume={commandQueue.resume}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Input Area — animated transition between ChatInput / ExecApproval / QuestionInput */}
          <div className="border-t border-border px-4 py-2">
            <div className="mx-auto max-w-[760px]">
              <AnimatePresence mode="wait">
                {player.pendingPlan ? (
                  <PlanApproval
                    key="plan"
                    plan={player.pendingPlan}
                    isPending
                    onApprove={() => {
                      console.log("Plan approved")
                      player.resolvePlan(true)
                    }}
                    onReject={() => {
                      console.log("Plan rejected")
                      player.resolvePlan(false)
                    }}
                  />
                ) : player.pendingApproval ? (
                  <ExecApproval
                    key="approval"
                    approval={player.pendingApproval}
                    onDecision={(decision, feedback) => {
                      console.log("Exec decision:", decision, "Feedback:", feedback)
                      player.resolveApproval(decision, feedback)
                    }}
                    enableKeyboard
                  />
                ) : player.pendingQuestion ? (
                  <QuestionInput
                    key="question"
                    questions={player.pendingQuestion}
                    onSubmit={(answers) => {
                      console.log("Answers:", answers)
                      player.resolveQuestion(answers)
                    }}
                  />
                ) : (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChatInput
                      value={chatInputValue}
                      onValueChange={setChatInputValue}
                      onRecallQueuedInput={commandQueueInputRecall.onRecallQueuedInput}
                      onSend={handleSend}
                      onCancel={player.pause}
                      isLoading={player.isStreaming}
                      allowSendWhileLoading
                      placeholder={player.isStreaming ? "Type to queue a message..." : "Type a message..."}
                      layoutVariant="expanded"
                      showTopToolbar
                      showConfigBar
                      renderEmojiPicker={(props) => <EmojiPicker {...props} />}
                      hideExecutorSelector
                      agents={demoAgents.map(a => ({ ...a, model: undefined }))}
                      selectedAgentId={selectedAgentId}
                      onAgentChange={setSelectedAgentId}
                      models={demoModels}
                      selectedModelId={selectedModelId}
                      onModelChange={setSelectedModelId}
                      tools={tools}
                      onToggleTool={handleToggleTool}
                      enabledToolsCount={tools.filter(t => t.enabled).length}
                      skills={skills}
                      onToggleSkill={handleToggleSkill}
                      enabledSkillsCount={skills.filter(s => s.enabled).length}
                      contextTokens={20000}
                      contextBreakdown={demoContextBreakdown}
                      slashCommands={demoSlashCommands}
                      onSlashCommand={handleSlashCommand}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <OverlayDemo
            contained
            mode={overlayMode}
            messages={player.messages}
            isStreaming={player.isStreaming}
            playerStatus={player.status}
            pendingUserMessageCount={commandQueue.items.length}
            sessions={overlaySessions}
            headerActions={{
              onSelectSession: handleOverlaySessionSelect,
              onCreateSession: () => setOverlayMode("expanded"),
              onSettingsClick: () => setShowToolsPanel((open) => !open),
            }}
            inputValue={chatInputValue}
            onInputValueChange={setChatInputValue}
            onModeChange={setOverlayMode}
            onSend={handleSend}
            onCancel={player.pause}
          />
        </div>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </h3>
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
