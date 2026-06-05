import type { Session } from '../sessions/session.js'
import type { AssistantRegistry } from './assistant-registry.js'
import type { SessionStore } from '../sessions/session-store.js'
import { createChildLogger } from '../utils/log.js'

const log = createChildLogger({ module: 'assistant-manager' })

/** Subset of VibenCore methods needed by AssistantManager, avoiding a circular import. */
interface AssistantManagerCore {
  createSession(params: {
    channelId: string
    agentName: string
    workingDirectory: string
    initialName?: string
    isAssistant?: boolean
    threadId?: string
    existingSessionId?: string
  }): Promise<Session>
  connectSessionBridge(session: Session): void
  configManager: {
    get(): { defaultAgent: string }
    resolveWorkspace(): string
  }
  sessionStore: SessionStore | null
}

/**
 * Manages the Viben built-in assistant session.
 *
 * The assistant is a special session (marked with `isAssistant: true`) that
 * can answer questions about the running Viben system — sessions, agents,
 * config, etc. Unlike user-created sessions, it is created and managed by
 * core, and its system prompt is dynamically composed from registry sections
 * that inject live system state.
 *
 * One assistant session exists per channel. The system prompt is built at
 * spawn time and deferred — it's prepended to the first user message rather
 * than sent immediately, so the agent receives it alongside real context.
 */
export class AssistantManager {
  private sessions = new Map<string, Session>()
  private pendingSystemPrompts = new Map<string, string>()

  constructor(
    private core: AssistantManagerCore,
    private registry: AssistantRegistry,
  ) {}

  /**
   * Returns the assistant session for a channel, creating one if needed.
   *
   * If a persisted assistant session exists in the store, it is reused
   * (same session ID) to preserve conversation history. The system prompt
   * is always rebuilt fresh and deferred until the first user message.
   */
  async getOrSpawn(channelId: string, threadId: string): Promise<Session> {
    const existing = this.core.sessionStore?.findAssistant(channelId)
    const session = await this.core.createSession({
      channelId,
      agentName: this.core.configManager.get().defaultAgent,
      workingDirectory: this.core.configManager.resolveWorkspace(),
      initialName: 'Assistant',
      isAssistant: true,
      threadId,
      existingSessionId: existing?.sessionId,
    })
    this.sessions.set(channelId, session)

    // Build the system prompt now but don't send it yet — it will be
    // prepended to the first real user message via consumePendingSystemPrompt()
    const systemPrompt = this.registry.buildSystemPrompt(channelId)
    this.pendingSystemPrompts.set(channelId, systemPrompt)
    log.info(
      { sessionId: session.id, channelId, reused: !!existing },
      existing ? 'Assistant session reused (system prompt deferred)' : 'Assistant spawned (system prompt deferred)',
    )

    return session
  }

  /** Returns the active assistant session for a channel, or null if none exists. */
  get(channelId: string): Session | null {
    return this.sessions.get(channelId) ?? null
  }

  /**
   * Consume and return any pending system prompt for a channel.
   * Should be prepended to the first real user message.
   */
  consumePendingSystemPrompt(channelId: string): string | undefined {
    const prompt = this.pendingSystemPrompts.get(channelId)
    if (prompt) this.pendingSystemPrompts.delete(channelId)
    return prompt
  }

  /** Checks whether a given session ID belongs to the built-in assistant. */
  isAssistant(sessionId: string): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === sessionId) return true
    }
    return false
  }
}
