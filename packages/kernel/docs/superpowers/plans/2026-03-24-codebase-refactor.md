# Codebase Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Viben for maintainability: remove callback monkey-patching, decompose god objects, extract shared adapter patterns, split API monolith.

**Architecture:** 5 sequential layers — fix AgentInstance callbacks (foundation), decompose Core, create shared adapter layer, split API server, then clean up adapter sendMessage methods. TDD throughout.

**Tech Stack:** TypeScript ESM, vitest, existing TypedEmitter

**Spec:** `docs/superpowers/specs/2026-03-23-codebase-refactor-design.md`

## Implementation Notes

These notes apply across all tasks — read before starting:

1. **ESM only** — never use `require()`. Use `import` or `vi.mock()` for test mocks.
2. **Field names** — SessionBridge already uses `agentEventHandler` as the field name. Reuse it, don't create `agentUpdateHandler`.
3. **Test mocks** — when mocking AgentInstance, create a real TypedEmitter instance and add spy methods. Don't try to call class constructors as functions.
4. **archiveSession** stays in Core (spec Section 2d) — do NOT move it.
5. **Slack PR #42** — if it has merged, also remove auto-approve from `src/adapters/slack/adapter.ts` in Task 7.
6. **Commit prefixes** — use `refactor:` for restructuring tasks, `feat:` only for genuinely new functionality.
7. **Adapter MessageHandlers** — adapters should `implements MessageHandlers<Ctx>` so no `as unknown as` cast is needed.
8. **Shared adapter exports** — `MessageHandlers` and `dispatchMessage` are imported directly from `../shared/message-dispatcher.js` by adapters. No need to re-export through `core/index.ts` (they're adapter-internal, not plugin API).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/agent-instance.ts` | **Modify** | Extend TypedEmitter, emit `agent_event` instead of callback |
| `src/core/session.ts` | **Modify** | Rewrite autoName to use AgentInstance emitter + Session pause |
| `src/core/session-bridge.ts` | **Modify** | Subscribe via .on(), add auto-approve logic |
| `src/core/security-guard.ts` | **New** | Extract security checks from Core |
| `src/core/session-factory.ts` | **New** | Unified session creation + side-effect wiring |
| `src/core/core.ts` | **Modify** | Slim down: delegate to SecurityGuard, SessionFactory |
| `src/adapters/shared/message-dispatcher.ts` | **New** | MessageHandlers interface + dispatchMessage() |
| `src/adapters/shared/types.ts` | **New** | ITextBuffer, ISendQueue interfaces |
| `src/core/api/index.ts` | **New** | ApiServer class (moved from api-server.ts) |
| `src/core/api/router.ts` | **New** | Lightweight path matcher |
| `src/core/api/middleware.ts` | **New** | Auth, body parsing |
| `src/core/api/routes/health.ts` | **New** | Health/version routes |
| `src/core/api/routes/sessions.ts` | **New** | Session CRUD routes |
| `src/core/api/routes/config.ts` | **New** | Config routes |
| `src/core/api/routes/topics.ts` | **New** | Topic routes |
| `src/core/api/routes/tunnel.ts` | **New** | Tunnel routes |
| `src/core/api/routes/usage.ts` | **New** | Usage routes |
| `src/core/api/routes/agents.ts` | **New** | Agent routes |
| `src/core/api/routes/notify.ts` | **New** | Notify route |
| `src/core/api-server.ts` | **Modify** | Thin re-export for backward compat |
| `src/adapters/telegram/adapter.ts` | **Modify** | Implement MessageHandlers, split start() |
| `src/adapters/discord/adapter.ts` | **Modify** | Implement MessageHandlers, remove auto-approve |

---

## Task 1: Create branch + verify baseline

**Files:**
- None modified

- [ ] **Step 1: Create branch**

```bash
git checkout develop
git pull
git checkout -b refactor/codebase-cleanup
```

- [ ] **Step 2: Run all tests to verify baseline**

```bash
pnpm test
```

Expected: All tests pass. Note the exact count.

- [ ] **Step 3: Build to verify baseline**

```bash
pnpm build
```

Expected: No errors.

---

## Task 2: AgentInstance — extend TypedEmitter + emit events

**Files:**
- Modify: `src/core/agent-instance.ts`
- Test: `src/core/__tests__/agent-instance-emitter.test.ts`

- [ ] **Step 1: Write test — AgentInstance emits agent_event**

Create `src/core/__tests__/agent-instance-emitter.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { AgentInstance } from "../agent-instance.js";

describe("AgentInstance event emitter", () => {
  it("has on/off/emit from TypedEmitter", () => {
    // AgentInstance has private constructor, so we test the type interface
    // by checking the prototype chain
    expect(typeof AgentInstance.prototype.on).toBe("function");
    expect(typeof AgentInstance.prototype.off).toBe("function");
    expect(typeof AgentInstance.prototype.emit).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/agent-instance-emitter.test.ts
```

Expected: FAIL — `on` is not defined on prototype (AgentInstance doesn't extend TypedEmitter yet).

- [ ] **Step 3: Make AgentInstance extend TypedEmitter**

In `src/core/agent-instance.ts`:

1. Add import: `import { TypedEmitter } from "./typed-emitter.js";`
2. Add interface before the class:

```typescript
export interface AgentInstanceEvents {
  agent_event: (event: AgentEvent) => void;
}
```

3. Change class declaration:

```typescript
export class AgentInstance extends TypedEmitter<AgentInstanceEvents> {
```

4. Update constructor to call `super()`:

```typescript
private constructor(agentName: string) {
  super();
  this.agentName = agentName;
}
```

5. In `createClient()`, find all `self.onSessionUpdate(event)` calls and replace with `self.emit('agent_event', event)`.

6. In `setupCrashDetection()`, find `this.onSessionUpdate({type: "error", ...})` and replace with `this.emit('agent_event', {type: "error", ...})`.

7. Remove the `onSessionUpdate` property declaration:
```typescript
// DELETE this line:
onSessionUpdate: (event: AgentEvent) => void = () => {};
```

Keep `onPermissionRequest` as-is (callback property — intentional exception per spec).

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- src/core/__tests__/agent-instance-emitter.test.ts
```

Expected: PASS

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: Some tests may fail because SessionBridge still assigns `onSessionUpdate`. That's OK — we fix those in the next task.

- [ ] **Step 6: Commit**

```bash
git add src/core/agent-instance.ts src/core/__tests__/agent-instance-emitter.test.ts
git commit -m "refactor: AgentInstance extends TypedEmitter, emit agent_event"
```

---

## Task 3: SessionBridge — subscribe via .on() instead of callback

**Files:**
- Modify: `src/core/session-bridge.ts`
- Test: existing `src/core/__tests__/session-bridge.test.ts` must pass

- [ ] **Step 1: Update wireAgentToSession()**

In `src/core/session-bridge.ts`, change `wireAgentToSession()`:

```typescript
// BEFORE:
private wireAgentToSession(): void {
  this.session.agentInstance.onSessionUpdate = (event: AgentEvent) => {
    this.session.emit("agent_event", event);
  };
}

// AFTER:
private wireAgentToSession(): void {
  this.agentUpdateHandler = (event: AgentEvent) => {
    this.session.emit("agent_event", event);
  };
  this.session.agentInstance.on("agent_event", this.agentUpdateHandler);
}
```

Reuse the existing `agentEventHandler` field (already declared in SessionBridge). Do NOT create a new field name.

- [ ] **Step 2: Update disconnect()**

In `disconnect()`, replace the `onSessionUpdate = () => {}` reset:

```typescript
// BEFORE:
this.session.agentInstance.onSessionUpdate = () => {};

// AFTER:
if (this.agentEventHandler) {
  this.session.agentInstance.off("agent_event", this.agentEventHandler);
}
```

Keep the `onPermissionRequest = async () => ""` reset as-is.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass. The event flow is now: `AgentInstance.emit('agent_event') → SessionBridge listener → Session.emit('agent_event') → adapter`.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/session-bridge.ts
git commit -m "refactor: SessionBridge subscribes to AgentInstance via .on()"
```

---

## Task 4: Session.autoName — remove monkey-patching

**Files:**
- Modify: `src/core/session.ts`
- Test: `src/core/__tests__/session-autoname.test.ts`

- [ ] **Step 1: Write test — autoName events not forwarded to adapter**

Create `src/core/__tests__/session-autoname.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Session } from "../session.js";
import { TypedEmitter } from "../typed-emitter.js";
import type { AgentEvent } from "../types.js";

interface MockAgentEvents {
  agent_event: (event: AgentEvent) => void;
}

function createMockAgent() {
  // Create a real TypedEmitter instance, then add spy methods
  const agent = new TypedEmitter<MockAgentEvents>() as TypedEmitter<MockAgentEvents> & Record<string, unknown>;
  agent.agentName = "test";
  agent.sessionId = "test-session";
  agent.promptCapabilities = {};
  agent.onPermissionRequest = async () => "";
  agent.cancel = vi.fn();
  agent.destroy = vi.fn();

  // prompt() is called twice: once for user message, once for autoName
  let promptCallCount = 0;
  agent.prompt = vi.fn().mockImplementation(async () => {
    promptCallCount++;
    if (promptCallCount === 1) {
      // First call = user prompt — emit response that SHOULD reach adapter
      agent.emit("agent_event", { type: "text", content: "User response" });
    } else {
      // Second call = autoName — emit title that should NOT reach adapter
      agent.emit("agent_event", { type: "text", content: "Test Title" });
    }
    return {};
  });

  return agent;
}

describe("Session.autoName", () => {
  it("collects title but does not forward autoName events to session listeners", async () => {
    const agent = createMockAgent();
    const session = new Session({
      channelId: "test",
      agentName: "test",
      workingDirectory: "/tmp",
      agentInstance: agent as any,
    });

    // Simulate what SessionBridge does: bridge agent_event → session agent_event
    agent.on("agent_event", (event) => {
      session.emit("agent_event", event);
    });

    const adapterEvents: AgentEvent[] = [];
    session.on("agent_event", (event) => adapterEvents.push(event));

    // enqueuePrompt triggers processPrompt (user msg) → autoName
    await session.enqueuePrompt("hello");

    // Session should be named from autoName output
    expect(session.name).toBe("Test Title");

    // Adapter should have received "User response" but NOT "Test Title"
    const texts = adapterEvents
      .filter(e => e.type === "text")
      .map(e => (e as { content: string }).content);
    expect(texts).toContain("User response");
    expect(texts).not.toContain("Test Title");
  });
});
```

Note: This test bridges `agent.on("agent_event") → session.emit("agent_event")` to simulate what SessionBridge does. The key assertion: autoName pauses the Session emitter, so the "Test Title" event emitted by the agent during autoName reaches the `titleCollector` (on AgentInstance) but does NOT reach `adapterEvents` (on Session, which is paused).

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/session-autoname.test.ts
```

Expected: FAIL — current autoName still monkey-patches.

- [ ] **Step 3: Rewrite autoName in session.ts**

Replace the current `autoName()` method:

```typescript
private async autoName(): Promise<void> {
  let title = "";

  // Listen on AgentInstance directly — this emitter is NOT paused,
  // so titleCollector receives events even while Session is paused.
  const titleCollector = (event: AgentEvent) => {
    if (event.type === "text") title += event.content;
  };
  this.agentInstance.on("agent_event", titleCollector);

  // Pause Session emitter — SessionBridge's listener won't receive events,
  // so adapter never sees autoName output.
  this.pause();

  try {
    await this.agentInstance.prompt(
      "Summarize this conversation in max 5 words for a topic title. Reply ONLY with the title, nothing else.",
    );
    this.name = title.trim().slice(0, 50) || `Session ${this.id.slice(0, 6)}`;
    this.log.info({ name: this.name }, "Session auto-named");
    this.emit("named", this.name);
  } catch {
    this.name = `Session ${this.id.slice(0, 6)}`;
  } finally {
    this.agentInstance.off("agent_event", titleCollector);
    this.clearBuffer();
    this.resume();
  }
}
```

- [ ] **Step 4: Run autoName test**

```bash
pnpm test -- src/core/__tests__/session-autoname.test.ts
```

Expected: PASS

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 6: Build**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/session.ts src/core/__tests__/session-autoname.test.ts
git commit -m "refactor: autoName uses emitter + pause instead of monkey-patching"
```

---

## Task 5: SecurityGuard — extract from Core

**Files:**
- Create: `src/core/security-guard.ts`
- Test: `src/core/__tests__/security-guard.test.ts`
- Modify: `src/core/core.ts`

- [ ] **Step 1: Write security guard tests**

Create `src/core/__tests__/security-guard.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { SecurityGuard } from "../security-guard.js";
import type { IncomingMessage } from "../types.js";

function mockConfigManager(overrides: Record<string, unknown> = {}) {
  return {
    get: () => ({
      security: {
        allowedUserIds: [],
        maxConcurrentSessions: 20,
        ...overrides,
      },
    }),
  } as any;
}

function mockSessionManager(activeSessions: number = 0) {
  const sessions = Array.from({ length: activeSessions }, (_, i) => ({
    id: `s${i}`,
    status: "active",
  }));
  return { listSessions: () => sessions } as any;
}

const msg: IncomingMessage = {
  channelId: "telegram",
  threadId: "123",
  userId: "user1",
  text: "hello",
};

describe("SecurityGuard", () => {
  it("allows when no restrictions", () => {
    const guard = new SecurityGuard(mockConfigManager(), mockSessionManager());
    expect(guard.checkAccess(msg)).toEqual({ allowed: true });
  });

  it("rejects unauthorized user", () => {
    const guard = new SecurityGuard(
      mockConfigManager({ allowedUserIds: ["user2", "user3"] }),
      mockSessionManager(),
    );
    const result = guard.checkAccess(msg);
    expect(result.allowed).toBe(false);
  });

  it("allows authorized user", () => {
    const guard = new SecurityGuard(
      mockConfigManager({ allowedUserIds: ["user1"] }),
      mockSessionManager(),
    );
    expect(guard.checkAccess(msg)).toEqual({ allowed: true });
  });

  it("rejects when session limit reached", () => {
    const guard = new SecurityGuard(
      mockConfigManager({ maxConcurrentSessions: 2 }),
      mockSessionManager(2),
    );
    const result = guard.checkAccess(msg);
    expect(result.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/security-guard.test.ts
```

Expected: FAIL — `security-guard.ts` doesn't exist.

- [ ] **Step 3: Create SecurityGuard**

Create `src/core/security-guard.ts` with the implementation from the spec (see spec Section 2a for the full class).

- [ ] **Step 4: Run test**

```bash
pnpm test -- src/core/__tests__/security-guard.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate into Core**

In `src/core/core.ts`:

1. Import: `import { SecurityGuard } from "./security-guard.js";`
2. In constructor, add: `this.securityGuard = new SecurityGuard(configManager, this.sessionManager);`
3. In `handleMessage()`, replace the inline security checks (~30 lines) with:

```typescript
const access = this.securityGuard.checkAccess(message);
if (!access.allowed) {
  log.warn({ userId: message.userId, reason: access.reason }, "Access denied");
  if (access.reason.includes("Session limit")) {
    const adapter = this.adapters.get(message.channelId);
    if (adapter) {
      await adapter.sendMessage(message.threadId, {
        type: "error",
        text: `⚠️ ${access.reason}. Please cancel existing sessions with /cancel before starting new ones.`,
      });
    }
  }
  return;
}
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/security-guard.ts src/core/__tests__/security-guard.test.ts src/core/core.ts
git commit -m "refactor: extract SecurityGuard from Core"
```

---

## Task 6: SessionFactory — extract from Core

**Files:**
- Create: `src/core/session-factory.ts`
- Test: `src/core/__tests__/session-factory.test.ts`
- Modify: `src/core/core.ts`

- [ ] **Step 1: Write SessionFactory tests**

Create `src/core/__tests__/session-factory.test.ts` with tests for:
1. `create()` — spawns agent, creates Session, registers in SessionManager
2. `create()` with `resumeAgentSessionId` — resumes agent
3. `wireSideEffects()` — usage tracking fires on usage event

Use mocks for AgentManager, SessionManager, SpeechService.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/session-factory.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create SessionFactory**

Create `src/core/session-factory.ts`. Extract the session creation logic from `core.ts:createSession()` (lines 267-407). The factory's `create()` method should:

1. Spawn or resume agent via AgentManager
2. Create Session object
3. Register in SessionManager
4. Emit `session:created` on EventBus
5. Return Session (no bridge, no side-effects)

The factory's `wireSideEffects()` should move the usage tracking (lines 327-353) and tunnel cleanup (lines 355-374) from core.ts.

- [ ] **Step 4: Run test**

```bash
pnpm test -- src/core/__tests__/session-factory.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate into Core**

In `src/core/core.ts`:
1. Import SessionFactory
2. Create in constructor: `this.sessionFactory = new SessionFactory(...)`
3. Replace `createSession()` body to use factory:

```typescript
async createSession(params: { ... }): Promise<Session> {
  const session = await this.sessionFactory.create(params);

  // Thread creation
  const adapter = this.adapters.get(params.channelId);
  if (params.createThread && adapter) {
    const threadId = await adapter.createSessionThread(session.id, params.initialName ?? `🔄 ${params.agentName} — New Session`);
    session.threadId = threadId;
  }

  // Connect bridge
  if (adapter) {
    const bridge = this.createBridge(session, adapter);
    bridge.connect();
  }

  // Wire side-effects
  this.sessionFactory.wireSideEffects(session, {
    usageStore: this.usageStore ?? undefined,
    usageBudget: this.usageBudget ?? undefined,
    notificationManager: this.notificationManager,
    tunnelService: this._tunnelService,
  });

  // Persist
  // ... (move existing persist logic)

  return session;
}
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 7: Build**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/session-factory.ts src/core/__tests__/session-factory.test.ts src/core/core.ts
git commit -m "refactor: extract SessionFactory from Core"
```

---

## Task 7: Move auto-approve to SessionBridge

**Files:**
- Modify: `src/core/session-bridge.ts`
- Modify: `src/adapters/telegram/adapter.ts`
- Modify: `src/adapters/discord/adapter.ts`
- Test: `src/core/__tests__/session-bridge-autoapprove.test.ts`

- [ ] **Step 1: Write auto-approve tests**

Create `src/core/__tests__/session-bridge-autoapprove.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { SessionBridge } from "../session-bridge.js";
import { TypedEmitter } from "../typed-emitter.js";
import type { AgentEvent, PermissionRequest } from "../types.js";

function createMockSession(opts: { dangerousMode?: boolean } = {}) {
  const session = {
    id: "sess-1",
    channelId: "telegram",
    threadId: "123",
    agentName: "test",
    workingDirectory: "/tmp",
    status: "active",
    dangerousMode: opts.dangerousMode ?? false,
    agentInstance: Object.assign(new TypedEmitter(), {
      onPermissionRequest: async () => "",
    }),
    permissionGate: {
      setPending: vi.fn().mockResolvedValue("allow-1"),
      requestId: undefined as string | undefined,
    },
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as any;
  return session;
}

function createMockAdapter() {
  return {
    sendPermissionRequest: vi.fn(),
    sendMessage: vi.fn(),
    sendNotification: vi.fn(),
  } as any;
}

const opaRequest: PermissionRequest = {
  id: "req-1",
  description: "Run viben api status",
  options: [
    { id: "allow-1", label: "Allow", isAllow: true },
    { id: "deny-1", label: "Deny", isAllow: false },
  ],
};

const normalRequest: PermissionRequest = {
  id: "req-2",
  description: "Run rm -rf /",
  options: [
    { id: "allow-2", label: "Allow", isAllow: true },
    { id: "deny-2", label: "Deny", isAllow: false },
  ],
};

describe("SessionBridge auto-approve", () => {
  it("auto-approves viben commands without sending to adapter", async () => {
    const session = createMockSession();
    const adapter = createMockAdapter();
    const bridge = new SessionBridge(session, adapter, {
      messageTransformer: {} as any,
      notificationManager: {} as any,
      sessionManager: {} as any,
    });
    bridge.connect();

    const result = await session.agentInstance.onPermissionRequest(opaRequest);
    expect(result).toBe("allow-1");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  it("auto-approves in dangerous mode", async () => {
    const session = createMockSession({ dangerousMode: true });
    const adapter = createMockAdapter();
    const bridge = new SessionBridge(session, adapter, {
      messageTransformer: {} as any,
      notificationManager: {} as any,
      sessionManager: {} as any,
    });
    bridge.connect();

    const result = await session.agentInstance.onPermissionRequest(normalRequest);
    expect(result).toBe("allow-2");
    expect(adapter.sendPermissionRequest).not.toHaveBeenCalled();
  });

  it("forwards non-viben requests to adapter", async () => {
    const session = createMockSession();
    const adapter = createMockAdapter();
    const bridge = new SessionBridge(session, adapter, {
      messageTransformer: {} as any,
      notificationManager: {} as any,
      sessionManager: {} as any,
    });
    bridge.connect();

    // This will call adapter.sendPermissionRequest and wait for permissionGate
    const resultPromise = session.agentInstance.onPermissionRequest(normalRequest);
    expect(adapter.sendPermissionRequest).toHaveBeenCalled();
    // The result comes from permissionGate.setPending mock
    const result = await resultPromise;
    expect(result).toBe("allow-1"); // from mock
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/session-bridge-autoapprove.test.ts
```

- [ ] **Step 3: Update SessionBridge.wirePermissions()**

In `src/core/session-bridge.ts`, update `wirePermissions()` to include auto-approve logic per spec Section 2c. The key change: check `request.description.includes("viben")` and `session.dangerousMode` BEFORE sending to adapter.

- [ ] **Step 4: Remove auto-approve from Telegram adapter**

In `src/adapters/telegram/adapter.ts`, in `sendPermissionRequest()`, remove the `viben` auto-approve block and the `dangerousMode` auto-approve block. Keep only the UI rendering code (sending inline keyboard to user).

- [ ] **Step 5: Remove auto-approve from Discord adapter**

In `src/adapters/discord/adapter.ts`, in `sendPermissionRequest()`, remove the same auto-approve blocks.

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/session-bridge.ts src/core/__tests__/session-bridge-autoapprove.test.ts src/adapters/telegram/adapter.ts src/adapters/discord/adapter.ts
git commit -m "refactor: move permission auto-approve to SessionBridge"
```

---

## Task 8: Shared adapter layer — MessageDispatcher

**Files:**
- Create: `src/adapters/shared/message-dispatcher.ts`
- Create: `src/adapters/shared/types.ts`
- Test: `src/adapters/shared/message-dispatcher.test.ts`

- [ ] **Step 1: Write dispatcher tests**

Create `src/adapters/shared/message-dispatcher.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { dispatchMessage, type MessageHandlers } from "./message-dispatcher.js";
import type { OutgoingMessage } from "../../core/types.js";

function createMockHandlers(): MessageHandlers<string> {
  return {
    onText: vi.fn(),
    onThought: vi.fn(),
    onToolCall: vi.fn(),
    onToolUpdate: vi.fn(),
    onPlan: vi.fn(),
    onUsage: vi.fn(),
    onSessionEnd: vi.fn(),
    onError: vi.fn(),
    onAttachment: vi.fn(),
    onSystemMessage: vi.fn(),
  };
}

describe("dispatchMessage", () => {
  it("routes text to onText", async () => {
    const h = createMockHandlers();
    const msg: OutgoingMessage = { type: "text", text: "hello" };
    await dispatchMessage(h, "ctx", msg);
    expect(h.onText).toHaveBeenCalledWith("ctx", msg);
  });

  it("routes tool_call to onToolCall", async () => {
    const h = createMockHandlers();
    const msg: OutgoingMessage = { type: "tool_call", text: "Read" };
    await dispatchMessage(h, "ctx", msg);
    expect(h.onToolCall).toHaveBeenCalledWith("ctx", msg);
  });

  it("unknown type does not crash", async () => {
    const h = createMockHandlers();
    const msg = { type: "unknown_xyz", text: "" } as any;
    await expect(dispatchMessage(h, "ctx", msg)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/adapters/shared/message-dispatcher.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create message-dispatcher.ts**

Create `src/adapters/shared/message-dispatcher.ts` with the `MessageHandlers` interface and `dispatchMessage()` function from the spec (Section 3a).

- [ ] **Step 4: Create shared types**

Create `src/adapters/shared/types.ts` with `ITextBuffer` and `ISendQueue` interfaces from spec (Section 3b).

- [ ] **Step 5: Run tests**

```bash
pnpm test -- src/adapters/shared/message-dispatcher.test.ts
```

Expected: PASS

- [ ] **Step 6: Run all tests + build**

```bash
pnpm test && pnpm build
```

Expected: All pass, no build errors.

- [ ] **Step 7: Commit**

```bash
git add src/adapters/shared/
git commit -m "refactor: add shared MessageDispatcher and adapter interfaces"
```

---

## Task 9: API Server — Router + middleware extraction

**Files:**
- Create: `src/core/api/router.ts`
- Create: `src/core/api/middleware.ts`
- Test: `src/core/__tests__/api-router.test.ts`

- [ ] **Step 1: Write router tests**

Create `src/core/__tests__/api-router.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Router } from "../api/router.js";

describe("Router", () => {
  it("matches exact path", () => {
    const router = new Router();
    const handler = async () => {};
    router.get("/api/health", handler);
    const match = router.match("GET", "/api/health");
    expect(match).not.toBeNull();
    expect(match!.handler).toBe(handler);
  });

  it("matches path with params", () => {
    const router = new Router();
    router.get("/api/sessions/:id", async () => {});
    const match = router.match("GET", "/api/sessions/abc123");
    expect(match).not.toBeNull();
    expect(match!.params.id).toBe("abc123");
  });

  it("returns null for unmatched path", () => {
    const router = new Router();
    router.get("/api/health", async () => {});
    expect(router.match("GET", "/api/unknown")).toBeNull();
  });

  it("matches correct method", () => {
    const router = new Router();
    const getHandler = async () => {};
    const postHandler = async () => {};
    router.get("/api/sessions", getHandler);
    router.post("/api/sessions", postHandler);
    expect(router.match("GET", "/api/sessions")!.handler).toBe(getHandler);
    expect(router.match("POST", "/api/sessions")!.handler).toBe(postHandler);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/core/__tests__/api-router.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create Router**

Create `src/core/api/router.ts`:

```typescript
import type * as http from "node:http";

export type Handler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: Record<string, string>,
) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: Handler): void { this.add("GET", path, handler); }
  post(path: string, handler: Handler): void { this.add("POST", path, handler); }
  put(path: string, handler: Handler): void { this.add("PUT", path, handler); }
  delete(path: string, handler: Handler): void { this.add("DELETE", path, handler); }

  match(method: string, url: string): { handler: Handler; params: Record<string, string> } | null {
    const pathname = url.split("?")[0];
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = pathname.match(route.pattern);
      if (!m) continue;
      const params: Record<string, string> = {};
      for (let i = 0; i < route.keys.length; i++) {
        params[route.keys[i]] = m[i + 1];
      }
      return { handler: route.handler, params };
    }
    return null;
  }

  private add(method: string, path: string, handler: Handler): void {
    const keys: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return "([^/]+)";
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      keys,
      handler,
    });
  }
}
```

- [ ] **Step 4: Create middleware.ts**

Create `src/core/api/middleware.ts` — extract auth checking and body parsing helpers from current `api-server.ts`.

- [ ] **Step 5: Run router tests**

```bash
pnpm test -- src/core/__tests__/api-router.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/api/ src/core/__tests__/api-router.test.ts
git commit -m "refactor: add API Router and middleware"
```

---

## Task 10: API Server — extract route modules

**Files:**
- Create: `src/core/api/index.ts`
- Create: `src/core/api/routes/health.ts`
- Create: `src/core/api/routes/sessions.ts`
- Create: `src/core/api/routes/config.ts`
- Create: `src/core/api/routes/topics.ts`
- Create: `src/core/api/routes/tunnel.ts`
- Create: `src/core/api/routes/usage.ts`
- Create: `src/core/api/routes/agents.ts`
- Create: `src/core/api/routes/notify.ts`
- Modify: `src/core/api-server.ts`

- [ ] **Step 1: Extract routes from api-server.ts**

Read through the current `src/core/api-server.ts` carefully. For each URL pattern, extract the handler into the corresponding route module. Each route module exports a `register(router, core, ...)` function.

Move the route handlers — don't rewrite them. The goal is to split the file without changing behavior.

- [ ] **Step 2: Create api/index.ts**

Move the `ApiServer` class to `src/core/api/index.ts`. It should:
1. Create the Router
2. Call each route module's register function
3. Handle the HTTP server lifecycle (start, stop)
4. Handle SSE, static serving, auth

- [ ] **Step 3: Update api-server.ts as re-export**

Replace `src/core/api-server.ts` contents with:

```typescript
// Backward compatibility re-export
export { ApiServer, type ApiConfig } from "./api/index.js";
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All existing API tests pass (they import from `api-server.js` which now re-exports).

- [ ] **Step 5: Build**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/api/ src/core/api-server.ts
git commit -m "refactor: split API server into route modules"
```

---

## Task 11: Telegram adapter — adopt MessageDispatcher

**Files:**
- Modify: `src/adapters/telegram/adapter.ts`

- [ ] **Step 1: Import MessageDispatcher**

Add import:
```typescript
import { dispatchMessage, type MessageHandlers } from "../shared/message-dispatcher.js";
```

- [ ] **Step 2: Define TelegramMessageCtx**

```typescript
interface TelegramMessageCtx {
  sessionId: string;
  threadId: number;
}
```

- [ ] **Step 3: Extract each switch case into a handler method**

For each case in the current `sendMessage()` switch, create a corresponding method on `TelegramAdapter`:

- `case "text"` → `private async onText(ctx, content)`
- `case "thought"` → `private async onThought(ctx, content)`
- `case "tool_call"` → `private async onToolCall(ctx, content)`
- etc.

Move the exact code from each case into the method — no rewriting.

- [ ] **Step 4: Replace sendMessage switch with dispatchMessage**

```typescript
async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
  if (this.assistantInitializing && sessionId === this.assistantSession?.id) return;
  const session = this.core.sessionManager.getSession(sessionId);
  if (!session) return;
  if (session.archiving) return;
  const threadId = Number(session.threadId);
  if (!threadId || isNaN(threadId)) return;

  const ctx: TelegramMessageCtx = { sessionId, threadId };
  await dispatchMessage(this, ctx, content);
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/telegram/adapter.ts
git commit -m "refactor: Telegram adapter adopts MessageDispatcher"
```

---

## Task 12: Discord adapter — adopt MessageDispatcher

**Files:**
- Modify: `src/adapters/discord/adapter.ts`

- [ ] **Step 1: Same pattern as Task 11**

Apply the same extraction pattern to Discord adapter:
1. Import MessageDispatcher
2. Define DiscordMessageCtx
3. Extract each switch case into handler methods
4. Replace switch with `dispatchMessage()`

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/adapters/discord/adapter.ts
git commit -m "refactor: Discord adapter adopts MessageDispatcher"
```

---

## Task 13: Update exports + final verification

**Files:**
- Modify: `src/core/index.ts`

- [ ] **Step 1: Add new exports**

In `src/core/index.ts`, add:

```typescript
export { SecurityGuard } from "./security-guard.js";
export { SessionFactory } from "./session-factory.js";
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Build production bundle**

```bash
pnpm build && pnpm build:publish
```

Expected: Both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/core/index.ts
git commit -m "refactor: export SecurityGuard and SessionFactory"
```

---

## Task 14: Review Slack PR #42 and comment

**Files:** None modified

- [ ] **Step 1: Review Slack PR against new architecture**

Check PR #42 for:
1. Permission auto-approve logic — should be removed (now in SessionBridge)
2. `sendMessage()` — should adopt `MessageDispatcher` pattern
3. Config schema change — verify compatibility
4. Core.ts changes — verify compatibility with refactored Core

- [ ] **Step 2: Post review comment on PR**

Using `gh pr review 42`, comment with specific suggestions:
1. Remove auto-approve from `sendPermissionRequest()` — it's now handled centrally in SessionBridge
2. Consider adopting `MessageHandlers` interface for `sendMessage()` consistency
3. Note any conflicts with refactored `core.ts` or `session-bridge.ts`

```bash
gh pr review 42 --comment --body "$(cat <<'EOF'
## Architecture alignment review

The `refactor/codebase-cleanup` branch introduces changes that affect this PR:

### 1. Permission auto-approve → SessionBridge (remove from adapter)
Auto-approve logic (`viben` command check + `dangerousMode`) has been moved to `SessionBridge.wirePermissions()`. All adapters no longer need this in `sendPermissionRequest()`. Please remove the auto-approve blocks from `SlackAdapter.sendPermissionRequest()`.

### 2. MessageDispatcher pattern (optional but recommended)
Telegram and Discord now use `dispatchMessage()` from `src/adapters/shared/message-dispatcher.ts`. The Slack adapter's `sendMessage()` is already clean, but adopting the same pattern would ensure consistency:

```typescript
import { dispatchMessage, type MessageHandlers } from "../shared/message-dispatcher.js";
```

### 3. Core.ts changes
`core.ts` has been refactored — `createSession()` now delegates to `SessionFactory`. The `handleNewSession()` signature change in this PR (adding `options`) is compatible.

### 4. No conflicts expected
The Slack adapter's config schema changes and `main.ts` registration are additive and don't conflict.
EOF
)"
```

---

## Summary

| Task | Description | Estimated size |
|------|-------------|----------------|
| 1 | Create branch + verify baseline | 2 min |
| 2 | AgentInstance extends TypedEmitter | 15 min |
| 3 | SessionBridge subscribes via .on() | 10 min |
| 4 | Session.autoName remove monkey-patching | 20 min |
| 5 | SecurityGuard extraction | 15 min |
| 6 | SessionFactory extraction | 25 min |
| 7 | Auto-approve to SessionBridge | 20 min |
| 8 | Shared MessageDispatcher | 10 min |
| 9 | API Router + middleware | 15 min |
| 10 | API route modules extraction | 30 min |
| 11 | Telegram adopt MessageDispatcher | 20 min |
| 12 | Discord adopt MessageDispatcher | 15 min |
| 13 | Update exports + final verification | 5 min |
| 14 | Review Slack PR #42 | 10 min |
