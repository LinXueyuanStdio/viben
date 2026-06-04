/**
 * Event-driven step player.
 *
 * Design principles:
 * - No setTimeout for control flow
 * - Blocking is a NATURAL result: a step requires resolution (approval/question/plan),
 *   so the advance condition isn't met → player naturally stalls
 * - When user resolves the interaction, the condition clears → next rAF tick advances
 * - Uses requestAnimationFrame loop with elapsed time tracking for pacing
 *
 * Queue routing model:
 * - User messages from demo steps go to `pendingUserMessages`
 * - App determines routing based on agent busy state (unresolved tool calls)
 * - When agent is busy → messages go to CommandQueue
 * - When agent is idle → messages inject directly into list
 * - Queue auto-dequeues when tool_result arrives (agent becomes idle)
 */

import { useReducer, useEffect, useRef, useCallback } from "react"
import type { AgentMessage, PendingExecApproval, PendingQuestion, TaskPlan } from "@viben/chat"

// ============================================================================
// Step Definition
// ============================================================================

export interface DemoStep {
  /** Messages to append when this step fires */
  messages: AgentMessage[]
  /** Transient UI-only updates applied when this step fires. */
  messageUpdates?: Record<string, Partial<AgentMessage>>
  /** Delay before auto-advancing to next step (ms). Default 400. */
  delayMs?: number
  /**
   * If set, this step requires user resolution before the NEXT step can fire.
   * The step's messages are still immediately added, but progression halts
   * until the matching `resolve*` action clears the awaiting state.
   */
  awaitsInteraction?:
    | { type: "approval"; approval: PendingExecApproval }
    | { type: "question"; question: PendingQuestion }
    | { type: "plan"; plan: TaskPlan }
}

// ============================================================================
// State
// ============================================================================

interface PlayerState {
  steps: DemoStep[]
  /** idle = not started / finished, playing = auto-advancing, paused = manual stop */
  status: "idle" | "playing" | "paused"
  stepIndex: number
  messages: AgentMessage[]
  messageUpdates: Record<string, Partial<AgentMessage>>
  /** Current pending interactions (null = nothing awaited) */
  pendingApproval: PendingExecApproval | null
  pendingQuestion: PendingQuestion | null
  pendingPlan: TaskPlan | null
  speed: number
  /**
   * User messages from steps that need routing by the App.
   * App checks isAgentBusy(messages) to decide: queue or inject directly.
   * Blocks ADVANCE until consumed to prevent overwrite.
   */
  pendingUserMessages: AgentMessage[]
}

type PlayerAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "ADVANCE" }
  | { type: "NEXT_MANUAL" }
  | { type: "PREV" }
  | { type: "SEEK"; stepIndex: number }
  | { type: "REPLAY" }
  | { type: "SET_SPEED"; speed: number }
  | { type: "RESOLVE_APPROVAL" }
  | { type: "RESOLVE_QUESTION" }
  | { type: "RESOLVE_PLAN" }
  | { type: "LOAD_STEPS"; steps: DemoStep[] }
  | { type: "LOAD_MESSAGES"; messages: AgentMessage[] }
  | { type: "SET_MESSAGE_UPDATES"; updates: Record<string, Partial<AgentMessage>> }
  | { type: "INJECT_MESSAGE"; message: AgentMessage }
  | { type: "CONSUME_PENDING_USERS" }

function createInitialState(steps: DemoStep[] = []): PlayerState {
  return {
    steps,
    status: "idle",
    stepIndex: 0,
    messages: [],
    messageUpdates: {},
    pendingApproval: null,
    pendingQuestion: null,
    pendingPlan: null,
    speed: 1,
    pendingUserMessages: [],
  }
}

function buildStateUpTo(steps: DemoStep[], endIndex: number): {
  messages: AgentMessage[];
  messageUpdates: Record<string, Partial<AgentMessage>>;
} {
  const msgs: AgentMessage[] = []
  let messageUpdates: Record<string, Partial<AgentMessage>> = {}
  for (let i = 0; i < endIndex && i < steps.length; i++) {
    msgs.push(...steps[i].messages)
    if (steps[i].messageUpdates) {
      messageUpdates = steps[i].messageUpdates ?? {}
    }
  }
  return { messages: msgs, messageUpdates }
}

function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  const steps = state.steps
  switch (action.type) {
    case "PLAY":
      if (state.stepIndex >= steps.length) return state
      return { ...state, status: "playing" }

    case "PAUSE":
      return { ...state, status: "paused" }

    case "ADVANCE": {
      // Called by rAF loop. Only advances if no blocking condition.
      if (state.status !== "playing") return state
      if (state.pendingApproval || state.pendingQuestion || state.pendingPlan) return state
      if (state.pendingUserMessages.length > 0) return state // wait for routing
      if (state.stepIndex >= steps.length) return { ...state, status: "idle" }

      const step = steps[state.stepIndex]
      const newIndex = state.stepIndex + 1
      const done = newIndex >= steps.length

      const userMsgs = step.messages.filter(msg => msg.type === "user")
      const agentMsgs = step.messages.filter(msg => msg.type !== "user")
      const nextMessageUpdates = step.messageUpdates ?? state.messageUpdates

      // Only separate user messages when agent has produced output.
      // If no agent output yet (start of conversation), user messages go straight to list.
      const hasAgentOutput = state.messages.some(m => m.type !== "user")

      if (hasAgentOutput && userMsgs.length > 0) {
        // User messages go to pendingUserMessages for routing by App.
        // App will check isAgentBusy(messages) to decide queue vs direct inject.
        return {
          ...state,
          status: done ? "idle" : "playing",
          stepIndex: newIndex,
          messages: [...state.messages, ...agentMsgs],
          messageUpdates: nextMessageUpdates,
          pendingUserMessages: userMsgs,
          pendingApproval: step.awaitsInteraction?.type === "approval" ? step.awaitsInteraction.approval : null,
          pendingQuestion: step.awaitsInteraction?.type === "question" ? step.awaitsInteraction.question : null,
          pendingPlan: step.awaitsInteraction?.type === "plan" ? step.awaitsInteraction.plan : null,
        }
      }

      // All messages go directly to list (no queue routing)
      return {
        ...state,
        status: done ? "idle" : "playing",
        stepIndex: newIndex,
        messages: [...state.messages, ...step.messages],
        messageUpdates: nextMessageUpdates,
        pendingUserMessages: [],
        pendingApproval: step.awaitsInteraction?.type === "approval" ? step.awaitsInteraction.approval : null,
        pendingQuestion: step.awaitsInteraction?.type === "question" ? step.awaitsInteraction.question : null,
        pendingPlan: step.awaitsInteraction?.type === "plan" ? step.awaitsInteraction.plan : null,
      }
    }

    case "NEXT_MANUAL": {
      if (state.pendingApproval || state.pendingQuestion || state.pendingPlan) return state
      if (state.stepIndex >= steps.length) return state

      const step = steps[state.stepIndex]
      const newMessages = [...state.messages, ...step.messages]
      const newIndex = state.stepIndex + 1

      return {
        ...state,
        stepIndex: newIndex,
        messages: newMessages,
        messageUpdates: step.messageUpdates ?? state.messageUpdates,
        pendingUserMessages: [],
        pendingApproval: step.awaitsInteraction?.type === "approval" ? step.awaitsInteraction.approval : null,
        pendingQuestion: step.awaitsInteraction?.type === "question" ? step.awaitsInteraction.question : null,
        pendingPlan: step.awaitsInteraction?.type === "plan" ? step.awaitsInteraction.plan : null,
      }
    }

    case "PREV": {
      const newIndex = Math.max(0, state.stepIndex - 1)
      const replayed = buildStateUpTo(steps, newIndex)
      return {
        ...state,
        status: "paused",
        stepIndex: newIndex,
        messages: replayed.messages,
        messageUpdates: replayed.messageUpdates,
        pendingApproval: null,
        pendingQuestion: null,
        pendingPlan: null,
        pendingUserMessages: [],
      }
    }

    case "SEEK": {
      const idx = Math.max(0, Math.min(action.stepIndex, steps.length))
      const replayed = buildStateUpTo(steps, idx)
      return {
        ...state,
        status: "paused",
        stepIndex: idx,
        messages: replayed.messages,
        messageUpdates: replayed.messageUpdates,
        pendingApproval: null,
        pendingQuestion: null,
        pendingPlan: null,
        pendingUserMessages: [],
      }
    }

    case "REPLAY":
      return { ...createInitialState(steps), speed: state.speed, status: "playing" }

    case "SET_SPEED":
      return { ...state, speed: action.speed }

    case "RESOLVE_APPROVAL":
      return { ...state, pendingApproval: null }

    case "RESOLVE_QUESTION":
      return { ...state, pendingQuestion: null }

    case "RESOLVE_PLAN":
      return { ...state, pendingPlan: null }

    case "LOAD_STEPS":
      return { ...createInitialState(action.steps), speed: state.speed }

    case "LOAD_MESSAGES":
      return {
        ...createInitialState(action.messages.map((message): DemoStep => ({ messages: [message] }))),
        speed: state.speed,
        status: "paused",
        stepIndex: action.messages.length,
        messages: action.messages,
        messageUpdates: {},
      }

    case "SET_MESSAGE_UPDATES":
      return { ...state, messageUpdates: action.updates }

    case "INJECT_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] }

    case "CONSUME_PENDING_USERS":
      return { ...state, pendingUserMessages: [] }

    default:
      return state
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface StepPlayerReturn {
  messages: AgentMessage[]
  messageUpdates: Record<string, Partial<AgentMessage>>
  stepIndex: number
  totalSteps: number
  status: "idle" | "playing" | "paused"
  speed: number
  /** True when player is actively producing messages (playing + not awaiting) */
  isStreaming: boolean
  /** True when waiting for user interaction */
  isAwaiting: boolean
  pendingApproval: PendingExecApproval | null
  pendingQuestion: PendingQuestion | null
  pendingPlan: TaskPlan | null

  play: () => void
  pause: () => void
  next: () => void
  prev: () => void
  replay: () => void
  seek: (ratio: number) => void
  setSpeed: (speed: number) => void
  resolveApproval: (decision: string, feedback?: string) => void
  resolveQuestion: (answers: Record<string, string[]>) => void
  resolvePlan: (approved: boolean) => void
  loadSteps: (newSteps: DemoStep[]) => void
  loadMessages: (messages: AgentMessage[]) => void
  setMessageUpdates: (updates: Record<string, Partial<AgentMessage>>) => void
  /** Inject a message into the message list (e.g., from command queue dequeue) */
  injectMessage: (message: AgentMessage) => void
  /** User messages waiting to be routed (consumed by App via consumePendingUsers) */
  pendingUserMessages: AgentMessage[]
  /** Clear pendingUserMessages after App has consumed them */
  consumePendingUsers: () => void
}

export function useStepPlayer(initialSteps: DemoStep[]): StepPlayerReturn {
  const stepsRef = useRef(initialSteps)
  const [state, dispatch] = useReducer(reducer, initialSteps, createInitialState)

  // rAF-based advance loop
  const rafRef = useRef<number | null>(null)
  const lastAdvanceRef = useRef<number>(0)

  useEffect(() => {
    if (state.status !== "playing") {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    function tick(now: number) {
      const steps = stepsRef.current
      const idx = state.stepIndex

      // Nothing to do if done
      if (idx >= steps.length) {
        dispatch({ type: "ADVANCE" })
        return
      }

      // Keep loop alive but don't advance when blocked
      if (
        state.pendingApproval || state.pendingQuestion || state.pendingPlan ||
        state.pendingUserMessages.length > 0
      ) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      // Check timing
      const step = steps[idx]
      const delay = (step?.delayMs ?? 400) / state.speed
      const elapsed = now - lastAdvanceRef.current

      if (elapsed >= delay) {
        lastAdvanceRef.current = now
        dispatch({ type: "ADVANCE" })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    // Initialize timing on first frame
    if (lastAdvanceRef.current === 0) {
      lastAdvanceRef.current = performance.now()
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [
    state.status, state.stepIndex, state.speed,
    state.pendingApproval, state.pendingQuestion, state.pendingPlan,
    state.pendingUserMessages.length,
  ])

  const isAwaiting = !!(state.pendingApproval || state.pendingQuestion || state.pendingPlan)
  const isStreaming = state.status === "playing" && !isAwaiting

  // Actions
  const play = useCallback(() => dispatch({ type: "PLAY" }), [])
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), [])
  const next = useCallback(() => dispatch({ type: "NEXT_MANUAL" }), [])
  const prev = useCallback(() => dispatch({ type: "PREV" }), [])
  const replay = useCallback(() => {
    lastAdvanceRef.current = 0
    dispatch({ type: "REPLAY" })
  }, [])
  const seek = useCallback((ratio: number) => {
    const idx = Math.round(ratio * stepsRef.current.length)
    dispatch({ type: "SEEK", stepIndex: idx })
  }, [])
  const setSpeed = useCallback((speed: number) => dispatch({ type: "SET_SPEED", speed }), [])

  const resolveApproval = useCallback((_decision: string, _feedback?: string) => {
    dispatch({ type: "RESOLVE_APPROVAL" })
  }, [])
  const resolveQuestion = useCallback((_answers: Record<string, string[]>) => {
    dispatch({ type: "RESOLVE_QUESTION" })
  }, [])
  const resolvePlan = useCallback((_approved: boolean) => {
    dispatch({ type: "RESOLVE_PLAN" })
  }, [])

  const loadSteps = useCallback((newSteps: DemoStep[]) => {
    stepsRef.current = newSteps
    lastAdvanceRef.current = 0
    dispatch({ type: "LOAD_STEPS", steps: newSteps })
  }, [])

  const loadMessages = useCallback((messages: AgentMessage[]) => {
    const steps = messages.map((message): DemoStep => ({ messages: [message] }))
    stepsRef.current = steps
    lastAdvanceRef.current = 0
    dispatch({ type: "LOAD_MESSAGES", messages })
  }, [])

  const setMessageUpdates = useCallback((updates: Record<string, Partial<AgentMessage>>) => {
    dispatch({ type: "SET_MESSAGE_UPDATES", updates })
  }, [])

  const injectMessage = useCallback((message: AgentMessage) => {
    dispatch({ type: "INJECT_MESSAGE", message })
  }, [])

  const consumePendingUsers = useCallback(() => {
    dispatch({ type: "CONSUME_PENDING_USERS" })
  }, [])

  return {
    messages: state.messages,
    messageUpdates: state.messageUpdates,
    stepIndex: state.stepIndex,
    totalSteps: state.steps.length,
    status: state.status,
    speed: state.speed,
    isStreaming,
    isAwaiting,
    pendingApproval: state.pendingApproval,
    pendingQuestion: state.pendingQuestion,
    pendingPlan: state.pendingPlan,
    play,
    pause,
    next,
    prev,
    replay,
    seek,
    setSpeed,
    resolveApproval,
    resolveQuestion,
    resolvePlan,
    loadSteps,
    loadMessages,
    setMessageUpdates,
    injectMessage,
    pendingUserMessages: state.pendingUserMessages,
    consumePendingUsers,
  }
}
