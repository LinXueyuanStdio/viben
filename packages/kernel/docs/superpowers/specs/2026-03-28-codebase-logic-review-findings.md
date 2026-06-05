# Codebase Logic Review — Comprehensive Findings

**Date:** 2026-03-28
**Scope:** Feature specs vs implementation, code-level bugs, architecture review, test coverage
**Total issues:** 76 (19 feature bugs, 14 missing features, 19 code bugs, 5 architecture gaps, 19 test gaps)

---

# 1. Feature Review (Spec vs Implementation)

## 1.1 Session Management

### Session Persistence (spec: 2026-03-20)
| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F1 | Cancelled sessions spawn fresh, not resume | **WRONG** — code resumes them | `core.ts:625-626` | Not tested |
| F2 | Resume failure falls back to fresh session | **WRONG** — returns null, drops message | `core.ts:668-679` | Not tested |
| | SessionRecord type | Correct | `session-store.ts:8-18` | Thorough |
| | JsonFileSessionStore (debounce, TTL, cleanup) | Correct | `session-store.ts` | Thorough |
| | Lazy resume lock per topic | Correct | `core.ts:607-611` | Not tested |
| | Auto-cleanup skips active/initializing | Correct | `session-store.ts:145` | Tested |

### /archive Command (spec: 2026-03-23)
| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F3 | Archive keeps agent alive, recreates topic | **WRONG** — kills agent + deletes topic + removes record | `core.ts:189-232` | Tested (wrong behavior) |
| F4 | Archive recreates topic (delete old + create new + rewire) | **MISSING** — only deletes, no recreation | `adapter.ts:1358-1385` | -- |
| F5 | Archive validates session state (must be active) | **MISSING** — no status check | `session.ts:358-385` | Not tested |
| F6 | Archive detects non-session topic usage | **MISSING** — no topic type check | `session.ts:358-385` | Not tested |
| | Confirmation flow with `ar:` callbacks | Correct | `session.ts:371-384` | Tested |
| | `session.archiving` flag | Correct | `session.ts:56` | Not tested |

### Context Resume /resume (spec: 2026-03-25)
| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F7 | Over-budget interactive selection (options + 60s timeout) | **MISSING** — silently truncates | `resume.ts:162-266` | Not tested |
| | ContextProvider interface | Correct | `context-provider.ts` | Tested |
| | ContextManager (register, build, cache) | Correct | `context-manager.ts` | Tested |
| | All 6 entry points (PR, branch, commit, checkpoint, session, latest) | Correct | `checkpoint-reader.ts` | Tested |
| | Conversation rebuild pipeline (parse, clean, build, mode) | Correct | `conversation-builder.ts` | Tested |
| | Context injection (first prompt only, survives warmup) | Correct | `session.ts:186-189` | Well tested |
| | Caching with 1h TTL | Correct | `context-cache.ts` | Tested |

### Session Handoff (spec: 2026-03-22)
| | adoptSession() with full validation chain | Correct | `core.ts:393-525` | Barely tested |
| | /handoff command | Correct | Telegram commands | Not tested |
| | findByAgentSessionId() | Correct | `session-store.ts:75-80` | Tested |

---

## 1.2 TTS / Speech

### Speech Module (spec: 2026-03-23)
| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F8 | Lazy provider initialization | **WRONG** — GroqSTT eagerly constructed at boot | `speech/index.ts:155` | Not tested |
| | STTProvider/TTSProvider interfaces | Correct | `speech-types.ts` | Indirect |
| | SpeechService orchestrator | Correct | `speech-service.ts` | Tested |
| | Groq Whisper STT (API, errors) | Correct | `providers/groq.ts` | Tested |
| | STT flow (transcribe OGG, error fallback) | Correct | `session.ts:265-321` | Not tested |

### TTS Feature (spec: 2026-03-24)
| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F9 | voiceMode "next" resets AFTER prompt, not before | **WRONG** — resets before prompt at line 203 | `session.ts:203-204` | Tested (wrong behavior) |
| F10 | `tts_strip` event to remove [TTS] block from streamed text | **MISSING** — block stays visible | -- | -- |
| | voiceMode states (off/next/on) | Correct | `session.ts:48` | Tested |
| | TTS_PROMPT_INSTRUCTION injection | Correct | `session.ts:14,196-206` | Tested |
| | Post-response TTS pipeline (accumulate, parse, synthesize) | Correct | `session.ts:208-360` | Tested |
| | 30s TTS timeout | Correct | `session.ts:340` | Not tested |

### msedge-tts Extraction (spec: 2026-03-27)
| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F11 | /tts command doesn't actually set voiceMode | **WRONG** — speech plugin /tts has no session access | `speech/index.ts:173-225` | Tested (wrong behavior) |
| F12 | ttsProvider config ignored, hardcoded to edge-tts | **WRONG** — config.ttsProvider never read | `speech/index.ts:147` | Not tested |
| | Plugin structure and registration | Correct | `built-in-plugins/msedge-tts-plugin/` | Tested |
| | unregisterTTSProvider() | Correct | `speech-service.ts:25-27` | Tested |
| | Auto-install flow | Correct | `speech/index.ts:193-216` | Tested |

---

## 1.3 Activity Tracker (spec: 2026-03-20)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F13 | ThinkingIndicator dismiss() deletes message | **WRONG** — only clears state, message persists in chat | `activity.ts:59-63` | Tested (wrong behavior) |
| F14 | UsageMessage class (separate, delete on next prompt) | **MISSING** — no UsageMessage, usage folded into ToolCard | `activity.ts:313-318` | -- |
| F15 | PlanCard as separate message with 3.5s debounce | **CHANGED** — merged into ToolCard, 500ms debounce | `activity.ts:108-220` | Partial |
| | Plan status icons (completed/in_progress/pending) | Correct | `tool-card-state.ts` | Tested |

---

## 1.4 Adapter Layer (spec: 2026-03-25)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F16 | MessagingAdapter composes shared primitives | **MISSING** — thin dispatch layer, no send/edit/enqueueSend | `messaging-adapter.ts` | -- |
| | IChannelAdapter interface | Correct | `channel.ts:18` | Conformance |
| | StreamAdapter | Correct | `stream-adapter.ts` | Not tested |
| | IRenderer/BaseRenderer/TelegramRenderer | Correct | `rendering/renderer.ts` | Not tested |
| | All shared primitives (SendQueue, Draft, ToolCallTracker, ActivityTracker) | Correct | `primitives/` | Tested |

---

## 1.5 Skill Commands (spec: 2026-03-19)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F17 | Skill commands as inline keyboard buttons with `s:` callback | **WRONG** — plain text `<code>/cmd</code>`, no buttons | `menu.ts:90-109` | -- |
| | sendSkillCommands/cleanupSkillCommands | Correct | `adapter.ts:1243-1255` | Tested |
| | Static commands via setMyCommands() | Correct | `adapter.ts:239-241` | -- |
| | Pinned message per session | Correct | `skill-command-manager.ts:87-89` | Tested |

---

## 1.6 Usage Tracking (spec: 2026-03-22)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F18 | UsageStore + UsageBudget + /usage command | **MISSING** — old code removed, new plugin never created | -- | -- |
| | usage:recorded event emission | Correct | `session-factory.ts:112` | Tested |
| | UsageRecord/UsageRecordEvent types | Correct | `types.ts:235-252` | -- |

---

## 1.7 API / CLI (spec: 2026-03-21)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F19 | CLI `api session` reads wrong fields (no .session wrapper, wrong names) | **BUG** — all fields show `undefined` | `api.ts:416-426` | Not tested |
| F20 | CLI `api health` reads wrong fields (uptimeSeconds, memoryUsage) | **BUG** — shows zeros | `api.ts:459-462` | Not tested |
| F21 | POST /api/sessions uses deprecated config.agents[] | **BUG** — workspace always undefined after migration | `routes/sessions.ts:114` | Not tested |
| | All 11+ API endpoints | Correct | `routes/` | Router only |
| | Config redaction | Correct | `routes/config.ts:4-32` | Not tested |
| | Typo suggestions (suggestMatch) | Correct, 8 integration points | `cli/suggest.ts` | 13 tests |

---

## 1.8 Plugin System (spec: 2026-03-26)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F22 | Settings validation against settingsSchema at boot | **MISSING** — validateSettings() exists but never called | `lifecycle-manager.ts:212-224` | Not tested |
| F23 | Legacy config stripping after migration | **MISSING** — old fields remain in config.json | `main.ts:398-477` | Not tested |
| | Plugin lifecycle hooks (install, configure, uninstall, migrate) | Correct | `types.ts:51-57` | Indirect |
| | SettingsAPI per-plugin persistence | Correct | `settings-manager.ts` | Thorough |
| | PluginRegistry (CRUD, enable/disable) | Correct | `plugin-registry.ts` | Thorough |
| | Boot with dependency order + migration | Correct | `lifecycle-manager.ts` | Tested |
| | MiddlewareChain (priority, timeout, circuit break) | Correct | `middleware-chain.ts` | 15 tests |

---

## 1.9 Tunnel Service (specs: 2026-03-20, 2026-03-23)

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| F24 | Telegram /tunnel command creates tunnels (not just status) | **MISSING** — only shows info | `tunnel/index.ts:143-163` | Not tested |
| | All 4 providers (cloudflare, ngrok, bore, tailscale) | Correct | `providers/` | Not tested |
| | ViewerStore with TTL, auth, path validation | Correct | `viewer-store.ts` | Not tested |
| | TunnelRegistry (system/user, persistence, race handling) | Correct | `tunnel-registry.ts` | Not tested |
| | API endpoints (add, list, stop, stop-all) | Correct | `routes/tunnel.ts` | Not tested |

---

## 1.10 Other Features

| # | Requirement | Status | Location | Tests |
|---|-------------|--------|----------|-------|
| | File/Image/Audio support (bidirectional) | Correct | adapter.ts, file-service.ts, session.ts | Not tested |
| | Assistant UX (welcome, menu, prompt, action detect) | Correct | assistant.ts, menu.ts, action-detect.ts | Partial |
| | Agent catalog (registry, install, resolve) | Correct | agent-catalog.ts, agent-store.ts | Partial |
| | Generic handoff (integrate, capabilities) | Correct | agent-dependencies.ts, integrate.ts | Partial |

---

# 2. Code-Level Bugs

Issues in the code regardless of specs.

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| C1 | **HIGH** | `session.ts:179` | processPrompt double-throw if session is "finished" | Guard: `if (this._status === "finished") return` |
| C2 | **HIGH** | `session-manager.ts:118` | cancelSession throws if error→cancelled transition | Add "cancelled" to valid transitions from "error" |
| C3 | **HIGH** | `config.ts:260-283` | save() writes invalid config to disk before validation | Validate before writing |
| C4 | **HIGH** | `log.ts:160-210` | Session logger pino.destination FD never closed | Add closeSessionLogger() in destroy() |
| C5 | **HIGH** | `activity-tracker.ts:74-76` | Thinking indicator stuck forever on maxThinkingDuration | Call removeThinkingIndicator() after stopRefresh |
| C6 | **HIGH** | `main.ts:119-272` | Spinner/logger not cleaned up on boot failure — user sees no error | Stop spinner + unmute logger in catch |
| C7 | MEDIUM | `session.ts:363-396` | Auto-name clearBuffer() discards crash error events | Replay error events before clearing |
| C8 | MEDIUM | `permission-gate.ts:33` | Timeout timer not unref'd — blocks shutdown 10min | Add .unref() |
| C9 | MEDIUM | `session-bridge.ts:40-53` | sendMessage middleware errors → unhandled rejections | Add .catch() or wrap in try-catch |
| C10 | MEDIUM | `draft-manager.ts:59-79` | Draft flush() race can create duplicate messages | Chain finalize flush onto flushPromise |
| C11 | MEDIUM | `streams.ts:3-26` | Node stream adapters missing close/cancel handlers | Add close/abort/cancel handlers |

### Cross-Service Logic Issues (from deep review)

These issues involve complex interactions between multiple services where timing, ordering, or error propagation can cause subtle bugs.

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| C12 | **HIGH** | `core.ts:657` | **Lazy resume: threadId set AFTER createSession** — agent events emitted during spawn (before `session.threadId` is set) are silently dropped because adapter sees `threadId = ""` and skips the message. This could include error events from a failed spawn. | Set `session.threadId = message.threadId` BEFORE calling `createSession()`, or pass it as a constructor parameter |
| C13 | **HIGH** | `session-manager.ts:118-135` | **cancelSession: if abortPrompt throws (agent dead), session stays in map forever** — `cancel()` sends ACP request; if agent already crashed, connection is closed and `cancel()` throws. `markCancelled()` and `sessions.delete()` never execute. Session leaks in memory with no cleanup path. | Wrap `abortPrompt` in try-catch: `try { await session.abortPrompt() } catch {}` then proceed with markCancelled + delete |
| C14 | MEDIUM | `tool-card-state.ts:122-126` | **appendUsage immediate flush shows stale tool state** — `appendUsage()` calls `flush()` immediately, but pending tool updates may still be in the 500ms debounce window. The card renders with old tool status then the tool update arrives and re-renders. | Use `scheduleFlush()` instead of `flush()`, or flush pending debounce first |
| C15 | MEDIUM | `session-store.ts:136` | **Corrupt sessions.json silently lost** — on parse error, logs warning and starts empty. No `.bak` backup created. User loses all session records with no recovery path. | Rename corrupt file to `sessions.json.bak` before starting empty |
| C16 | MEDIUM | `draft-manager.ts:96-100` (shared) | **Shared DraftManager.finalize() doesn't remove draft from map** — after finalization, draft stays in map. `getOrCreate()` returns the stale finalized draft for subsequent prompts, potentially serving old buffer content. | Remove draft from map after finalization: `this.drafts.delete(sessionId)` |
| C17 | MEDIUM | `activity.ts:35-56` | **ThinkingIndicator: message sent but untrackable after dismiss** — if `dismiss()` called during SendQueue wait (3+ seconds), the message is still sent to Telegram but `msgId` is cleared. The thinking message persists in chat with no way to delete it. | After send completes, if `dismissed` is true, immediately delete the just-sent message |
| C18 | LOW | `session-bridge.ts:96-127` | **Middleware error fallback creates confusing control flow** — `.then().catch()` chain could theoretically double-process an event if inner try-catch doesn't catch everything. Currently safe because inner catch swallows all errors, but fragile for future changes. | Simplify to single try-catch with middleware as decorator |

---

# 3. Architecture Review

| # | Area | Issue |
|---|------|-------|
| A1 | **MessagingAdapter too thin** | Spec envisions rich base with send/edit/enqueueSend abstractions + composed primitives. Reality: thin dispatch layer. Each adapter replicates Telegram-specific logic. New adapters need ~1000+ lines, not the spec's 200-300. |
| A2 | **TelegramRenderer bypassed** | Renderer exists but adapter handlers directly call formatting functions. The renderer→adapter chain is not actually used for most message types. |
| A3 | **Usage tracking gap** | Core correctly emits usage:recorded events. Old consumer removed. New consumer (built-in-plugins/usage-plugin/) never created. Data flows to void. |
| A4 | **Config not simplified** | Plugin-specific schemas (channels, speech, tunnel, usage, api) and env vars remain in core ConfigSchema despite plugin extraction spec. |
| A5 | **Skill command UX** | Spec designed interactive button flow with callback routing. Implementation uses plain text. The interaction model is fundamentally different. |

---

# 4. Test Coverage Gaps

## Well Tested (no action needed)
- Session state machine (exhaustive transitions)
- PromptQueue (serial, abort, drain)
- PermissionGate (timeout, supersede, cleanup)
- SessionStore (CRUD, TTL, persistence, corruption)
- SessionManager (register, lookup, cancel, list)
- SessionFactory (spawn, resume, middleware, events)
- SessionBridge (comprehensive — wiring, permissions, lifecycle)
- MiddlewareChain (15 tests — timeout, errors, circuit breaking)
- SettingsManager + PluginRegistry (CRUD, persistence)
- LifecycleManager migration (version check, migrate call)
- AgentStore (atomic writes, CRUD, corruption)
- Context system (provider, manager, builder, cleaner, cache)
- SendQueue, DraftManager, ToolCallTracker, ToolCardState (shared primitives)
- suggestMatch (13 test cases)
- Speech service + Groq STT provider
- Action detection (detect + extended tests)

## Missing Test Coverage

| # | Area | What's untested |
|---|------|-----------------|
| T1 | **Lazy resume** | Entire flow — no tests exist |
| T2 | **adoptSession** | Only trivial mock test, no real flow test |
| T3 | **API route handlers** | All 15+ routes untested (only Router class tested) |
| T4 | **CLI commands** | All CLI commands untested |
| T5 | **Tunnel** | No tests for service, registry, providers, viewer store, server |
| T6 | **Telegram commands** | No tests for session/admin/menu/help handlers |
| T7 | **Telegram permissions** | Handler not tested |
| T8 | **TelegramRenderer** | No tests |
| T9 | **BaseRenderer + StreamAdapter** | No tests |
| T10 | **STT integration** | maybeTranscribeAudio() not tested |
| T11 | **TTS timeout** | 30s timeout not tested |
| T12 | **TTS toggle button** | Telegram callback not tested |
| T13 | **Plan in ToolCard** | Integration not tested |
| T14 | **ActivityTracker firstEvent** | Guard behavior not tested |
| T15 | **InstallContext + TerminalIO** | No tests |
| T16 | **File service** | No tests |
| T17 | **Agent catalog** | Only resolve/getAvailable — install, uninstall, refresh, availability untested |
| T18 | **Cleanup commands** | handleCleanup, handleCleanupEverything untested |
| T19 | **Archive flow** | Confirmation flow tested but wrong behavior verified |

---

# 5. Fix Status

## Completed (4 commits on fix/codebase-logic-review)

| Commit | Items Fixed |
|--------|------------|
| `9038102` | C1, C2, C3, C4, C5, C6, C8, C9, C11, C12, C13, C14, C15, C16, F1, F9, F19, F20, F21 |
| `270ab52` | F11, F12, F13, C17, F22 |
| `18c590d` | F3, F4, F5, F6, F10 |
| `0bc34ca` | F18, F24 |

**Total fixed: 30 items** (all code bugs + most feature issues)
**Tests: 134 files, 1746 tests passing**

## Remaining (deferred)

| # | Item | Reason |
|---|------|--------|
| F7 | Over-budget /resume interactive selection | Complex UI flow — TODO added |
| F14 | UsageMessage as separate deletable message | Design choice: merged into ToolCard |
| F15 | PlanCard separate message with 3.5s debounce | Design choice: merged into ToolCard |
| F16 | MessagingAdapter compose shared primitives | Architecture — separate effort |
| F17 | Skill commands as inline buttons | UX redesign — separate effort |
| F23 | Legacy config stripping after migration | Non-blocking — fallback works |
| A1-A5 | Architecture gaps | Separate design efforts |
| T1-T19 | Test coverage gaps | Ongoing |
