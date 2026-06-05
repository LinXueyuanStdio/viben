import type { AgentManager } from "./agents/agent-manager.js";
import type { SessionManager } from "./sessions/session-manager.js";
import type { ConfigManager } from "./config/config.js";
import type { SessionBridge } from "./sessions/session-bridge.js";
import type { Session } from "./sessions/session.js";
import type { IChannelAdapter } from "./channel.js";
import type { EventBus } from "./event-bus.js";
import type { MiddlewareChain } from "./plugin/middleware-chain.js";
import type { AgentEvent } from "./types.js";
import type { ContextManager } from "../plugins/context/context-manager.js";
import { getAgentCapabilities } from "./agents/agent-registry.js";
import { createChildLogger } from "./utils/log.js";
import { Hook, BusEvent, SessionEv } from "./events.js";

const log = createChildLogger({ module: "agent-switch" });

/** Dependencies injected from VibenCore to avoid circular imports. */
export interface AgentSwitchDeps {
  sessionManager: SessionManager;
  agentManager: AgentManager;
  configManager: ConfigManager;
  eventBus: EventBus;
  adapters: Map<string, IChannelAdapter>;
  bridges: Map<string, SessionBridge>;
  createBridge: (session: Session, adapter: IChannelAdapter, adapterId?: string) => SessionBridge;
  getSessionBridgeKeys: (sessionId: string) => string[];
  getMiddlewareChain: () => MiddlewareChain | undefined;
  getService: <T>(name: string) => T | undefined;
}

/**
 * Coordinates the state transitions required when switching agents mid-session.
 *
 * Switching agents is a multi-step process with rollback support:
 * 1. Run `agent:beforeSwitch` middleware (blocking — plugins can veto)
 * 2. Determine whether to resume a previous agent session or spawn fresh
 * 3. Disconnect all SessionBridges and clean up adapter state
 * 4. Replace the agent instance on the session (with rollback on failure)
 * 5. Reconnect all bridges to the new agent
 * 6. Persist updated session record
 * 7. Fire `agent:afterSwitch` middleware (non-blocking)
 *
 * A per-session lock prevents concurrent switches on the same session.
 */
export class AgentSwitchHandler {
  /** Prevents concurrent switch operations on the same session */
  private switchingLocks = new Set<string>();

  constructor(private deps: AgentSwitchDeps) {}

  /**
   * Switch a session to a different agent. Returns whether the previous
   * agent session was resumed or a new one was spawned.
   */
  async switch(sessionId: string, toAgent: string): Promise<{ resumed: boolean }> {
    if (this.switchingLocks.has(sessionId)) {
      throw new Error('Switch already in progress');
    }
    this.switchingLocks.add(sessionId);
    try {
      return await this.doSwitch(sessionId, toAgent);
    } finally {
      this.switchingLocks.delete(sessionId);
    }
  }

  private async doSwitch(sessionId: string, toAgent: string): Promise<{ resumed: boolean }> {
    const { sessionManager, agentManager, configManager, eventBus, adapters, bridges, createBridge } = this.deps;

    const session = sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const agentDef = agentManager.getAgent(toAgent);
    if (!agentDef) throw new Error(`Agent "${toAgent}" is not installed`);

    const fromAgent = session.agentName;

    // 1. Middleware: agent:beforeSwitch (blocking)
    const middlewareChain = this.deps.getMiddlewareChain();
    const result = await middlewareChain?.execute(Hook.AGENT_BEFORE_SWITCH, {
      sessionId,
      fromAgent,
      toAgent,
    }, async (payload) => payload);
    if (middlewareChain && !result) throw new Error('Agent switch blocked by middleware');

    // 2. Determine resume vs new — if the agent was used before in this session
    //    and supports resume, reconnect to its previous subprocess instead of spawning fresh
    const lastEntry = session.findLastSwitchEntry(toAgent);
    const caps = getAgentCapabilities(toAgent);
    const canResume = !!(lastEntry && caps.supportsResume);
    let resumed = false;

    // Emit "starting" events so UI can reflect long-running switches
    const startEvent: AgentEvent = {
      type: "system_message",
      message: `Switching from ${fromAgent} to ${toAgent}...`,
    };
    session.emit(SessionEv.AGENT_EVENT, startEvent);
    eventBus.emit(BusEvent.AGENT_EVENT, { sessionId, turnId: '', event: startEvent });
    eventBus.emit(BusEvent.SESSION_AGENT_SWITCH, {
      sessionId,
      fromAgent,
      toAgent,
      status: "starting",
    });

    // 3. Disconnect ALL bridges for this session
    const sessionBridgeKeys = this.deps.getSessionBridgeKeys(sessionId);
    const hadBridges = sessionBridgeKeys.length > 0;
    for (const key of sessionBridgeKeys) {
      const bridge = bridges.get(key);
      if (bridge) {
        bridges.delete(key);
        bridge.disconnect();
      }
    }

    const switchAdapter = adapters.get(session.channelId);
    if (switchAdapter?.sendSkillCommands) {
      await switchAdapter.sendSkillCommands(session.id, []);
    }
    if (switchAdapter?.cleanupSessionState) {
      await switchAdapter.cleanupSessionState(session.id);
    }

    const fromAgentSessionId = session.agentSessionId;

    // 4. Switch agent on session (with rollback on failure).
    //    switchAgent() replaces the session's agent instance atomically — if the
    //    factory callback throws, the session state is unchanged.
    const fileService = this.deps.getService<import('../plugins/file-service/file-service.js').FileService>('file-service');
    const configAllowedPaths = configManager.get().workspace?.security?.allowedPaths ?? [];
    try {
      await session.switchAgent(toAgent, async () => {
        if (canResume) {
          try {
            const instance = await agentManager.resume(toAgent, session.workingDirectory, lastEntry!.agentSessionId, configAllowedPaths);
            if (fileService) instance.addAllowedPath(fileService.baseDir);
            resumed = true;
            return instance;
          } catch {
            // Resume failed (session expired or unavailable) — fall through to spawn with context
            log.warn({ sessionId, toAgent }, "Resume failed, falling back to new agent with context injection");
          }
        }

        // Fresh spawn: inject conversation history from the context service so the
        // new agent has awareness of what was discussed with the previous agent
        const instance = await agentManager.spawn(toAgent, session.workingDirectory, configAllowedPaths);
        if (fileService) instance.addAllowedPath(fileService.baseDir);
        try {
          const contextService = this.deps.getService<ContextManager>('context');
          if (contextService) {
            const config = configManager.get();
            const labelAgent = config.agentSwitch?.labelHistory ?? true;
            await contextService.flushSession(sessionId);
            const contextResult = await contextService.buildContext(
              { type: 'session', value: sessionId, repoPath: session.workingDirectory },
              { labelAgent, noCache: true },
            );
            if (contextResult?.markdown) {
              session.setContext(contextResult.markdown);
            }
          }
        } catch {
          // Context injection is best-effort
        }
        return instance;
      });

      const successEvent: AgentEvent = {
        type: "system_message",
        message: resumed
          ? `Switched to ${toAgent} (resumed previous session).`
          : `Switched to ${toAgent} (new session).`,
      };
      session.emit(SessionEv.AGENT_EVENT, successEvent);
      eventBus.emit(BusEvent.AGENT_EVENT, { sessionId, turnId: '', event: successEvent });
      eventBus.emit(BusEvent.SESSION_AGENT_SWITCH, {
        sessionId,
        fromAgent,
        toAgent,
        status: "succeeded",
        resumed,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      const failedEvent: AgentEvent = {
        type: "system_message",
        message: `Failed to switch to ${toAgent}: ${errorMessage}`,
      };
      session.emit(SessionEv.AGENT_EVENT, failedEvent);
      eventBus.emit(BusEvent.AGENT_EVENT, { sessionId, turnId: '', event: failedEvent });
      eventBus.emit(BusEvent.SESSION_AGENT_SWITCH, {
        sessionId,
        fromAgent,
        toAgent,
        status: "failed",
        error: errorMessage,
      });

      // Rollback
      try {
        let rollbackInstance;
        try {
          rollbackInstance = await agentManager.resume(fromAgent, session.workingDirectory, fromAgentSessionId);
        } catch {
          rollbackInstance = await agentManager.spawn(fromAgent, session.workingDirectory);
        }
        const oldInstance = rollbackInstance;
        session.agentSwitchHistory.pop();
        session.agentInstance = oldInstance;
        session.agentName = fromAgent;
        session.agentSessionId = oldInstance.sessionId;
        // Reconnect all bridges on rollback
        for (const adapterId of session.attachedAdapters) {
          const adapter = adapters.get(adapterId);
          if (adapter) {
            createBridge(session, adapter, adapterId).connect();
          }
        }
        log.warn({ sessionId, fromAgent, toAgent, err }, "Agent switch failed, rolled back to previous agent");
      } catch (rollbackErr) {
        session.fail(`Switch failed and rollback failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`);
        log.error({ sessionId, fromAgent, toAgent, err, rollbackErr }, "Agent switch failed and rollback also failed");
      }
      throw err;
    }

    // 5. Reconnect bridges for ALL attached adapters
    if (hadBridges) {
      for (const adapterId of session.attachedAdapters) {
        const adapter = adapters.get(adapterId);
        if (adapter) {
          createBridge(session, adapter, adapterId).connect();
        } else {
          log.warn({ sessionId, adapterId }, "Adapter not available during switch reconnect, skipping bridge");
        }
      }
    }

    // 6. Persist
    await sessionManager.patchRecord(sessionId, {
      agentName: toAgent,
      agentSessionId: session.agentSessionId,
      firstAgent: session.firstAgent,
      currentPromptCount: 0,
      agentSwitchHistory: session.agentSwitchHistory,
    });

    // 7. Middleware: agent:afterSwitch (fire-and-forget)
    middlewareChain?.execute(Hook.AGENT_AFTER_SWITCH, {
      sessionId,
      fromAgent,
      toAgent,
      resumed,
    }, async (p) => p).catch(() => {});

    return { resumed };
  }
}
