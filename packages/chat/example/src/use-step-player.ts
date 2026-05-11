/**
 * Event-driven step player.
 *
 * Design principles:
 * - No setTimeout for control flow
 * - Blocking is a NATURAL result: a step requires resolution (approval/question/plan),
 *   so the advance condition isn't met → player naturally stalls
 * - When user resolves the interaction, the condition clears → next rAF tick advances
 * - Uses requestAnimationFrame loop with elapsed time tracking for pacing
 */

import { useReducer, useEffect, useRef, useCallback } from "react"
import type { AgentMessage, PendingExecApproval, PendingQuestion, TaskPlan } from "@viben/chat"

// ============================================================================
// Step Definition
// ============================================================================

export interface DemoStep {
  /** Messages to append when this step fires */
  messages: AgentMessage[]
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
  /** idle = not started / finished, playing = auto-advancing, paused = manual stop */
  status: "idle" | "playing" | "paused"
  stepIndex: number
  messages: AgentMessage[]
  /** Current pending interactions (null = nothing awaited) */
  pendingApproval: PendingExecApproval | null
  pendingQuestion: PendingQuestion | null
  pendingPlan: TaskPlan | null
  speed: number
  /**
   * User messages from steps that need routing through the command queue.
   * When a step fires and contains user messages while the player is streaming,
   * they go here instead of directly to `messages`. App consumes and routes them.
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
  | { type: "LOAD_STEPS" }
  | { type: "INJECT_MESSAGE"; message: AgentMessage }
  | { type: "CONSUME_PENDING_USERS" }

function createInitialState(): PlayerState {
  return {
    status: "idle",
    stepIndex: 0,
    messages: [],
    pendingApproval: null,
    pendingQuestion: null,
    pendingPlan: null,
    speed: 1,
    pendingUserMessages: [],
  }
}

function buildMessagesUpTo(steps: DemoStep[], endIndex: number): AgentMessage[] {
  const msgs: AgentMessage[] = []
  for (let i = 0; i < endIndex && i < steps.length; i++) {
    msgs.push(...steps[i].messages)
  }
  return msgs
}

function createReducer(steps: DemoStep[]) {
  return function reducer(state: PlayerState, action: PlayerAction): PlayerState {
    switch (action.type) {
      case "PLAY":
        if (state.stepIndex >= steps.length) return state
        return { ...state, status: "playing" }

      case "PAUSE":
        return { ...state, status: "paused" }

      case "ADVANCE": {
        // Called by rAF loop. Only advances if no pending interaction.
        if (state.status !== "playing") return state
        if (state.pendingApproval || state.pendingQuestion || state.pendingPlan) return state
        if (state.stepIndex >= steps.length) return { ...state, status: "idle" }

        const step = steps[state.stepIndex]
        const newIndex = state.stepIndex + 1
        const done = newIndex >= steps.length

        // Separate user messages from agent messages.
        // User messages go to pendingUserMessages for routing through command queue.
        // Agent messages go directly to the message list.
        const userMsgs = step.messages.filter(msg => msg.type === "user")
        const agentMsgs = step.messages.filter(msg => msg.type !== "user")

        return {
          ...state,
          status: done ? "idle" : "playing",
          stepIndex: newIndex,
          messages: [...state.messages, ...agentMsgs],
          pendingUserMessages: userMsgs.length > 0 ? userMsgs : [],
          pendingApproval: step.awaitsInteraction?.type === "approval" ? step.awaitsInteraction.approval : null,
          pendingQuestion: step.awaitsInteraction?.type === "question" ? step.awaitsInteraction.question : null,
          pendingPlan: step.awaitsInteraction?.type === "plan" ? step.awaitsInteraction.plan : null,
        }
      }

      case "NEXT_MANUAL": {
        // Manual step (Next button). Ignores status, forces one step forward.
        // But still respects pending interactions.
        if (state.pendingApproval || state.pendingQuestion || state.pendingPlan) return state
        if (state.stepIndex >= steps.length) return state

        const step = steps[state.stepIndex]
        const newMessages = [...state.messages, ...step.messages]
        const newIndex = state.stepIndex + 1

        return {
          ...state,
          stepIndex: newIndex,
          messages: newMessages,
          pendingApproval: step.awaitsInteraction?.type === "approval" ? step.awaitsInteraction.approval : null,
          pendingQuestion: step.awaitsInteraction?.type === "question" ? step.awaitsInteraction.question : null,
          pendingPlan: step.awaitsInteraction?.type === "plan" ? step.awaitsInteraction.plan : null,
        }
      }

      case "PREV": {
        const newIndex = Math.max(0, state.stepIndex - 1)
        return {
          ...state,
          status: "paused",
          stepIndex: newIndex,
          messages: buildMessagesUpTo(steps, newIndex),
          pendingApproval: null,
          pendingQuestion: null,
          pendingPlan: null,
        }
      }

      case "SEEK": {
        const idx = Math.max(0, Math.min(action.stepIndex, steps.length))
        return {
          ...state,
          status: "paused",
          stepIndex: idx,
          messages: buildMessagesUpTo(steps, idx),
          pendingApproval: null,
          pendingQuestion: null,
          pendingPlan: null,
        }
      }

      case "REPLAY":
        return { ...createInitialState(), speed: state.speed, status: "playing" }

      case "SET_SPEED":
        return { ...state, speed: action.speed }

      case "RESOLVE_APPROVAL":
        return { ...state, pendingApproval: null }

      case "RESOLVE_QUESTION":
        return { ...state, pendingQuestion: null }

      case "RESOLVE_PLAN":
        return { ...state, pendingPlan: null }

      case "LOAD_STEPS":
        return createInitialState()

      case "INJECT_MESSAGE":
        return { ...state, messages: [...state.messages, action.message] }

      case "CONSUME_PENDING_USERS":
        return { ...state, pendingUserMessages: [] }

      default:
        return state
    }
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface StepPlayerReturn {
  messages: AgentMessage[]
  stepIndex: number
  totalSteps: number
  status: "idle" | "playing" | "paused"
  speed: number
  /** True when player is actively producing messages (playing + not awaiting interaction) */
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
  /** Inject a message into the message list (e.g., from command queue dequeue) */
  injectMessage: (message: AgentMessage) => void
  /** User messages waiting to be routed (consumed by App via consumePendingUsers) */
  pendingUserMessages: AgentMessage[]
  /** Clear pendingUserMessages after App has consumed them */
  consumePendingUsers: () => void
}

export function useStepPlayer(initialSteps: DemoStep[]): StepPlayerReturn {
  const stepsRef = useRef(initialSteps)
  const reducerRef = useRef(createReducer(initialSteps))
  const [state, dispatch] = useReducer(reducerRef.current, undefined, createInitialState)

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

    // If awaiting interaction, don't schedule advances but keep loop alive
    // so it resumes instantly when resolved
    function tick(now: number) {
      const steps = stepsRef.current
      const idx = state.stepIndex

      // Nothing to do if done or awaiting
      if (idx >= steps.length) {
        dispatch({ type: "ADVANCE" })
        return
      }

      if (state.pendingApproval || state.pendingQuestion || state.pendingPlan) {
        // Keep loop alive, re-check next frame
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
  }, [state.status, state.stepIndex, state.speed, state.pendingApproval, state.pendingQuestion, state.pendingPlan])

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
    reducerRef.current = createReducer(newSteps)
    dispatch({ type: "LOAD_STEPS" })
  }, [])

  const injectMessage = useCallback((message: AgentMessage) => {
    dispatch({ type: "INJECT_MESSAGE", message })
  }, [])

  const consumePendingUsers = useCallback(() => {
    dispatch({ type: "CONSUME_PENDING_USERS" })
  }, [])

  return {
    messages: state.messages,
    stepIndex: state.stepIndex,
    totalSteps: stepsRef.current.length,
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
    injectMessage,
    pendingUserMessages: state.pendingUserMessages,
    consumePendingUsers,
  }
}
