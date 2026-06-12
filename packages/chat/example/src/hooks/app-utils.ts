import type { AgentMessage } from "@viben/chat"
import type { SubagentPreviewEvent } from "../claudecode-log-provider"
import type { DemoStep } from "../use-step-player"

export const SPEEDS = [0.5, 1, 2, 4, 8]
export const FULLSCREEN_LAYOUT_DELAY_MS = 40
export const EXAMPLE_SIDEBAR_EXPANDED_WIDTH = 280
export const EXAMPLE_SIDEBAR_COLLAPSED_WIDTH = 56
export const FULLSCREEN_CHAT_MIN_WIDTH = 440
export const FULLSCREEN_CHAT_DEFAULT_WIDTH = 720
export const FULLSCREEN_CHAT_MAX_WIDTH = 1040
export const DEMO_PANEL_MIN_WIDTH = 360
export const FULLSCREEN_CHAT_WIDTH_STORAGE_KEY = "viben.chat.example.fullscreen_chat_width"

export type ExampleLanguage = "en" | "zh-CN"
export type ExampleSidebarPage = "player" | "ui-showcase"
export type FullscreenEntryGeometry = {
  x: number
  y: number
  width: number
  height: number
}

export function isAgentBusy(messages: AgentMessage[]): boolean {
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

export function getFullscreenChatMaxWidth(sidebarWidth: number) {
  if (typeof window === "undefined") return FULLSCREEN_CHAT_MAX_WIDTH
  return Math.min(
    FULLSCREEN_CHAT_MAX_WIDTH,
    Math.max(FULLSCREEN_CHAT_MIN_WIDTH, window.innerWidth - sidebarWidth - DEMO_PANEL_MIN_WIDTH)
  )
}

export function clampFullscreenChatWidth(width: number, sidebarWidth: number) {
  return Math.min(getFullscreenChatMaxWidth(sidebarWidth), Math.max(FULLSCREEN_CHAT_MIN_WIDTH, width))
}

export function readStoredFullscreenChatWidth() {
  if (typeof window === "undefined") return FULLSCREEN_CHAT_DEFAULT_WIDTH
  const stored = window.localStorage.getItem(FULLSCREEN_CHAT_WIDTH_STORAGE_KEY)
  const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN
  return Number.isFinite(parsed) ? parsed : FULLSCREEN_CHAT_DEFAULT_WIDTH
}

export function storeFullscreenChatWidth(width: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FULLSCREEN_CHAT_WIDTH_STORAGE_KEY, String(Math.round(width)))
}

export function messagesToSteps(messages: AgentMessage[]): DemoStep[] {
  return messages.map((msg) => ({
    messages: [msg],
    delayMs: msg.type === "user" ? 800 : msg.type === "text" ? 1200 : msg.type === "thinking" ? 600 : 400,
  }))
}

export function buildClaudeCodePlaybackSteps(
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
        updates[message.id] = { subagentMessages: [...previewMessages] }
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
