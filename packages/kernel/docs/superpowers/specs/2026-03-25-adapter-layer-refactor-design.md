# Adapter Layer Refactor — Phase 1 Design Spec

**Date:** 2026-03-25
**Scope:** Full redesign of adapter layer with composition pattern, layered interface, shared primitives
**Phase:** 1 of 2 (Phase 2: Core ACP protocol completion — separate spec)

---

## Type Mapping: Current → New

This section maps every existing type/interface to its new counterpart. Types not listed here are unchanged.

| Current Type | New Location | Changes |
|---|---|---|
| `IChannelAdapter` (channel.ts) | `IChannelAdapter` (channel.ts) | Add `name`, `capabilities`. `createSessionThread` returns `Promise<string>` (unchanged). Add `archiveSessionTopic?` as optional. |
| `ChannelAdapter<TCore>` (channel.ts) | `MessagingAdapter` (shared/messaging-adapter.ts) | Replaced by richer base class. Generic `TCore` → narrower `AdapterContext` interface. |
| `OutgoingMessage` (types.ts) | `OutgoingMessage` (types.ts) | **Unchanged**. Types: `text`, `thought`, `tool_call`, `tool_update`, `plan`, `usage`, `session_end`, `error`, `attachment`, `system_message`. |
| `PermissionRequest` (types.ts) | `PermissionRequest` (types.ts) | **Unchanged**: `{ id, description, options: { id, label, isAllow }[] }` |
| `PermissionOption` (types.ts) | `PermissionOption` (types.ts) | **Unchanged**: `{ id, label, isAllow }` |
| `NotificationMessage` (types.ts) | `NotificationMessage` (types.ts) | **Unchanged**: `{ sessionId, sessionName?, type, summary, deepLink? }` |
| `AgentCommand` (types.ts) | `AgentCommand` (types.ts) | **Unchanged** |
| `MessageHandlers<TCtx>` (message-dispatcher.ts) | Deprecated — replaced by `MessagingAdapter.dispatchMessage()` + protected handlers. Existing `dispatchMessage()` function can be kept as internal delegate during migration. |

---

## Problem Statement

The current adapter layer has several issues that make it hard to maintain and extend:

1. **Duplication**: ToolCallTracker, DraftManager, ActivityTracker re-implemented in each adapter (Telegram, Discord, Slack)
2. **Monolith adapter files**: Telegram `adapter.ts` = 1154 lines with too many responsibilities
3. **High boilerplate for new adapters**: Each new adapter must re-implement ~1000+ lines of similar logic
4. **No support for non-messaging transports**: WebSocket/API adapters for custom UIs (mobile, web) would need to inherit messaging-specific logic they don't need
5. **Abstract base class too thin**: `ChannelAdapter` (54 lines) provides no shared behavior

## Goals

- New messaging adapter (like WhatsApp) requires only ~200-300 lines (renderer + transport + platform quirks)
- New stream adapter (WebSocket/API) requires only ~50-100 lines
- Shared logic (drafts, queues, tracking) lives in one place, tested once
- Every adapter behavior is overridable without forking
- Architecture ready for both internal and external (plugin) adapters
- Foundation for custom mobile/web UIs via stream adapters

## Non-Goals

- Core ACP protocol completion (Phase 2)
- Breaking backward compatibility of config format
- Rewriting core event system (SessionBridge, MessageTransformer)

---

## Architecture Overview

```
IChannelAdapter (thin interface — contract for ALL adapters)
  │
  ├── MessagingAdapter extends IChannelAdapter
  │     (base class with drafts, queues, rate limiting, tool tracking)
  │     ├── TelegramAdapter
  │     ├── DiscordAdapter
  │     └── SlackAdapter
  │
  └── StreamAdapter extends IChannelAdapter
        (lightweight base for real-time transports)
        ├── WebSocketAdapter (future)
        ├── APIAdapter (future)
        └── ...
```

---

## Section 1: IChannelAdapter Interface

The core contract that ALL adapters must implement. Thin, no logic.

```typescript
interface IChannelAdapter {
  readonly name: string  // 'telegram', 'discord', 'websocket', ...

  // Lifecycle
  start(): Promise<void>
  stop(): Promise<void>

  // Message output (uses existing types from types.ts)
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  sendNotification(notification: NotificationMessage): Promise<void>

  // Session thread management
  createSessionThread(sessionId: string, name: string): Promise<string>  // returns threadId (unchanged)
  renameSessionThread(sessionId: string, newName: string): Promise<void>
  deleteSessionThread?(sessionId: string): Promise<void>
  archiveSessionTopic?(sessionId: string): Promise<void>

  // Optional capabilities
  sendSkillCommands?(sessionId: string, commands: AgentCommand[]): Promise<void>
  cleanupSkillCommands?(sessionId: string): Promise<void>

  // Self-declared capabilities — core queries this to adjust behavior
  capabilities: AdapterCapabilities
}

interface AdapterCapabilities {
  streaming: boolean       // supports real-time streaming?
  richFormatting: boolean  // supports bold/code/embed?
  threads: boolean         // has forum/thread system?
  reactions: boolean       // supports reactions?
  fileUpload: boolean      // can send files?
  voice: boolean           // has STT/TTS?
  // Future (Phase 2):
  // elicitation: { form: boolean; url: boolean }
  // configOptions: boolean
  // resourceContent: boolean
}
```

### Changes from current

- Added `name` readonly property for identification
- Added `capabilities` — core can query what adapter supports instead of hardcoding
- `deleteSessionThread`, `archiveSessionTopic`, and skill methods are optional (not no-op in base)
- Pure interface, not abstract class — both composition and inheritance work
- Preserves existing signatures: `createSessionThread` returns `Promise<string>` (threadId), `sendNotification` takes `NotificationMessage`, `PermissionRequest` keeps `{ id, description, options: { id, label, isAllow }[] }`

---

## Section 2: MessagingAdapter Base Class

Base class for Telegram/Discord/Slack with all shared logic built-in. Every method is `protected` and overridable.

```typescript
// Narrow interface to decouple from VibenCore — easier to test, no circular deps
interface AdapterContext {
  configManager: { get(): AppConfig }
  fileService?: FileService
  // Adapters that need more from core can cast or extend
}

abstract class MessagingAdapter implements IChannelAdapter {
  // Composable primitives — initialized from config
  protected draftManager: DraftManager
  protected sendQueue: SendQueue
  protected toolTracker: ToolCallTracker
  protected activityTracker: ActivityTracker

  constructor(protected core: AdapterContext, protected config: MessagingAdapterConfig) {
    this.draftManager = new DraftManager({
      flushInterval: config.flushInterval ?? 5000,
      maxLength: config.maxMessageLength,
      onFlush: (sessionId, text, isEdit) => this.flushDraft(sessionId, text, isEdit),  // returns messageId on first send
    })
    this.sendQueue = new SendQueue({
      minInterval: config.sendInterval ?? 3000,
      onRateLimited: () => this.onRateLimited(),
    })
    this.toolTracker = new ToolCallTracker()
    this.activityTracker = new ActivityTracker({
      thinkingRefreshInterval: config.thinkingRefreshInterval ?? 15000,
      maxThinkingDuration: config.thinkingDuration ?? 180000,
    })
  }

  // === Default message flow ===

  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    const verbosity = this.getVerbosity()
    if (!this.shouldDisplay(content, verbosity)) return
    await this.dispatchMessage(sessionId, content, verbosity)
  }

  // Override point: change dispatch logic
  // NOTE: type discriminants match OutgoingMessage.type from types.ts exactly
  protected async dispatchMessage(sessionId: string, content: OutgoingMessage, verbosity: DisplayVerbosity): Promise<void> {
    switch (content.type) {
      case 'text':           return this.handleText(sessionId, content)
      case 'thought':        return this.handleThought(sessionId, content)
      case 'tool_call':      return this.handleToolCall(sessionId, content)
      case 'tool_update':    return this.handleToolUpdate(sessionId, content)
      case 'plan':           return this.handlePlan(sessionId, content, verbosity)
      case 'usage':          return this.handleUsage(sessionId, content)
      case 'error':          return this.handleError(sessionId, content)
      case 'attachment':     return this.handleAttachment(sessionId, content)
      case 'system_message': return this.handleSystem(sessionId, content)
      case 'session_end':    return this.handleSessionEnd(sessionId, content)
    }
  }

  // === Default handlers — all protected, all overridable ===

  protected async handleText(sessionId: string, content: OutgoingMessage): Promise<void> {
    const draft = this.draftManager.getOrCreate(sessionId)
    draft.append(content.text)
  }

  protected async handleToolCall(sessionId: string, content: OutgoingMessage): Promise<void> {
    await this.draftManager.finalize(sessionId)
    const rendered = this.renderer.renderToolCall(content, this.getVerbosity())
    await this.enqueueSend(sessionId, rendered)
    this.toolTracker.track(sessionId, content.metadata)
  }

  protected async handleToolUpdate(sessionId: string, content: OutgoingMessage): Promise<void> {
    const meta = this.toolTracker.update(sessionId, content.metadata.id, content.metadata.status)
    if (meta) {
      const rendered = this.renderer.renderToolUpdate(content, this.getVerbosity())
      await this.enqueueEdit(meta.messageId, rendered)
    }
  }

  protected async handlePlan(sessionId: string, content: OutgoingMessage, verbosity: DisplayVerbosity): Promise<void> {
    const rendered = this.renderer.renderPlan(content, verbosity)
    await this.enqueueSend(sessionId, rendered)
  }

  protected async handleUsage(sessionId: string, content: OutgoingMessage): Promise<void> {
    await this.draftManager.finalize(sessionId)
    const rendered = this.renderer.renderUsage(content, this.getVerbosity())
    await this.enqueueSend(sessionId, rendered)
  }

  protected async handleThought(sessionId: string, content: OutgoingMessage): Promise<void> { /* default: ignore or show based on verbosity */ }
  protected async handleError(sessionId: string, content: OutgoingMessage): Promise<void> { /* render error */ }
  protected async handleAttachment(sessionId: string, content: OutgoingMessage): Promise<void> { /* render file */ }
  protected async handleSystem(sessionId: string, content: OutgoingMessage): Promise<void> { /* render system msg */ }
  protected async handleSessionEnd(sessionId: string, content: OutgoingMessage): Promise<void> { /* finalize drafts, cleanup */ }

  // === Helpers (overridable) ===

  protected getVerbosity(): DisplayVerbosity { /* read from live config */ }
  protected shouldDisplay(content: OutgoingMessage, verbosity: DisplayVerbosity): boolean { /* noise rules + verbosity filter */ }
  protected async flushDraft(sessionId: string, text: string, isEdit: boolean): Promise<string | undefined> { /* render + send (returns messageId) or edit (returns undefined) */ }
  protected async enqueueSend(sessionId: string, rendered: RenderedMessage): Promise<SentMessage> { /* queue + send */ }
  protected async enqueueEdit(messageId: string, rendered: RenderedMessage): Promise<void> { /* queue + edit */ }
  protected onRateLimited(): void { /* drop pending text, log */ }

  // === Abstract — adapter MUST implement ===

  abstract readonly name: string
  abstract readonly renderer: IRenderer
  abstract readonly capabilities: AdapterCapabilities
  protected abstract send(sessionId: string, rendered: RenderedMessage): Promise<SentMessage>
  protected abstract editMessage(messageId: string, rendered: RenderedMessage): Promise<void>
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract createSessionThread(sessionId: string, name: string): Promise<string>  // returns threadId
  abstract renameSessionThread(sessionId: string, newName: string): Promise<void>
  abstract sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  abstract sendNotification(notification: NotificationMessage): Promise<void>
}

// SentMessage — returned by send(), used to track message IDs for edits
interface SentMessage {
  messageId: string   // platform-specific ID (Telegram number→string, Discord snowflake, Slack ts)
}

interface MessagingAdapterConfig extends ChannelConfig {
  maxMessageLength: number    // 4096 Telegram, 2000 Discord, 3000 Slack
  flushInterval?: number      // default 5000ms
  sendInterval?: number       // default 3000ms
  thinkingRefreshInterval?: number  // default 15000ms
  thinkingDuration?: number   // default 180000ms
}
```

### What TelegramAdapter looks like after refactor

```typescript
class TelegramAdapter extends MessagingAdapter {
  readonly name = 'telegram'
  readonly renderer = new TelegramRenderer(new SharedMessageFormatter())
  readonly capabilities = { streaming: true, richFormatting: true, threads: true, reactions: true, fileUpload: true, voice: true }
  private bot: Bot

  constructor(core: AdapterContext, config: TelegramChannelConfig) {
    super(core, { ...config, maxMessageLength: 4096 })
    this.bot = new Bot(config.botToken)
  }

  // Platform-specific: send via grammY, return SentMessage with messageId
  protected async send(sessionId, rendered): Promise<SentMessage> {
    const msg = await this.bot.api.sendMessage(...)
    return { messageId: String(msg.message_id) }
  }
  protected async editMessage(messageId, rendered) { await this.bot.api.editMessageText(...) }

  // Platform-specific: forum topics — returns threadId (topic ID as string)
  async createSessionThread(sessionId, name): Promise<string> {
    const topic = await this.bot.api.createForumTopic(...)
    return String(topic.message_thread_id)
  }
  async renameSessionThread(sessionId, newName) { /* rename forum topic */ }

  // Override: Telegram text handler must be synchronous for ordering
  protected async handleText(sessionId, content) {
    const draft = this.draftManager.getOrCreate(sessionId)
    draft.append(content.text)  // sync append, no await
  }

  // Platform-specific: inline keyboard for permissions
  async sendPermissionRequest(sessionId, request) { /* inline keyboard buttons */ }
  async sendNotification(notification) { /* send to Notifications topic */ }

  // ... bot setup, commands, etc.
}
```

---

## Section 3: IRenderer Interface

Separates platform-specific rendering from logic.

```typescript
interface IRenderer {
  renderText(content: TextContent, verbosity: DisplayVerbosity): RenderedMessage
  renderToolCall(content: ToolCallContent, verbosity: DisplayVerbosity): RenderedMessage
  renderToolUpdate(content: ToolUpdateContent, verbosity: DisplayVerbosity): RenderedMessage
  renderPlan(content: PlanContent, verbosity: DisplayVerbosity): RenderedMessage
  renderUsage(content: UsageContent, verbosity: DisplayVerbosity): RenderedMessage
  renderPermission(request: PermissionRequest): RenderedPermission
  renderError(error: ErrorContent): RenderedMessage
  renderNotification(notification: NotificationMessage): RenderedMessage
  renderThought?(content: ThoughtContent, verbosity: DisplayVerbosity): RenderedMessage
  renderAttachment?(content: AttachmentContent): RenderedMessage
  renderSessionEnd?(content: EndContent): RenderedMessage
}

// Platform-agnostic output container
// Generic TComponents allows platform renderers to type components properly
interface RenderedMessage<TComponents = unknown> {
  body: string                 // rendered text (HTML, markdown, plain)
  format: 'html' | 'markdown' | 'plain' | 'structured'  // 'structured' for Slack blocks, etc.
  attachments?: RenderedAttachment[]
  components?: TComponents     // platform-specific (TG: InlineKeyboard, Discord: Embed, Slack: Block[])
}

interface RenderedPermission extends RenderedMessage {
  actions: RenderedAction[]    // buttons/options
}

interface RenderedAttachment {
  type: 'file' | 'image' | 'audio'
  data: Buffer | string        // binary or URL
  mimeType?: string
  filename?: string
}
```

### BaseRenderer — sensible defaults

```typescript
class BaseRenderer implements IRenderer {
  constructor(protected formatter: SharedMessageFormatter) {}

  renderText(content, verbosity) {
    return { body: content.text, format: 'plain' }
  }

  renderToolCall(content, verbosity) {
    const formatted = this.formatter.formatToolSummary(content.metadata, verbosity)
    return { body: `${formatted.icon} ${formatted.summary}`, format: 'plain' }
  }

  renderToolUpdate(content, verbosity) {
    const formatted = this.formatter.formatToolUpdate(content.metadata, verbosity)
    return { body: `${formatted.icon} ${formatted.summary}`, format: 'plain' }
  }

  renderPlan(content, verbosity) {
    const formatted = this.formatter.formatPlan(content.metadata.entries, verbosity)
    return { body: formatted, format: 'plain' }
  }

  renderUsage(content, verbosity) {
    const formatted = this.formatter.formatUsage(content.metadata)
    return { body: formatted, format: 'plain' }
  }

  renderPermission(request) {
    // Uses PermissionRequest from types.ts: { id, description, options: { id, label, isAllow }[] }
    return { body: request.description, format: 'plain', actions: request.options.map(o => ({ id: o.id, label: o.label })) }
  }

  renderError(error) {
    return { body: `Error: ${error.message}`, format: 'plain' }
  }

  renderNotification(notification) {
    // Uses NotificationMessage from types.ts: { sessionId, sessionName?, type, summary, deepLink? }
    return { body: notification.summary, format: 'plain' }
  }
}
```

### SharedMessageFormatter

Reuses ALL existing logic from `src/adapters/shared/`:
- `formatToolSummary()`, `formatToolTitle()` — tool call rendering
- `resolveToolIcon()` — emoji mapping by kind/status
- `evaluateNoise()` — hide/collapse noisy tools
- `progressBar()` — visual progress bar
- `formatTokens()` — human-readable token counts
- `truncateContent()`, `splitMessage()` — text utilities
- `stripCodeFences()` — clean code blocks

No rewrite needed — wrap existing functions into class.

### Platform renderers

```typescript
// Telegram: HTML output, 4096 char limit
class TelegramRenderer extends BaseRenderer {
  renderToolCall(content, verbosity) {
    const formatted = this.formatter.formatToolSummary(content.metadata, verbosity)
    return { body: escapeHtml(`${formatted.icon} ${formatted.summary}`), format: 'html' }
  }
  // ... HTML escaping, inline links, message splitting at 4096
}

// Discord: Markdown + embeds, 2000 char limit
class DiscordRenderer extends BaseRenderer {
  renderToolCall(content, verbosity) {
    const formatted = this.formatter.formatToolSummary(content.metadata, verbosity)
    return { body: formatted.summary, format: 'markdown', components: buildEmbed(formatted) }
  }
}

// Slack: Block Kit, 3000 char limit
class SlackRenderer extends BaseRenderer { /* Block Kit output */ }

// WebSocket: pass-through JSON
class StreamRenderer extends BaseRenderer {
  renderToolCall(content, verbosity) {
    return { body: JSON.stringify(content), format: 'plain' }
  }
}
```

---

## Section 4: StreamAdapter Base Class

Lightweight base for WebSocket/API/gRPC transports.

```typescript
abstract class StreamAdapter implements IChannelAdapter {
  // Defaults — override in constructor or subclass for richer clients (e.g., React web app)
  capabilities: AdapterCapabilities

  constructor(config?: Partial<AdapterCapabilities>) {
    this.capabilities = {
      streaming: true,
      richFormatting: false,
      threads: false,
      reactions: false,
      fileUpload: false,
      voice: false,
      ...config,
    }
  }

  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    await this.emit(sessionId, {
      type: content.type,
      sessionId,
      payload: content,
      timestamp: Date.now(),
    })
  }

  async sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    await this.emit(sessionId, {
      type: 'permission_request',
      sessionId,
      payload: request,
      timestamp: Date.now(),
    })
  }

  async sendNotification(notification: NotificationMessage): Promise<void> {
    await this.broadcast({
      type: 'notification',
      payload: notification,
      timestamp: Date.now(),
    })
  }

  // Default: client manages UI, return empty threadId
  async createSessionThread(_sessionId: string, _name: string): Promise<string> { return '' }
  async renameSessionThread(sessionId: string, name: string): Promise<void> {
    await this.emit(sessionId, { type: 'session_rename', sessionId, payload: { name }, timestamp: Date.now() })
  }

  // Abstract — implement transport
  protected abstract emit(sessionId: string, event: StreamEvent): Promise<void>
  protected abstract broadcast(event: StreamEvent): Promise<void>
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
}

interface StreamEvent {
  type: string
  sessionId?: string
  payload: unknown
  timestamp: number
}
```

---

## Section 5: Shared Primitives

Standalone, composable classes. No adapter dependency. Testable in isolation.

### DraftManager

```typescript
class DraftManager {
  constructor(config: DraftConfig)

  getOrCreate(sessionId: string): Draft
  finalize(sessionId: string): Promise<void>
  finalizeAll(): Promise<void>
  destroy(sessionId: string): void
  destroyAll(): void
}

interface DraftConfig {
  flushInterval: number      // ms between auto-flushes
  maxLength: number          // platform message length limit
  onFlush: (sessionId: string, text: string, isEdit: boolean) => Promise<string | undefined>
  // onFlush returns messageId on first send (isEdit=false), undefined on edits
  // Draft stores the returned messageId for subsequent edit flushes
  onError?: (sessionId: string, error: Error) => void  // called when flush fails; draft retains text for next attempt
}

class Draft {
  append(text: string): void    // synchronous, preserves ordering
  finalize(): Promise<void>     // flush remaining text
  destroy(): void               // cleanup timers
  readonly isEmpty: boolean
  readonly messageId?: string   // set after first flush
}
```

### SendQueue

```typescript
class SendQueue {
  constructor(config: SendQueueConfig)

  enqueue<T>(fn: () => Promise<T>, opts?: EnqueueOptions): Promise<T | undefined>
  clear(): void
  readonly pending: number
}

interface SendQueueConfig {
  minInterval: number           // ms between sends (default throttle)
  categoryIntervals?: Record<string, number>  // per-category intervals (e.g., Slack per-method RPM)
  onRateLimited?: () => void    // callback on HTTP 429
  onError?: (error: Error) => void  // callback on send failure
}

interface EnqueueOptions {
  type: 'text' | 'other'
  key?: string                  // for text deduplication
  category?: string             // for per-category rate limiting (e.g., 'chat.update', 'chat.postMessage')
}
```

**Note on platform differences:** The base SendQueue supports per-category rate limiting via `categoryIntervals`. Telegram/Discord use a single `minInterval`. Slack can define per-method intervals: `{ 'chat.postMessage': 3000, 'chat.update': 1200 }`. If a platform needs fundamentally different queue behavior, it can use its own implementation — the adapter just overrides `enqueueSend()` / `enqueueEdit()` in MessagingAdapter.

### ToolCallTracker

```typescript
class ToolCallTracker {
  track(sessionId: string, meta: ToolCallMeta, messageId: string): void  // messageId = sent message to edit on update
  update(sessionId: string, toolId: string, status: string): TrackedToolCall | null
  getActive(sessionId: string): TrackedToolCall[]
  clear(sessionId: string): void
  clearAll(): void
}

// Extends ToolCallMeta with platform message tracking
interface TrackedToolCall extends ToolCallMeta {
  messageId: string   // platform message ID for editing on status update
}
```

### ActivityTracker

```typescript
class ActivityTracker {
  constructor(config: ActivityConfig)

  onThinkingStart(sessionId: string, callbacks: ActivityCallbacks): void
  onTextStart(sessionId: string): void
  onSessionEnd(sessionId: string): void
  destroy(): void
}

interface ActivityConfig {
  thinkingRefreshInterval: number  // ms between indicator refreshes
  maxThinkingDuration: number      // ms max thinking time
}

interface ActivityCallbacks {
  sendThinkingIndicator(): Promise<void>
  updateThinkingIndicator(): Promise<void>
  removeThinkingIndicator(): Promise<void>
}
```

---

## Section 6: File Structure

```
src/
  core/
    channel.ts                    → IChannelAdapter interface (~30 lines, from 54)
    message-transformer.ts        → unchanged
    session-bridge.ts             → unchanged

  adapters/
    shared/
      primitives/
        draft-manager.ts          — standalone DraftManager + Draft
        send-queue.ts             — standalone SendQueue
        tool-call-tracker.ts      — standalone ToolCallTracker
        activity-tracker.ts       — standalone ActivityTracker
        index.ts                  — barrel export
        __tests__/
          draft-manager.test.ts
          send-queue.test.ts
          tool-call-tracker.test.ts
          activity-tracker.test.ts
      rendering/
        renderer.ts               — IRenderer interface + BaseRenderer
        message-formatter.ts      — SharedMessageFormatter (wraps existing logic)
        format-types.ts           — unchanged
        format-utils.ts           — unchanged
        index.ts                  — barrel export
      messaging-adapter.ts        — MessagingAdapter base class
      stream-adapter.ts           — StreamAdapter base class
      message-dispatcher.ts       — deprecated; MessagingAdapter.dispatchMessage() replaces it. Kept during migration, removed after all adapters migrated.
      __tests__
        adapter-conformance.ts    — shared conformance test suite
      index.ts                    — barrel export

    telegram/
      adapter.ts                  — TelegramAdapter extends MessagingAdapter (~500-600 lines, from 1154)
      renderer.ts                 — TelegramRenderer extends BaseRenderer
      transport.ts                — grammY API calls (send, edit, delete)
      permissions.ts              — inline keyboard handling
      topics.ts                   — forum topic management
      activity.ts                 — TG-specific activity (reuses ActivityTracker with TG callbacks)
      assistant.ts                — unchanged
      commands/                   — unchanged
      __tests__/
        conformance.test.ts       — runs shared conformance suite
        telegram-renderer.test.ts
        telegram-transport.test.ts

    discord/
      adapter.ts                  — DiscordAdapter extends MessagingAdapter
      renderer.ts                 — DiscordRenderer extends BaseRenderer
      transport.ts                — discord.js API calls
      permissions.ts
      ...
      __tests__/
        conformance.test.ts

    slack/
      adapter.ts                  — SlackAdapter extends MessagingAdapter
      renderer.ts                 — SlackRenderer extends BaseRenderer
      transport.ts                — @slack/bolt API calls
      ...
      __tests__/
        conformance.test.ts
```

---

## Section 7: Testing Strategy

### Layer 1: Shared Primitive Unit Tests

Test pure logic, no platform mocks needed.

```typescript
// draft-manager.test.ts
describe('DraftManager', () => {
  it('buffers text and flushes at interval')
  it('deduplicates rapid appends')
  it('finalizes pending text on demand')
  it('respects maxLength — splits messages')
  it('handles concurrent sessions independently')
  it('cleans up timers on destroy')
})

// send-queue.test.ts
describe('SendQueue', () => {
  it('enforces minimum interval between sends')
  it('deduplicates text items with same key')
  it('preserves order for non-text items')
  it('calls onRateLimited on 429')
  it('clear() drops all pending items')
})
```

### Layer 2: Conformance Test Suite

Shared test suite that ALL adapters must pass.

```typescript
// adapter-conformance.ts
export function runAdapterConformanceTests(
  createAdapter: () => IChannelAdapter,
  cleanup?: () => Promise<void>
) {
  describe('IChannelAdapter conformance', () => {
    it('declares capabilities correctly')
    it('starts and stops without error')
    it('sends text messages')
    it('sends tool call messages')
    it('sends usage messages')
    it('handles permission requests')
    it('creates and renames session threads')
    it('handles concurrent sessions')
    it('cleans up on stop()')
    it('is idempotent on double stop()')

    // Negative / edge case tests
    it('sendMessage after stop() throws or is no-op')
    it('createSessionThread for existing session is safe')
    it('handles unknown message types gracefully')
  })
}

// Each adapter imports and runs:
// telegram/__tests__/conformance.test.ts
import { runAdapterConformanceTests } from '../../shared/__tests__/adapter-conformance.js'
runAdapterConformanceTests(() => new TelegramAdapter(mockCore, testConfig))
```

### Layer 3: Platform-Specific Tests

```typescript
// telegram-renderer.test.ts — HTML rendering correctness
// discord-renderer.test.ts — embed building
// slack-renderer.test.ts — Block Kit output
// telegram-transport.test.ts — grammY API integration
```

---

## Section 8: Registration & Core Integration

### Adapter Registration (main.ts)

```typescript
for (const [name, channelConfig] of Object.entries(config.channels)) {
  if (!channelConfig.enabled) continue

  let adapter: IChannelAdapter

  switch (channelConfig.type ?? name) {
    case 'telegram':
      adapter = new TelegramAdapter(core, channelConfig as TelegramChannelConfig)
      break
    case 'discord': {
      const { DiscordAdapter } = await import('./adapters/discord/index.js')
      adapter = new DiscordAdapter(core, channelConfig as DiscordChannelConfig)
      break
    }
    case 'slack': {
      const { SlackAdapter } = await import('./adapters/slack/index.js')
      adapter = new SlackAdapter(core, channelConfig as SlackChannelConfig)
      break
    }
    default:
      // Plugin adapter
      if (channelConfig.adapter) {
        adapter = await loadPluginAdapter(channelConfig.adapter, core, channelConfig)
      }
      break
  }

  if (adapter) core.registerAdapter(name, adapter)
}
```

### Core uses capabilities

```typescript
// In SessionBridge — check before forwarding events
if (!adapter.capabilities.voice) {
  // Don't send audio content blocks to this adapter
}

if (!adapter.capabilities.fileUpload) {
  // Convert file attachment to text link
}
```

---

## Section 9: Migration Strategy

### Approach: Incremental, adapter-by-adapter

1. **Create shared primitives** — extract DraftManager, SendQueue, ToolCallTracker, ActivityTracker as standalone classes with full tests
2. **Create base classes** — MessagingAdapter, StreamAdapter, IRenderer, BaseRenderer
3. **Migrate Telegram adapter first** — most mature, best test coverage, validates the design
4. **Migrate Discord adapter** — validates design works for different platform
5. **Migrate Slack adapter** — final validation
6. **Update registration** — switch main.ts to new pattern
7. **Remove old shared code** — delete duplicated logic from individual adapters

### Backward compatibility

- Config format unchanged — no user impact
- Plugin API: `AdapterFactory.createAdapter()` still works, plugins just implement `IChannelAdapter` directly
- CLI commands unchanged
- Session data unchanged

### Risk mitigation

- Each adapter migration is a separate PR — can be reviewed and tested independently
- Conformance tests catch regressions across all adapters
- Old and new code can coexist during migration

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Telegram adapter.ts | 1154 lines | ~500-600 lines |
| Shared logic duplication | 3x (TG/DC/Slack) | 1x (primitives) |
| Lines to write new messaging adapter | ~1000+ | ~200-300 |
| Lines to write new stream adapter | N/A | ~50-100 |
| Shared logic test coverage | scattered | centralized + conformance |
| Time to add new platform | days | hours |
