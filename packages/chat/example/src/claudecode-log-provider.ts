import type { AgentMessage, ContentBlock } from "@viben/chat"
import { getPublicAssetUrl } from "./public-assets"

export interface ParseStats {
  totalLines: number
  handledLines: number
  skippedLines: number
  emittedMessages: number
  skippedByReason: Record<string, number>
}

export interface ParsedSessionJsonl {
  messages: AgentMessage[]
  stats: ParseStats
}

export interface SubagentMeta {
  agentType?: string
  description?: string
}

export interface ClaudeCodeSessionManifestItem {
  id: string
  label: string
  basePath: string
  mainFile: string
  subagents: Array<{
    id: string
    jsonl: string
    meta: string
  }>
  toolResults?: string[]
}

export interface LoadedClaudeCodeSession {
  id: string
  label: string
  messages: AgentMessage[]
  subagentPreviewEvents: SubagentPreviewEvent[]
  stats: ParseStats
  subagentCount: number
}

export interface SubagentPreviewEvent {
  parentToolUseId: string
  subagentId: string
  messages: AgentMessage[]
}

const EMPTY_STATS: ParseStats = {
  totalLines: 0,
  handledLines: 0,
  skippedLines: 0,
  emittedMessages: 0,
  skippedByReason: {},
}

export const CLAUDE_CODE_SESSION_MAIN_MODULES = import.meta.glob("../public/claudecode_sessions/*.jsonl", {
  query: "?url",
  import: "default",
  eager: true,
})

const CLAUDE_CODE_SUBAGENT_MODULES = import.meta.glob("../public/claudecode_sessions/*/subagents/agent-*.jsonl", {
  query: "?url",
  import: "default",
  eager: true,
})

const CLAUDE_CODE_TOOL_RESULT_MODULES = import.meta.glob("../public/claudecode_sessions/*/tool-results/*", {
  query: "?url",
  import: "default",
  eager: true,
})

const CLAUDE_CODE_SESSION_LABELS: Record<string, string> = {
  "2c88f85a-690d-49ca-95f4-c3aa71da1da8": "Claude Code: breadcrumb navigation debug",
}

function getSessionIdFromMainModulePath(modulePath: string): string {
  const match = modulePath.match(/\/claudecode_sessions\/([^/]+)\.jsonl$/)
  return match?.[1] ?? modulePath
}

function getSessionIdFromNestedModulePath(modulePath: string): string | null {
  return modulePath.match(/\/claudecode_sessions\/([^/]+)\//)?.[1] ?? null
}

function getSubagentIdFromModulePath(modulePath: string): string | null {
  return modulePath.match(/\/subagents\/agent-([^/]+)\.jsonl$/)?.[1] ?? null
}

function getFileNameFromModulePath(modulePath: string): string {
  return modulePath.slice(modulePath.lastIndexOf("/") + 1)
}

function createClaudeCodeSessionManifest(
  id: string,
  label: string,
  subagentIds: string[],
  toolResultFiles: string[] = []
): ClaudeCodeSessionManifestItem {
  const basePath = `/claudecode_sessions/${id}`
  return {
    id,
    label,
    basePath,
    mainFile: `${basePath}.jsonl`,
    subagents: subagentIds.map((subagentId) => ({
      id: subagentId,
      jsonl: `${basePath}/subagents/agent-${subagentId}.jsonl`,
      meta: `${basePath}/subagents/agent-${subagentId}.meta.json`,
    })),
    toolResults: toolResultFiles.map((file) => `${basePath}/tool-results/${file}`),
  }
}

function buildClaudeCodeSessionManifests(): ClaudeCodeSessionManifestItem[] {
  return Object.keys(CLAUDE_CODE_SESSION_MAIN_MODULES)
    .map((modulePath) => getSessionIdFromMainModulePath(modulePath))
    .sort()
    .map((id) => {
      const subagentIds = Object.keys(CLAUDE_CODE_SUBAGENT_MODULES)
        .filter((modulePath) => getSessionIdFromNestedModulePath(modulePath) === id)
        .map((modulePath) => getSubagentIdFromModulePath(modulePath))
        .filter((subagentId): subagentId is string => Boolean(subagentId))
        .sort()
      const toolResultFiles = Object.keys(CLAUDE_CODE_TOOL_RESULT_MODULES)
        .filter((modulePath) => getSessionIdFromNestedModulePath(modulePath) === id)
        .map((modulePath) => getFileNameFromModulePath(modulePath))
        .sort()
      return createClaudeCodeSessionManifest(
        id,
        CLAUDE_CODE_SESSION_LABELS[id] ?? `Claude Code: ${id.slice(0, 8)} session replay`,
        subagentIds,
        toolResultFiles
      )
    })
}

export const CLAUDE_CODE_SESSIONS: ClaudeCodeSessionManifestItem[] = buildClaudeCodeSessionManifests()

function incrementReason(stats: ParseStats, reason: string) {
  stats.skippedLines += 1
  stats.skippedByReason[reason] = (stats.skippedByReason[reason] ?? 0) + 1
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((block) => {
      if (
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        block.type === "text" &&
        "text" in block
      ) {
        return String(block.text ?? "")
      }
      return ""
    })
    .join("")
}

function parseToolResultContent(content: unknown): string | ContentBlock[] {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    const hasImage = content.some((block) => {
      return typeof block === "object" && block !== null && "type" in block && block.type === "image"
    })
    if (hasImage) return content as ContentBlock[]
    return textFromContent(content)
  }
  return String(content ?? "")
}

function hasMeaningfulErrorValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value !== "object" || value === null) return value !== undefined
  const entries = Object.entries(value)
  return entries.some(([, entryValue]) => hasMeaningfulErrorValue(entryValue))
}

function formatSystemError(obj: Record<string, unknown>): string {
  const subtype = typeof obj.subtype === "string" ? obj.subtype : "system_error"
  const retryAttempt = typeof obj.retryAttempt === "number" ? obj.retryAttempt : undefined
  const maxRetries = typeof obj.maxRetries === "number" ? obj.maxRetries : undefined
  const retryInMs = typeof obj.retryInMs === "number" ? obj.retryInMs : undefined
  const retryText = retryInMs !== undefined ? `; retrying in ${(retryInMs / 1000).toFixed(1)}s` : ""
  const attemptText =
    retryAttempt !== undefined && maxRetries !== undefined
      ? ` (attempt ${retryAttempt}/${maxRetries})`
      : ""

  if (hasMeaningfulErrorValue(obj.error)) {
    return `${subtype}${attemptText}${retryText}: ${JSON.stringify(obj.error)}`
  }
  if (hasMeaningfulErrorValue(obj.cause)) {
    return `${subtype}${attemptText}${retryText}: ${JSON.stringify(obj.cause)}`
  }
  return `${subtype}${attemptText}${retryText}`
}

export function parseSessionJsonlDetailed(text: string): ParsedSessionJsonl {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const stats: ParseStats = { ...EMPTY_STATS, skippedByReason: {} }
  const messages: AgentMessage[] = []
  const seenTool = new Set<string>()
  let msgCounter = 0

  for (const line of lines) {
    stats.totalLines += 1
    let emitted = 0

    try {
      const obj = JSON.parse(line)
      const t = obj.type

      if (t === "user") {
        const content = obj.message?.content
        if (Array.isArray(content) && content.some((c: { type?: string }) => c.type === "tool_result")) {
          for (const c of content) {
            if (c.type !== "tool_result") continue
            if (!c.content) continue
            messages.push({
              id: `msg-${msgCounter++}`,
              type: "tool_result",
              toolUseId: c.tool_use_id,
              output: parseToolResultContent(c.content),
              isError: c.is_error,
              timestamp: obj.timestamp ? Date.parse(obj.timestamp) : undefined,
            })
            emitted += 1
          }
        } else {
          let txt = textFromContent(content)
          txt = txt.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim()

          if (txt && !txt.startsWith("<local-command")) {
            messages.push({
              id: `msg-${msgCounter++}`,
              type: "user",
              content: txt,
              timestamp: obj.timestamp ? Date.parse(obj.timestamp) : undefined,
            })
            emitted += 1
          }
        }
      } else if (t === "assistant") {
        const content = obj.message?.content
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "thinking" && c.thinking) {
              messages.push({
                id: `msg-${msgCounter++}`,
                type: "thinking",
                content: c.thinking,
                timestamp: obj.timestamp ? Date.parse(obj.timestamp) : undefined,
              })
              emitted += 1
            } else if (c.type === "text" && c.text) {
              messages.push({
                id: `msg-${msgCounter++}`,
                type: "text",
                content: c.text,
                timestamp: obj.timestamp ? Date.parse(obj.timestamp) : undefined,
              })
              emitted += 1
            } else if (c.type === "tool_use") {
              const tid = c.id
              if (tid && seenTool.has(tid)) continue
              seenTool.add(tid)
              messages.push({
                id: `msg-${msgCounter++}`,
                type: "tool_use",
                name: c.name,
                toolUseId: tid,
                input: c.input,
                timestamp: obj.timestamp ? Date.parse(obj.timestamp) : undefined,
              })
              emitted += 1
            }
          }
        }
      } else if (t === "system") {
        if (obj.level === "error") {
          messages.push({
            id: `msg-${msgCounter++}`,
            type: "error",
            content: obj.subtype || "System error",
            message: formatSystemError(obj),
            timestamp: obj.timestamp ? Date.parse(obj.timestamp) : undefined,
          })
          emitted += 1
        }
      } else if (
        t === "progress" ||
        t === "file-history-snapshot" ||
        t === "queue-operation" ||
        t === "last-prompt"
      ) {
        // These are metadata lines. They are handled by counting them as known
        // session records, while message rendering uses their derived mappings.
      } else {
        incrementReason(stats, `unsupported:${String(t)}`)
      }

      if (
        emitted > 0 ||
        t === "progress" ||
        t === "file-history-snapshot" ||
        t === "system" ||
        t === "queue-operation" ||
        t === "last-prompt" ||
        (t === "user" && obj.isMeta) ||
        (t === "user" && typeof obj.message?.content === "string" && obj.message.content.startsWith("<local-command-stdout"))
      ) {
        stats.handledLines += 1
      } else if (t === "user" || t === "assistant") {
        incrementReason(stats, "empty_or_meta_message")
      }
    } catch {
      incrementReason(stats, "invalid_json")
    }
  }

  stats.emittedMessages = messages.length
  return { messages, stats }
}

export function parseSessionJsonl(text: string): AgentMessage[] {
  return parseSessionJsonlDetailed(text).messages
}

function extractAgentMapping(text: string): Map<string, string> {
  const mapping = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const obj = JSON.parse(line)
      if (obj.type === "progress" && obj.parentToolUseID && obj.data?.agentId) {
        if (!mapping.has(obj.parentToolUseID)) mapping.set(obj.parentToolUseID, obj.data.agentId)
      }
    } catch {
      // ignored; detailed parser reports invalid lines
    }
  }
  return mapping
}

export function extractSubagentPreviewEvents(text: string): SubagentPreviewEvent[] {
  const events: SubagentPreviewEvent[] = []
  let eventIndex = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const obj = JSON.parse(line)
      if (obj.type !== "progress" || !obj.parentToolUseID || !obj.data?.agentId) continue
      const progressMessage = obj.data?.message
      if (!progressMessage || typeof progressMessage !== "object") continue
      const messages = parseSessionJsonlDetailed(JSON.stringify(progressMessage)).messages
      if (messages.length === 0) continue
      const currentEventIndex = eventIndex++
      const messagesWithStableIds = messages.map((message, messageIndex) => ({
        ...message,
        id: `${obj.parentToolUseID}:${obj.data.agentId}:preview-${currentEventIndex}-${message.id ?? messageIndex}`,
      }))
      events.push({
        parentToolUseId: obj.parentToolUseID,
        subagentId: obj.data.agentId,
        messages: messagesWithStableIds,
      })
    } catch {
      // Detailed parser covers malformed session records. Preview extraction is best-effort.
    }
  }
  return events
}

async function fetchText(path: string): Promise<string> {
  const url = getPublicAssetUrl(path, import.meta.env.BASE_URL)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`)
  return response.text()
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = getPublicAssetUrl(path, import.meta.env.BASE_URL)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`)
  return response.json() as Promise<T>
}

export async function loadClaudeCodeSubagent(
  session: ClaudeCodeSessionManifestItem,
  subagentId: string
): Promise<{ messages: AgentMessage[]; meta?: SubagentMeta; stats: ParseStats }> {
  const entry = session.subagents.find((item) => item.id === subagentId)
  if (!entry) {
    throw new Error(`Unknown subagent: ${subagentId}`)
  }

  const [jsonl, meta] = await Promise.all([
    fetchText(entry.jsonl),
    fetchJson<SubagentMeta>(entry.meta).catch(() => undefined),
  ])
  const parsed = parseSessionJsonlDetailed(jsonl)
  return { messages: parsed.messages, meta, stats: parsed.stats }
}

export async function loadClaudeCodeSession(
  session: ClaudeCodeSessionManifestItem
): Promise<LoadedClaudeCodeSession> {
  const mainText = await fetchText(session.mainFile)
  const parsed = parseSessionJsonlDetailed(mainText)
  const agentMapping = extractAgentMapping(mainText)

  const metaEntries = await Promise.all(
    session.subagents.map(async (subagent) => ({
      id: subagent.id,
      meta: await fetchJson<SubagentMeta>(subagent.meta).catch(() => undefined),
    }))
  )
  const metaMap = new Map(metaEntries.map((entry) => [entry.id, entry.meta]))

  for (const message of parsed.messages) {
    if (message.type !== "tool_use") continue
    if (message.name !== "Agent" && message.name !== "Task") continue
    if (!message.toolUseId) continue

    const agentId = agentMapping.get(message.toolUseId)
    if (!agentId) continue
    message.subagentId = agentId

    const meta = metaMap.get(agentId)
    if (meta && message.input) {
      if (!message.input.subagent_type && meta.agentType) {
        message.input.subagent_type = meta.agentType
      }
      if (!message.input.description && meta.description) {
        message.input.description = meta.description
      }
    }
  }

  return {
    id: session.id,
    label: session.label,
    messages: parsed.messages,
    subagentPreviewEvents: extractSubagentPreviewEvents(mainText),
    stats: parsed.stats,
    subagentCount: session.subagents.length,
  }
}
