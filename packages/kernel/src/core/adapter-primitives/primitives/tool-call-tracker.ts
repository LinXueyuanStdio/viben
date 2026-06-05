import type { ToolCallMeta } from '../format-types.js'

/** A tool call associated with the platform message ID where it is displayed. */
export interface TrackedToolCall extends ToolCallMeta {
  /** Platform message ID of the tool card message, used for in-place updates. */
  messageId: string
}

/**
 * Tracks active tool calls per session, associating each with the platform
 * message that displays it. Used by adapters that render individual tool
 * cards and need to update them in-place when tool status changes.
 */
export class ToolCallTracker {
  private sessions = new Map<string, Map<string, TrackedToolCall>>()

  /** Registers a new tool call and associates it with its platform message ID. */
  track(sessionId: string, meta: ToolCallMeta, messageId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map())
    }
    this.sessions.get(sessionId)!.set(meta.id, { ...meta, messageId })
  }

  /** Updates a tracked tool call's status and optional metadata. Returns null if not found. */
  update(
    sessionId: string,
    toolId: string,
    status: string,
    patch?: Partial<Pick<ToolCallMeta, 'viewerLinks' | 'viewerFilePath' | 'name' | 'kind'>>,
  ): TrackedToolCall | null {
    const tool = this.sessions.get(sessionId)?.get(toolId)
    if (!tool) return null

    tool.status = status
    if (patch?.viewerLinks) tool.viewerLinks = patch.viewerLinks
    if (patch?.viewerFilePath) tool.viewerFilePath = patch.viewerFilePath
    if (patch?.name) tool.name = patch.name
    if (patch?.kind) tool.kind = patch.kind

    return tool
  }

  /** Returns all tracked tool calls for a session (regardless of status). */
  getActive(sessionId: string): TrackedToolCall[] {
    const session = this.sessions.get(sessionId)
    return session ? [...session.values()] : []
  }

  /** Removes all tracked tool calls for a session (called at turn end). */
  clear(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  clearAll(): void {
    this.sessions.clear()
  }
}
