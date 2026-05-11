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
  getModelIcon,
} from "@viben/chat"
import type { AgentMessage, MessageListHandle, TaskPlan, PendingQuestion } from "@viben/chat"
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap, Upload, Sun, Moon, ChevronDown } from "lucide-react"
import {
  demoMessages,
  demoPlan,
  demoQuestions,
  demoAgents,
  demoModels,
  demoExecutors,
  demoTools,
  demoSkills,
  demoSlashCommands,
  demoContextBreakdown,
  parseSessionJsonl,
} from "./demo-data"

// ============================================================================
// Player Speeds
// ============================================================================

const SPEEDS = [0.5, 1, 2, 4, 8]

// ============================================================================
// App
// ============================================================================

export function App() {
  // Theme
  const [dark, setDark] = useState(true)

  // Player state
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [allMessages, setAllMessages] = useState<AgentMessage[]>(demoMessages)
  const [playIndex, setPlayIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(`Demo · ${demoMessages.length} messages`)

  // Interactive state
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null)
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState("coder")
  const [selectedModelId, setSelectedModelId] = useState("claude-opus-4-6")
  const [selectedExecutor, setSelectedExecutor] = useState("claude-code")
  const [tools, setTools] = useState(demoTools)
  const [skills, setSkills] = useState(demoSkills)

  // Standalone component demos
  const [showPlan, setShowPlan] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Sidebar collapsible sections
  const [showToolsPanel, setShowToolsPanel] = useState(false)
  const [showSkillsPanel, setShowSkillsPanel] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(false)

  // Refs
  const messageListRef = useRef<MessageListHandle>(null)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef = useRef(playing)
  const speedRef = useRef(SPEEDS[speedIdx])
  const playIndexRef = useRef(playIndex)
  const allMessagesRef = useRef(allMessages)

  // Sync refs
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { speedRef.current = SPEEDS[speedIdx] }, [speedIdx])
  useEffect(() => { playIndexRef.current = playIndex }, [playIndex])
  useEffect(() => { allMessagesRef.current = allMessages }, [allMessages])

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  // ===== Playback Logic =====
  const playStep = useCallback(() => {
    const idx = playIndexRef.current
    const all = allMessagesRef.current
    if (idx >= all.length) {
      setPlaying(false)
      setIsStreaming(false)
      return
    }

    const msg = all[idx]
    setMessages(prev => [...prev, msg])
    setIsStreaming(true)

    const newIdx = idx + 1
    setPlayIndex(newIdx)
    playIndexRef.current = newIdx

    let delay = 400
    if (msg.type === "user") delay = 800
    else if (msg.type === "text") delay = 1200
    else if (msg.type === "thinking") delay = 600
    else if (msg.type === "tool_use") delay = 500
    else if (msg.type === "tool_result") delay = 300

    if (newIdx >= all.length) {
      setTimeout(() => setIsStreaming(false), delay / speedRef.current)
    }

    if (playingRef.current && newIdx < all.length) {
      playTimerRef.current = setTimeout(playStep, delay / speedRef.current)
    } else if (newIdx >= all.length) {
      setPlaying(false)
    }
  }, [])

  const handlePlay = useCallback(() => {
    if (playIndexRef.current >= allMessagesRef.current.length) return
    setPlaying(true)
    playingRef.current = true
    playTimerRef.current = setTimeout(playStep, 50)
  }, [playStep])

  const handlePause = useCallback(() => {
    setPlaying(false)
    playingRef.current = false
    setIsStreaming(false)
    if (playTimerRef.current) clearTimeout(playTimerRef.current)
  }, [])

  const handleNext = useCallback(() => {
    handlePause()
    const idx = playIndexRef.current
    const all = allMessagesRef.current
    if (idx < all.length) {
      const msg = all[idx]
      setMessages(prev => [...prev, msg])
      const newIdx = idx + 1
      setPlayIndex(newIdx)
      playIndexRef.current = newIdx
    }
  }, [handlePause])

  const handlePrev = useCallback(() => {
    handlePause()
    const newIdx = Math.max(0, playIndexRef.current - 1)
    setPlayIndex(newIdx)
    playIndexRef.current = newIdx
    setMessages(allMessagesRef.current.slice(0, newIdx))
  }, [handlePause])

  const handleReplay = useCallback(() => {
    handlePause()
    setPlayIndex(0)
    playIndexRef.current = 0
    setMessages([])
    setPendingPlan(null)
    setPendingQuestions(null)
    setTimeout(() => {
      setPlaying(true)
      playingRef.current = true
      playTimerRef.current = setTimeout(playStep, 100)
    }, 100)
  }, [handlePause, playStep])

  const handleSeek = useCallback((ratio: number) => {
    handlePause()
    const all = allMessagesRef.current
    const targetIdx = Math.round(ratio * all.length)
    setPlayIndex(targetIdx)
    playIndexRef.current = targetIdx
    setMessages(all.slice(0, targetIdx))
  }, [handlePause])

  // ===== File Load =====
  const handleFileLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then(text => {
      const parsed = parseSessionJsonl(text)
      setAllMessages(parsed)
      allMessagesRef.current = parsed
      setMessages([])
      setPlayIndex(0)
      playIndexRef.current = 0
      setPlaying(false)
      setIsStreaming(false)
      setSessionInfo(`${file.name} · ${parsed.length} msgs`)
      setPendingPlan(null)
      setPendingQuestions(null)
    })
  }, [])

  // ===== ChatInput handlers =====
  const handleSend = useCallback((content: string) => {
    const userMsg: AgentMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content,
    }
    setMessages(prev => [...prev, userMsg])
  }, [])

  const handleToggleTool = useCallback((toolId: string) => {
    setTools(prev => prev.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t))
  }, [])

  const handleToggleSkill = useCallback((skillId: string) => {
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, enabled: !s.enabled } : s))
  }, [])

  const progress = allMessages.length > 0 ? playIndex / allMessages.length : 0

  return (
    <div className="flex h-full w-full">
      {/* ===== Left Panel ===== */}
      <div className="flex w-[320px] min-w-[320px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
        {/* Fixed header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">@viben/chat Player</h2>
          <button
            onClick={() => setDark(!dark)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Player section */}
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-3 py-2 text-xs font-medium hover:bg-accent">
              <Upload className="size-3.5" />
              Load .jsonl Session
              <input type="file" accept=".jsonl" hidden onChange={handleFileLoad} />
            </label>

            <p className="text-center text-[11px] text-muted-foreground">{sessionInfo}</p>

            {/* Controls */}
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={handleReplay} className="flex size-7 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground" title="Replay">
                <RotateCcw className="size-3.5" />
              </button>
              <button onClick={handlePrev} className="flex size-7 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground">
                <SkipBack className="size-3.5" />
              </button>
              <button
                onClick={playing ? handlePause : handlePlay}
                className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
              </button>
              <button onClick={handleNext} className="flex size-7 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground">
                <SkipForward className="size-3.5" />
              </button>
              <button
                onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
                className="flex size-7 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Speed"
              >
                <Zap className="size-3.5" />
              </button>
              <span className="min-w-[28px] rounded bg-secondary/80 px-1.5 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
                {SPEEDS[speedIdx]}x
              </span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 flex-1 cursor-pointer rounded-full bg-secondary"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  handleSeek((e.clientX - rect.left) / rect.width)
                }}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {playIndex}/{allMessages.length}
              </span>
            </div>
          </div>

          <hr className="border-border" />

          {/* Component Demos */}
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Component Demos</h3>
            <button
              onClick={() => { setShowPlan(!showPlan); setShowQuestions(false); setShowEmojiPicker(false) }}
              className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${showPlan ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent"}`}
            >
              PlanApproval
            </button>
            <button
              onClick={() => { setShowQuestions(!showQuestions); setShowPlan(false); setShowEmojiPicker(false) }}
              className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${showQuestions ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent"}`}
            >
              QuestionInput
            </button>
            <button
              onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowPlan(false); setShowQuestions(false) }}
              className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${showEmojiPicker ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent"}`}
            >
              EmojiPicker
            </button>
          </div>

          <hr className="border-border" />

          {/* Model Icons */}
          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model Icons</h3>
            <div className="flex flex-wrap gap-1.5">
              {demoModels.map(m => (
                <div key={m.id} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                  {getModelIcon(m.id, { size: 12 })}
                  <span>{m.name.split(" ").pop()}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-border" />

          {/* ToolExecutionItem */}
          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">ToolExecutionItem</h3>
            <div className="space-y-1">
              <ToolExecutionItem name="Read" displayName="Read" input={{ file_path: "/src/App.tsx" }} output="File content here..." compact />
              <ToolExecutionItem name="Bash" displayName="Bash" input={{ command: "pnpm test" }} isExecuting compact />
              <ToolExecutionItem name="Write" displayName="Write" input={{ file_path: "/src/utils.ts" }} output="File written." isError={false} compact />
            </div>
          </div>

          <hr className="border-border" />

          {/* Config Panels - collapsible */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Config Panels</h3>

            {/* Tools */}
            <CollapsibleSection
              title={`Tools (${tools.filter(t => t.enabled).length}/${tools.length})`}
              open={showToolsPanel}
              onToggle={() => setShowToolsPanel(!showToolsPanel)}
            >
              <div className="max-w-full overflow-hidden">
                <ToolsConfigPopover
                  tools={tools}
                  onToggleTool={(toolId, _enabled) => handleToggleTool(toolId)}
                  className="!w-full"
                />
              </div>
            </CollapsibleSection>

            {/* Skills */}
            <CollapsibleSection
              title={`Skills (${skills.filter(s => s.enabled).length}/${skills.length})`}
              open={showSkillsPanel}
              onToggle={() => setShowSkillsPanel(!showSkillsPanel)}
            >
              <div className="max-w-full overflow-hidden">
                <SkillsConfigPopover
                  skills={skills}
                  onToggleSkill={(skillId, _enabled) => handleToggleSkill(skillId)}
                  className="!w-full"
                />
              </div>
            </CollapsibleSection>

            {/* Context */}
            <CollapsibleSection
              title="Context Details"
              open={showContextPanel}
              onToggle={() => setShowContextPanel(!showContextPanel)}
            >
              <div className="max-w-full overflow-hidden">
                <ContextDetailsPopover
                  breakdown={demoContextBreakdown}
                  className="!w-full"
                />
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>

      {/* ===== Right Panel: Message List + Input ===== */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {showPlan ? (
            <div className="flex h-full items-center justify-center p-8">
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
            <div className="flex h-full items-center justify-center p-8">
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
            <div className="flex h-full items-center justify-center p-8">
              <EmojiPicker
                onSelect={(emoji) => console.log("Selected:", emoji)}
              />
            </div>
          ) : (
            <MessageList
              ref={messageListRef}
              messages={messages}
              isStreaming={isStreaming}
              pendingPlan={pendingPlan}
              pendingQuestions={pendingQuestions}
              onApprovePlan={() => setPendingPlan(null)}
              onRejectPlan={() => setPendingPlan(null)}
              onAnswerQuestions={(answers) => {
                console.log("Answers:", answers)
                setPendingQuestions(null)
              }}
              welcomeTitle="@viben/chat Session Player"
              welcomeDescription="Press Play to replay the demo session, or load a .jsonl file."
              maxMessageWidth="720px"
            />
          )}
        </div>

        {/* Chat Input */}
        <div className="border-t border-border p-4">
          <div className="mx-auto max-w-[720px]">
            <ChatInput
              onSend={handleSend}
              isLoading={isStreaming}
              placeholder="Type a message..."
              showTopToolbar
              showConfigBar
              showResizeHandle
              enableWritingMode
              agents={demoAgents}
              selectedAgentId={selectedAgentId}
              onAgentChange={setSelectedAgentId}
              models={demoModels}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              executors={demoExecutors}
              selectedExecutor={selectedExecutor}
              onExecutorChange={setSelectedExecutor}
              tools={tools}
              onToggleTool={handleToggleTool}
              enabledToolsCount={tools.filter(t => t.enabled).length}
              skills={skills}
              onToggleSkill={handleToggleSkill}
              enabledSkillsCount={skills.filter(s => s.enabled).length}
              contextTokens={20000}
              contextBreakdown={demoContextBreakdown}
              slashCommands={demoSlashCommands}
              onSlashCommand={(cmd) => console.log("Slash command:", cmd)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Collapsible Section
// ============================================================================

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/50 transition-colors"
      >
        {title}
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border p-2">
          {children}
        </div>
      )}
    </div>
  )
}
