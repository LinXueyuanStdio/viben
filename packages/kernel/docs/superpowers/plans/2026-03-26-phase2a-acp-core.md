# Phase 2a Part 2: Full ACP Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ACP protocol coverage by wiring new event types through SessionBridge, MessageTransformer, Session model, and adapters — so modes, config, models, resources, and session info updates flow end-to-end from agent to user.

**Architecture:** AgentInstance already emits new event types (session_info_update, current_mode_update, etc.). This plan wires those events through the existing pipeline: AgentInstance → Session → SessionBridge → MessageTransformer → Adapter → User. TDD throughout.

**Tech Stack:** TypeScript ESM, Vitest, `@agentclientprotocol/sdk` v0.16.1

**Spec:** `docs/superpowers/specs/2026-03-26-phase2a-restructure-acp-core.md` Sections 4-9

**Already done (not in this plan):**
- Types expanded in `src/core/types.ts` (Step 1 of spec)
- AgentInstance updated with all new methods and session/update handling (Step 3 of spec)
- rawOutput forwarding on tool events (already in place)

---

## File Structure

### Files to modify

```
src/core/sessions/session.ts              — Add mode/config/model state + methods
src/core/sessions/session-bridge.ts       — Wire new AgentEvent types to adapter
src/core/message-transformer.ts           — Transform new events to OutgoingMessage
src/adapters/shared/messaging-adapter.ts  — Add handler stubs for new message types
src/adapters/shared/rendering/renderer.ts — Add render methods for new types
src/core/index.ts                         — Export new types
```

### Files to create (tests)

```
src/core/sessions/__tests__/session-acp.test.ts          — Session mode/config/model state
src/core/sessions/__tests__/session-bridge-acp.test.ts   — Bridge wiring for new events
src/core/__tests__/message-transformer-acp.test.ts       — Transform new event types
```

---

## Task 1: Update Session Model — Mode/Config/Model State

Add properties and methods to Session for tracking ACP state.

**Files:**
- Modify: `src/core/sessions/session.ts`
- Test: `src/core/sessions/__tests__/session-acp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/sessions/__tests__/session-acp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Session } from '../session.js'
import type { AgentInstance } from '../../agents/agent-instance.js'
import type { SessionMode, ConfigOption, ModelInfo, SessionModeState, SessionModelState } from '../../types.js'

function mockAgentInstance() {
  return {
    sessionId: 'agent-sess-1',
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    setMode: vi.fn().mockResolvedValue(undefined),
    setConfigOption: vi.fn().mockResolvedValue({ configOptions: [] }),
    setModel: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  } as unknown as AgentInstance
}

describe('Session ACP state', () => {
  let session: Session

  beforeEach(() => {
    session = new Session({
      id: 'test-session',
      channelId: 'telegram',
      agentName: 'claude',
      workingDirectory: '/tmp',
      agentInstance: mockAgentInstance(),
    })
  })

  it('initializes with empty mode/config/model state', () => {
    expect(session.currentMode).toBeUndefined()
    expect(session.availableModes).toEqual([])
    expect(session.configOptions).toEqual([])
    expect(session.currentModel).toBeUndefined()
    expect(session.availableModels).toEqual([])
  })

  it('setInitialAcpState stores modes, config, and models', () => {
    const modes: SessionModeState = {
      currentModeId: 'code',
      availableModes: [
        { id: 'code', name: 'Code' },
        { id: 'architect', name: 'Architect' },
      ],
    }
    const configOptions: ConfigOption[] = [{
      id: 'model',
      name: 'Model',
      type: 'select',
      currentValue: 'sonnet',
      options: [{ value: 'sonnet', label: 'Sonnet' }],
    }]
    const models: SessionModelState = {
      currentModelId: 'sonnet',
      availableModels: [{ id: 'sonnet', name: 'Sonnet' }],
    }

    session.setInitialAcpState({ modes, configOptions, models })

    expect(session.currentMode).toBe('code')
    expect(session.availableModes).toHaveLength(2)
    expect(session.configOptions).toHaveLength(1)
    expect(session.currentModel).toBe('sonnet')
    expect(session.availableModels).toHaveLength(1)
  })

  it('updateMode changes current mode', () => {
    session.setInitialAcpState({
      modes: { currentModeId: 'code', availableModes: [{ id: 'code', name: 'Code' }] },
    })
    session.updateMode('architect')
    expect(session.currentMode).toBe('architect')
  })

  it('updateConfigOptions replaces options', () => {
    const opts: ConfigOption[] = [{
      id: 'thought',
      name: 'Thinking',
      type: 'boolean',
      currentValue: true,
    }]
    session.updateConfigOptions(opts)
    expect(session.configOptions).toEqual(opts)
  })

  it('updateModel changes current model', () => {
    session.updateModel('opus')
    expect(session.currentModel).toBe('opus')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/sessions/__tests__/session-acp.test.ts`
Expected: FAIL — properties/methods don't exist on Session

- [ ] **Step 3: Implement Session ACP state**

In `src/core/sessions/session.ts`, add to the class:

```typescript
// ACP state properties (after existing properties like voiceMode, dangerousMode)
currentMode?: string
availableModes: SessionMode[] = []
configOptions: ConfigOption[] = []
currentModel?: string
availableModels: ModelInfo[] = []

// ACP state methods
setInitialAcpState(state: {
  modes?: SessionModeState | null
  configOptions?: ConfigOption[] | null
  models?: SessionModelState | null
}): void {
  if (state.modes) {
    this.currentMode = state.modes.currentModeId
    this.availableModes = state.modes.availableModes
  }
  if (state.configOptions) {
    this.configOptions = state.configOptions
  }
  if (state.models) {
    this.currentModel = state.models.currentModelId
    this.availableModels = state.models.availableModels
  }
}

updateMode(modeId: string): void {
  this.currentMode = modeId
}

updateConfigOptions(options: ConfigOption[]): void {
  this.configOptions = options
}

updateModel(modelId: string): void {
  this.currentModel = modelId
}
```

Add necessary imports at top of file:
```typescript
import type { SessionMode, ConfigOption, ModelInfo, SessionModeState, SessionModelState } from '../types.js'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/sessions/__tests__/session-acp.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Build and full test**

Run: `pnpm build && pnpm test`
Expected: Build passes, all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/core/sessions/session.ts src/core/sessions/__tests__/session-acp.test.ts
git commit -m "feat(session): add ACP mode, config, and model state management

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Update MessageTransformer — Transform New Events

**Files:**
- Modify: `src/core/message-transformer.ts`
- Test: `src/core/__tests__/message-transformer-acp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/message-transformer-acp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MessageTransformer } from '../message-transformer.js'
import type { AgentEvent } from '../types.js'

describe('MessageTransformer ACP events', () => {
  const transformer = new MessageTransformer()

  it('transforms session_info_update', () => {
    const event: AgentEvent = { type: 'session_info_update', title: 'My Session', updatedAt: '2026-03-26' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('system_message')
    expect(msg.text).toContain('My Session')
    expect(msg.metadata?.title).toBe('My Session')
  })

  it('transforms current_mode_update', () => {
    const event: AgentEvent = { type: 'current_mode_update', modeId: 'architect' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('mode_change')
    expect(msg.metadata?.modeId).toBe('architect')
  })

  it('transforms config_option_update', () => {
    const event: AgentEvent = {
      type: 'config_option_update',
      options: [{ id: 'model', name: 'Model', type: 'select', currentValue: 'sonnet', options: [] }],
    }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('config_update')
    expect(msg.metadata?.options).toHaveLength(1)
  })

  it('transforms model_update', () => {
    const event: AgentEvent = { type: 'model_update', modelId: 'opus' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('model_update')
    expect(msg.metadata?.modelId).toBe('opus')
  })

  it('transforms user_message_chunk', () => {
    const event: AgentEvent = { type: 'user_message_chunk', content: 'Hello replay' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('user_replay')
    expect(msg.text).toBe('Hello replay')
  })

  it('transforms resource_content', () => {
    const event: AgentEvent = { type: 'resource_content', uri: 'file:///a.txt', name: 'a.txt', text: 'content' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('resource')
    expect(msg.metadata?.uri).toBe('file:///a.txt')
  })

  it('transforms resource_link', () => {
    const event: AgentEvent = { type: 'resource_link', uri: 'https://example.com', name: 'Example', title: 'Ex' }
    const msg = transformer.transform(event)
    expect(msg.type).toBe('resource_link')
    expect(msg.metadata?.uri).toBe('https://example.com')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/__tests__/message-transformer-acp.test.ts`
Expected: FAIL — new event types fall through to default case

- [ ] **Step 3: Add new transform cases**

In `src/core/message-transformer.ts`, add cases in the `transform()` method switch:

```typescript
case "session_info_update":
  return {
    type: "system_message",
    text: `Session updated: ${event.title ?? ""}`.trim(),
    metadata: { title: event.title, updatedAt: event.updatedAt },
  }

case "current_mode_update":
  return {
    type: "mode_change",
    text: `Mode: ${event.modeId}`,
    metadata: { modeId: event.modeId },
  }

case "config_option_update":
  return {
    type: "config_update",
    text: "Config updated",
    metadata: { options: event.options },
  }

case "model_update":
  return {
    type: "model_update",
    text: `Model: ${event.modelId}`,
    metadata: { modelId: event.modelId },
  }

case "user_message_chunk":
  return {
    type: "user_replay",
    text: event.content,
  }

case "resource_content":
  return {
    type: "resource",
    text: event.name,
    metadata: { uri: event.uri, text: event.text, blob: event.blob, mimeType: event.mimeType },
  }

case "resource_link":
  return {
    type: "resource_link",
    text: event.name,
    metadata: { uri: event.uri, mimeType: event.mimeType, title: event.title, description: event.description, size: event.size },
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/__tests__/message-transformer-acp.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Build and full test**

Run: `pnpm build && pnpm test`

- [ ] **Step 6: Commit**

```bash
git add src/core/message-transformer.ts src/core/__tests__/message-transformer-acp.test.ts
git commit -m "feat(transformer): transform new ACP event types to OutgoingMessage

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Update SessionBridge — Wire New Events

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Test: `src/core/sessions/__tests__/session-bridge-acp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/core/sessions/__tests__/session-bridge-acp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionBridge } from '../session-bridge.js'
import { MessageTransformer } from '../../message-transformer.js'
import type { IChannelAdapter } from '../../channel.js'
import type { Session } from '../session.js'
import type { AgentEvent } from '../../types.js'
import { TypedEmitter } from '../../utils/typed-emitter.js'

function createMockSession() {
  const emitter = new TypedEmitter()
  return Object.assign(emitter, {
    id: 'test-session',
    channelId: 'telegram',
    name: 'Test',
    threadId: '123',
    agentName: 'claude',
    agentSessionId: 'agent-1',
    workingDirectory: '/tmp',
    status: 'active' as const,
    createdAt: new Date(),
    promptCount: 0,
    dangerousMode: false,
    permissionGate: { setPending: vi.fn() },
    agentInstance: Object.assign(new TypedEmitter(), {
      sessionId: 'agent-1',
      on: vi.fn(),
      off: vi.fn(),
      onPermissionRequest: vi.fn(),
    }),
    setName: vi.fn(),
    finish: vi.fn(),
    fail: vi.fn(),
    updateMode: vi.fn(),
    updateConfigOptions: vi.fn(),
    updateModel: vi.fn(),
  }) as unknown as Session
}

function createMockAdapter(): IChannelAdapter {
  return {
    name: 'test',
    capabilities: { streaming: false, richFormatting: false, threads: false, reactions: false, fileUpload: false, voice: false },
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPermissionRequest: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    createSessionThread: vi.fn().mockResolvedValue('thread-1'),
    renameSessionThread: vi.fn().mockResolvedValue(undefined),
  } as unknown as IChannelAdapter
}

describe('SessionBridge ACP events', () => {
  let session: Session
  let adapter: IChannelAdapter
  let bridge: SessionBridge

  beforeEach(() => {
    session = createMockSession()
    adapter = createMockAdapter()
    bridge = new SessionBridge(session, adapter, {
      messageTransformer: new MessageTransformer(),
      notificationManager: { notify: vi.fn() } as any,
      sessionManager: { patchRecord: vi.fn() } as any,
    })
    bridge.connect()
  })

  it('session_info_update with title calls session.setName and sends message', async () => {
    const event: AgentEvent = { type: 'session_info_update', title: 'New Title' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect((session as any).setName).toHaveBeenCalledWith('New Title')
      expect(adapter.sendMessage).toHaveBeenCalled()
    })
  })

  it('current_mode_update updates session and sends message', async () => {
    const event: AgentEvent = { type: 'current_mode_update', modeId: 'architect' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect((session as any).updateMode).toHaveBeenCalledWith('architect')
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'mode_change' }))
    })
  })

  it('config_option_update updates session and sends message', async () => {
    const event: AgentEvent = {
      type: 'config_option_update',
      options: [{ id: 'model', name: 'Model', type: 'select', currentValue: 'sonnet', options: [] }],
    }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect((session as any).updateConfigOptions).toHaveBeenCalled()
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'config_update' }))
    })
  })

  it('model_update updates session and sends message', async () => {
    const event: AgentEvent = { type: 'model_update', modelId: 'opus' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect((session as any).updateModel).toHaveBeenCalledWith('opus')
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'model_update' }))
    })
  })

  it('user_message_chunk sends message to adapter', async () => {
    const event: AgentEvent = { type: 'user_message_chunk', content: 'Hello' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'user_replay' }))
    })
  })

  it('resource_content sends message to adapter', async () => {
    const event: AgentEvent = { type: 'resource_content', uri: 'file:///a.txt', name: 'a.txt', text: 'hi' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'resource' }))
    })
  })

  it('resource_link sends message to adapter', async () => {
    const event: AgentEvent = { type: 'resource_link', uri: 'https://ex.com', name: 'Ex' }
    session.emit('agent_event', event)
    await vi.waitFor(() => {
      expect(adapter.sendMessage).toHaveBeenCalledWith('test-session', expect.objectContaining({ type: 'resource_link' }))
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/sessions/__tests__/session-bridge-acp.test.ts`
Expected: FAIL — events not handled in bridge

- [ ] **Step 3: Add new event handling to SessionBridge**

In `src/core/sessions/session-bridge.ts`, in the `wireSessionToAdapter()` method, add cases in the switch for the new event types:

```typescript
case "session_info_update":
  if (event.title) {
    this.session.setName(event.title)
  }
  this.adapter.sendMessage(
    this.session.id,
    this.deps.messageTransformer.transform(event),
  )
  break

case "current_mode_update":
  this.session.updateMode(event.modeId)
  this.adapter.sendMessage(
    this.session.id,
    this.deps.messageTransformer.transform(event),
  )
  break

case "config_option_update":
  this.session.updateConfigOptions(event.options)
  this.adapter.sendMessage(
    this.session.id,
    this.deps.messageTransformer.transform(event),
  )
  break

case "model_update":
  this.session.updateModel(event.modelId)
  this.adapter.sendMessage(
    this.session.id,
    this.deps.messageTransformer.transform(event),
  )
  break

case "user_message_chunk":
  this.adapter.sendMessage(
    this.session.id,
    this.deps.messageTransformer.transform(event),
  )
  break

case "resource_content":
case "resource_link":
  this.adapter.sendMessage(
    this.session.id,
    this.deps.messageTransformer.transform(event),
  )
  break
```

NOTE: `session.setName()`, `session.updateMode()`, etc. must exist from Task 1. The `setName` method likely already exists (check the Session class).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/sessions/__tests__/session-bridge-acp.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Build and full test**

Run: `pnpm build && pnpm test`

- [ ] **Step 6: Commit**

```bash
git add src/core/sessions/session-bridge.ts src/core/sessions/__tests__/session-bridge-acp.test.ts
git commit -m "feat(bridge): wire ACP mode, config, model, resource events to adapters

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Update Adapters — Handle New Message Types

Add handler stubs to MessagingAdapter base + dispatch, and render methods to BaseRenderer.

**Files:**
- Modify: `src/adapters/shared/messaging-adapter.ts`
- Modify: `src/adapters/shared/rendering/renderer.ts`

- [ ] **Step 1: Add new handler stubs to MessagingAdapter**

In `src/adapters/shared/messaging-adapter.ts`:

1. Add new cases in `dispatchMessage()` switch:
```typescript
case 'mode_change':    return this.handleModeChange(sessionId, content)
case 'config_update':  return this.handleConfigUpdate(sessionId, content)
case 'model_update':   return this.handleModelUpdate(sessionId, content)
case 'user_replay':    return this.handleUserReplay(sessionId, content)
case 'resource':       return this.handleResource(sessionId, content)
case 'resource_link':  return this.handleResourceLink(sessionId, content)
```

2. Add protected no-op handler stubs:
```typescript
protected async handleModeChange(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleConfigUpdate(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleModelUpdate(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleUserReplay(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleResource(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleResourceLink(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
```

- [ ] **Step 2: Add render methods to IRenderer + BaseRenderer**

In `src/adapters/shared/rendering/renderer.ts`:

1. Add to `IRenderer` interface:
```typescript
renderModeChange?(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
renderConfigUpdate?(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
renderModelUpdate?(content: OutgoingMessage, verbosity: DisplayVerbosity): RenderedMessage
renderResource?(content: OutgoingMessage): RenderedMessage
renderResourceLink?(content: OutgoingMessage): RenderedMessage
```

2. Add to `BaseRenderer` class:
```typescript
renderModeChange(content: OutgoingMessage): RenderedMessage {
  const modeId = (content.metadata as Record<string, unknown>)?.modeId ?? ''
  return { body: `🔄 Mode: ${modeId}`, format: 'plain' }
}

renderConfigUpdate(content: OutgoingMessage): RenderedMessage {
  return { body: '⚙️ Config updated', format: 'plain' }
}

renderModelUpdate(content: OutgoingMessage): RenderedMessage {
  const modelId = (content.metadata as Record<string, unknown>)?.modelId ?? ''
  return { body: `🤖 Model: ${modelId}`, format: 'plain' }
}

renderResource(content: OutgoingMessage): RenderedMessage {
  const uri = (content.metadata as Record<string, unknown>)?.uri ?? ''
  return { body: `📄 Resource: ${content.text} (${uri})`, format: 'plain' }
}

renderResourceLink(content: OutgoingMessage): RenderedMessage {
  const uri = (content.metadata as Record<string, unknown>)?.uri ?? ''
  return { body: `🔗 ${content.text}: ${uri}`, format: 'plain' }
}
```

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add src/adapters/shared/messaging-adapter.ts src/adapters/shared/rendering/renderer.ts
git commit -m "feat(adapters): add handler stubs and render methods for ACP message types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Export New Types + Final Verification

**Files:**
- Modify: `src/core/index.ts`

- [ ] **Step 1: Export new types from core/index.ts**

Add exports for the new ACP types:
```typescript
export type {
  SessionMode,
  SessionModeState,
  ConfigOption,
  ConfigSelectChoice,
  ConfigSelectGroup,
  SetConfigOptionValue,
  ModelInfo,
  SessionModelState,
  AgentCapabilities,
  NewSessionResponse,
  AuthMethod,
  AuthenticateRequest,
  StopReason,
  PromptResponse,
  ContentBlock,
  SessionListItem,
  SessionListResponse,
  McpServerConfig,
} from './types.js'
```

- [ ] **Step 2: Full build**

Run: `pnpm build`

- [ ] **Step 3: Full test suite**

Run: `pnpm test`

- [ ] **Step 4: Publish build**

Run: `pnpm build:publish`

- [ ] **Step 5: Commit**

```bash
git add src/core/index.ts
git commit -m "feat(core): export new ACP types from public API

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Test file | Key changes |
|------|-------------|-----------|-------------|
| 1 | Session ACP state | `session-acp.test.ts` | Add mode/config/model properties + methods |
| 2 | MessageTransformer | `message-transformer-acp.test.ts` | Transform 7 new event types |
| 3 | SessionBridge wiring | `session-bridge-acp.test.ts` | Wire new events to adapter |
| 4 | Adapter handlers | (build verification) | Dispatch + render for 6 new message types |
| 5 | Export + verify | (full suite) | Public API exports |
