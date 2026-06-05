# Critical Code Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 20 critical and high-severity bugs identified in the codebase logic review (Batches 1-3).

**Architecture:** Targeted fixes to existing files — no new modules. Each task is a small, independent patch (1-10 lines). Tests verify fix works. Existing tests must still pass.

**Tech Stack:** TypeScript, Vitest, Node.js

**Reference:** Full findings at `docs/superpowers/specs/2026-03-28-codebase-logic-review-findings.md`

---

### Task 1: Guard processPrompt for finished state (C1)

**Files:**
- Modify: `src/core/sessions/session.ts:171-181`
- Test: `src/core/sessions/__tests__/session-lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/sessions/__tests__/session-lifecycle.test.ts`:

```typescript
it("processPrompt silently returns if session is finished", async () => {
  session.activate();
  session.finish("done");
  // Should not throw — silently returns
  await session.enqueuePrompt("hello after finish");
  // Give the queue a tick to process
  await new Promise((r) => setTimeout(r, 50));
  expect(mockAgent.prompt).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/sessions/__tests__/session-lifecycle.test.ts -t "finished"`
Expected: FAIL with "Invalid session transition: finished → active"

- [ ] **Step 3: Write minimal implementation**

In `src/core/sessions/session.ts`, add guard at the top of `processPrompt`, after the warmup check (line 175), before `this.promptCount++` (line 177):

```typescript
    // Don't process prompts for finished sessions (queue may still drain)
    if (this._status === "finished") return;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/sessions/__tests__/session-lifecycle.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

---

### Task 2: Add cancelled to valid transitions from error (C2)

**Files:**
- Modify: `src/core/sessions/session.ts:23`
- Test: `src/core/sessions/__tests__/session-state-machine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/sessions/__tests__/session-state-machine.test.ts`:

```typescript
it("allows error → cancelled transition", () => {
  session.activate();
  session.fail("something broke");
  expect(() => session.markCancelled()).not.toThrow();
  expect(session.status).toBe("cancelled");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/sessions/__tests__/session-state-machine.test.ts -t "error → cancelled"`
Expected: FAIL with "Invalid session transition: error → cancelled"

- [ ] **Step 3: Write minimal implementation**

In `src/core/sessions/session.ts:23`, change:

```typescript
  error: new Set(["active"]),
```

to:

```typescript
  error: new Set(["active", "cancelled"]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/sessions/__tests__/session-state-machine.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

---

### Task 3: Wrap abortPrompt in try-catch in cancelSession (C13)

**Files:**
- Modify: `src/core/sessions/session-manager.ts:118-124`
- Test: `src/core/sessions/__tests__/session-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/sessions/__tests__/session-manager.test.ts`:

```typescript
it("cancelSession completes even if abortPrompt throws", async () => {
  const session = createMockSession("test-1");
  session.abortPrompt = vi.fn().mockRejectedValue(new Error("agent dead"));
  manager.register(session);
  await manager.cancelSession("test-1");
  expect(session.markCancelled).toHaveBeenCalled();
  expect(manager.getSession("test-1")).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/sessions/__tests__/session-manager.test.ts -t "abortPrompt throws"`
Expected: FAIL with "agent dead"

- [ ] **Step 3: Write minimal implementation**

In `src/core/sessions/session-manager.ts:118-124`, change:

```typescript
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.abortPrompt();
      session.markCancelled();
      this.sessions.delete(sessionId);
    }
```

to:

```typescript
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.abortPrompt();
      } catch {
        // Agent may already be dead — continue with cleanup
      }
      session.markCancelled();
      this.sessions.delete(sessionId);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/sessions/__tests__/session-manager.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

---

### Task 4: Remove thinking indicator on maxThinkingDuration (C5)

**Files:**
- Modify: `src/core/adapter-primitives/primitives/activity-tracker.ts:74-76`
- Test: `src/core/adapter-primitives/__tests__/activity-tracker.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/adapter-primitives/__tests__/activity-tracker.test.ts`:

```typescript
it("removes thinking indicator when maxThinkingDuration exceeded", async () => {
  const removeThinking = vi.fn().mockResolvedValue(undefined);
  const tracker = new ActivityTracker({
    thinkingRefreshInterval: 50,
    maxThinkingDuration: 100,
    thinkingDelay: 0,
  });
  tracker.onThinkingStart("s1", {
    showThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    updateThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    removeThinkingIndicator: removeThinking,
  });
  // Wait for maxThinkingDuration + one refresh interval
  await new Promise((r) => setTimeout(r, 200));
  expect(removeThinking).toHaveBeenCalled();
  tracker.destroy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/adapter-primitives/__tests__/activity-tracker.test.ts -t "maxThinkingDuration"`
Expected: FAIL — removeThinkingIndicator never called

- [ ] **Step 3: Write minimal implementation**

In `src/core/adapter-primitives/primitives/activity-tracker.ts:74-76`, change:

```typescript
      if (Date.now() - state.startTime >= this.config.maxThinkingDuration) {
        this.stopRefresh(state)
        return
      }
```

to:

```typescript
      if (Date.now() - state.startTime >= this.config.maxThinkingDuration) {
        state.dismissed = true
        this.stopRefresh(state)
        state.callbacks.removeThinkingIndicator().catch(() => {})
        return
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/adapter-primitives/__tests__/activity-tracker.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

---

### Task 5: Move voiceMode "next" reset after successful prompt (F9)

**Files:**
- Modify: `src/core/sessions/session.ts:201-206,233-236`
- Test: `src/core/sessions/__tests__/session-tts.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/sessions/__tests__/session-tts.test.ts`:

```typescript
it("preserves voiceMode 'next' if prompt fails", async () => {
  session.setVoiceMode("next");
  mockAgent.prompt.mockRejectedValueOnce(new Error("agent error"));
  try {
    await session.enqueuePrompt("test");
    await vi.waitFor(() => expect(mockAgent.prompt).toHaveBeenCalled());
  } catch {}
  // voiceMode should still be "next" because the prompt failed
  expect(session.voiceMode).toBe("next");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/sessions/__tests__/session-tts.test.ts -t "preserves voiceMode"`
Expected: FAIL — voiceMode is "off" because it was reset before prompt

- [ ] **Step 3: Write minimal implementation**

In `src/core/sessions/session.ts`, remove the early reset (lines 203-204):

Change:

```typescript
    // TTS: inject prompt instruction
    if (ttsActive) {
      processed.text += TTS_PROMPT_INSTRUCTION;
      if (this.voiceMode === "next") {
        this.voiceMode = "off";
      }
    }
```

to:

```typescript
    // TTS: inject prompt instruction
    if (ttsActive) {
      processed.text += TTS_PROMPT_INSTRUCTION;
    }
```

Then after the successful prompt (around line 233, inside the try block after `const response = await this.agentInstance.prompt(...)`), add:

```typescript
      // Reset "next" voice mode only after successful prompt
      if (ttsActive && this.voiceMode === "next") {
        this.voiceMode = "off";
      }
```

Place this right after the existing `if (contextUsed) { this.pendingContext = null; }` block.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/sessions/__tests__/session-tts.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

---

### Task 6: Unref permission gate timer (C8)

**Files:**
- Modify: `src/core/sessions/permission-gate.ts:33-36`

- [ ] **Step 1: Write minimal implementation**

In `src/core/sessions/permission-gate.ts`, after the setTimeout (line 35), add unref:

Change:

```typescript
      this.timeoutTimer = setTimeout(() => {
        this.reject("Permission request timed out (no response received)");
      }, this.timeoutMs);
```

to:

```typescript
      this.timeoutTimer = setTimeout(() => {
        this.reject("Permission request timed out (no response received)");
      }, this.timeoutMs);
      if (typeof this.timeoutTimer === 'object' && 'unref' in this.timeoutTimer) {
        (this.timeoutTimer as NodeJS.Timeout).unref();
      }
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test -- src/core/sessions/__tests__/permission-gate`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 7: Remove draft from map after finalize in shared DraftManager (C16)

**Files:**
- Modify: `src/core/adapter-primitives/primitives/draft-manager.ts:96-100`
- Test: `src/core/adapter-primitives/__tests__/draft-manager.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/core/adapter-primitives/__tests__/draft-manager.test.ts`:

```typescript
it("removes draft from map after finalize", async () => {
  const dm = new DraftManager(defaultConfig);
  const draft = dm.getOrCreate("s1");
  draft.append("hello");
  await dm.finalize("s1");
  // getOrCreate should return a NEW draft, not the old finalized one
  const newDraft = dm.getOrCreate("s1");
  expect(newDraft).not.toBe(draft);
  expect(newDraft.isEmpty).toBe(true);
  dm.destroyAll();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/adapter-primitives/__tests__/draft-manager.test.ts -t "removes draft"`
Expected: FAIL — same draft instance returned with old content

- [ ] **Step 3: Write minimal implementation**

In `src/core/adapter-primitives/primitives/draft-manager.ts:96-100`, change:

```typescript
  async finalize(sessionId: string): Promise<void> {
    const draft = this.drafts.get(sessionId)
    if (!draft) return
    await draft.finalize()
  }
```

to:

```typescript
  async finalize(sessionId: string): Promise<void> {
    const draft = this.drafts.get(sessionId)
    if (!draft) return
    await draft.finalize()
    this.drafts.delete(sessionId)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/adapter-primitives/__tests__/draft-manager.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

---

### Task 8: Set session.threadId BEFORE createSession in lazy resume (C12)

**Files:**
- Modify: `src/core/core.ts:303-311` (createSession params type) and `src/core/core.ts:313-323` (createSession body) and `src/core/core.ts:647-658` (lazyResume)

- [ ] **Step 1: Write minimal implementation**

In `src/core/core.ts:303-311`, add `threadId` to the params type:

```typescript
  async createSession(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    resumeAgentSessionId?: string;
    existingSessionId?: string;
    createThread?: boolean;
    initialName?: string;
    threadId?: string;
  }): Promise<Session> {
```

Then in the body, after `const session = await this.sessionFactory.create(params);` (line 313) and BEFORE connecting the bridge (line 327), add:

```typescript
    // Set threadId early so agent events during bridge.connect() can find the thread
    if (params.threadId) {
      session.threadId = params.threadId;
    }
```

Then in `lazyResume` (line 647-658), pass threadId in the createSession call:

```typescript
        const session = await this.createSession({
          channelId: record.channelId,
          agentName: record.agentName,
          workingDirectory: record.workingDir,
          resumeAgentSessionId: record.agentSessionId,
          existingSessionId: record.sessionId,
          initialName: record.name,
          threadId: message.threadId,
        });
```

Keep `session.threadId = message.threadId;` after the call as a no-op safety net.

- [ ] **Step 2: Run existing tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 9: Fix lazy resume — skip cancelled, fallback to fresh (F1+F2)

**Files:**
- Modify: `src/core/core.ts:625-636,666-680`

- [ ] **Step 1: Write minimal implementation**

In `src/core/core.ts:625-636`, change the status check to also skip cancelled and finished sessions:

Change:

```typescript
    // Don't resume errored sessions (cancelled sessions can still be resumed)
    if (record.status === "error") {
```

to:

```typescript
    // Don't resume errored or cancelled sessions — spawn fresh instead
    if (record.status === "error" || record.status === "cancelled") {
```

Then in the catch block (lines 666-680), add fallback to fresh session:

Change the catch block to:

```typescript
      } catch (err) {
        log.error({ err, record }, "Lazy resume failed, spawning fresh session");
        try {
          const session = await this.createSession({
            channelId: record.channelId,
            agentName: record.agentName,
            workingDirectory: record.workingDir,
            threadId: message.threadId,
          });
          session.threadId = message.threadId;
          session.activate();
          log.info({ sessionId: session.id }, "Fresh session created after resume failure");
          return session;
        } catch (fallbackErr) {
          log.error({ err: fallbackErr }, "Fresh session fallback also failed");
          const adapter = this.adapters.get(message.channelId);
          if (adapter) {
            try {
              await adapter.sendMessage(message.threadId, {
                type: "error",
                text: `Failed to start session: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
              });
            } catch { /* best effort */ }
          }
          return null;
        }
      } finally {
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 10: Backup corrupt sessions.json (C15)

**Files:**
- Modify: `src/core/sessions/session-store.ts:136-138`

- [ ] **Step 1: Write minimal implementation**

In `src/core/sessions/session-store.ts:136-138`, change:

```typescript
    } catch (err) {
      log.error({ err }, "Failed to load session store");
    }
```

to:

```typescript
    } catch (err) {
      log.error({ err }, "Failed to load session store, backing up corrupt file");
      try {
        fs.renameSync(this.filePath, `${this.filePath}.bak`);
      } catch { /* best effort */ }
    }
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test -- src/core/sessions/__tests__/session-store`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 11: Fix CLI api session field access (F19)

**Files:**
- Modify: `src/cli/commands/api.ts:415-426`

- [ ] **Step 1: Write minimal implementation**

Change lines 415-426:

```typescript
      console.log(`Session details:`)
      console.log(`  ID             : ${data.id}`)
      console.log(`  Agent          : ${data.agent}`)
      console.log(`  Status         : ${data.status}`)
      console.log(`  Name           : ${data.name ?? '(none)'}`)
      console.log(`  Workspace      : ${data.workspace}`)
      console.log(`  Created        : ${data.createdAt}`)
      console.log(`  Dangerous      : ${data.dangerous}`)
      console.log(`  Queue depth    : ${data.queueDepth}`)
      console.log(`  Prompt active  : ${data.promptActive}`)
      console.log(`  Channel        : ${data.channelId ?? '(none)'}`)
      console.log(`  Thread         : ${data.threadId ?? '(none)'}`)
```

to:

```typescript
      const s = (data.session ?? data) as Record<string, unknown>
      console.log(`Session details:`)
      console.log(`  ID             : ${s.id}`)
      console.log(`  Agent          : ${s.agent}`)
      console.log(`  Status         : ${s.status}`)
      console.log(`  Name           : ${s.name ?? '(none)'}`)
      console.log(`  Workspace      : ${s.workspace}`)
      console.log(`  Created        : ${s.createdAt}`)
      console.log(`  Dangerous      : ${s.dangerousMode}`)
      console.log(`  Queue depth    : ${s.queueDepth}`)
      console.log(`  Prompt active  : ${s.promptRunning}`)
      console.log(`  Channel        : ${s.channelId ?? '(none)'}`)
      console.log(`  Thread         : ${s.threadId ?? '(none)'}`)
```

- [ ] **Step 2: Run build to verify no type errors**

Run: `pnpm build`
Expected: SUCCESS

- [ ] **Step 3: Commit**

---

### Task 12: Fix CLI api health field access (F20)

**Files:**
- Modify: `src/cli/commands/api.ts:459-471`

- [ ] **Step 1: Write minimal implementation**

Change lines 459-471:

```typescript
      const uptimeSeconds = typeof data.uptimeSeconds === 'number' ? data.uptimeSeconds : 0
      const hours = Math.floor(uptimeSeconds / 3600)
      const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      const memoryBytes = typeof data.memoryUsage === 'number' ? data.memoryUsage : 0
      const memoryMB = (memoryBytes / 1024 / 1024).toFixed(1)
      const sessions = data.sessions as Record<string, unknown> ?? {}
      console.log(`Status   : ${data.status}`)
      console.log(`Uptime   : ${hours}h ${minutes}m`)
      console.log(`Version  : ${data.version}`)
      console.log(`Memory   : ${memoryMB} MB`)
      console.log(`Sessions : ${sessions.active ?? 0} active / ${sessions.total ?? 0} total`)
      console.log(`Adapters : ${data.adapters}`)
      console.log(`Tunnel   : ${data.tunnel}`)
```

to:

```typescript
      const uptimeMs = typeof data.uptime === 'number' ? data.uptime : 0
      const uptimeSeconds = Math.floor(uptimeMs / 1000)
      const hours = Math.floor(uptimeSeconds / 3600)
      const minutes = Math.floor((uptimeSeconds % 3600) / 60)
      const mem = data.memory as Record<string, number> | undefined
      const memoryMB = mem ? (mem.rss / 1024 / 1024).toFixed(1) : '0.0'
      const sessions = data.sessions as Record<string, unknown> ?? {}
      const tunnel = data.tunnel as Record<string, unknown> | undefined
      const tunnelStr = tunnel?.enabled ? `${tunnel.url}` : 'disabled'
      const adapters = Array.isArray(data.adapters) ? data.adapters.join(', ') : String(data.adapters ?? 'none')
      console.log(`Status   : ${data.status}`)
      console.log(`Uptime   : ${hours}h ${minutes}m`)
      console.log(`Version  : ${data.version}`)
      console.log(`Memory   : ${memoryMB} MB`)
      console.log(`Sessions : ${sessions.active ?? 0} active / ${sessions.total ?? 0} total`)
      console.log(`Adapters : ${adapters}`)
      console.log(`Tunnel   : ${tunnelStr}`)
```

- [ ] **Step 2: Run build to verify no type errors**

Run: `pnpm build`
Expected: SUCCESS

- [ ] **Step 3: Commit**

---

### Task 13: Use AgentCatalog in API sessions route (F21)

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts:112-115`

- [ ] **Step 1: Write minimal implementation**

Change lines 112-115:

```typescript
    const resolvedAgent = agent || config.defaultAgent;
    const resolvedWorkspace = deps.core.configManager.resolveWorkspace(
      workspace || config.agents[resolvedAgent]?.workingDirectory,
    );
```

to:

```typescript
    const resolvedAgent = agent || config.defaultAgent;
    const agentDef = deps.core.agentCatalog?.resolve(resolvedAgent);
    const resolvedWorkspace = deps.core.configManager.resolveWorkspace(
      workspace || agentDef?.workingDirectory,
    );
```

- [ ] **Step 2: Run build to verify no type errors**

Run: `pnpm build`
Expected: SUCCESS (if `agentCatalog` is accessible on core — check and add getter if needed)

- [ ] **Step 3: Commit**

---

### Task 14: Validate config before writing to disk (C3)

**Files:**
- Modify: `src/core/config/config.ts:260-283`

- [ ] **Step 1: Write minimal implementation**

Change `save()` method to validate before writing:

```typescript
  async save(
    updates: Record<string, unknown>,
    changePath?: string,
  ): Promise<void> {
    const oldConfig = this.config ? structuredClone(this.config) : undefined;
    // Read current file, merge updates
    const raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
    this.deepMerge(raw, updates);
    // Validate BEFORE writing to disk
    const result = ConfigSchema.safeParse(raw);
    if (!result.success) {
      log.error({ errors: result.error.issues }, 'Config validation failed, not saving');
      return;
    }
    // Write validated config to disk
    fs.writeFileSync(this.configPath, JSON.stringify(raw, null, 2));
    this.config = result.data;
    // Emit change event if path provided
    if (changePath) {
      const { getConfigValue } = await import("./config-registry.js");
      const value = getConfigValue(this.config, changePath);
      const oldValue = oldConfig
        ? getConfigValue(oldConfig, changePath)
        : undefined;
      this.emit("config:changed", { path: changePath, value, oldValue });
    }
  }
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test -- src/__tests__/config`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 15: Close session logger file descriptors (C4)

**Files:**
- Modify: `src/core/utils/log.ts:210`
- Modify: `src/core/sessions/session.ts:494-503`

- [ ] **Step 1: Write minimal implementation**

In `src/core/utils/log.ts`, add after `createSessionLogger` function (after line 210):

```typescript
export function closeSessionLogger(logger: Logger): void {
  const dest = (logger as any).__sessionDest
  if (dest && typeof dest.destroy === 'function') {
    dest.destroy()
  }
}
```

In `src/core/sessions/session.ts`, import and call in `destroy()`:

Add to imports at top:

```typescript
import { createChildLogger, createSessionLogger, closeSessionLogger, type Logger } from "../utils/log.js";
```

In `destroy()` method (line 494-503), add before the final line:

```typescript
  async destroy(): Promise<void> {
    this.log.info("Session destroyed");
    // Reject any pending permission promise so callers don't hang
    if (this.permissionGate.isPending) {
      this.permissionGate.reject("Session destroyed");
    }
    // Clear queued prompts
    this.queue.clear();
    await this.agentInstance.destroy();
    // Close session log file descriptor
    closeSessionLogger(this.log);
  }
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 16: Clean up spinner/logger on boot failure (C6)

**Files:**
- Modify: `src/main.ts:270-272`

- [ ] **Step 1: Write minimal implementation**

Change lines 270-272:

```typescript
  } catch (err) {
    log.error({ err }, 'Plugin boot failed')
  }
```

to:

```typescript
  } catch (err) {
    if (spinner) {
      spinner.fail('Plugin boot failed')
      spinner = undefined
    }
    unmuteLogger()
    log.error({ err }, 'Plugin boot failed')
  }
```

- [ ] **Step 2: Run build to verify no type errors**

Run: `pnpm build`
Expected: SUCCESS

- [ ] **Step 3: Commit**

---

### Task 17: Catch sendMessage middleware errors (C9)

**Files:**
- Modify: `src/core/sessions/session-bridge.ts:40-53`

- [ ] **Step 1: Write minimal implementation**

Wrap the entire `sendMessage` body in try-catch:

```typescript
  private async sendMessage(sessionId: string, message: ReturnType<MessageTransformer["transform"]>): Promise<void> {
    try {
      const mw = this.deps.middlewareChain;
      if (mw) {
        const result = await mw.execute('message:outgoing', { sessionId, message }, async (m) => m);
        if (!result) return; // blocked by middleware
        this.adapter.sendMessage(sessionId, result.message).catch((err) => {
          log.error({ err, sessionId }, "Failed to send message to adapter");
        });
      } else {
        this.adapter.sendMessage(sessionId, message).catch((err) => {
          log.error({ err, sessionId }, "Failed to send message to adapter");
        });
      }
    } catch (err) {
      log.error({ err, sessionId }, "Error in sendMessage middleware");
    }
  }
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test -- src/core/sessions/__tests__/session-bridge`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 18: ToolCardState appendUsage — use scheduleFlush (C14)

**Files:**
- Modify: `src/core/adapter-primitives/primitives/tool-card-state.ts:122-126`

- [ ] **Step 1: Write minimal implementation**

Change:

```typescript
  appendUsage(usage: UsageData): void {
    if (this.finalized) return;
    this.usage = usage;
    this.flush();
  }
```

to:

```typescript
  appendUsage(usage: UsageData): void {
    if (this.finalized) return;
    this.usage = usage;
    this.scheduleFlush();
  }
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test -- src/core/adapter-primitives/__tests__/tool-card-state`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 19: Node stream adapters — add close/cancel handlers (C11)

**Files:**
- Modify: `src/core/utils/streams.ts:3-26`

- [ ] **Step 1: Write minimal implementation**

Change `nodeToWebWritable`:

```typescript
export function nodeToWebWritable(nodeStream: NodeJS.WritableStream): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        const ok = nodeStream.write(chunk);
        if (ok) { resolve(); return; }
        (nodeStream as any).once("drain", resolve);
        (nodeStream as any).once("error", reject);
      });
    },
    close() {
      (nodeStream as any).end();
    },
    abort(reason) {
      (nodeStream as any).destroy(reason instanceof Error ? reason : new Error(String(reason)));
    },
  });
}
```

Change `nodeToWebReadable`:

```typescript
export function nodeToWebReadable(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      (nodeStream as any).destroy();
    },
  });
}
```

- [ ] **Step 2: Run existing tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

---

### Task 20: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: SUCCESS

- [ ] **Step 3: Verify no regressions**

Run: `pnpm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All test suites pass, no new failures
