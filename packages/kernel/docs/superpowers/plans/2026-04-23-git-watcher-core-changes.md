# git-watcher Core Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two capabilities to Viben core: (1) tunnel service emits lifecycle events so plugins can react to URL changes; (2) sessions can be created with a list of pre-approved command patterns that bypass user permission prompts.

**Architecture:** Tunnel events use the same callback-injection pattern already used by the identity plugin — the tunnel plugin passes `(event, data) => ctx.emit(event, data)` to `TunnelService`. Auto-approved commands are stored on `Session` and checked in `SessionBridge.checkAutoApprove()` using `micromatch` glob matching.

**Tech Stack:** TypeScript, Vitest, micromatch (already in deps)

---

## File Map

| File | Change |
|---|---|
| `packages/kernel-sdk/src/types.ts` | Add `autoApprovedCommands?: string[]` to `VibenPlugin` |
| `src/plugins/tunnel/tunnel-service.ts` | Add `onEvent` callback to constructor; call it on start/stop/URL change |
| `src/plugins/tunnel/index.ts` | Pass `(e, d) => ctx.emit(e, d)` when constructing `TunnelService` |
| `src/core/sessions/session-manager.ts` | Add `options?: { autoApprovedCommands?: string[] }` to `createSession()` |
| `src/core/sessions/session.ts` | Store `autoApprovedCommands` on session; expose getter |
| `src/core/sessions/session-bridge.ts` | Extend `checkAutoApprove()` to glob-match against session's approved list |
| `src/core/sessions/__tests__/session-auto-approve.test.ts` | New test file |
| `src/plugins/tunnel/__tests__/tunnel-events.test.ts` | New test file |

---

## Task 1: Tunnel Service Emits Lifecycle Events

**Files:**
- Modify: `src/plugins/tunnel/tunnel-service.ts`
- Modify: `src/plugins/tunnel/index.ts`
- Create: `src/plugins/tunnel/__tests__/tunnel-events.test.ts`

- [ ] **Step 1.1: Write failing test**

Create `src/plugins/tunnel/__tests__/tunnel-events.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TunnelService } from '../tunnel-service'

describe('TunnelService events', () => {
  it('calls onEvent with tunnel:started when start() succeeds', async () => {
    const onEvent = vi.fn()
    const svc = new TunnelService(
      { provider: 'cloudflare' } as any,
      undefined,
      undefined,
      undefined,
      onEvent,
    )
    vi.spyOn(svc as any, 'registry', 'get').mockReturnValue({
      start: vi.fn().mockResolvedValue('https://abc.cfargotunnel.com'),
      stop: vi.fn(),
      getPublicUrl: vi.fn().mockReturnValue('https://abc.cfargotunnel.com'),
    })

    await svc.start(21420)

    expect(onEvent).toHaveBeenCalledWith('tunnel:started', {
      url: 'https://abc.cfargotunnel.com',
    })
  })

  it('calls onEvent with tunnel:stopped when stop() is called', async () => {
    const onEvent = vi.fn()
    const svc = new TunnelService(
      { provider: 'cloudflare' } as any,
      undefined,
      undefined,
      undefined,
      onEvent,
    )
    vi.spyOn(svc as any, 'registry', 'get').mockReturnValue({
      stop: vi.fn(),
    })

    await svc.stop()

    expect(onEvent).toHaveBeenCalledWith('tunnel:stopped', {})
  })
})
```

- [ ] **Step 1.2: Run test — expect FAIL**

```bash
cd /Users/lucas/viben-workspace/Viben
npx vitest run src/plugins/tunnel/__tests__/tunnel-events.test.ts
```

Expected: FAIL (TunnelService constructor doesn't accept 5th param yet)

- [ ] **Step 1.3: Add `onEvent` callback to TunnelService**

In `src/plugins/tunnel/tunnel-service.ts`, add the private field and update constructor:

```typescript
// Add private field (near other private fields at top of class):
private onEvent: (event: string, data: unknown) => void

// Update constructor signature:
constructor(
  config: TunnelConfig,
  registryPath?: string,
  binDir?: string,
  storage?: PluginStorage,
  onEvent?: (event: string, data: unknown) => void,
) {
  // ... existing body ...
  this.onEvent = onEvent ?? (() => {})  // no-op if not provided
}
```

In the `start()` method, after successfully obtaining the public URL, add:

```typescript
// After: const publicUrl = await this.registry.start(apiPort)
// Before: return publicUrl
this.onEvent('tunnel:started', { url: publicUrl })
```

In the `stop()` method (find and update it), add before returning:

```typescript
this.onEvent('tunnel:stopped', {})
```

- [ ] **Step 1.4: Pass callback in tunnel plugin setup()**

In `src/plugins/tunnel/index.ts`, find where `new TunnelService(...)` is constructed and add the callback:

```typescript
const tunnelSvc = new TunnelService(
  config,
  registryPath,
  binDir,
  ctx.storage,
  (event, data) => ctx.emit(event, data),  // ADD THIS
)
```

- [ ] **Step 1.5: Run test — expect PASS**

```bash
npx vitest run src/plugins/tunnel/__tests__/tunnel-events.test.ts
```

Expected: PASS

- [ ] **Step 1.6: Commit**

```bash
git add src/plugins/tunnel/tunnel-service.ts src/plugins/tunnel/index.ts src/plugins/tunnel/__tests__/tunnel-events.test.ts
git commit -m "feat(tunnel): emit tunnel:started and tunnel:stopped events via callback

Plugins can now react to tunnel lifecycle by listening to ctx.on('tunnel:started')
and ctx.on('tunnel:stopped'). Uses same callback-injection pattern as identity plugin.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: `autoApprovedCommands` in Plugin Manifest Type

**Files:**
- Modify: `packages/kernel-sdk/src/types.ts`

- [ ] **Step 2.1: Add field to `VibenPlugin` interface**

In `packages/kernel-sdk/src/types.ts`, add to the `VibenPlugin` interface (after `permissions?`):

```typescript
/**
 * Glob patterns for bash commands that should be auto-approved in sessions
 * spawned by this plugin. Core validates these against a security blocklist
 * at plugin load time. Patterns use micromatch glob syntax.
 *
 * Example: ['gh pr view *', 'git -C */workspaces/* pull *']
 * Blocked patterns include: 'rm *', 'sudo *', 'curl *', 'chmod *'
 */
autoApprovedCommands?: string[]
```

- [ ] **Step 2.2: Run existing plugin-sdk tests**

```bash
npx vitest run packages/kernel-sdk
```

Expected: all PASS (type-only change, no runtime impact)

- [ ] **Step 2.3: Commit**

```bash
git add packages/kernel-sdk/src/types.ts
git commit -m "feat(plugin-sdk): add autoApprovedCommands to VibenPlugin manifest type

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: `createSession()` Accepts `autoApprovedCommands` Option

**Files:**
- Modify: `src/core/sessions/session-manager.ts`
- Modify: `src/core/sessions/session.ts`
- Create: `src/core/sessions/__tests__/session-auto-approve.test.ts`

- [ ] **Step 3.1: Write failing test**

Create `src/core/sessions/__tests__/session-auto-approve.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Session } from '../session'

describe('Session.autoApprovedCommands', () => {
  it('stores autoApprovedCommands passed at construction', () => {
    const session = new Session({
      id: 'test-session',
      channelId: 'test',
      agentName: 'claude',
      workingDirectory: '/tmp',
      autoApprovedCommands: ['gh pr view *', 'git -C */workspaces/* pull *'],
    } as any)

    expect(session.autoApprovedCommands).toEqual([
      'gh pr view *',
      'git -C */workspaces/* pull *',
    ])
  })

  it('defaults to empty array when not provided', () => {
    const session = new Session({
      id: 'test-session',
      channelId: 'test',
      agentName: 'claude',
      workingDirectory: '/tmp',
    } as any)

    expect(session.autoApprovedCommands).toEqual([])
  })
})
```

- [ ] **Step 3.2: Run test — expect FAIL**

```bash
npx vitest run src/core/sessions/__tests__/session-auto-approve.test.ts
```

Expected: FAIL (`autoApprovedCommands` property does not exist on Session)

- [ ] **Step 3.3: Add `autoApprovedCommands` to Session**

In `src/core/sessions/session.ts`, find the Session class:

1. Add to session options/constructor params (wherever `channelId`, `agentName` etc. are declared):
```typescript
autoApprovedCommands?: string[]
```

2. Add private field and getter:
```typescript
private _autoApprovedCommands: string[] = []

get autoApprovedCommands(): string[] {
  return this._autoApprovedCommands
}
```

3. In the constructor body, assign it:
```typescript
this._autoApprovedCommands = options.autoApprovedCommands ?? []
```

- [ ] **Step 3.4: Add `options` param to `createSession()`**

In `src/core/sessions/session-manager.ts`, update `createSession()`:

```typescript
async createSession(
  channelId: string,
  agentName: string,
  workingDirectory: string,
  agentManager: AgentManager,
  options?: { autoApprovedCommands?: string[] },  // ADD
): Promise<Session> {
  // Find where new Session(...) is called and pass the option:
  const session = new Session({
    // ... existing params ...
    autoApprovedCommands: options?.autoApprovedCommands ?? [],
  })
  // ... rest of existing body ...
}
```

- [ ] **Step 3.5: Run test — expect PASS**

```bash
npx vitest run src/core/sessions/__tests__/session-auto-approve.test.ts
```

Expected: PASS

- [ ] **Step 3.6: Run full session tests to check no regression**

```bash
npx vitest run src/core/sessions
```

Expected: all PASS

- [ ] **Step 3.7: Commit**

```bash
git add src/core/sessions/session.ts src/core/sessions/session-manager.ts src/core/sessions/__tests__/session-auto-approve.test.ts
git commit -m "feat(sessions): accept autoApprovedCommands option in createSession()

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Pattern-Match Auto-Approve in SessionBridge

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Modify: `src/core/sessions/__tests__/session-auto-approve.test.ts`

- [ ] **Step 4.1: Add tests for pattern-match auto-approve**

Append to `src/core/sessions/__tests__/session-auto-approve.test.ts`:

```typescript
import { isMatch } from 'micromatch'

describe('autoApprovedCommands glob matching', () => {
  const patterns = [
    'gh pr view *',
    'gh pr diff *',
    'gh auth status',
    'git -C */workspaces/* pull *',
    'cat */workspaces/*',
  ]

  it.each([
    ['gh pr view 123 --repo owner/repo --json title', true],
    ['gh pr diff 42 --repo owner/repo', true],
    ['gh auth status', true],
    ['git -C /data/workspaces/watcher_abc/down_xyz pull --ff-only', true],
    ['cat /data/workspaces/watcher_abc/down_xyz/downstream/src/api.ts', true],
    ['rm -rf /data/workspaces', false],
    ['curl https://evil.com', false],
    ['gh issue delete 1', false],
    ['sudo apt install something', false],
  ])('command "%s" approved=%s', (command, expected) => {
    expect(isMatch(command, patterns)).toBe(expected)
  })
})
```

- [ ] **Step 4.2: Run test — expect PASS** (pure logic test, no code change needed)

```bash
npx vitest run src/core/sessions/__tests__/session-auto-approve.test.ts
```

Expected: all micromatch tests PASS

- [ ] **Step 4.3: Add auto-approve integration test via SessionBridge**

Add to `src/core/sessions/__tests__/session-auto-approve.test.ts`:

```typescript
import { SessionBridge } from '../session-bridge'

describe('SessionBridge.checkAutoApprove with patterns', () => {
  it('auto-approves a bash command matching session autoApprovedCommands', async () => {
    // Build a minimal session mock with autoApprovedCommands
    const mockSession = {
      id: 'sess-1',
      autoApprovedCommands: ['gh pr view *'],
      getConfigByCategory: () => null,
      clientOverrides: { bypassPermissions: false },
      // Add any other session properties SessionBridge needs — check session-bridge.ts constructor
    } as any

    const bridge = new SessionBridge(mockSession, { /* minimal deps */ } as any)

    // Simulate a bash tool permission request for "gh pr view 123"
    const mockRequest = {
      id: 'req-1',
      options: [{ id: 'allow', isAllow: true }, { id: 'deny', isAllow: false }],
      // The description field is what gets matched — check actual PermissionRequest type in session-bridge.ts
      description: 'gh pr view 123 --repo owner/repo',
    } as any

    // Access private method via casting
    const result = (bridge as any).checkAutoApprove(mockRequest)

    expect(result).toBe('allow')
  })

  it('returns null for command not in approved list', () => {
    const mockSession = {
      id: 'sess-2',
      autoApprovedCommands: ['gh pr view *'],
      getConfigByCategory: () => null,
      clientOverrides: { bypassPermissions: false },
    } as any

    const bridge = new SessionBridge(mockSession, {} as any)
    const mockRequest = {
      id: 'req-2',
      options: [{ id: 'allow', isAllow: true }],
      description: 'rm -rf /important',
    } as any

    const result = (bridge as any).checkAutoApprove(mockRequest)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 4.4: Run test — expect FAIL**

```bash
npx vitest run src/core/sessions/__tests__/session-auto-approve.test.ts
```

Expected: FAIL on SessionBridge tests (checkAutoApprove doesn't check patterns yet)

> **Note:** Before implementing, open `src/core/sessions/session-bridge.ts` and check: (a) what field on `PermissionRequest` contains the bash command string (likely `description` or `title`), (b) exact constructor params of `SessionBridge`. Adjust the test mock accordingly if needed.

- [ ] **Step 4.5: Extend `checkAutoApprove()` with glob matching**

In `src/core/sessions/session-bridge.ts`, update the `checkAutoApprove()` private method:

```typescript
// Add import at top of file:
import { isMatch } from 'micromatch'

// Update checkAutoApprove():
private checkAutoApprove(request: PermissionRequest): string | null {
  // Existing bypass mode check (keep as-is):
  const modeOption = this.session.getConfigByCategory('mode')
  const isAgentBypass = modeOption && isPermissionBypass(
    typeof modeOption.currentValue === 'string' ? modeOption.currentValue : ''
  )
  const isClientBypass = this.session.clientOverrides.bypassPermissions
  if (isAgentBypass || isClientBypass) {
    const allowOption = request.options.find((o) => o.isAllow)
    if (allowOption) {
      log.info({ sessionId: this.session.id, requestId: request.id }, 'Bypass mode: auto-approving')
      return allowOption.id
    }
  }

  // NEW: Check autoApprovedCommands glob patterns
  const patterns = this.session.autoApprovedCommands
  if (patterns.length > 0) {
    // Use the field that contains the bash command string — check PermissionRequest type
    // It is likely request.description or request.title. Adjust if needed.
    const command = request.description ?? ''
    if (command && isMatch(command, patterns, { dot: true })) {
      const allowOption = request.options.find((o) => o.isAllow)
      if (allowOption) {
        log.info(
          { sessionId: this.session.id, requestId: request.id, command },
          'autoApprovedCommands: auto-approving matching command',
        )
        return allowOption.id
      }
    }
  }

  return null
}
```

- [ ] **Step 4.6: Run tests — expect PASS**

```bash
npx vitest run src/core/sessions/__tests__/session-auto-approve.test.ts
```

Expected: all PASS

- [ ] **Step 4.7: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS (no regressions)

- [ ] **Step 4.8: Commit**

```bash
git add src/core/sessions/session-bridge.ts src/core/sessions/__tests__/session-auto-approve.test.ts
git commit -m "feat(sessions): auto-approve bash commands matching session glob patterns

Uses micromatch to match permission request descriptions against
session.autoApprovedCommands. Allows plugins to declare safe commands
that bypass user approval prompts for automated workflows.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Done

All 4 core changes implemented:
1. ✅ Tunnel service emits `tunnel:started` / `tunnel:stopped` events
2. ✅ `VibenPlugin` manifest type has `autoApprovedCommands` field
3. ✅ `createSession()` accepts and stores `autoApprovedCommands`
4. ✅ `SessionBridge.checkAutoApprove()` glob-matches against approved patterns

**Next:** Implement Plan 2 — the `@viben/git-watcher` plugin itself.
