import type { AgentManager } from "../agents/agent-manager.js";
import type { SessionManager } from "./session-manager.js";
import type { SpeechService } from "../../plugins/speech/exports.js";
import type { EventBus } from "../event-bus.js";
import type { NotificationManager } from "../../plugins/notifications/notification.js";
import type { TunnelService } from "../../plugins/tunnel/tunnel-service.js";
import type { AgentEvent } from "../types.js";
import type { MiddlewareChain } from "../plugin/middleware-chain.js";
import type { SessionStore } from "./session-store.js";
import type { IChannelAdapter } from "../channel.js";
import type { ConfigManager } from "../config/config.js";
import type { AgentCatalog } from "../agents/agent-catalog.js";
import type { ContextManager } from "../../plugins/context/context-manager.js";
import type { ContextQuery, ContextOptions, ContextResult } from "../../plugins/context/context-provider.js";
import { Session } from "./session.js";
import { createChildLogger } from "../utils/log.js";
import { Hook, BusEvent, SessionEv } from "../events.js";

const log = createChildLogger({ module: "session-factory" });

/** Parameters for creating a new session — used by SessionFactory.create() and Core.createFullSession(). */
export interface SessionCreateParams {
  channelId: string;
  agentName: string;
  workingDirectory: string;
  resumeAgentSessionId?: string;
  existingSessionId?: string;
  initialName?: string;
  isAssistant?: boolean;
  /** User ID from identity system — who is creating this session. */
  userId?: string;
  /** Glob patterns matched against bash command descriptions to auto-approve without user prompts. */
  autoApprovedCommands?: string[];
}

export interface SideEffectDeps {
  eventBus: EventBus;
  notificationManager: NotificationManager;
  tunnelService?: TunnelService;
}

/**
 * Constructs new Sessions with the right agent, working directory, and initial state.
 *
 * Handles agent spawning (or resuming from a previous ACP session), middleware integration,
 * ACP state hydration, and side-effect wiring (usage tracking, tunnel cleanup).
 * Also provides lazy resume: when a message arrives for a stored (not live) session,
 * the factory transparently resumes it by re-spawning the agent with the stored session ID.
 */
export class SessionFactory {
  middlewareChain?: MiddlewareChain;
  private resumeLocks: Map<string, Promise<Session | null>> = new Map();

  /** Injected by Core after construction — needed for lazy resume error feedback */
  adapters?: Map<string, IChannelAdapter>;
  /** Injected by Core after construction — needed for lazy resume store lookup */
  sessionStore?: SessionStore | null;
  /** Injected by Core — creates full session with thread + bridge + persist */
  createFullSession?: (params: SessionCreateParams & { threadId?: string; createThread?: boolean }) => Promise<Session>;
  /** Injected by Core — needed for resolving default agent and workspace */
  configManager?: ConfigManager;
  /** Injected by Core — needed for resolving agent definitions */
  agentCatalog?: AgentCatalog;
  /** Injected by Core — needed for context-aware session creation */
  getContextManager?: () => ContextManager | undefined;
  /** Injected by Core — returns extra filesystem paths the agent is allowed to read.
   *  Used to whitelist the file-service upload directory so agents can read attachments
   *  saved outside the workspace (e.g. ~/.viben/instances/main/files/). */
  getAgentAllowedPaths?: () => string[];

  constructor(
    private agentManager: AgentManager,
    private sessionManager: SessionManager,
    private speechServiceAccessor: SpeechService | (() => SpeechService),
    private eventBus: EventBus,
    private instanceRoot?: string,
  ) {}

  private get speechService(): SpeechService {
    return typeof this.speechServiceAccessor === 'function'
      ? this.speechServiceAccessor()
      : this.speechServiceAccessor;
  }

  /**
   * Create a new Session: spawn agent → create Session instance → hydrate ACP state → register.
   * Runs session:beforeCreate middleware (which can modify params or block creation).
   */
  async create(params: SessionCreateParams): Promise<Session> {
    // Hook: session:beforeCreate — modifiable, can block
    let createParams = params;
    if (this.middlewareChain) {
      const payload = {
        agentName: params.agentName,
        workingDir: params.workingDirectory,
        userId: params.userId ?? '',
        channelId: params.channelId,
        threadId: '', // threadId is assigned after session creation
      };
      const result = await this.middlewareChain.execute(Hook.SESSION_BEFORE_CREATE, payload, async (p) => p);
      if (!result) throw new Error("Session creation blocked by middleware");
      // Apply any middleware modifications back to create params
      createParams = {
        ...params,
        agentName: result.agentName,
        workingDirectory: result.workingDir,
        channelId: result.channelId,
      };
    }

    // 1. Spawn or resume agent
    // Include config-level allowedPaths so agents can read whitelisted directories from startup
    const configAllowedPaths = this.configManager?.get().workspace?.security?.allowedPaths ?? [];

    let agentInstance;
    try {
      if (createParams.resumeAgentSessionId) {
        try {
          agentInstance = await this.agentManager.resume(
            createParams.agentName,
            createParams.workingDirectory,
            createParams.resumeAgentSessionId,
            configAllowedPaths,
          );
        } catch (resumeErr) {
          // Resume failed (session expired after restart) — fall back to fresh spawn
          log.warn(
            { agentName: createParams.agentName, resumeErr },
            "Agent session resume failed, falling back to fresh spawn",
          );
          agentInstance = await this.agentManager.spawn(
            createParams.agentName,
            createParams.workingDirectory,
            configAllowedPaths,
          );
        }
      } else {
        agentInstance = await this.agentManager.spawn(
          createParams.agentName,
          createParams.workingDirectory,
          configAllowedPaths,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);

      // Emit a structured guidance error so adapters (Telegram, SSE UI) can show clear next steps.
      // We intentionally avoid leaking internal paths — instead, we point users at the viben wrapper.
      const guidanceLines = [
        `❌ Failed to start agent "${createParams.agentName}": ${message}`,
        "",
        "Run the agent CLI once in a terminal for this Viben instance to complete login or setup.",
      ];
      if (this.instanceRoot) {
        guidanceLines.push(
          "",
          "Copy and run this command in your terminal:",
          `  cd "${this.instanceRoot}" && viben agents run ${createParams.agentName}`,
        );
      } else {
        guidanceLines.push(
          "",
          "Copy and run this command in your terminal (same project where you started Viben):",
          `  viben agents run ${createParams.agentName}`,
        );
      }
      guidanceLines.push(
        "",
        "After setup completes, retry creating the session here.",
      );

      const guidance: AgentEvent = {
        type: "system_message",
        message: guidanceLines.join("\n"),
      };

      // Emit the error event directly on the event bus so UIs (SSE, adapters) can
      // display it. We intentionally do NOT register a session — the dummy session
      // would never be cleaned up, leaking memory in SessionManager.
      const failedSessionId = createParams.existingSessionId ?? `failed-${Date.now()}`;
      this.eventBus.emit(BusEvent.AGENT_EVENT, {
        sessionId: failedSessionId,
        turnId: '',
        event: guidance,
      });

      // Re-throw so callers still see the failure
      throw err;
    }

    // Whitelist extra paths (e.g. file-service upload dir) so agents can read attachments
    // saved outside the workspace boundary without lifting the workspace guard entirely.
    const extraPaths = this.getAgentAllowedPaths?.() ?? [];
    for (const p of extraPaths) {
      agentInstance.addAllowedPath(p);
    }

    // Wire middleware chain to agent instance for FS/terminal hooks
    agentInstance.middlewareChain = this.middlewareChain;

    // 2. Create Session instance
    const session = new Session({
      id: createParams.existingSessionId,
      channelId: createParams.channelId,
      agentName: createParams.agentName,
      workingDirectory: createParams.workingDirectory,
      agentInstance,
      speechService: this.speechService,
      autoApprovedCommands: createParams.autoApprovedCommands,
    });
    session.agentSessionId = agentInstance.sessionId;
    session.middlewareChain = this.middlewareChain;
    if (createParams.initialName) {
      session.name = createParams.initialName;
    }

    // 3. Propagate ACP state from agent session response
    session.applySpawnResponse(agentInstance.initialSessionResponse, agentInstance.agentCapabilities);

    // 4. Register in SessionManager
    this.sessionManager.registerSession(session);
    if (!session.isAssistant) {
      this.eventBus.emit(BusEvent.SESSION_CREATED, {
        sessionId: session.id,
        name: session.name,
        agent: session.agentName,
        status: session.status,
        userId: createParams.userId,
      });
    }

    return session;
  }

  /**
   * Get active session by thread, or attempt lazy resume from store.
   * Used by adapter command handlers and handleMessage().
   */
  async getOrResume(channelId: string, threadId: string): Promise<Session | null> {
    const session = this.sessionManager.getSessionByThread(channelId, threadId);
    if (session) return session;
    return this.lazyResume(channelId, threadId);
  }

  async getOrResumeById(sessionId: string): Promise<Session | null> {
    const live = this.sessionManager.getSession(sessionId);
    if (live) return live;

    if (!this.sessionStore || !this.createFullSession) return null;
    const record = this.sessionStore.get(sessionId);
    if (!record) return null;
    if (record.isAssistant) return null;
    if (record.status === "error" || record.status === "cancelled") return null;

    // Deduplicate concurrent resumes for the same session
    const existing = this.resumeLocks.get(sessionId);
    if (existing) return existing;

    const resumePromise = (async (): Promise<Session | null> => {
      try {
        const p = record.platform as { topicId?: number; threadId?: string } | undefined;
        const existingThreadId = p?.topicId ? String(p.topicId) : p?.threadId;
        const session = await this.createFullSession!({
          channelId: record.channelId,
          agentName: record.agentName,
          workingDirectory: record.workingDir,
          resumeAgentSessionId: record.agentSessionId,
          existingSessionId: record.sessionId,
          initialName: record.name,
          threadId: existingThreadId,
        });
        session.activate();
        if (record.clientOverrides) {
          session.clientOverrides = record.clientOverrides;
        } else if (record.dangerousMode) {
          session.clientOverrides = { bypassPermissions: true };
        }
        if (record.firstAgent) session.firstAgent = record.firstAgent;
        if (record.agentSwitchHistory) session.agentSwitchHistory = record.agentSwitchHistory;
        if (record.currentPromptCount != null) session.promptCount = record.currentPromptCount;
        if (record.attachedAdapters) session.attachedAdapters = record.attachedAdapters;
        if (record.platforms) {
          for (const [adapterId, platformData] of Object.entries(record.platforms)) {
            const data = platformData as Record<string, unknown>;
            const tid = adapterId === "telegram"
              ? String(data.topicId ?? "")
              : String(data.threadId ?? "");
            if (tid) session.threadIds.set(adapterId, tid);
          }
        }
        if (record.acpState) {
          if (record.acpState.configOptions && session.configOptions.length === 0) {
            session.setInitialConfigOptions(record.acpState.configOptions);
          }
          if (record.acpState.agentCapabilities && !session.agentCapabilities) {
            session.setAgentCapabilities(record.acpState.agentCapabilities);
          }
        }

        // Re-apply persisted configOptions that differ from what the live agent reports.
        // Agents spawn with default values; without this step the persisted user preference
        // (e.g. mode=bypassPermissions) silently diverges from the agent's actual state.
        if (record.acpState?.configOptions) {
          for (const persisted of record.acpState.configOptions) {
            const live = session.getConfigOption(persisted.id);
            if (live && live.currentValue !== persisted.currentValue) {
              try {
                await session.setConfigOption(persisted.id, {
                  type: persisted.type,
                  value: persisted.currentValue as string & boolean,
                });
              } catch { /* best-effort — don't fail resume if one option sync fails */ }
            }
          }
        }

        log.info({ sessionId }, "Lazy resume by ID successful");
        return session;
      } catch (err) {
        log.error({ err, sessionId }, "Lazy resume by ID failed");
        return null;
      } finally {
        this.resumeLocks.delete(sessionId);
      }
    })();

    this.resumeLocks.set(sessionId, resumePromise);
    return resumePromise;
  }

  /**
   * Attempt to resume a session from disk when a message arrives on a thread with
   * no live session. Deduplicates concurrent resume attempts for the same thread
   * via resumeLocks to avoid spawning multiple agents.
   */
  private async lazyResume(channelId: string, threadId: string): Promise<Session | null> {
    const store = this.sessionStore;
    if (!store || !this.createFullSession) return null;

    const lockKey = `${channelId}:${threadId}`;

    // Check for existing resume in progress
    const existing = this.resumeLocks.get(lockKey);
    if (existing) return existing;

    const record = store.findByPlatform(
      channelId,
      (p) => String(p.topicId) === threadId || String(p.threadId ?? "") === threadId,
    );
    if (!record) {
      log.debug({ threadId, channelId }, "No session record found for thread");
      return null;
    }
    if (record.isAssistant) return null;

    // Don't resume errored or cancelled sessions
    if (record.status === "error" || record.status === "cancelled") {
      log.warn(
        { threadId, sessionId: record.sessionId, status: record.status },
        "Session record found but skipped (status: %s) — use /new to start a fresh session",
        record.status,
      );
      return null;
    }

    log.info({ threadId, sessionId: record.sessionId, status: record.status }, "Lazy resume: found record, attempting resume");

    const resumePromise = (async (): Promise<Session | null> => {
      try {
        const session = await this.createFullSession!({
          channelId: record.channelId,
          agentName: record.agentName,
          workingDirectory: record.workingDir,
          resumeAgentSessionId: record.agentSessionId,
          existingSessionId: record.sessionId,
          initialName: record.name,
          threadId,
        });
        session.activate();
        // MIGRATION: old records with dangerousMode but no clientOverrides
        if (record.clientOverrides) {
          session.clientOverrides = record.clientOverrides;
        } else if (record.dangerousMode) {
          session.clientOverrides = { bypassPermissions: true };
        }
        if (record.firstAgent) session.firstAgent = record.firstAgent;
        if (record.agentSwitchHistory) session.agentSwitchHistory = record.agentSwitchHistory;
        if (record.currentPromptCount != null) session.promptCount = record.currentPromptCount;

        // Restore multi-adapter state
        if (record.attachedAdapters) {
          session.attachedAdapters = record.attachedAdapters;
        }
        if (record.platforms) {
          for (const [adapterId, platformData] of Object.entries(record.platforms)) {
            const data = platformData as Record<string, unknown>;
            const tid = adapterId === "telegram"
              ? String(data.topicId ?? "")
              : String(data.threadId ?? "");
            if (tid) session.threadIds.set(adapterId, tid);
          }
        }

        // Hydrate cached ACP state only as fallback — fresh agent data takes precedence
        if (record.acpState) {
          if (record.acpState.configOptions && session.configOptions.length === 0) {
            session.setInitialConfigOptions(record.acpState.configOptions);
          }
          if (record.acpState.agentCapabilities && !session.agentCapabilities) {
            session.setAgentCapabilities(record.acpState.agentCapabilities);
          }
        }

        // Re-apply persisted configOptions that differ from what the live agent reports.
        // Agents spawn with default values; without this step the persisted user preference
        // (e.g. mode=bypassPermissions) silently diverges from the agent's actual state.
        if (record.acpState?.configOptions) {
          for (const persisted of record.acpState.configOptions) {
            const live = session.getConfigOption(persisted.id);
            if (live && live.currentValue !== persisted.currentValue) {
              try {
                await session.setConfigOption(persisted.id, {
                  type: persisted.type,
                  value: persisted.currentValue as string & boolean,
                });
              } catch { /* best-effort — don't fail resume if one option sync fails */ }
            }
          }
        }

        // If resume fell back to a fresh spawn (session.agentSessionId differs from record),
        // inject conversation history so the new agent has context from previous sessions.
        const resumeFalledBack = record.agentSessionId && session.agentSessionId !== record.agentSessionId;
        if (resumeFalledBack) {
          log.info({ sessionId: session.id }, "Resume fell back to fresh spawn — injecting conversation history");
          const contextManager = this.getContextManager?.();
          if (contextManager) {
            try {
              const config = this.configManager?.get();
              const labelAgent = config?.agentSwitch?.labelHistory ?? true;
              const contextResult = await contextManager.buildContext(
                { type: 'session', value: record.sessionId, repoPath: record.workingDir },
                { labelAgent, noCache: true },
              );
              if (contextResult?.markdown) {
                session.setContext(contextResult.markdown);
              }
            } catch { /* context injection is best-effort */ }
          }
        }

        log.info({ sessionId: session.id, threadId }, "Lazy resume successful");
        return session;
      } catch (err) {
        log.error({ err, record }, "Lazy resume failed");
        // Send error feedback to user
        const adapter = this.adapters?.get(channelId);
        if (adapter) {
          try {
            await adapter.sendMessage(threadId, {
              type: "error",
              text: `⚠️ Failed to resume session: ${err instanceof Error ? err.message : String(err)}`,
            });
          } catch { /* best effort */ }
        }
        return null;
      } finally {
        this.resumeLocks.delete(lockKey);
      }
    })();

    this.resumeLocks.set(lockKey, resumePromise);
    return resumePromise;
  }

  /** Create a brand-new session, resolving agent name and workspace from config if not provided. */
  async handleNewSession(
    channelId: string,
    agentName?: string,
    workspacePath?: string,
    options?: { createThread?: boolean; threadId?: string },
  ): Promise<Session> {
    if (!this.configManager || !this.agentCatalog || !this.createFullSession) {
      throw new Error("SessionFactory not fully initialized");
    }
    const config = this.configManager.get();
    const resolvedAgent = agentName || config.defaultAgent;
    log.info({ channelId, agentName: resolvedAgent }, "New session request");
    const agentDef = this.agentCatalog.resolve(resolvedAgent);
    const resolvedWorkspace = this.configManager.resolveWorkspace(
      workspacePath || agentDef?.workingDirectory,
    );

    return this.createFullSession({
      channelId,
      agentName: resolvedAgent,
      workingDirectory: resolvedWorkspace,
      ...options,
    });
  }

  /** NOTE: handleNewChat is currently dead code — never called outside core.ts itself.
   *  Moving it anyway for completeness; can be removed in a future cleanup. */
  async handleNewChat(
    channelId: string,
    currentThreadId: string,
  ): Promise<Session | null> {
    const currentSession = this.sessionManager.getSessionByThread(
      channelId,
      currentThreadId,
    );

    if (currentSession) {
      return this.handleNewSession(
        channelId,
        currentSession.agentName,
        currentSession.workingDirectory,
      );
    }

    // Fallback: look up from store
    const record = this.sessionManager.getRecordByThread(
      channelId,
      currentThreadId,
    );
    if (!record || record.status === "cancelled" || record.status === "error")
      return null;

    return this.handleNewSession(
      channelId,
      record.agentName,
      record.workingDir,
    );
  }

  /** Create a session and inject conversation context from a ContextProvider (e.g., history from a previous session). */
  async createSessionWithContext(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    contextQuery: ContextQuery;
    contextOptions?: ContextOptions;
    createThread?: boolean;
    threadId?: string;
  }): Promise<{ session: Session; contextResult: ContextResult | null }> {
    if (!this.createFullSession) throw new Error("SessionFactory not fully initialized");

    let contextResult: ContextResult | null = null;
    const contextManager = this.getContextManager?.();
    if (contextManager) {
      try {
        contextResult = await contextManager.buildContext(
          params.contextQuery,
          params.contextOptions,
        );
      } catch (err) {
        log.warn({ err }, "Context building failed, proceeding without context");
      }
    }

    const session = await this.createFullSession({
      channelId: params.channelId,
      agentName: params.agentName,
      workingDirectory: params.workingDirectory,
      createThread: params.createThread,
      threadId: params.threadId,
    });

    if (contextResult) {
      session.setContext(contextResult.markdown);
    }

    return { session, contextResult };
  }

  /** Wire session-level side effects: usage tracking (via EventBus) and tunnel cleanup on session end. */
  wireSideEffects(session: Session, deps: SideEffectDeps): void {
    // Wire usage tracking via event bus (consumed by usage plugin)
    session.on(SessionEv.AGENT_EVENT, (event: AgentEvent) => {
      if (event.type !== "usage") return;
      deps.eventBus.emit(BusEvent.USAGE_RECORDED, {
        sessionId: session.id,
        agentName: session.agentName,
        timestamp: new Date().toISOString(),
        tokensUsed: event.tokensUsed ?? 0,
        contextSize: event.contextSize ?? 0,
        cost: event.cost,
      });
    });

    // Clean up user tunnels when session ends
    session.on(SessionEv.STATUS_CHANGE, (_from, to) => {
      if ((to === "finished" || to === "cancelled") && deps.tunnelService) {
        deps.tunnelService
          .stopBySession(session.id)
          .then((stopped) => {
            for (const entry of stopped) {
              deps.notificationManager
                .notifyAll({
                  sessionId: session.id,
                  sessionName: session.name,
                  type: "completed",
                  summary: `Tunnel stopped: port ${entry.port}${entry.label ? ` (${entry.label})` : ""} — session ended`,
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    });
  }
}
