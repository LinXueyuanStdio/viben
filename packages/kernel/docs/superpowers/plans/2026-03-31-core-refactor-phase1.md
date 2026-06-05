# Core Refactor Phase 1 — Split `core.ts` + Organize Instance Files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `core.ts` from 929 to ~400 lines by extracting AgentSwitchHandler, moving lazy resume to SessionFactory, moving convenience creation methods to SessionFactory, and grouping instance-* files into `core/instance/`.

**Architecture:** Extract responsibilities into focused modules while keeping VibenCore as thin orchestrator. All public method signatures on VibenCore stay the same — only internal delegation changes.

**Tech Stack:** TypeScript, Vitest, ESM (.js extensions)

**Spec:** `docs/superpowers/specs/2026-03-31-core-refactor-design.md`

---

### Task 1: Create branch and group instance-* files into `core/instance/`

**Files:**
- Create: `src/core/instance/index.ts`
- Move: `src/core/instance-context.ts` → `src/core/instance/instance-context.ts`
- Move: `src/core/instance-registry.ts` → `src/core/instance/instance-registry.ts`
- Move: `src/core/instance-discovery.ts` → `src/core/instance/instance-discovery.ts`
- Move: `src/core/instance-copy.ts` → `src/core/instance/instance-copy.ts`
- Move: `src/core/__tests__/instance-context.test.ts` → `src/core/instance/__tests__/instance-context.test.ts`
- Move: `src/core/__tests__/instance-registry.test.ts` → `src/core/instance/__tests__/instance-registry.test.ts`
- Move: `src/core/__tests__/instance-discovery.test.ts` → `src/core/instance/__tests__/instance-discovery.test.ts`
- Move: `src/core/__tests__/instance-copy.test.ts` → `src/core/instance/__tests__/instance-copy.test.ts`
- Move: `src/core/__tests__/multi-instance-flows.test.ts` → `src/core/instance/__tests__/multi-instance-flows.test.ts`

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/lucas/viben-workspace/Viben
git checkout -b refactor/core-phase1
```

- [ ] **Step 2: Create directory structure and move files**

```bash
mkdir -p src/core/instance/__tests__
git mv src/core/instance-context.ts src/core/instance/instance-context.ts
git mv src/core/instance-registry.ts src/core/instance/instance-registry.ts
git mv src/core/instance-discovery.ts src/core/instance/instance-discovery.ts
git mv src/core/instance-copy.ts src/core/instance/instance-copy.ts
git mv src/core/__tests__/instance-context.test.ts src/core/instance/__tests__/instance-context.test.ts
git mv src/core/__tests__/instance-registry.test.ts src/core/instance/__tests__/instance-registry.test.ts
git mv src/core/__tests__/instance-discovery.test.ts src/core/instance/__tests__/instance-discovery.test.ts
git mv src/core/__tests__/instance-copy.test.ts src/core/instance/__tests__/instance-copy.test.ts
git mv src/core/__tests__/multi-instance-flows.test.ts src/core/instance/__tests__/multi-instance-flows.test.ts
```

- [ ] **Step 3: Create `src/core/instance/index.ts`**

```typescript
export {
  type InstanceContext,
  type CreateInstanceContextOpts,
  type ResolveOpts,
  createInstanceContext,
  generateSlug,
  resolveInstanceRoot,
  getGlobalRoot,
} from './instance-context.js'
export { InstanceRegistry, type InstanceRegistryEntry } from './instance-registry.js'
export { discoverRunningInstances, type DiscoveredInstance } from './instance-discovery.js'
export { copyInstance, type CopyOptions } from './instance-copy.js'
```

- [ ] **Step 4: Update all import paths**

Update these files to import from the new location. Each file's old and new import:

**`src/core/core.ts` (line 29):**
- Old: `import type { InstanceContext } from "./instance-context.js";`
- New: `import type { InstanceContext } from "./instance/instance-context.js";`

**`src/main.ts` (lines 5-6):**
- Old: `import type { InstanceContext } from './core/instance-context.js'`
  `import { createInstanceContext, getGlobalRoot } from './core/instance-context.js'`
- New: `import type { InstanceContext } from './core/instance/instance-context.js'`
  `import { createInstanceContext, getGlobalRoot } from './core/instance/instance-context.js'`

**`src/main.ts` (line 16):**
- Old: `import { InstanceRegistry } from './core/instance-registry.js'`
- New: `import { InstanceRegistry } from './core/instance/instance-registry.js'`

**`src/cli.ts` (line 34):**
- Old: `import { resolveInstanceRoot, getGlobalRoot } from './core/instance-context.js'`
- New: `import { resolveInstanceRoot, getGlobalRoot } from './core/instance/instance-context.js'`

**`src/cli/instance-hint.ts` (line 4):**
- Old: `import { getGlobalRoot } from '../core/instance-context.js'`
- New: `import { getGlobalRoot } from '../core/instance/instance-context.js'`

**`src/cli/commands/default.ts` (line 5):**
- Old: `import { createInstanceContext, getGlobalRoot } from '../../core/instance-context.js'`
- New: `import { createInstanceContext, getGlobalRoot } from '../../core/instance/instance-context.js'`

**`src/cli/commands/restart.ts` (line 5):**
- Old: `import { createInstanceContext, getGlobalRoot } from '../../core/instance-context.js'`
- New: `import { createInstanceContext, getGlobalRoot } from '../../core/instance/instance-context.js'`

**`src/cli/commands/status.ts` (lines 1-2):**
- Old: `import { InstanceRegistry } from '../../core/instance-registry.js'`
  `import { getGlobalRoot } from '../../core/instance-context.js'`
- New: `import { InstanceRegistry } from '../../core/instance/instance-registry.js'`
  `import { getGlobalRoot } from '../../core/instance/instance-context.js'`

**`src/cli/commands/remote.ts` (line 2):**
- Old: `import { InstanceRegistry } from '../../core/instance-registry.js'`
- New: `import { InstanceRegistry } from '../../core/instance/instance-registry.js'`

**`src/core/setup/wizard.ts` (lines 18-20):**
- Old: `import { generateSlug, getGlobalRoot } from "../instance-context.js";`
  `import { InstanceRegistry } from "../instance-registry.js";`
  `import { copyInstance } from "../instance-copy.js";`
- New: `import { generateSlug, getGlobalRoot } from "../instance/instance-context.js";`
  `import { InstanceRegistry } from "../instance/instance-registry.js";`
  `import { copyInstance } from "../instance/instance-copy.js";`

**`src/core/setup/setup-channels.ts` (line 2):**
- Old: `import { getGlobalRoot } from "../instance-context.js";`
- New: `import { getGlobalRoot } from "../instance/instance-context.js";`

**`src/core/config/config-migrations.ts` (line 4):**
- Old: `import { getGlobalRoot } from "../instance-context.js";`
- New: `import { getGlobalRoot } from "../instance/instance-context.js";`

**`src/core/config/config-registry.ts` (line 4):**
- Old: `import { getGlobalRoot } from "../instance-context.js";`
- New: `import { getGlobalRoot } from "../instance/instance-context.js";`

**`src/core/doctor/index.ts` (line 5):**
- Old: `import { getGlobalRoot } from "../instance-context.js";`
- New: `import { getGlobalRoot } from "../instance/instance-context.js";`

**Test files — update relative imports:**

`src/core/instance/__tests__/instance-context.test.ts`:
- Old: `from '../instance-context.js'`
- New: `from '../instance-context.js'` (no change — moved together)

`src/core/instance/__tests__/instance-registry.test.ts`:
- Old: `from '../instance-registry.js'`
- New: `from '../instance-registry.js'` (no change — moved together)

`src/core/instance/__tests__/instance-discovery.test.ts`:
- Old: `from '../instance-discovery.js'`
- New: `from '../instance-discovery.js'` (no change — moved together)

`src/core/instance/__tests__/instance-copy.test.ts`:
- Old: `from '../instance-copy.js'`
- New: `from '../instance-copy.js'` (no change — moved together)

`src/core/instance/__tests__/multi-instance-flows.test.ts`:
- Old: `from '../instance-registry.js'` and `from '../instance-copy.js'`
- New: `from '../instance-registry.js'` and `from '../instance-copy.js'` (no change — moved together)

- [ ] **Step 5: Build and run tests**

```bash
pnpm build && pnpm test
```

Expected: All tests pass, no build errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: group instance-* files into core/instance/"
```

---

### Task 2: Extract `AgentSwitchHandler` from `core.ts`

**Files:**
- Create: `src/core/agent-switch-handler.ts`
- Modify: `src/core/core.ts` (remove lines 609-809, add delegation)

- [ ] **Step 1: Create `src/core/agent-switch-handler.ts`**

```typescript
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

const log = createChildLogger({ module: "agent-switch" });

export interface AgentSwitchDeps {
  sessionManager: SessionManager;
  agentManager: AgentManager;
  configManager: ConfigManager;
  eventBus: EventBus;
  adapters: Map<string, IChannelAdapter>;
  bridges: Map<string, SessionBridge>;
  createBridge: (session: Session, adapter: IChannelAdapter) => SessionBridge;
  getMiddlewareChain: () => MiddlewareChain | undefined;
  getService: <T>(name: string) => T | undefined;
}

export class AgentSwitchHandler {
  private switchingLocks = new Set<string>();

  constructor(private deps: AgentSwitchDeps) {}

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

    // Validate target agent exists before doing anything destructive
    const agentDef = agentManager.getAgent(toAgent);
    if (!agentDef) throw new Error(`Agent "${toAgent}" is not installed`);

    const fromAgent = session.agentName;

    // 1. Middleware: agent:beforeSwitch (blocking)
    const middlewareChain = this.deps.getMiddlewareChain();
    const result = await middlewareChain?.execute('agent:beforeSwitch', {
      sessionId,
      fromAgent,
      toAgent,
    }, async (payload) => payload);
    if (middlewareChain && !result) throw new Error('Agent switch blocked by middleware');

    // 2. Determine resume vs new
    const lastEntry = session.findLastSwitchEntry(toAgent);
    const caps = getAgentCapabilities(toAgent);
    const canResume = !!(lastEntry && caps.supportsResume && lastEntry.promptCount === 0);
    const resumed = canResume;

    // Emit "starting" events so UI can reflect long-running switches
    const startEvent: AgentEvent = {
      type: "system_message",
      message: `Switching from ${fromAgent} to ${toAgent}...`,
    };
    session.emit("agent_event", startEvent);
    eventBus.emit("agent:event", { sessionId, event: startEvent });
    eventBus.emit("session:agentSwitch", {
      sessionId,
      fromAgent,
      toAgent,
      status: "starting",
    });

    // 3. Disconnect bridge
    const bridge = bridges.get(sessionId);
    if (bridge) bridge.disconnect();

    // Clear old agent's skill commands so they don't linger in the UI
    const switchAdapter = adapters.get(session.channelId);
    if (switchAdapter?.sendSkillCommands) {
      await switchAdapter.sendSkillCommands(session.id, []);
    }

    // Clean up adapter-side per-session state (draft manager, activity tracker, etc.)
    if (switchAdapter?.cleanupSessionState) {
      await switchAdapter.cleanupSessionState(session.id);
    }

    // Capture pre-switch state for rollback
    const fromAgentSessionId = session.agentSessionId;

    // 4. Switch agent on session (with rollback on failure)
    try {
      await session.switchAgent(toAgent, async () => {
        if (canResume) {
          return agentManager.resume(toAgent, session.workingDirectory, lastEntry!.agentSessionId);
        } else {
          const instance = await agentManager.spawn(toAgent, session.workingDirectory);
          // Inject context if context service available
          try {
            const contextService = this.deps.getService<ContextManager>('context');
            if (contextService) {
              const config = configManager.get();
              const labelAgent = config.agentSwitch?.labelHistory ?? true;
              const contextResult = await contextService.buildContext(
                { type: 'session', value: sessionId, repoPath: session.workingDirectory },
                { labelAgent },
              );
              if (contextResult?.markdown) {
                session.setContext(contextResult.markdown);
              }
            }
          } catch {
            // Context injection is best-effort
          }
          return instance;
        }
      });

      // On success, emit structured + system_message events
      const successEvent: AgentEvent = {
        type: "system_message",
        message: resumed
          ? `Switched to ${toAgent} (resumed previous session).`
          : `Switched to ${toAgent} (new session).`,
      };
      session.emit("agent_event", successEvent);
      eventBus.emit("agent:event", { sessionId, event: successEvent });
      eventBus.emit("session:agentSwitch", {
        sessionId,
        fromAgent,
        toAgent,
        status: "succeeded",
        resumed,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Emit failure events before attempting rollback so UI can show error state
      const failedEvent: AgentEvent = {
        type: "system_message",
        message: `Failed to switch to ${toAgent}: ${errorMessage}`,
      };
      session.emit("agent_event", failedEvent);
      eventBus.emit("agent:event", { sessionId, event: failedEvent });
      eventBus.emit("session:agentSwitch", {
        sessionId,
        fromAgent,
        toAgent,
        status: "failed",
        error: errorMessage,
      });

      // Rollback: try to restore the old agent so the session isn't left broken
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
        // Reconnect bridge after rollback
        const adapter = adapters.get(session.channelId);
        if (adapter) {
          createBridge(session, adapter).connect();
        }
        log.warn({ sessionId, fromAgent, toAgent, err }, "Agent switch failed, rolled back to previous agent");
      } catch (rollbackErr) {
        session.fail(`Switch failed and rollback failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`);
        log.error({ sessionId, fromAgent, toAgent, err, rollbackErr }, "Agent switch failed and rollback also failed");
      }
      throw err;
    }

    // 5. Reconnect bridge
    if (bridge) {
      const adapter = adapters.get(session.channelId);
      if (adapter) {
        createBridge(session, adapter).connect();
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
    middlewareChain?.execute('agent:afterSwitch', {
      sessionId,
      fromAgent,
      toAgent,
      resumed,
    }, async (p) => p).catch(() => {});

    return { resumed };
  }
}
```

- [ ] **Step 2: Wire `AgentSwitchHandler` in `core.ts`**

Add import at top of `core.ts`:
```typescript
import { AgentSwitchHandler } from "./agent-switch-handler.js";
```

Add field in `VibenCore` class (after `sessionFactory` field):
```typescript
private agentSwitchHandler: AgentSwitchHandler;
```

Initialize in constructor (after `this.lifecycleManager` initialization, around line 127):
```typescript
this.agentSwitchHandler = new AgentSwitchHandler({
  sessionManager: this.sessionManager,
  agentManager: this.agentManager,
  configManager: this.configManager,
  eventBus: this.eventBus,
  adapters: this.adapters,
  bridges: this.bridges,
  createBridge: (session, adapter) => this.createBridge(session, adapter),
  getMiddlewareChain: () => this.lifecycleManager?.middlewareChain,
  getService: <T>(name: string) => this.lifecycleManager.serviceRegistry.get<T>(name),
});
```

Replace `switchSessionAgent` and `_doSwitchSessionAgent` methods (lines 609-809) with:
```typescript
async switchSessionAgent(sessionId: string, toAgent: string): Promise<{ resumed: boolean }> {
  return this.agentSwitchHandler.switch(sessionId, toAgent);
}
```

Remove `switchingLocks` field from `VibenCore` (line 46).

- [ ] **Step 3: Build and run tests**

```bash
pnpm build && pnpm test
```

Expected: All existing agent switch tests pass (`agent-switch.test.ts`, `session-switch.test.ts`, `session-bridge-switch.test.ts`, `core-orchestrator-comprehensive.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/core/agent-switch-handler.ts src/core/core.ts
git commit -m "refactor: extract AgentSwitchHandler from core.ts"
```

---

### Task 3: Move lazy resume into SessionFactory

**Files:**
- Modify: `src/core/sessions/session-factory.ts`
- Modify: `src/core/core.ts`

- [ ] **Step 1: Add lazy resume to SessionFactory**

Add imports at top of `session-factory.ts`:
```typescript
import type { SessionStore } from "./session-store.js";
import type { IChannelAdapter } from "../channel.js";
```

Add new fields and constructor params to `SessionFactory`. Update the constructor:
```typescript
export class SessionFactory {
  middlewareChain?: MiddlewareChain;
  private resumeLocks: Map<string, Promise<Session | null>> = new Map();

  constructor(
    private agentManager: AgentManager,
    private sessionManager: SessionManager,
    private speechServiceAccessor: SpeechService | (() => SpeechService),
    private eventBus: EventBus,
    private instanceRoot?: string,
  ) {}

  /** Injected by Core after construction — needed for lazy resume error feedback */
  adapters?: Map<string, IChannelAdapter>;
  /** Injected by Core after construction — needed for lazy resume store lookup */
  sessionStore?: SessionStore | null;
  /** Injected by Core — creates full session with thread + bridge + persist */
  createFullSession?: (params: SessionCreateParams & { threadId?: string; createThread?: boolean }) => Promise<Session>;
```

Add these methods to `SessionFactory`:
```typescript
  /**
   * Get active session by thread, or attempt lazy resume from store.
   * Used by adapter command handlers and handleMessage().
   */
  async getOrResume(channelId: string, threadId: string): Promise<Session | null> {
    const session = this.sessionManager.getSessionByThread(channelId, threadId);
    if (session) return session;
    return this.lazyResume(channelId, threadId);
  }

  private async lazyResume(channelId: string, threadId: string): Promise<Session | null> {
    const store = this.sessionStore;
    if (!store || !this.createFullSession) return null;

    const lockKey = `${channelId}:${threadId}`;

    // Check for existing resume in progress
    const existing = this.resumeLocks.get(lockKey);
    if (existing) return existing;

    const record = store.findByPlatform(
      channelId,
      (p) => String(p.topicId) === threadId,
    );
    if (!record) {
      log.debug({ threadId, channelId }, "No session record found for thread");
      return null;
    }

    // Don't resume errored or cancelled sessions
    if (record.status === "error" || record.status === "cancelled") {
      log.debug({ threadId, sessionId: record.sessionId, status: record.status }, "Skipping resume of error session");
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
        session.dangerousMode = record.dangerousMode ?? false;
        if (record.firstAgent) session.firstAgent = record.firstAgent;
        if (record.agentSwitchHistory) session.agentSwitchHistory = record.agentSwitchHistory;
        if (record.currentPromptCount != null) session.promptCount = record.currentPromptCount;

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
```

- [ ] **Step 2: Wire SessionFactory in core.ts and remove old lazy resume**

In `core.ts` constructor, after `this.sessionFactory` creation and `this.lifecycleManager` setup (around line 127), add:
```typescript
// Wire lazy resume dependencies
this.sessionFactory.sessionStore = this.sessionStore;
this.sessionFactory.adapters = this.adapters;
this.sessionFactory.createFullSession = (params) => this.createSession(params);
```

Update `handleMessage()` — replace lines 281-297:
```typescript
    // Find session by thread or lazy resume
    let session = await this.sessionFactory.getOrResume(message.channelId, message.threadId);

    if (!session) {
      log.warn(
        { channelId: message.channelId, threadId: message.threadId },
        "No session found for thread (in-memory miss + lazy resume returned null)",
      );
      return;
    }
```

Update `getOrResumeSession()` — replace lines 817-821:
```typescript
  async getOrResumeSession(channelId: string, threadId: string): Promise<Session | null> {
    return this.sessionFactory.getOrResume(channelId, threadId);
  }
```

Remove from `core.ts`:
- `private resumeLocks: Map<string, Promise<Session | null>> = new Map();` (line 45)
- The entire `private async lazyResume(message: IncomingMessage)` method (lines 823-911)

- [ ] **Step 3: Build and run tests**

```bash
pnpm build && pnpm test
```

Expected: All lazy resume tests pass (`lazy-resume.test.ts`, `core-orchestrator-comprehensive.test.ts` lazy resume suite).

- [ ] **Step 4: Commit**

```bash
git add src/core/sessions/session-factory.ts src/core/core.ts
git commit -m "refactor: move lazy resume from core.ts into SessionFactory"
```

---

### Task 4: Move convenience session creation methods to SessionFactory

**Files:**
- Modify: `src/core/sessions/session-factory.ts`
- Modify: `src/core/core.ts`

- [ ] **Step 1: Add convenience methods to SessionFactory**

Add import to `session-factory.ts`:
```typescript
import type { ConfigManager } from "../config/config.js";
import type { AgentCatalog } from "../agents/agent-catalog.js";
import type { ContextManager } from "../../plugins/context/context-manager.js";
import type { ContextQuery, ContextOptions, ContextResult } from "../../plugins/context/context-provider.js";
```

Add new fields (injected by Core after construction):
```typescript
  /** Injected by Core — needed for resolving default agent and workspace */
  configManager?: ConfigManager;
  /** Injected by Core — needed for resolving agent definitions */
  agentCatalog?: AgentCatalog;
  /** Injected by Core — needed for context-aware session creation */
  getContextManager?: () => ContextManager | undefined;
```

Add these methods to `SessionFactory`:
```typescript
  async handleNewSession(
    channelId: string,
    agentName?: string,
    workspacePath?: string,
    options?: { createThread?: boolean },
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

  async createSessionWithContext(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    contextQuery: ContextQuery;
    contextOptions?: ContextOptions;
    createThread?: boolean;
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
    });

    if (contextResult) {
      session.setContext(contextResult.markdown);
    }

    return { session, contextResult };
  }
```

- [ ] **Step 2: Wire new dependencies and delegate from core.ts**

In `core.ts` constructor, extend the wiring section:
```typescript
this.sessionFactory.configManager = this.configManager;
this.sessionFactory.agentCatalog = this.agentCatalog;
this.sessionFactory.getContextManager = () => this.lifecycleManager.serviceRegistry.get<ContextManager>('context');
```

Replace `handleNewSession`, `handleNewChat`, `createSessionWithContext` methods in `core.ts` with thin delegators:
```typescript
  async handleNewSession(
    channelId: string,
    agentName?: string,
    workspacePath?: string,
    options?: { createThread?: boolean },
  ): Promise<Session> {
    return this.sessionFactory.handleNewSession(channelId, agentName, workspacePath, options);
  }

  async handleNewChat(channelId: string, currentThreadId: string): Promise<Session | null> {
    return this.sessionFactory.handleNewChat(channelId, currentThreadId);
  }

  async createSessionWithContext(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    contextQuery: import("../plugins/context/context-provider.js").ContextQuery;
    contextOptions?: import("../plugins/context/context-provider.js").ContextOptions;
    createThread?: boolean;
  }): Promise<{ session: Session; contextResult: import("../plugins/context/context-provider.js").ContextResult | null }> {
    return this.sessionFactory.createSessionWithContext(params);
  }
```

Remove the old full implementations of these 3 methods from `core.ts`.

- [ ] **Step 3: Build and run tests**

```bash
pnpm build && pnpm test
```

Expected: All tests pass. Callers of `core.handleNewSession()` in `plugins/telegram/commands/new-session.ts`, `core.handleNewChat()`, and `core.createSessionWithContext()` in `plugins/telegram/commands/resume.ts` work unchanged because method signatures are preserved.

- [ ] **Step 4: Commit**

```bash
git add src/core/sessions/session-factory.ts src/core/core.ts
git commit -m "refactor: move handleNewSession, handleNewChat, createSessionWithContext to SessionFactory"
```

---

### Task 5: Clean up and verify final state

**Files:**
- Review: `src/core/core.ts`

- [ ] **Step 1: Verify core.ts line count and remaining methods**

```bash
wc -l src/core/core.ts
```

Expected: ~400 lines. Remaining methods should be:
- Constructor + service getters
- `registerAdapter()`, `start()`, `stop()`
- `handleMessage()` (thin — delegates to sessionFactory.getOrResume)
- `createSession()` (orchestration: factory.create + thread + bridge + persist)
- `adoptSession()` (validation + orchestration)
- `archiveSession()`
- `createBridge()`
- `handleNewSession()`, `handleNewChat()`, `createSessionWithContext()` (thin delegators)
- `getOrResumeSession()` (thin delegator)
- `switchSessionAgent()` (thin delegator)

- [ ] **Step 2: Remove unused imports from core.ts**

Check for imports that were only used by moved code (e.g., `getAgentCapabilities` if only used in switch logic). Remove any dead imports.

- [ ] **Step 3: Run full test suite one final time**

```bash
pnpm build && pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: clean up core.ts after phase 1 extraction"
```
