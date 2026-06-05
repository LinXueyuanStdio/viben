# Codebase Logic Review & Refactoring Spec

**Date:** 2026-03-27
**Approach:** Severity-based (Approach C) — critical fixes first, then plugin fixes, architecture, tests

## Scope

7 fixes across core and plugins, plus test coverage for each fix.

## Fixes

### Phase 1: Core Critical Bugs

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `permission-gate.ts` | `setPending()` called twice orphans first promise forever | Reject existing pending promise before creating new one |
| 2 | `agent-instance.ts:725-733` | `destroy()` returns immediately without waiting for process exit | Return Promise that resolves on process exit or SIGKILL timeout |
| 3 | `session-bridge.ts:94-107` | `handleAgentEvent()` can throw inside `.then()` uncaught | Wrap in try-catch inside both `.then()` and `.catch()` |
| 4 | `command-registry.ts:78-92` | Dead code in `unregister()` — `if (!cmd)` block unreachable after refactor | Simplify to single delete + conditional qualified name delete |
| 5 | `middleware-chain.ts:45` | Sorts handlers O(n log n) on every `execute()` call | Sort once at `add()` time, remove sort from `execute()` |
| 6 | `agent-instance.ts:273-286` | Crash detection ignores signal kills (code=null, signal set) | Extend condition to emit error on signal kills too |

### Phase 2: Plugin Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 7 | `notification.ts` | `notify()`/`notifyAll()` don't catch adapter errors | Wrap in try-catch to prevent notification failures from crashing callers |

### Phase 3: Tests

- PermissionGate: test superseded request gets rejected
- AgentInstance: test destroy waits for exit
- SessionBridge: test middleware error doesn't crash bridge
- NotificationManager: test error resilience
- MiddlewareChain: verify pre-sorted execution order
- AgentInstance: test signal kill crash detection

## Items Reviewed But NOT Changed (logic already correct)

- `session.ts:186-188` pendingContext — already cleared after text is built, not before send
- `tunnel-registry.ts:219-221` unknown provider — already has log.warn
- `security-guard.ts:22-23` session count — correctly counts only active+initializing
- `speech-service.ts:67-80` refreshProviders — correctly merges, doesn't overwrite external
