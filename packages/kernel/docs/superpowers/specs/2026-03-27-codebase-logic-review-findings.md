# Codebase Logic Review — Findings

**Date:** 2026-03-27
**Scope:** Full codebase review — core, plugins, adapter primitives, utilities
**Status:** Review complete — awaiting triage

---

## Previously Identified Issues (from spec) — All Fixed

The 7 issues from `2026-03-27-codebase-logic-review-design.md` have all been implemented:
1. PermissionGate `setPending()` superseding — fixed
2. AgentInstance `destroy()` waiting for exit — fixed
3. SessionBridge `handleAgentEvent()` error handling — fixed
4. CommandRegistry `unregister()` dead code — fixed
5. MiddlewareChain pre-sorted at `add()` time — fixed
6. AgentInstance crash detection for signal kills — fixed
7. NotificationManager error catching — fixed

---

## New Issues Found

### HIGH Severity

#### H1. Session `processPrompt` throws unrecoverably if session is "finished"

**File:** `src/core/sessions/session.ts:179-181`

**Issue:** If a session is in "finished" state and a queued prompt still executes (enqueued just before `finish()` was called), `this.activate()` throws because `finished -> active` is invalid. The PromptQueue error handler calls `session.fail()`, but `finished -> error` is also invalid — causing a **second throw** that becomes an unhandled exception.

**Fix:** Guard at top of `processPrompt`:
```typescript
if (this._status === "finished") return;
```

---

#### H2. `cancelSession` can throw if agent error transitions state before `markCancelled()`

**File:** `src/core/sessions/session-manager.ts:118-122`

**Issue:** `session.abortPrompt()` can trigger the agent to emit an error, calling `session.fail()` which transitions to "error" state. Then `markCancelled()` attempts `error -> cancelled`, which is invalid in the state machine (`error` can only go to `active`). This throws an uncaught exception.

**Fix:** Either:
- Add "cancelled" to valid transitions from "error" state
- Wrap `markCancelled()` in try-catch
- Check session status before calling `markCancelled()`

---

#### H3. ConfigManager `save()` writes invalid config to disk, bricks next startup

**File:** `src/core/config/config.ts:260-283`

**Issue:** `save()` writes the merged config to disk **before** re-validating with Zod. If validation fails, the invalid config is already on disk. Next startup reads this invalid config and calls `process.exit(1)`.

**Fix:** Validate BEFORE writing to disk. If validation fails, log an error and don't write.

---

#### H4. Session logger leaks file descriptors — `pino.destination` never closed

**File:** `src/core/utils/log.ts:160-210`

**Issue:** Each session creates a `pino.destination(sessionLogPath)` which opens a file descriptor. The destination is stored as `__sessionDest` but never closed. Long-running servers with many sessions will exhaust OS file descriptor limits.

**Fix:** Add a `closeSessionLogger()` function called during `session.destroy()`:
```typescript
export function closeSessionLogger(logger: Logger): void {
  const dest = (logger as any).__sessionDest
  if (dest && typeof dest.destroy === 'function') {
    dest.destroy()
  }
}
```

---

#### H5. ActivityTracker: thinking indicator stuck when `maxThinkingDuration` exceeded

**File:** `src/core/adapter-primitives/primitives/activity-tracker.ts:74-76`

**Issue:** When `maxThinkingDuration` is exceeded, `stopRefresh` is called (stops the interval timer), but `removeThinkingIndicator()` is **never called**. The thinking indicator remains visible to the user indefinitely.

**Fix:**
```typescript
if (Date.now() - state.startTime >= this.config.maxThinkingDuration) {
  state.dismissed = true
  this.stopRefresh(state)
  state.callbacks.removeThinkingIndicator().catch(() => {})
  return
}
```

---

#### H6. `main.ts`: spinner/logger not cleaned up on plugin boot failure

**File:** `src/main.ts:119-272`

**Issue:** If `core.lifecycleManager.boot()` throws, the spinner keeps spinning and logger stays muted (from `muteLogger()`). The error catch at line 270 logs the error, but the muted logger swallows it. The user sees a spinning animation and no error message, then `process.exit(1)`.

**Fix:** Stop spinner and unmute logger in the catch block:
```typescript
} catch (err) {
  if (spinner) spinner.fail('Plugin boot failed')
  unmuteLogger()
  log.error({ err }, 'Plugin boot failed')
}
```

---

### MEDIUM Severity

#### M1. Agent crash during auto-naming silently discards error event

**File:** `src/core/sessions/session.ts:363-396`

**Issue:** During `autoName()`, the session emitter is paused and a capture handler only catches "text" events (line 370). If the agent crashes during auto-naming, the crash error event is buffered. Then `clearBuffer()` at line 393 **discards all buffered events**, including the crash error. The user never sees the crash notification.

**Fix:** In `autoName()` finally block, replay error-type events instead of clearing all:
```typescript
// Replay error events, discard others
const buffer = this.getBuffer() // need to expose buffer
for (const { event, args } of buffer) {
  if (event === 'agent_event') {
    const agentEvent = args[0] as AgentEvent
    if (agentEvent?.type === 'error') {
      this.emit('agent_event', agentEvent)
    }
  }
}
this.clearBuffer()
this.resume()
```

---

#### M2. PermissionGate timeout timer not `unref()`ed — blocks graceful shutdown

**File:** `src/core/sessions/permission-gate.ts:33-36`

**Issue:** The 10-minute timeout timer keeps the Node.js event loop alive. During graceful shutdown with an active permission request, the process won't exit for up to 10 minutes.

**Fix:** Add `unref()` after setting the timer (pattern already used in `agent-instance.ts:753`):
```typescript
this.timeoutTimer = setTimeout(() => {
  this.reject("Permission request timed out");
}, this.timeoutMs);
if (typeof this.timeoutTimer === 'object' && 'unref' in this.timeoutTimer) {
  (this.timeoutTimer as NodeJS.Timeout).unref();
}
```

---

#### M3. Lazy resume resurrects truly-finished sessions after restart

**File:** `src/core/core.ts:603-688`

**Issue:** On shutdown, ALL sessions are marked as `status: "finished"` in `shutdownAll()`. On restart, when a user messages in a thread of a truly-completed session, `lazyResume` spawns a new agent for it. The user may not expect their completed session to restart.

**Fix:** Either:
- Skip `status === "finished"` in `lazyResume`
- Use a separate status like `"shutdown"` for sessions that were active at shutdown time

---

#### M4. `SessionBridge.sendMessage` — middleware errors become unhandled rejections

**File:** `src/core/sessions/session-bridge.ts:40-53`

**Issue:** `sendMessage` is async but called without `await` in `handleAgentEvent`. The `mw.execute()` call is awaited within `sendMessage`, and if middleware throws, it propagates as an unhandled promise rejection.

**Fix:** Add `.catch()` to `sendMessage` calls in `handleAgentEvent`, or wrap the entire `sendMessage` body in try-catch.

---

#### M5. `handleCleanup` doesn't cancel active sessions before deleting records

**File:** `src/plugins/telegram/commands/session.ts:167-201`

**Issue:** `handleCleanup` deletes session records without first cancelling running agent processes. Compare with `handleCleanupEverythingConfirmed` which correctly calls `cancelSession` before removal. This can orphan running agent subprocesses.

**Fix:** Add active session cancellation before record removal, similar to `handleCleanupEverythingConfirmed`.

---

#### M6. Tunnel providers don't wait for child process exit on `stop()`

**Files:** All tunnel providers (`cloudflare.ts`, `ngrok.ts`, `bore.ts`, `tailscale.ts`)

**Issue:** All providers call `this.child.kill('SIGTERM')` and immediately set `this.child = null` without waiting for exit. If a new tunnel is started immediately on the same port, the old process may still be holding it.

**Fix:** Wait for the `exit` event with a SIGKILL timeout fallback.

---

#### M7. `CheckpointReader` uses `execFileSync` blocking the event loop

**File:** `src/plugins/context/entire/checkpoint-reader.ts:43-51`

**Issue:** The `git()` method uses `execFileSync`, blocking the Node.js event loop. `resolveLatest` iterates all checkpoints with synchronous git calls. Repositories with many checkpoints can freeze all operations for seconds.

**Fix:** Use `execFile` with `util.promisify` instead of `execFileSync`.

---

#### M8. `PermissionHandler` pending map grows unboundedly (memory leak)

**File:** `src/plugins/telegram/permissions.ts:18, 32`

**Issue:** The `pending` Map stores entries for every permission request sent. Entries are only removed when the user clicks a button. If ignored, entries stay in memory forever.

**Fix:** Add TTL-based cleanup (e.g., remove entries older than 10 minutes).

---

#### M9. `createBridge` throws if notification/file-service plugins not loaded

**File:** `src/core/core.ts:693-702`

**Issue:** `createBridge()` accesses `this.notificationManager` and `this.fileService` via `getService()` which throws if not registered. If these plugins failed to load, all session creation crashes.

**Fix:** Use optional service lookups that return `undefined` instead of throwing.

---

#### M10. Draft `flush()` race condition — concurrent flushes can create duplicate messages

**File:** `src/core/adapter-primitives/primitives/draft-manager.ts:59-79`

**Issue:** `finalize()` awaits `flushPromise` then calls `flush()`, but a timer-triggered flush can sneak in between. If both are first-flushes (no `_messageId` yet), both create separate messages.

**Fix:** Chain the finalize flush onto `flushPromise`:
```typescript
this.flushPromise = this.flushPromise.then(() => this.buffer ? this.flush() : undefined)
await this.flushPromise
```

---

#### M11. Node stream adapters don't implement close/cancel — resource leaks

**File:** `src/core/utils/streams.ts:3-26`

**Issue:** `nodeToWebWritable` doesn't implement `close()` or `abort()`. `nodeToWebReadable` doesn't implement `cancel()`. When Web streams are closed/cancelled, the underlying Node streams stay open, leaking file handles/sockets.

**Fix:** Add the missing handlers:
```typescript
// WritableStream
close() { nodeStream.end() },
abort(reason) { nodeStream.destroy(reason instanceof Error ? reason : new Error(String(reason))) }

// ReadableStream
cancel() { nodeStream.destroy() }
```

---

### LOW Severity

#### L1. `SecurityGuard.checkAccess` TOCTOU race on session count

**File:** `src/plugins/security/security-guard.ts:22-27`

**Issue:** Session count checked at access time, but session created after check passes. Two concurrent messages can both pass the check, exceeding `maxConcurrentSessions` by 1.

**Verdict:** Acceptable for current use case. Note if session limits become critical.

---

#### L2. `core.ts` `patchRecord` not awaited — potential unhandled rejection

**File:** `src/core/core.ts:293-295`

**Issue:** `patchRecord` returns Promise but is not awaited. Store write failures become unhandled rejections.

**Fix:** Add `.catch()` or await.

---

#### L3. PluginContext `cleanup()` service unregistration order

**File:** `src/core/plugin/plugin-context.ts:179-200`

**Issue:** Services are unregistered (line 190) before command registry is accessed (line 193). If the command-registry was registered by the same plugin being cleaned up, commands are never cleaned.

**Fix:** Move command cleanup before service unregistration.

---

#### L4. SendQueue timer not cleared on `clear()` — temporary message stall

**File:** `src/core/adapter-primitives/primitives/send-queue.ts:85-106`

**Issue:** `clear()` doesn't cancel the pending setTimeout. New items enqueued between `clear()` and the timer firing won't be processed until the orphaned timer fires.

**Fix:** Track and clear the timer in `clear()`.

---

#### L5. `downloadFile` unlimited redirect following

**File:** `src/core/utils/install-binary.ts:24-64`

**Issue:** Follows 301/302 redirects recursively with no limit. A misconfigured server could cause stack overflow.

**Fix:** Add `maxRedirects` parameter (default 10).

---

#### L6. `main.ts` `fs.watch` watcher never closed on shutdown

**File:** `src/main.ts:224-243`

**Issue:** Dev plugin hot-reload watcher is never stored or closed during shutdown. Keeps process alive or causes errors after cleanup.

**Fix:** Store the watcher and close it during shutdown.

---

#### L7. `SpeechService.refreshProviders` doesn't remove stale factory providers

**File:** `src/plugins/speech/speech-service.ts:68-80`

**Issue:** When config changes remove a provider, the old factory-created provider remains registered. Merge only adds/overwrites, never removes factory providers.

**Fix:** Track factory-created vs externally-registered providers. Clear factory providers before re-adding.

---

#### L8. `ContextCache` constructor creates directory synchronously — crashes on permission error

**File:** `src/plugins/context/context-cache.ts:10`

**Issue:** `fs.mkdirSync` in constructor throws synchronously on permission errors, crashing the application during plugin boot.

**Fix:** Wrap in try-catch or defer to first use.

---

#### L9. PromptQueue race — enqueue during `clear()` can bypass the clear

**File:** `src/core/sessions/prompt-queue.ts:55-65`

**Issue:** Narrow window where `enqueue()` between `clear()` resolving pending items and `finally` block running `drainNext()` causes a prompt to execute after cancel was requested.

**Fix:** Add a generation counter checked in `drainNext()`.

---

## Summary by Priority

| Priority | Count | Issues |
|----------|-------|--------|
| **HIGH** | 6 | H1, H2, H3, H4, H5, H6 |
| **MEDIUM** | 11 | M1-M11 |
| **LOW** | 9 | L1-L9 |

### Recommended Fix Order

1. **H1** — Session processPrompt finished-state crash (trivial 1-line guard)
2. **H2** — cancelSession state machine throw (add valid transition or guard)
3. **H5** — Thinking indicator stuck forever (3-line fix)
4. **H6** — Boot failure invisible to user (add spinner/unmute cleanup)
5. **H3** — Config save bricks startup (validate before write)
6. **H4** — Session logger fd leak (add close function)
7. **M2** — PermissionGate timer unref (2-line fix)
8. **M4** — sendMessage unhandled rejections (add .catch())
9. **M1** — Auto-name swallows crash errors (replay errors from buffer)
10. Rest of MEDIUM/LOW based on impact
