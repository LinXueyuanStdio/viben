import { useState, useCallback, useRef, useEffect } from "react"
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
  useCommandQueue,
  getModelIcon,
} from "@viben/chat"
import type { AgentMessage, MessageListHandle, CommandQueueItem, MessageAttachment } from "@viben/chat"
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap, Upload, Sun, Moon, ChevronDown, Plus } from "lucide-react"
import {
  demoPlan,
  demoQuestions,
  demoAgents,
  demoModels,
  demoTools,
  demoSkills,
  demoContextBreakdown,
  demoCommandQueueItems,
  demoExecApprovals,
  parseSessionJsonl,
} from "./demo-data"
import { demoSteps } from "./demo-steps"
import { useStepPlayer } from "./use-step-player"
import type { DemoStep } from "./use-step-player"

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

  // Speed index (maps to SPEEDS array)
  const [speedIdx, setSpeedIdx] = useState(1)

  // Command Queue (event-driven, auto-dequeue when idle)
  const commandQueue = useCommandQueue({
    id: "demo-session",
    enabled: true,
    isBusy: player.isStreaming || player.isAwaiting,
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

  // ExecApproval cycling demo
  const [approvalDemoIdx, setApprovalDemoIdx] = useState(0)
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null)
  const approvalFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sidebar collapsible sections
  const [showToolsPanel, setShowToolsPanel] = useState(false)
  const [showSkillsPanel, setShowSkillsPanel] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(false)

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
  // When a step emits user messages, the reducer sets shouldQueuePending to indicate
  // whether they should go to the command queue (agent was outputting) or directly to list.
  useEffect(() => {
    if (player.pendingUserMessages.length === 0) return
    if (player.shouldQueuePending) {
      // Route to command queue — items show in CommandQueuePanel.
      // If waitingForDrain is also true, isStreaming=false and queue will auto-dequeue.
      for (const msg of player.pendingUserMessages) {
        commandQueue.send(msg.content || "", msg.attachments)
      }
    } else {
      // No queue routing needed — inject directly into message list
      for (const msg of player.pendingUserMessages) {
        player.injectMessage(msg)
      }
    }
    player.consumePendingUsers()
  }, [player.pendingUserMessages, player.shouldQueuePending, commandQueue, player.injectMessage, player.consumePendingUsers])

  // ===== Queue drain completion =====
  // When queue empties while player is waiting for drain, unblock the player.
  useEffect(() => {
    if (player.waitingForDrain && commandQueue.items.length === 0) {
      player.completeDrain()
    }
  }, [player.waitingForDrain, commandQueue.items.length, player.completeDrain])

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

  // ===== ChatInput handlers =====
  const handleSend = useCallback((content: string, attachments?: MessageAttachment[]) => {
    // Route through command queue: if busy, it queues; if idle, it sends immediately
    commandQueue.send(content, attachments)
  }, [commandQueue])

  const handleToggleTool = useCallback((toolId: string) => {
    setTools(prev => prev.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t))
  }, [])

  const handleToggleSkill = useCallback((skillId: string) => {
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, enabled: !s.enabled } : s))
  }, [])

  const progress = player.totalSteps > 0 ? player.stepIndex / player.totalSteps : 0
  const isPlaying = player.status === "playing"
  const isAwaiting = player.isAwaiting

  return (
    <div className="flex h-screen flex-col">
      {/* ===== Main row ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* ===== Sidebar ===== */}
        <aside className="flex h-full w-[280px] shrink-0 flex-col border-r bg-card">
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
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Upload className="size-3.5" />
                Load .jsonl Session
                <input type="file" accept=".jsonl" hidden onChange={handleFileLoad} />
              </label>

              <p className="text-center text-[11px] text-muted-foreground">{sessionInfo}</p>

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
        <div className="flex flex-1 w-0 flex-col min-w-0 overflow-hidden bg-background">
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
                  isStreaming={player.isStreaming}
                  pendingPlan={player.pendingPlan}
                  pendingQuestions={player.pendingQuestion}
                  pendingApproval={player.pendingApproval}
                  onApprovePlan={() => player.resolvePlan(true)}
                  onRejectPlan={() => player.resolvePlan(false)}
                  onAnswerQuestions={(answers: Record<string, string[]>) => {
                    console.log("Answers:", answers)
                    player.resolveQuestion(answers)
                  }}
                  onApprovalDecision={(decision, feedback) => {
                    console.log("Exec decision:", decision, "Feedback:", feedback)
                    player.resolveApproval(decision, feedback)
                  }}
                  welcomeTitle="@viben/chat Session Player"
                  welcomeDescription="Press Play to replay the demo session, or load a .jsonl file."
                  maxMessageWidth="760px"
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

          {/* Chat Input */}
          <div className="border-t border-border px-4 py-2">
            <div className="mx-auto max-w-[760px]">
              <ChatInput
                onSend={handleSend}
                onCancel={player.pause}
                isLoading={player.isStreaming}
                allowSendWhileLoading
                disabled={isAwaiting}
                blockedReason={
                  player.pendingApproval ? "Waiting for permission approval..." :
                  player.pendingQuestion ? "Waiting for question response..." :
                  player.pendingPlan ? "Waiting for plan approval..." :
                  undefined
                }
                placeholder={player.isStreaming ? "Type to queue a message..." : "Type a message..."}
                showConfigBar
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
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
