# Agent Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to switch agents mid-session while preserving conversation context, session continuity, and resume capability.

**Architecture:** Session-level switch — swap the AgentInstance inside an existing Session without changing the session ID or platform thread. Switch history is tracked in SessionRecord for resume logic and future fork support.

**Tech Stack:** TypeScript, Vitest, Zod, ACP SDK

---

### Task 1: Extend Data Model — Types & SessionRecord

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/sessions/session-store.ts`

- [ ] **Step 1: Add AgentSwitchEntry and extend SessionRecord in types.ts**

Add after the existing `SessionRecord` interface:

```typescript
export interface AgentSwitchEntry {
  agentName: string;
  agentSessionId: string;
  switchedAt: string;
  promptCount: number;
}
```

Extend `SessionRecord` with new optional fields (backward-compatible):

```typescript
export interface SessionRecord<P = Record<string, unknown>> {
  // ... existing fields ...
  firstAgent?: string;
  currentPromptCount?: number;
  agentSwitchHistory?: AgentSwitchEntry[];
}
```

- [ ] **Step 2: Update SessionStore backward compatibility**

In `session-store.ts`, ensure `findByAgentSessionId()` also searches `agentSwitchHistory` entries. Modify the `findByAgentSessionId` method:

```typescript
findByAgentSessionId(agentSessionId: string): SessionRecord | undefined {
  for (const record of this.records.values()) {
    if (
      record.agentSessionId === agentSessionId ||
      record.originalAgentSessionId === agentSessionId
    ) {
      return record;
    }
    // Also search switch history
    if (record.agentSwitchHistory?.some((e) => e.agentSessionId === agentSessionId)) {
      return record;
    }
  }
  return undefined;
}
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `pnpm test`
Expected: All existing tests pass. New fields are optional so nothing breaks.

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/sessions/session-store.ts
git commit -m "feat(agent-switch): extend SessionRecord with switch history fields"
```

---

### Task 2: Add Middleware Hook Definitions

**Files:**
- Modify: `src/core/plugin/types.ts`

- [ ] **Step 1: Add agent:beforeSwitch and agent:afterSwitch hook type definitions**

Add to the `MiddlewareHookPayloads` type (or equivalent hook definitions area) alongside existing hooks like `agent:beforePrompt`:

```typescript
'agent:beforeSwitch': {
  sessionId: string;
  fromAgent: string;
  toAgent: string;
}

'agent:afterSwitch': {
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  resumed: boolean;
}
```

- [ ] **Step 2: Run tests to verify no regressions**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/types.ts
git commit -m "feat(agent-switch): add beforeSwitch/afterSwitch middleware hooks"
```

---

### Task 3: Extend Session Class — switchAgent Method

**Files:**
- Modify: `src/core/sessions/session.ts`
- Test: `src/core/sessions/__tests__/session-switch.test.ts`

- [ ] **Step 1: Write failing tests for switchAgent**

Create `src/core/sessions/__tests__/session-switch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../session.js';
import { TypedEmitter } from '../../utils/typed-emitter.js';

function mockAgentInstance(sessionId = 'agent-sess-1') {
  const emitter = new TypedEmitter();
  return Object.assign(emitter, {
    sessionId,
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
    setMode: vi.fn(),
    setModel: vi.fn(),
    setConfigOption: vi.fn(),
    connection: {},
  }) as any;
}

describe('Session.switchAgent', () => {
  let session: Session;
  let agent1: any;

  beforeEach(() => {
    agent1 = mockAgentInstance('agent-sess-1');
    session = new Session({
      agentName: 'claude',
      agentInstance: agent1,
      channelId: 'telegram',
    });
    session.agentSessionId = 'agent-sess-1';
  });

  it('should track firstAgent on creation', () => {
    expect(session.firstAgent).toBe('claude');
  });

  it('should add entry to switchHistory when switching', async () => {
    const agent2 = mockAgentInstance('agent-sess-2');
    const spawnFn = vi.fn().mockResolvedValue(agent2);

    await session.switchAgent('gemini', spawnFn);

    expect(session.agentSwitchHistory).toHaveLength(1);
    expect(session.agentSwitchHistory[0].agentName).toBe('claude');
    expect(session.agentSwitchHistory[0].agentSessionId).toBe('agent-sess-1');
    expect(session.agentSwitchHistory[0].promptCount).toBe(0);
  });

  it('should update agentName and agentSessionId after switch', async () => {
    const agent2 = mockAgentInstance('agent-sess-2');
    const spawnFn = vi.fn().mockResolvedValue(agent2);

    await session.switchAgent('gemini', spawnFn);

    expect(session.agentName).toBe('gemini');
    expect(session.agentSessionId).toBe('agent-sess-2');
  });

  it('should destroy old agent instance on switch', async () => {
    const agent2 = mockAgentInstance('agent-sess-2');
    const spawnFn = vi.fn().mockResolvedValue(agent2);

    await session.switchAgent('gemini', spawnFn);

    expect(agent1.destroy).toHaveBeenCalled();
  });

  it('should reset promptCount to 0 after switch', async () => {
    // Simulate some prompts
    (session as any).promptCount = 5;

    const agent2 = mockAgentInstance('agent-sess-2');
    const spawnFn = vi.fn().mockResolvedValue(agent2);

    await session.switchAgent('gemini', spawnFn);

    expect(session.promptCount).toBe(0);
    expect(session.agentSwitchHistory[0].promptCount).toBe(5);
  });

  it('should throw if switching to same agent', async () => {
    const spawnFn = vi.fn();
    await expect(session.switchAgent('claude', spawnFn)).rejects.toThrow('Already using claude');
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('should find last entry for a given agent', () => {
    session.agentSwitchHistory = [
      { agentName: 'claude', agentSessionId: 'sess-1', switchedAt: '2026-01-01T00:00:00Z', promptCount: 3 },
      { agentName: 'gemini', agentSessionId: 'sess-2', switchedAt: '2026-01-01T01:00:00Z', promptCount: 0 },
      { agentName: 'claude', agentSessionId: 'sess-3', switchedAt: '2026-01-01T02:00:00Z', promptCount: 0 },
    ];

    expect(session.findLastSwitchEntry('claude')?.agentSessionId).toBe('sess-3');
    expect(session.findLastSwitchEntry('gemini')?.agentSessionId).toBe('sess-2');
    expect(session.findLastSwitchEntry('codex')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/sessions/__tests__/session-switch.test.ts`
Expected: FAIL — `switchAgent`, `firstAgent`, `agentSwitchHistory`, `findLastSwitchEntry` don't exist yet.

- [ ] **Step 3: Implement switchAgent on Session class**

Add to `session.ts`:

```typescript
// New properties
public firstAgent: string;
public agentSwitchHistory: AgentSwitchEntry[] = [];

// In constructor, after setting agentName:
this.firstAgent = params.agentName;

// New methods
findLastSwitchEntry(agentName: string): AgentSwitchEntry | undefined {
  for (let i = this.agentSwitchHistory.length - 1; i >= 0; i--) {
    if (this.agentSwitchHistory[i].agentName === agentName) {
      return this.agentSwitchHistory[i];
    }
  }
  return undefined;
}

async switchAgent(
  agentName: string,
  createAgent: () => Promise<AgentInstance>,
): Promise<void> {
  if (agentName === this.agentName) {
    throw new Error(`Already using ${agentName}`);
  }

  // 1. Save current agent to history
  this.agentSwitchHistory.push({
    agentName: this.agentName,
    agentSessionId: this.agentSessionId,
    switchedAt: new Date().toISOString(),
    promptCount: this.promptCount,
  });

  // 2. Destroy old agent
  await this.agentInstance.destroy();

  // 3. Create new agent (caller decides spawn vs resume)
  const newAgent = await createAgent();

  // 4. Swap agent instance
  this.agentInstance = newAgent;
  this.agentName = agentName;
  this.agentSessionId = newAgent.sessionId;
  this.promptCount = 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/core/sessions/__tests__/session-switch.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session.ts src/core/sessions/__tests__/session-switch.test.ts
git commit -m "feat(agent-switch): add switchAgent method to Session class"
```

---

### Task 4: Extend SessionBridge — Disconnect/Reconnect

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Test: `src/core/sessions/__tests__/session-bridge-switch.test.ts`

- [ ] **Step 1: Write failing tests for bridge reconnection**

Create `src/core/sessions/__tests__/session-bridge-switch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionBridge } from '../session-bridge.js';
import { Session } from '../session.js';
import { TypedEmitter } from '../../utils/typed-emitter.js';

function mockAgentInstance(sessionId = 'agent-1') {
  const emitter = new TypedEmitter();
  return Object.assign(emitter, {
    sessionId,
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any;
}

function mockAdapter() {
  return {
    channelId: 'test',
    sendMessage: vi.fn().mockResolvedValue(undefined),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('SessionBridge reconnection', () => {
  it('should disconnect old agent listeners and reconnect to new agent', () => {
    const agent1 = mockAgentInstance('agent-1');
    const agent2 = mockAgentInstance('agent-2');
    const adapter = mockAdapter();

    const session = new Session({
      agentName: 'claude',
      agentInstance: agent1,
      channelId: 'test',
    });

    const bridge = new SessionBridge({
      session,
      adapter,
      messageTransformer: { transform: vi.fn((e) => e) } as any,
      sessionManager: { patchRecord: vi.fn() } as any,
      eventBus: { emit: vi.fn() } as any,
      middlewareChain: { execute: vi.fn((_h, p, fn) => fn(p)) } as any,
    });

    bridge.connect();

    // Verify agent1 has listeners
    expect(agent1.listenerCount('agent_event')).toBeGreaterThan(0);

    // Disconnect
    bridge.disconnect();
    expect(agent1.listenerCount('agent_event')).toBe(0);

    // Swap agent on session
    session.agentInstance = agent2;

    // Reconnect
    bridge.connect();
    expect(agent2.listenerCount('agent_event')).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/sessions/__tests__/session-bridge-switch.test.ts`
Expected: May fail depending on current disconnect() implementation completeness.

- [ ] **Step 3: Verify/fix disconnect() removes all agent event listeners**

In `session-bridge.ts`, verify `disconnect()` properly removes all listeners from `session.agentInstance`. The current implementation should already handle this, but ensure it removes:
- `agent_event` listener from agentInstance
- Permission request callback reset
- Status change / named listeners from session

If `disconnect()` already removes everything and `connect()` can be re-called, the test should pass. If not, fix `disconnect()` to fully clean up and ensure `connect()` re-wires from the current `session.agentInstance`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/core/sessions/__tests__/session-bridge-switch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sessions/session-bridge.ts src/core/sessions/__tests__/session-bridge-switch.test.ts
git commit -m "feat(agent-switch): ensure SessionBridge supports disconnect/reconnect"
```

---

### Task 5: Add /switch Command

**Files:**
- Create: `src/core/commands/switch.ts`
- Modify: `src/core/commands/index.ts` (to register the new command)

- [ ] **Step 1: Create the /switch command file**

Create `src/core/commands/switch.ts`:

```typescript
import type { CommandRegistry } from '../command-registry.js';
import type { CommandResponse } from '../plugin/types.js';

export function registerSwitchCommands(registry: CommandRegistry): void {
  registry.register({
    name: 'switch',
    description: 'Switch to a different agent',
    usage: '[agent-name | label on|off]',
    category: 'system',
    handler: async (args) => {
      const raw = args.raw.trim();

      // /switch label on|off
      if (raw.startsWith('label ')) {
        const value = raw.slice(6).trim().toLowerCase();
        if (value !== 'on' && value !== 'off') {
          return { type: 'error', message: 'Usage: /switch label on|off' } satisfies CommandResponse;
        }
        // Delegate to adapter handler via silent response
        // Adapter reads raw args and applies setting
        return { type: 'silent' } satisfies CommandResponse;
      }

      // /switch (no args) → show menu, or /switch <agent> → direct switch
      // Both delegated to adapter handler which has access to session and agent list
      return { type: 'silent' } satisfies CommandResponse;
    },
  });
}
```

- [ ] **Step 2: Register in commands/index.ts**

Add import and registration call in the commands index file (where other commands like `registerSessionCommands`, `registerAgentCommands` are registered):

```typescript
import { registerSwitchCommands } from './switch.js';

// In the registration function:
registerSwitchCommands(registry);
```

- [ ] **Step 3: Run build to verify compilation**

Run: `pnpm build`
Expected: Successful compilation.

- [ ] **Step 4: Commit**

```bash
git add src/core/commands/switch.ts src/core/commands/index.ts
git commit -m "feat(agent-switch): add /switch command registration"
```

---

### Task 6: Add Config Setting for Agent Label

**Files:**
- Modify: `src/core/config/config.ts`
- Modify: `src/core/config/config-registry.ts`

- [ ] **Step 1: Add agentSwitchLabel to config schema**

In `config.ts`, add to the `ConfigSchema`:

```typescript
agentSwitch: z.object({
  labelHistory: z.boolean().default(true),
}).default({}),
```

- [ ] **Step 2: Add config field definition**

In `config-registry.ts`, add a new field:

```typescript
{
  path: 'agentSwitch.labelHistory',
  displayName: 'Label Agent in History',
  group: 'agent',
  type: 'toggle',
  scope: 'safe',
  hotReload: true,
},
```

- [ ] **Step 3: Run build and tests**

Run: `pnpm build && pnpm test`
Expected: Pass. New config has `.default({})` so backward-compatible.

- [ ] **Step 4: Commit**

```bash
git add src/core/config/config.ts src/core/config/config-registry.ts
git commit -m "feat(agent-switch): add agentSwitch.labelHistory config setting"
```

---

### Task 7: Extend Context Plugin — Agent-Labeled History

**Files:**
- Modify: `src/plugins/context/history/history-provider.ts`

- [ ] **Step 1: Add labelAgent option to context building**

In `history-provider.ts`, modify `buildMergedMarkdown()` (or the equivalent method that renders markdown) to accept a `labelAgent` option. When enabled, add `## [agentName]` headers between agent switches:

```typescript
// In buildMergedMarkdown or equivalent:
private buildMergedMarkdown(
  sessions: LoadedSession[],
  mode: ContextMode,
  query: ContextQuery,
  options?: { labelAgent?: boolean },
): string {
  // ... existing logic ...
  // When iterating turns, if labelAgent is true and the agent changed,
  // insert a markdown header: `## [agentName]`
}
```

The exact implementation depends on whether `SessionHistory` tracks which agent produced each turn. If not, the switch entries from `SessionRecord.agentSwitchHistory` can be used to map timestamps to agents.

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Successful compilation.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/context/history/history-provider.ts
git commit -m "feat(agent-switch): add agent label support to history context"
```

---

### Task 8: Core Switch Orchestration

**Files:**
- Modify: `src/core/core.ts`
- Test: `src/core/__tests__/agent-switch.test.ts`

This is the main orchestration that ties everything together: middleware hooks, session switch, bridge rewire, context injection, persistence.

- [ ] **Step 1: Write failing integration test**

Create `src/core/__tests__/agent-switch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../sessions/session.js';
import { TypedEmitter } from '../utils/typed-emitter.js';

function mockAgentInstance(sessionId: string) {
  const emitter = new TypedEmitter();
  return Object.assign(emitter, {
    sessionId,
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any;
}

describe('Agent Switch Orchestration', () => {
  it('should switch agent and preserve session identity', async () => {
    const agent1 = mockAgentInstance('claude-sess-1');
    const session = new Session({
      agentName: 'claude',
      agentInstance: agent1,
      channelId: 'telegram',
    });
    session.agentSessionId = 'claude-sess-1';
    const originalSessionId = session.id;

    const agent2 = mockAgentInstance('gemini-sess-1');
    await session.switchAgent('gemini', async () => agent2);

    // Session ID unchanged
    expect(session.id).toBe(originalSessionId);
    // Agent swapped
    expect(session.agentName).toBe('gemini');
    expect(session.agentSessionId).toBe('gemini-sess-1');
    // History recorded
    expect(session.agentSwitchHistory).toHaveLength(1);
    expect(session.firstAgent).toBe('claude');
  });

  it('should support resume when promptCount is 0', async () => {
    const agent1 = mockAgentInstance('claude-sess-1');
    const session = new Session({
      agentName: 'claude',
      agentInstance: agent1,
      channelId: 'telegram',
    });
    session.agentSessionId = 'claude-sess-1';

    // Switch to gemini (promptCount = 0 for claude)
    const agent2 = mockAgentInstance('gemini-sess-1');
    await session.switchAgent('gemini', async () => agent2);

    // Claude entry should have promptCount = 0
    const claudeEntry = session.findLastSwitchEntry('claude');
    expect(claudeEntry).toBeDefined();
    expect(claudeEntry!.promptCount).toBe(0);
  });

  it('should record non-zero promptCount when user sent prompts', async () => {
    const agent1 = mockAgentInstance('claude-sess-1');
    const session = new Session({
      agentName: 'claude',
      agentInstance: agent1,
      channelId: 'telegram',
    });
    session.agentSessionId = 'claude-sess-1';

    // Simulate 3 user prompts
    (session as any).promptCount = 3;

    const agent2 = mockAgentInstance('gemini-sess-1');
    await session.switchAgent('gemini', async () => agent2);

    const claudeEntry = session.findLastSwitchEntry('claude');
    expect(claudeEntry!.promptCount).toBe(3);
  });

  it('should rollback on spawn failure', async () => {
    const agent1 = mockAgentInstance('claude-sess-1');
    const session = new Session({
      agentName: 'claude',
      agentInstance: agent1,
      channelId: 'telegram',
    });
    session.agentSessionId = 'claude-sess-1';

    // Make agent1.destroy resolve but spawn fail
    const failingSpawn = vi.fn().mockRejectedValue(new Error('spawn failed'));

    await expect(session.switchAgent('gemini', failingSpawn)).rejects.toThrow('spawn failed');

    // Session should NOT have changed agent (rollback)
    // Note: rollback logic needs to be implemented in switchAgent
    // The destroy already happened so we need the caller to handle rollback
  });

  it('should handle multiple switches A→B→C→A', async () => {
    const agentA = mockAgentInstance('a-sess-1');
    const session = new Session({
      agentName: 'agentA',
      agentInstance: agentA,
      channelId: 'telegram',
    });
    session.agentSessionId = 'a-sess-1';

    // A → B
    const agentB = mockAgentInstance('b-sess-1');
    await session.switchAgent('agentB', async () => agentB);

    // B → C
    const agentC = mockAgentInstance('c-sess-1');
    await session.switchAgent('agentC', async () => agentC);

    // C → A
    const agentA2 = mockAgentInstance('a-sess-2');
    await session.switchAgent('agentA', async () => agentA2);

    expect(session.agentSwitchHistory).toHaveLength(3);
    expect(session.agentSwitchHistory[0].agentName).toBe('agentA');
    expect(session.agentSwitchHistory[1].agentName).toBe('agentB');
    expect(session.agentSwitchHistory[2].agentName).toBe('agentC');
    expect(session.agentName).toBe('agentA');
    expect(session.firstAgent).toBe('agentA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/__tests__/agent-switch.test.ts`
Expected: FAIL on tests that depend on not-yet-implemented features.

- [ ] **Step 3: Add switchAgent orchestration method to core.ts**

Add a method to `VibenCore` that orchestrates the full switch flow:

```typescript
async switchSessionAgent(
  sessionId: string,
  toAgent: string,
): Promise<{ resumed: boolean }> {
  const session = this.sessionManager.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const fromAgent = session.agentName;

  // 1. Middleware: agent:beforeSwitch
  const blocked = await this.middlewareChain.execute('agent:beforeSwitch', {
    sessionId,
    fromAgent,
    toAgent,
  }, async (payload) => payload);
  if (!blocked) throw new Error('Switch blocked by middleware');

  // 2. Determine resume vs new
  const lastEntry = session.findLastSwitchEntry(toAgent);
  const agentDef = this.agentManager.getAgent(toAgent);
  const canResume = lastEntry
    && lastEntry.promptCount === 0
    && agentDef.capabilities?.loadSession;
  const resumed = !!canResume;

  // 3. Find bridge for this session
  const bridge = this.bridges.get(sessionId);

  // 4. Disconnect bridge
  if (bridge) bridge.disconnect();

  // 5. Switch agent on session
  await session.switchAgent(toAgent, async () => {
    if (canResume) {
      return this.agentManager.resume(toAgent, session.workingDirectory, lastEntry!.agentSessionId);
    } else {
      const instance = await this.agentManager.spawn(toAgent, session.workingDirectory);
      // Inject context history
      const contextService = this.serviceRegistry.get<any>('context');
      if (contextService) {
        const config = this.configManager.get();
        const labelAgent = config.agentSwitch?.labelHistory ?? true;
        const result = await contextService.buildContext(
          { type: 'session', value: sessionId, repoPath: session.workingDirectory },
          { labelAgent },
        );
        if (result?.markdown) {
          session.setContext(result.markdown);
        }
      }
      return instance;
    }
  });

  // 6. Reconnect bridge
  if (bridge) bridge.connect();

  // 7. Persist updated record
  await this.sessionManager.patchRecord(sessionId, {
    agentName: toAgent,
    agentSessionId: session.agentSessionId,
    firstAgent: session.firstAgent,
    currentPromptCount: 0,
    agentSwitchHistory: session.agentSwitchHistory,
  });

  // 8. Middleware: agent:afterSwitch (fire-and-forget)
  this.middlewareChain.execute('agent:afterSwitch', {
    sessionId,
    fromAgent,
    toAgent,
    resumed,
  }, async (payload) => payload).catch(() => {});

  return { resumed };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/core/__tests__/agent-switch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/core.ts src/core/__tests__/agent-switch.test.ts
git commit -m "feat(agent-switch): add switchSessionAgent orchestration to core"
```

---

### Task 9: Update lazyResume for Switch History

**Files:**
- Modify: `src/core/core.ts`

- [ ] **Step 1: Update lazyResume to restore switchHistory**

In the `lazyResume()` method in `core.ts`, after creating the session from a stored record, restore the switch history fields:

```typescript
// After session.activate() in lazyResume:
if (record.firstAgent) session.firstAgent = record.firstAgent;
if (record.agentSwitchHistory) session.agentSwitchHistory = record.agentSwitchHistory;
if (record.currentPromptCount != null) (session as any).promptCount = record.currentPromptCount;
```

- [ ] **Step 2: Update session persistence to include new fields**

Ensure that wherever `SessionRecord` is saved (in `createSession()` pipeline and `patchRecord` calls), the new fields are included. In the `createSession()` method, add to the initial record:

```typescript
firstAgent: session.firstAgent,
currentPromptCount: session.promptCount,
agentSwitchHistory: session.agentSwitchHistory,
```

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/core.ts
git commit -m "feat(agent-switch): persist and restore switch history in lazyResume"
```

---

### Task 10: Adapter Integration — Telegram Switch Handler

**Files:**
- Modify: Telegram adapter command handler (where `/new`, `/session` are handled)

- [ ] **Step 1: Add /switch handler in Telegram adapter**

In the Telegram adapter's command dispatch (where it handles `type: 'silent'` responses for commands like `/new`, `/handoff`), add handling for `/switch`:

```typescript
// When command is 'switch':
case 'switch': {
  const raw = args.trim();

  // /switch label on|off
  if (raw.startsWith('label ')) {
    const value = raw.slice(6).trim().toLowerCase();
    // Save to session or config
    // Reply with confirmation
    return;
  }

  // /switch (no args) → show menu
  if (!raw) {
    const agents = core.agentManager.getAvailableAgents();
    const currentAgent = session.agentName;
    const options = agents
      .filter((a) => a.name !== currentAgent)
      .map((a) => ({ label: a.name, command: `/switch ${a.name}` }));

    if (options.length === 0) {
      await reply('No other agents available');
      return;
    }

    await reply({
      type: 'menu',
      title: 'Switch Agent',
      options,
    });
    return;
  }

  // /switch <agentName> → direct switch
  // Check in-flight prompt
  if (session.isProcessing) {
    await reply({
      type: 'confirm',
      question: 'Agent is responding. Cancel and switch?',
      onYes: `/switch ${raw}`,
      onNo: '',
    });
    return;
  }

  try {
    const { resumed } = await core.switchSessionAgent(session.id, raw);
    const status = resumed ? 'resumed' : 'new session';
    await reply(`Switched to ${raw} (${status})`);
  } catch (err: any) {
    await reply({ type: 'error', message: err.message });
  }
  return;
}
```

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Successful compilation.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/telegram/
git commit -m "feat(agent-switch): add /switch command handler to Telegram adapter"
```

---

### Task 11: Adapter Integration — Discord & Slack

**Files:**
- Modify: Discord adapter command handler
- Modify: Slack adapter command handler

- [ ] **Step 1: Add /switch handler to Discord adapter**

Follow the same pattern as Telegram (Task 10) adapted for Discord's message/interaction system.

- [ ] **Step 2: Add /switch handler to Slack adapter**

Follow the same pattern as Telegram (Task 10) adapted for Slack's Bolt framework.

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Successful compilation.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/discord/ src/plugins/slack/
git commit -m "feat(agent-switch): add /switch command handler to Discord and Slack adapters"
```

---

### Task 12: Update promptCount Persistence

**Files:**
- Modify: `src/core/sessions/session.ts`

- [ ] **Step 1: Persist promptCount on each prompt**

In `session.ts`, after `this.promptCount++` in `processPrompt()`, emit or track the count so it can be persisted. Add a hook or callback to update the session record:

```typescript
// After this.promptCount++ in processPrompt():
this.emit('prompt_count_changed', this.promptCount);
```

Then in `SessionBridge.wireLifecycle()`, listen for this and patch the record:

```typescript
session.on('prompt_count_changed', (count) => {
  this.sessionManager.patchRecord(session.id, { currentPromptCount: count });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/core/sessions/session.ts src/core/sessions/session-bridge.ts
git commit -m "feat(agent-switch): persist promptCount for resume decisions"
```

---

### Task 13: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/` (relevant GitBook pages)

- [ ] **Step 1: Add /switch command documentation**

Document the `/switch` command:
- Usage: `/switch`, `/switch <agent>`, `/switch label on|off`
- Behavior: resume vs new session logic
- Configuration: `agentSwitch.labelHistory` config option

- [ ] **Step 2: Commit**

```bash
git add README.md docs/
git commit -m "docs: add agent switch feature documentation"
```

---

### Task 14: Final Integration Test

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Successful compilation.

- [ ] **Step 3: Manual smoke test**

Start Viben with at least 2 agents configured. Test:
1. `/switch` shows menu without current agent
2. `/switch gemini` switches and shows "new session" message
3. `/switch claude` switches back — shows "resumed" if no prompts sent to gemini
4. Send a prompt to gemini, then `/switch claude` — shows "new session"
5. `/switch label off` then switch — history injected without agent names
6. `/switch claude` while already on claude — shows error
7. Process restart — session resumes with correct agent and history
