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
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap, Upload, Sun, Moon } from "lucide-react"
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
  const [sessionInfo, setSessionInfo] = useState("Demo session · 8 messages")

  // Interactive state
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null)
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState("coder")
  const [selectedModelId, setSelectedModelId] = useState("claude-opus-4-6")
  const [selectedExecutor, setSelectedExecutor] = useState("claude-code")
  const [tools, setTools] = useState(demoTools)
  const [skills, setSkills] = useState(demoSkills)

  // Refs
  const messageListRef = useRef<MessageListHandle>(null)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef = useRef(playing)
  const speedRef = useRef(SPEEDS[speedIdx])
  const playIndexRef = useRef(playIndex)
  const allMessagesRef = useRef(allMessages)

  // Standalone component demos
  const [showPlan, setShowPlan] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

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

    // Calculate delay based on message type
    let delay = 400
    if (msg.type === "user") delay = 800
    else if (msg.type === "text") delay = 1200
    else if (msg.type === "thinking") delay = 600
    else if (msg.type === "tool_use") delay = 500
    else if (msg.type === "tool_result") delay = 300

    if (newIdx >= all.length) {
      // Last message
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
      setSessionInfo(`${file.name} · ${parsed.length} messages`)
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

  // Progress bar
  const progress = allMessages.length > 0 ? playIndex / allMessages.length : 0

  return (
    <div className="flex h-full w-full">
      {/* ===== Left Panel: Player Controls ===== */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card p-4 overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold">@viben/chat Player</h2>

        {/* Theme toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="mb-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm hover:bg-accent"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        {/* File upload */}
        <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm hover:bg-accent">
          <Upload className="size-4" />
          Load .jsonl Session
          <input type="file" accept=".jsonl" hidden onChange={handleFileLoad} />
        </label>

        <p className="mb-4 text-center text-xs text-muted-foreground">{sessionInfo}</p>

        {/* Player controls */}
        <div className="mb-3 flex items-center justify-center gap-2">
          <button onClick={handleReplay} className="rounded-full bg-secondary p-2 hover:bg-accent" title="Replay">
            <RotateCcw className="size-4" />
          </button>
          <button onClick={handlePrev} className="rounded-full bg-secondary p-2 hover:bg-accent">
            <SkipBack className="size-4" />
          </button>
          <button
            onClick={playing ? handlePause : handlePlay}
            className="rounded-full bg-primary p-2.5 text-primary-foreground hover:opacity-90"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button onClick={handleNext} className="rounded-full bg-secondary p-2 hover:bg-accent">
            <SkipForward className="size-4" />
          </button>
          <button
            onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
            className="rounded-full bg-secondary p-2 hover:bg-accent"
            title="Speed"
          >
            <Zap className="size-4" />
          </button>
          <span className="min-w-[32px] text-center text-xs text-muted-foreground">
            {SPEEDS[speedIdx]}x
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-4 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 cursor-pointer rounded-full bg-secondary"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              handleSeek((e.clientX - rect.left) / rect.width)
            }}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {playIndex}/{allMessages.length}
          </span>
        </div>

        {/* Separator */}
        <div className="my-3 border-t border-border" />

        {/* Standalone component demos */}
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Component Demos</h3>

        <button
          onClick={() => { setShowPlan(!showPlan); setShowQuestions(false); setShowEmojiPicker(false) }}
          className={`mb-2 rounded-lg px-3 py-2 text-left text-sm ${showPlan ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`}
        >
          PlanApproval
        </button>
        <button
          onClick={() => { setShowQuestions(!showQuestions); setShowPlan(false); setShowEmojiPicker(false) }}
          className={`mb-2 rounded-lg px-3 py-2 text-left text-sm ${showQuestions ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`}
        >
          QuestionInput
        </button>
        <button
          onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowPlan(false); setShowQuestions(false) }}
          className={`mb-2 rounded-lg px-3 py-2 text-left text-sm ${showEmojiPicker ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`}
        >
          EmojiPicker
        </button>

        {/* Separator */}
        <div className="my-3 border-t border-border" />

        {/* Model icons demo */}
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Model Icons</h3>
        <div className="flex flex-wrap gap-2">
          {demoModels.map(m => (
            <div key={m.id} className="flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs">
              {getModelIcon(m.id, { size: 14 })}
              <span>{m.name.split(" ").pop()}</span>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="my-3 border-t border-border" />

        {/* ToolExecutionItem standalone demo */}
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">ToolExecutionItem</h3>
        <div className="space-y-1">
          <ToolExecutionItem
            name="Read"
            displayName="Read"
            input={{ file_path: "/src/App.tsx" }}
            output="File content here..."
            compact
          />
          <ToolExecutionItem
            name="Bash"
            displayName="Bash"
            input={{ command: "pnpm test" }}
            isExecuting
            compact
          />
          <ToolExecutionItem
            name="Write"
            displayName="Write"
            input={{ file_path: "/src/utils.ts" }}
            output="File written."
            isError={false}
            compact
          />
        </div>

        {/* Separator */}
        <div className="my-3 border-t border-border" />

        {/* Config popovers demo */}
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Config Popovers</h3>
        <div className="space-y-2">
          <ToolsConfigPopover
            tools={tools}
            onToggleTool={(toolId, _enabled) => handleToggleTool(toolId)}
          />
          <SkillsConfigPopover
            skills={skills}
            onToggleSkill={(skillId, _enabled) => handleToggleSkill(skillId)}
          />
          <ContextDetailsPopover
            breakdown={demoContextBreakdown}
          />
        </div>
      </div>

      {/* ===== Right Panel: Message List + Input ===== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 overflow-hidden">
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
              welcomeDescription="Press Play to replay the demo session, or load a .jsonl file from the left panel."
              maxMessageWidth="800px"
            />
          )}
        </div>

        {/* Chat Input */}
        <div className="border-t border-border p-3">
          <ChatInput
            onSend={handleSend}
            isLoading={isStreaming}
            placeholder="Type a message to add to the conversation..."
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
  )
}
