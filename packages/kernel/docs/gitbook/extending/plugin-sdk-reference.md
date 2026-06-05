# Plugin SDK Reference

The `@viben/plugin-sdk` package provides types, base classes, adapter primitives, and testing utilities for building Viben plugins.

---

## Installation

```bash
npm install --save-dev @viben/plugin-sdk
```

---

## Type Exports

All types are re-exported from the main entry point:

```typescript
import type { VibenPlugin, PluginContext } from '@viben/plugin-sdk'
```

### Plugin Interfaces

| Type | Description |
|---|---|
| `VibenPlugin` | Main plugin interface. All plugins must default-export an object matching this shape. |
| `PluginContext` | Context passed to `setup()`. Provides services, events, commands, middleware, storage, and logging. |
| `PluginPermission` | Union type of all permission strings (e.g., `'events:read'`, `'services:register'`). |
| `PluginStorage` | Key-value storage interface available via `ctx.storage`. |
| `InstallContext` | Context passed to `install()`, `configure()`, and `uninstall()`. Provides terminal I/O and settings. |
| `MigrateContext` | Context passed to `migrate()`. Provides logging. |
| `TerminalIO` | Interactive terminal interface wrapping `@clack/prompts`. |
| `SettingsAPI` | Read/write interface for plugin settings. |

### Command Types

| Type | Description |
|---|---|
| `CommandDef` | Command definition including name, description, usage, category, and handler. |
| `CommandArgs` | Arguments passed to a command handler (raw text, sessionId, channelId, userId, reply function). |
| `CommandResponse` | Response from a command handler (text, error, menu, list, etc.). |
| `MenuOption` | A selectable option in a menu-type command response. |
| `ListItem` | An item in a list-type command response. |

### Service Interfaces

| Type | Description |
|---|---|
| `SecurityService` | Access control and session limit checking. |
| `FileServiceInterface` | File saving, resolving, and format conversion. |
| `NotificationService` | Send notifications to users. |
| `UsageService` | Token/cost tracking and budget checking. |
| `SpeechServiceInterface` | Text-to-speech and speech-to-text. |
| `TunnelServiceInterface` | Port tunneling and public URL management. |
| `ContextService` | Context building and provider registration for agent sessions. |

### Adapter Types

| Type | Description |
|---|---|
| `IChannelAdapter` | Interface that all channel adapters must implement. |
| `OutgoingMessage` | Message sent from Viben to a channel. |
| `PermissionRequest` | Permission prompt sent to the user. |
| `PermissionOption` | A selectable option in a permission request. |
| `NotificationMessage` | Notification sent to the notification channel. |
| `AgentCommand` | Command received from a channel adapter. |

---

## Base Classes

Exported from the main entry point:

```typescript
import { MessagingAdapter, StreamAdapter, BaseRenderer } from '@viben/plugin-sdk'
```

### MessagingAdapter

Abstract base class for channel adapters (Telegram, Discord, Slack, etc.). Implements `IChannelAdapter` with common patterns for session threading and message routing.

Use this when building a new platform adapter.

### StreamAdapter

Extends `MessagingAdapter` with streaming support. Handles chunked message updates, buffering, and periodic batch sends.

Use this when your platform supports message editing (e.g., Telegram, Discord).

### BaseRenderer

Base class for rendering agent output into platform-specific formats. Handles markdown conversion, code block formatting, and tool call display.

Use this to customize how agent responses appear on your platform.

---

## Adapter Primitives

Reusable building blocks for adapter implementations:

```typescript
import { SendQueue, DraftManager, ToolCallTracker, ActivityTracker } from '@viben/plugin-sdk'
```

| Class | Description |
|---|---|
| `SendQueue` | Serial message queue that ensures messages are sent one at a time. Prevents race conditions when multiple messages arrive simultaneously. |
| `DraftManager` | Manages streaming message drafts. Buffers text chunks and sends periodic batch updates to the platform. |
| `ToolCallTracker` | Tracks active tool calls (file edits, shell commands, etc.) and generates status displays. |
| `ActivityTracker` | Monitors agent activity and manages typing indicators. |

---

## Testing Utilities

Import from the `/testing` subpath:

```typescript
import { createTestContext, createTestInstallContext, mockServices } from '@viben/plugin-sdk/testing'
```

---

### createTestContext(opts)

Creates a test-friendly `PluginContext` for unit-testing plugin `setup()` and runtime behavior. All state is in-memory, the logger is silent, and services can be pre-populated.

**Options:**

```typescript
interface TestContextOpts {
  pluginName: string
  pluginConfig?: Record<string, unknown>
  permissions?: string[]
  services?: Record<string, unknown>
}
```

| Option | Type | Description |
|---|---|---|
| `pluginName` | `string` | Required. The plugin name. |
| `pluginConfig` | `Record<string, unknown>` | Plugin settings available as `ctx.pluginConfig`. Default: `{}`. |
| `permissions` | `string[]` | Simulated permissions. Default: all permitted. |
| `services` | `Record<string, unknown>` | Pre-registered services available via `ctx.getService()`. |

**Returns: `TestPluginContext`**

Extends `PluginContext` with inspection properties:

| Property / Method | Type | Description |
|---|---|---|
| `registeredServices` | `Map<string, unknown>` | Services registered via `registerService()`. |
| `registeredCommands` | `Map<string, CommandDef>` | Commands registered via `registerCommand()`. |
| `registeredMiddleware` | `Array<{ hook, opts }>` | Middleware registered via `registerMiddleware()`. |
| `emittedEvents` | `Array<{ event, payload }>` | Events emitted via `emit()`. |
| `sentMessages` | `Array<{ sessionId, content }>` | Messages sent via `sendMessage()`. |
| `executeCommand(name, args?)` | `Promise<CommandResponse>` | Dispatch a registered command by name for testing. |

**Example:**

```typescript
import { describe, it, expect } from 'vitest'
import { createTestContext } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

describe('my-plugin', () => {
  it('registers a service on setup', async () => {
    const ctx = createTestContext({
      pluginName: '@myorg/my-plugin',
      pluginConfig: { apiKey: 'test-key' },
    })

    await plugin.setup(ctx)

    expect(ctx.registeredServices.has('my-service')).toBe(true)
  })

  it('registers a command and handles it', async () => {
    const ctx = createTestContext({ pluginName: '@myorg/my-plugin' })
    await plugin.setup(ctx)

    const response = await ctx.executeCommand('mycommand', { raw: 'test input' })
    expect(response).toEqual({ type: 'text', text: expect.any(String) })
  })

  it('sends messages on events', async () => {
    const ctx = createTestContext({ pluginName: '@myorg/my-plugin' })
    await plugin.setup(ctx)

    ctx.emit('session:created', { sessionId: 'sess-1' })

    expect(ctx.sentMessages).toHaveLength(1)
    expect(ctx.sentMessages[0].sessionId).toBe('sess-1')
  })

  it('uses pre-populated services', async () => {
    const ctx = createTestContext({
      pluginName: '@myorg/my-plugin',
      services: { security: mockServices.security() },
    })

    await plugin.setup(ctx)
    // Plugin can call ctx.getService('security') and get the mock
  })
})
```

---

### createTestInstallContext(opts)

Creates a test-friendly `InstallContext` for unit-testing `install()`, `configure()`, and `uninstall()` hooks. Terminal prompts are automatically answered from a response map.

**Options:**

```typescript
interface TestInstallContextOpts {
  pluginName: string
  legacyConfig?: Record<string, unknown>
  terminalResponses?: Record<string, unknown[]>
}
```

| Option | Type | Description |
|---|---|---|
| `pluginName` | `string` | Required. The plugin name. |
| `legacyConfig` | `Record<string, unknown>` | Simulated legacy config data (for migration testing). |
| `terminalResponses` | `Record<string, unknown[]>` | Auto-answers for terminal prompts, keyed by method name. |

**Terminal auto-answering:**

The `terminalResponses` map provides answers for each prompt method. Responses are consumed in order (queue). If the queue is empty, sensible defaults are returned:

- `text` -> `''`
- `password` -> `''`
- `confirm` -> `false`
- `select` -> `undefined`
- `multiselect` -> `[]`

**Returns: `InstallContext` with extra properties:**

| Property | Type | Description |
|---|---|---|
| `terminalCalls` | `Array<{ method, args }>` | Log of all terminal prompt calls made. |
| `settingsData` | `Map<string, unknown>` | In-memory settings store. |

**Example:**

```typescript
import { describe, it, expect } from 'vitest'
import { createTestInstallContext } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

describe('install flow', () => {
  it('saves API key from prompt', async () => {
    const ctx = createTestInstallContext({
      pluginName: '@myorg/my-plugin',
      terminalResponses: {
        password: ['sk-test-123456789'],
        select: ['en'],
      },
    })

    await plugin.install!(ctx)

    // Verify settings were saved
    expect(ctx.settingsData.get('apiKey')).toBe('sk-test-123456789')
    expect(ctx.settingsData.get('targetLanguage')).toBe('en')
  })

  it('records terminal interactions', async () => {
    const ctx = createTestInstallContext({
      pluginName: '@myorg/my-plugin',
      terminalResponses: {
        password: ['sk-test-123456789'],
        select: ['en'],
      },
    })

    await plugin.install!(ctx)

    expect(ctx.terminalCalls).toEqual([
      { method: 'password', args: expect.objectContaining({ message: expect.any(String) }) },
      { method: 'select', args: expect.objectContaining({ message: expect.any(String) }) },
    ])
  })

  it('handles legacy config migration', async () => {
    const ctx = createTestInstallContext({
      pluginName: '@myorg/my-plugin',
      legacyConfig: {
        oldApiKey: 'legacy-key',
      },
    })

    await plugin.install!(ctx)

    // Plugin should read legacyConfig and migrate to new settings format
    expect(ctx.settingsData.has('apiKey')).toBe(true)
  })
})
```

---

### mockServices

Factory functions that create mock implementations of Viben service interfaces. Each function returns a fully-typed object with sensible defaults. Pass `overrides` to customize specific methods.

```typescript
import { mockServices } from '@viben/plugin-sdk/testing'
```

#### mockServices.security(overrides?)

```typescript
const security = mockServices.security()
// { checkAccess() -> { allowed: true }, checkSessionLimit() -> { allowed: true }, getUserRole() -> 'user' }

const restricted = mockServices.security({
  async checkAccess() { return { allowed: false, reason: 'blocked' } },
})
```

#### mockServices.fileService(overrides?)

```typescript
const files = mockServices.fileService()
// { saveFile(), resolveFile() -> null, readTextFileWithRange() -> '', extensionFromMime() -> '.bin', convertOggToWav() }
```

#### mockServices.notifications(overrides?)

```typescript
const notifs = mockServices.notifications()
// { notify(), notifyAll() }
```

#### mockServices.usage(overrides?)

```typescript
const usage = mockServices.usage()
// { trackUsage(), checkBudget() -> { ok: true }, getSummary() -> { totalTokens: 0, ... } }
```

#### mockServices.speech(overrides?)

```typescript
const speech = mockServices.speech()
// { textToSpeech(), speechToText(), registerTTSProvider(), registerSTTProvider() }
```

#### mockServices.tunnel(overrides?)

```typescript
const tunnel = mockServices.tunnel()
// { getPublicUrl(), start(), stop(), getStore(), fileUrl(), diffUrl() }
```

#### mockServices.context(overrides?)

```typescript
const context = mockServices.context()
// { buildContext() -> '', registerProvider() }
```

**Using mockServices with createTestContext:**

```typescript
const ctx = createTestContext({
  pluginName: '@myorg/my-plugin',
  services: {
    security: mockServices.security(),
    usage: mockServices.usage({
      async checkBudget() { return { ok: false, percent: 100 } },
    }),
  },
})

await plugin.setup(ctx)
// Plugin can now call ctx.getService('security') and ctx.getService('usage')
```

---

## Further Reading

- [Getting Started: Your First Plugin](getting-started-plugin.md) -- step-by-step tutorial
- [Writing Plugins](../architecture/writing-plugins.md) -- full guide to services, middleware, events, and storage
- [Dev Mode](dev-mode.md) -- development workflow with hot-reload
