import type { AgentManager } from "../agents/agent-manager.js";
import { Session } from "./session.js";
import type { SessionStore } from "./session-store.js";
import type { EventBus } from "../event-bus.js";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import type { SessionStatus, ConfigOption, AgentCapabilities } from "../types.js";
import { Hook, BusEvent } from "../events.js";

/** Flattened view of a session for API consumers — merges live state with stored record. */
export interface SessionSummary {
  id: string;
  agent: string;
  status: SessionStatus;
  name: string | null;
  workspace: string;
  channelId: string;
  createdAt: string;
  lastActiveAt: string | null;
  dangerousMode: boolean;
  queueDepth: number;
  promptRunning: boolean;
  configOptions?: ConfigOption[];
  capabilities: AgentCapabilities | null;
  isLive: boolean;
}

/**
 * Registry for live Session instances. Provides lookup by session ID, channel+thread,
 * or agent session ID. Coordinates session lifecycle: creation, cancellation, persistence,
 * and graceful shutdown.
 *
 * Live sessions are kept in an in-memory Map. The optional SessionStore handles
 * disk persistence — the manager delegates save/patch/remove operations to the store.
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private store: SessionStore | null;
  private eventBus?: EventBus;
  middlewareChain?: MiddlewareChain;
  // Set to true after shutdownAll() flushes "finished" state to disk.
  // Prevents SessionBridge STATUS_CHANGE listeners from overwriting the flushed state
  // with transient error status from in-flight prompts that fail after shutdown.
  private _shutdownComplete = false;

  /**
   * Inject the EventBus after construction. Deferred because EventBus is created
   * after SessionManager during bootstrap, so it cannot be passed to the constructor.
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  constructor(store: SessionStore | null = null) {
    this.store = store;
  }

  /** Create a new session by spawning an agent and persisting the initial record. */
  async createSession(
    channelId: string,
    agentName: string,
    workingDirectory: string,
    agentManager: AgentManager,
    options?: { autoApprovedCommands?: string[] },
  ): Promise<Session> {
    const agentInstance = await agentManager.spawn(agentName, workingDirectory);
    const session = new Session({
      channelId,
      agentName,
      workingDirectory,
      agentInstance,
      autoApprovedCommands: options?.autoApprovedCommands ?? [],
    });
    this.sessions.set(session.id, session);
    session.agentSessionId = session.agentInstance.sessionId;

    if (this.store) {
      await this.store.save({
        sessionId: session.id,
        agentSessionId: session.agentInstance.sessionId,
        agentName: session.agentName,
        workingDir: session.workingDirectory,
        channelId,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        lastActiveAt: new Date().toISOString(),
        name: session.name,
        clientOverrides: {},
        platform: {},
      });
    }

    return session;
  }

  /** Look up a live session by its Viben session ID. */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /** Look up a live session by adapter channel and thread ID (checks per-adapter threadIds map first, then legacy fields). */
  getSessionByThread(channelId: string, threadId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      // New: check per-adapter threadIds map
      const adapterThread = session.threadIds.get(channelId);
      if (adapterThread === threadId) return session;
      // Backward compat: check legacy channelId + threadId
      if (session.channelId === channelId && session.threadId === threadId) {
        return session;
      }
    }
    return undefined;
  }

  /** Look up a live session by the agent's internal session ID (assigned by the ACP subprocess). */
  getSessionByAgentSessionId(agentSessionId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.agentSessionId === agentSessionId) {
        return session;
      }
    }
    return undefined;
  }

  /** Look up the persisted SessionRecord by the agent's internal session ID. */
  getRecordByAgentSessionId(
    agentSessionId: string,
  ): import("../types.js").SessionRecord | undefined {
    return this.store?.findByAgentSessionId(agentSessionId);
  }

  /** Look up the persisted SessionRecord by channel and thread ID. */
  getRecordByThread(
    channelId: string,
    threadId: string,
  ): import("../types.js").SessionRecord | undefined {
    return this.store?.findByPlatform(
      channelId,
      (p) => String(p.topicId) === threadId || p.threadId === threadId,
    );
  }

  /** Register a session that was created externally (e.g. restored from store on startup). */
  registerSession(session: Session): void {
    this.sessions.set(session.id, session);
  }

  /**
   * Merge a partial update into the stored SessionRecord. If no record exists yet and
   * the patch includes `sessionId`, it is treated as an initial save.
   * Pass `{ immediate: true }` to flush the store to disk synchronously.
   */
  async patchRecord(
    sessionId: string,
    patch: Partial<import("../types.js").SessionRecord>,
    options?: { immediate?: boolean },
  ): Promise<void> {
    if (!this.store) return;
    // After shutdown, the store was already flushed with terminal state — ignore further patches
    // to prevent in-flight prompt failures from overwriting "finished" with "error" on disk.
    if (this._shutdownComplete) return;
    const record = this.store.get(sessionId);
    if (record) {
      await this.store.save({ ...record, ...patch });
    } else if (patch.sessionId) {
      // Initial save — treat patch as full record
      await this.store.save(patch as import("../types.js").SessionRecord);
    }
    if (options?.immediate) {
      this.store.flush();
    }
  }

  /** Retrieve the persisted SessionRecord for a given session ID. Returns undefined if no store or record not found. */
  getSessionRecord(
    sessionId: string,
  ): import("../types.js").SessionRecord | undefined {
    return this.store?.get(sessionId);
  }

  /** Cancel a session: abort in-flight prompt, transition to cancelled, destroy agent, and persist. */
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.abortPrompt();
      } catch {
        // Agent may already be dead — continue with cleanup
      }
      // Skip markCancelled for sessions already in a terminal state (e.g. finished)
      // to avoid invalid state machine transition errors.
      if (session.status !== "finished" && session.status !== "cancelled") {
        session.markCancelled();
      }
      await session.destroy();
      this.sessions.delete(sessionId);
    }
    if (this.store) {
      const record = this.store.get(sessionId);
      if (record && record.status !== "cancelled" && record.status !== "finished") {
        await this.store.save({ ...record, status: "cancelled" });
      }
    }
    // Hook: session:afterDestroy — read-only, fire-and-forget
    if (this.middlewareChain) {
      this.middlewareChain.execute(Hook.SESSION_AFTER_DESTROY, { sessionId }, async (p) => p).catch(() => {});
    }
  }

  /** List live (in-memory) sessions, optionally filtered by channel. Excludes assistant sessions. */
  listSessions(channelId?: string): Session[] {
    const all = Array.from(this.sessions.values()).filter(s => !s.isAssistant);
    if (channelId) return all.filter((s) => s.channelId === channelId);
    return all;
  }

  /**
   * List all sessions (live + stored) as SessionSummary. Live sessions take precedence
   * over stored records — their real-time state (queueDepth, promptRunning) is used.
   */
  listAllSessions(channelId?: string): SessionSummary[] {
    if (this.store) {
      let records = this.store.list().filter(r => !r.isAssistant);
      if (channelId) records = records.filter((r) => r.channelId === channelId);
      return records.map((record) => {
        const live = this.sessions.get(record.sessionId);
        if (live) {
          return {
            id: live.id,
            agent: live.agentName,
            status: live.status,
            name: live.name ?? null,
            workspace: live.workingDirectory,
            channelId: live.channelId,
            createdAt: live.createdAt.toISOString(),
            lastActiveAt: record.lastActiveAt ?? null,
            dangerousMode: live.clientOverrides.bypassPermissions ?? false,
            queueDepth: live.queueDepth,
            promptRunning: live.promptRunning,
            configOptions: live.configOptions?.length ? live.configOptions : undefined,
            capabilities: live.agentCapabilities ?? null,
            isLive: true,
          };
        }
        return {
          id: record.sessionId,
          agent: record.agentName,
          status: record.status,
          name: record.name ?? null,
          workspace: record.workingDir,
          channelId: record.channelId,
          createdAt: record.createdAt,
          lastActiveAt: record.lastActiveAt ?? null,
          dangerousMode: record.clientOverrides?.bypassPermissions ?? false,
          queueDepth: 0,
          promptRunning: false,
          configOptions: record.acpState?.configOptions,
          capabilities: record.acpState?.agentCapabilities ?? null,
          isLive: false,
        };
      });
    }

    // Fallback: no store — return live sessions only
    let live = Array.from(this.sessions.values()).filter(s => !s.isAssistant);
    if (channelId) live = live.filter((s) => s.channelId === channelId);
    return live.map((s) => ({
      id: s.id,
      agent: s.agentName,
      status: s.status,
      name: s.name ?? null,
      workspace: s.workingDirectory,
      channelId: s.channelId,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: null,
      dangerousMode: s.clientOverrides.bypassPermissions ?? false,
      queueDepth: s.queueDepth,
      promptRunning: s.promptRunning,
      configOptions: s.configOptions?.length ? s.configOptions : undefined,
      capabilities: s.agentCapabilities ?? null,
      isLive: true,
    }));
  }

  /** List all stored SessionRecords, optionally filtered by status. Excludes assistant sessions. */
  listRecords(filter?: {
    statuses?: string[];
  }): import("../types.js").SessionRecord[] {
    if (!this.store) return [];
    let records = this.store.list().filter(r => !r.isAssistant);
    if (filter?.statuses?.length) {
      records = records.filter((r) => filter.statuses!.includes(r.status));
    }
    return records;
  }

  /** Remove a session's stored record and emit a SESSION_DELETED event. */
  async removeRecord(sessionId: string): Promise<void> {
    if (!this.store) return;
    await this.store.remove(sessionId);
    this.eventBus?.emit(BusEvent.SESSION_DELETED, { sessionId });
  }

  /**
   * Graceful shutdown: persist session state without killing agent subprocesses.
   * Agent processes will exit naturally when the parent process terminates.
   */
  async shutdownAll(): Promise<void> {
    if (this.store) {
      for (const session of this.sessions.values()) {
        const record = this.store.get(session.id);
        if (record) {
          await this.store.save({
            ...record,
            status: "finished",
            acpState: session.toAcpStateSnapshot(),
            clientOverrides: session.clientOverrides,
            currentPromptCount: session.promptCount,
            agentSwitchHistory: session.agentSwitchHistory,
          });
        }
      }
      this.store.flush();
    }
    this._shutdownComplete = true;
    this.sessions.clear();
  }

  /**
   * Forcefully destroy all sessions (kill agent subprocesses).
   * Use only when sessions must be fully torn down (e.g. archive).
   * Unlike shutdownAll(), this does NOT snapshot live session state (acpState, etc.)
   * because destroyed sessions are terminal and will not be resumed.
   */
  async destroyAll(): Promise<void> {
    if (this.store) {
      for (const session of this.sessions.values()) {
        const record = this.store.get(session.id);
        if (record) {
          await this.store.save({ ...record, status: "finished" });
        }
      }
      this.store.flush();
    }
    const sessionIds = [...this.sessions.keys()];
    for (const session of this.sessions.values()) {
      await session.destroy();
    }
    this.sessions.clear();
    // Hook: session:afterDestroy — read-only, fire-and-forget
    if (this.middlewareChain) {
      for (const sessionId of sessionIds) {
        this.middlewareChain.execute(Hook.SESSION_AFTER_DESTROY, { sessionId }, async (p) => p).catch(() => {});
      }
    }
  }
}
