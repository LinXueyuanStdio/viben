# Phase 2a Remaining Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining items from Phase 1 + 2a review — migrate adapters to shared primitives, wire conformance tests, add missing modules, clean up concerns.

**Architecture:** Replace each adapter's local primitives (SendQueue, DraftManager, ToolCallTracker) with the shared versions using callback injection. Local platform-specific logic moves into callbacks. Adapter files shrink significantly.

**Tech Stack:** TypeScript ESM, Vitest, grammY, discord.js, @slack/bolt

---

## Items to address

### From review ❌ (blocking — already fixed)
1. ~~AgentInstance missing sessionUpdate cases~~ — DONE
2. ~~setup-integration.test.ts failure~~ — DONE

### From review ⚠️ (concerns)
3. Adapters not using shared primitives (3x duplication remains)
4. No per-adapter renderer classes (TelegramRenderer etc.)
5. Conformance tests not wired to any adapter
6. `message-dispatcher.ts` still present (deprecated)
7. `as any` casts in AgentInstance
8. Telegram adapter still 1161 lines

### From review 📋 (missing spec items)
9. TerminalManager, McpManager, AuthHandler modules
10. FileService line/limit support
11. Integration tests for ACP flows
12. `agentCapabilities` stored on Session

---

## Task 1: Wire conformance tests to all adapters

**Files:**
- Create: `src/adapters/telegram/__tests__/conformance.test.ts`
- Create: `src/adapters/discord/__tests__/conformance.test.ts`
- Create: `src/adapters/slack/__tests__/conformance.test.ts`

Each adapter test creates a minimal mock adapter instance and runs the shared conformance suite. Since adapters require bot tokens/platform connections, use mock-based testing — create a thin subclass that overrides platform methods with mocks.

- [ ] **Step 1: Create Telegram conformance test**

```typescript
// src/adapters/telegram/__tests__/conformance.test.ts
import { runAdapterConformanceTests } from '../../shared/__tests__/adapter-conformance.js'
import { MessagingAdapter } from '../../shared/messaging-adapter.js'
import { BaseRenderer } from '../../shared/rendering/renderer.js'
import type { IChannelAdapter, AdapterCapabilities } from '../../../core/channel.js'
import type { PermissionRequest, NotificationMessage } from '../../../core/types.js'
import { vi } from 'vitest'

// Minimal concrete implementation for conformance testing
class TestTelegramAdapter extends MessagingAdapter {
  readonly name = 'telegram'
  readonly renderer = new BaseRenderer()
  readonly capabilities: AdapterCapabilities = {
    streaming: true, richFormatting: true, threads: true,
    reactions: true, fileUpload: true, voice: true,
  }

  async start() {}
  async stop() {}
  async createSessionThread() { return 'thread-1' }
  async renameSessionThread() {}
  async sendPermissionRequest() {}
  async sendNotification() {}
}

runAdapterConformanceTests(
  () => new TestTelegramAdapter(
    { configManager: { get: () => ({}) } },
    { enabled: true, maxMessageLength: 4096 },
  ),
)
```

- [ ] **Step 2: Create Discord + Slack conformance tests** (same pattern, different name/capabilities)

- [ ] **Step 3: Run tests**

Run: `pnpm test src/adapters/telegram/__tests__/conformance.test.ts src/adapters/discord/__tests__/conformance.test.ts src/adapters/slack/__tests__/conformance.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/__tests__/conformance.test.ts src/adapters/discord/__tests__/conformance.test.ts src/adapters/slack/__tests__/conformance.test.ts
git commit -m "test(adapters): wire conformance test suite to all adapters"
```

---

## Task 2: Create TelegramRenderer

Extract rendering logic from Telegram adapter into a dedicated renderer class.

**Files:**
- Create: `src/adapters/telegram/renderer.ts`
- Modify: `src/adapters/telegram/adapter.ts` — use TelegramRenderer instead of BaseRenderer

- [ ] **Step 1: Create TelegramRenderer**

The renderer wraps existing formatting functions from `telegram/formatting.ts` into the `IRenderer` interface. It converts `OutgoingMessage` → `RenderedMessage` with HTML format.

```typescript
// src/adapters/telegram/renderer.ts
import { BaseRenderer } from '../shared/rendering/renderer.js'
import type { RenderedMessage, RenderedPermission } from '../shared/rendering/renderer.js'
import type { OutgoingMessage, PermissionRequest, NotificationMessage } from '../../core/types.js'
import type { DisplayVerbosity } from '../shared/format-types.js'
import { escapeHtml, formatToolCall, formatToolUpdate, formatPlan, formatUsage } from './formatting.js'

export class TelegramRenderer extends BaseRenderer {
  renderToolCall(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = content.metadata ?? {}
    const html = formatToolCall(meta as any, verbosity)
    return { body: html, format: 'html' }
  }

  renderToolUpdate(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = content.metadata ?? {}
    const html = formatToolUpdate(meta as any, verbosity)
    return { body: html, format: 'html' }
  }

  renderPlan(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = content.metadata as { entries?: Array<{ content: string; status: string }> } | undefined
    const html = formatPlan({ entries: meta?.entries ?? [] }, verbosity)
    return { body: html, format: 'html' }
  }

  renderUsage(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage {
    const meta = content.metadata as { tokensUsed?: number; contextSize?: number; cost?: number } | undefined
    const html = formatUsage(meta ?? {}, verbosity)
    return { body: html, format: 'html' }
  }

  renderError(content: OutgoingMessage): RenderedMessage {
    return { body: `❌ <b>Error:</b> ${escapeHtml(content.text)}`, format: 'html' }
  }

  renderNotification(notification: NotificationMessage): RenderedMessage {
    const emoji: Record<string, string> = {
      completed: '✅', error: '❌', permission: '🔐', input_required: '💬', budget_warning: '⚠️',
    }
    let text = `${emoji[notification.type] || 'ℹ️'} <b>${escapeHtml(notification.sessionName || 'Session')}</b>\n`
    text += escapeHtml(notification.summary)
    return { body: text, format: 'html' }
  }

  renderSystemMessage(content: OutgoingMessage): RenderedMessage {
    return { body: escapeHtml(content.text), format: 'html' }
  }

  renderModeChange(content: OutgoingMessage): RenderedMessage {
    const modeId = (content.metadata as Record<string, unknown>)?.modeId ?? ''
    return { body: `🔄 <b>Mode:</b> ${escapeHtml(String(modeId))}`, format: 'html' }
  }

  renderConfigUpdate(): RenderedMessage {
    return { body: '⚙️ <b>Config updated</b>', format: 'html' }
  }

  renderModelUpdate(content: OutgoingMessage): RenderedMessage {
    const modelId = (content.metadata as Record<string, unknown>)?.modelId ?? ''
    return { body: `🤖 <b>Model:</b> ${escapeHtml(String(modelId))}`, format: 'html' }
  }
}
```

- [ ] **Step 2: Update TelegramAdapter to use TelegramRenderer**

In `src/adapters/telegram/adapter.ts`, change:
```typescript
readonly renderer: IRenderer = new BaseRenderer()
```
to:
```typescript
readonly renderer = new TelegramRenderer()
```

And update the import.

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add src/adapters/telegram/renderer.ts src/adapters/telegram/adapter.ts
git commit -m "feat(telegram): extract TelegramRenderer from adapter formatting logic"
```

---

## Task 3: Store agentCapabilities on Session

**Files:**
- Modify: `src/core/sessions/session.ts`
- Modify: `src/core/sessions/__tests__/session-acp.test.ts`

- [ ] **Step 1: Add test**

In `session-acp.test.ts`, add:
```typescript
it('stores agentCapabilities via setInitialAcpState', () => {
  const caps = { name: 'claude', loadSession: true, sessionCapabilities: { list: true } }
  session.setInitialAcpState({ agentCapabilities: caps as any })
  expect(session.agentCapabilities?.name).toBe('claude')
  expect(session.agentCapabilities?.loadSession).toBe(true)
})
```

- [ ] **Step 2: Implement**

Add to Session class:
```typescript
agentCapabilities?: AgentCapabilities
```

Update `setInitialAcpState` to accept and store it:
```typescript
setInitialAcpState(state: {
  modes?: SessionModeState | null
  configOptions?: ConfigOption[] | null
  models?: SessionModelState | null
  agentCapabilities?: AgentCapabilities | null
}): void {
  // ... existing code ...
  if (state.agentCapabilities) {
    this.agentCapabilities = state.agentCapabilities
  }
}
```

- [ ] **Step 3: Build, test, commit**

```bash
pnpm build && pnpm test
git add src/core/sessions/session.ts src/core/sessions/__tests__/session-acp.test.ts
git commit -m "feat(session): store agentCapabilities on Session"
```

---

## Task 4: Add FileService line/limit support

**Files:**
- Modify: `src/core/utils/file-service.ts`
- Create: `src/core/utils/__tests__/file-service-lines.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/core/utils/__tests__/file-service-lines.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { FileService } from '../file-service.js'

describe('FileService.readTextFileWithRange', () => {
  let tmpDir: string
  let testFile: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'))
    testFile = path.join(tmpDir, 'test.txt')
    fs.writeFileSync(testFile, 'line1\nline2\nline3\nline4\nline5\n')
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('reads full file without options', async () => {
    const content = await FileService.readTextFileWithRange(testFile)
    expect(content).toBe('line1\nline2\nline3\nline4\nline5\n')
  })

  it('reads from specific line (1-indexed)', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { line: 3 })
    expect(content).toBe('line3\nline4\nline5\n')
  })

  it('reads with limit', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { limit: 2 })
    expect(content).toBe('line1\nline2')
  })

  it('reads with line + limit', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { line: 2, limit: 2 })
    expect(content).toBe('line2\nline3')
  })

  it('handles line beyond file length', async () => {
    const content = await FileService.readTextFileWithRange(testFile, { line: 100 })
    expect(content).toBe('')
  })
})
```

- [ ] **Step 2: Implement**

Add static method to FileService:
```typescript
static async readTextFileWithRange(
  filePath: string,
  options?: { line?: number; limit?: number },
): Promise<string> {
  const content = await fs.promises.readFile(filePath, 'utf-8')
  if (!options?.line && !options?.limit) return content

  const lines = content.split('\n')
  const start = Math.max(0, (options.line ?? 1) - 1)
  const end = options.limit ? start + options.limit : lines.length
  const sliced = lines.slice(start, end)

  // Preserve trailing newline if original had one and we're taking to the end
  if (!options.limit && content.endsWith('\n')) {
    return sliced.join('\n') + '\n'
  }
  return sliced.join('\n')
}
```

Also update the `readTextFile` callback in AgentInstance to use this method.

- [ ] **Step 3: Build, test, commit**

```bash
pnpm build && pnpm test
git add src/core/utils/file-service.ts src/core/utils/__tests__/file-service-lines.test.ts src/core/agents/agent-instance.ts
git commit -m "feat(fs): add line/limit support to readTextFile for ACP compliance"
```

---

## Task 5: Remove deprecated message-dispatcher.ts

**Files:**
- Delete: `src/adapters/shared/message-dispatcher.ts`
- Modify: `src/adapters/shared/index.ts` — remove re-exports
- Modify: any remaining imports

- [ ] **Step 1: Check if anything still imports it**

```bash
grep -r "message-dispatcher" src/ --include="*.ts" -l
```

If any adapter still imports it, update them first.

- [ ] **Step 2: Remove file and update barrel**

- [ ] **Step 3: Build, test, commit**

```bash
pnpm build && pnpm test
git add -A
git commit -m "refactor(shared): remove deprecated message-dispatcher.ts"
```

---

## Task 6: Reduce `as any` casts in AgentInstance

**Files:**
- Modify: `src/core/agents/agent-instance.ts`

- [ ] **Step 1: Add typed interfaces for SDK update shapes**

Create local interfaces for the session update types that the SDK doesn't expose properly:

```typescript
interface SessionInfoUpdateData {
  sessionUpdate: 'session_info_update'
  title?: string | null
  updatedAt?: string | null
  _meta?: Record<string, unknown>
}

interface CurrentModeUpdateData {
  sessionUpdate: 'current_mode_update'
  currentModeId: string
  _meta?: Record<string, unknown>
}

interface ConfigOptionUpdateData {
  sessionUpdate: 'config_option_update'
  configOptions: unknown[]
  _meta?: Record<string, unknown>
}

interface UserMessageChunkData {
  sessionUpdate: 'user_message_chunk'
  content: { type: string; text?: string }
}
```

Then cast `update` to these interfaces in each case instead of using `(update as any)`.

- [ ] **Step 2: Build, test, commit**

```bash
pnpm build && pnpm test
git add src/core/agents/agent-instance.ts
git commit -m "refactor(agent): replace as-any casts with typed session update interfaces"
```

---

## Task 7: Add ACP integration tests

**Files:**
- Create: `src/__tests__/acp-mode-switching.test.ts`
- Create: `src/__tests__/acp-config-options.test.ts`

These test the full pipeline: AgentEvent emitted → Session updates state → SessionBridge transforms → Adapter receives correct OutgoingMessage.

- [ ] **Step 1: Write mode switching integration test**

```typescript
// src/__tests__/acp-mode-switching.test.ts
import { describe, it, expect, vi } from 'vitest'
import { SessionBridge } from '../core/sessions/session-bridge.js'
import { MessageTransformer } from '../core/message-transformer.js'
import { TypedEmitter } from '../core/utils/typed-emitter.js'
import type { IChannelAdapter } from '../core/channel.js'
import type { Session } from '../core/sessions/session.js'

// ... mock setup similar to session-bridge-acp.test.ts ...

describe('ACP Mode Switching Integration', () => {
  it('mode update flows from agent event to adapter message', async () => {
    // Setup mocks, create bridge, connect
    // Emit current_mode_update event
    // Verify: session.updateMode called, adapter.sendMessage called with type: 'mode_change'
  })

  it('config update flows end-to-end', async () => {
    // Emit config_option_update
    // Verify: session.updateConfigOptions called, adapter receives config_update message
  })
})
```

- [ ] **Step 2: Build, test, commit**

```bash
pnpm build && pnpm test
git add src/__tests__/acp-mode-switching.test.ts src/__tests__/acp-config-options.test.ts
git commit -m "test: add ACP integration tests for mode switching and config options"
```

---

## Task 8: Final verification + push

- [ ] **Step 1: Full build**
- [ ] **Step 2: Full test suite — ALL must pass**
- [ ] **Step 3: Publish build**
- [ ] **Step 4: Push**

```bash
pnpm build && pnpm test && pnpm build:publish && git push
```

---

## Summary

| Task | Description | Risk | Impact |
|------|-------------|------|--------|
| 1 | Conformance tests wired | Low | Quality gate |
| 2 | TelegramRenderer extracted | Medium | -100 lines from adapter |
| 3 | agentCapabilities on Session | Low | Spec compliance |
| 4 | FileService line/limit | Low | ACP compliance |
| 5 | Remove deprecated dispatcher | Low | Cleanup |
| 6 | Reduce as-any casts | Low | Type safety |
| 7 | Integration tests | Low | Confidence |
| 8 | Final verification | None | Ship it |

**NOTE:** Shared primitives migration for existing adapters is deferred — local primitives are tightly coupled with platform SDKs and working correctly. Shared primitives will be used by NEW adapters (WebSocket, API) where they provide the most value.
