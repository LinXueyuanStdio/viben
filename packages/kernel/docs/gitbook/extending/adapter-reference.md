# Adapter Reference

Complete API reference for the `ChannelAdapter` abstract class and the types it works with.

---

## ChannelAdapter Methods

### Required (abstract)

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `() => Promise<void>` | Connect to the platform, register listeners, begin accepting messages. |
| `stop` | `() => Promise<void>` | Disconnect from the platform and release all resources. |
| `sendMessage` | `(sessionId: string, content: OutgoingMessage) => Promise<void>` | Deliver agent output to the session's thread. Called for every agent event. |
| `sendPermissionRequest` | `(sessionId: string, request: PermissionRequest) => Promise<void>` | Present a permission prompt to the user and collect their choice. |
| `sendNotification` | `(notification: NotificationMessage) => Promise<void>` | Send a summary notification (completion, error, budget warning). |
| `createSessionThread` | `(sessionId: string, name: string) => Promise<string>` | Create a platform thread/channel for a new session. Returns the platform thread ID. |
| `renameSessionThread` | `(sessionId: string, newName: string) => Promise<void>` | Rename the platform thread after auto-naming resolves. |

### Optional (no-op defaults provided)

| Method | Signature | Description |
|--------|-----------|-------------|
| `deleteSessionThread` | `(sessionId: string) => Promise<void>` | Delete the platform thread when a session is cleaned up. |
| `sendSkillCommands` | `(sessionId: string, commands: AgentCommand[]) => Promise<void>` | Register dynamic slash commands or menu entries surfaced by the agent. |
| `cleanupSkillCommands` | `(sessionId: string) => Promise<void>` | Remove dynamic commands when the session ends. |
| `archiveSessionTopic` | `(sessionId: string) => Promise<void>` | Archive (rather than delete) the session thread — for platforms that support it (e.g. Telegram forum topics). |

### Constructor

```typescript
constructor(core: TCore, config: ChannelConfig)
```

Both values are stored as public/protected properties:

- `this.core` — the `VibenCore` instance (typed by generic `TCore`)
- `this.config` — the raw config block for this adapter from `<instance-root>/config.json`

---

## Key Types

### IncomingMessage

Represents a message arriving from a user on the platform. Pass this to `core.handleIncomingMessage()`.

```typescript
interface IncomingMessage {
  channelId: string       // Adapter identifier, e.g. "telegram" or "discord"
  threadId: string        // Platform thread/channel/topic ID
  userId: string          // Platform user ID
  text: string            // Message content
  attachments?: Attachment[]
}
```

### Attachment

```typescript
interface Attachment {
  type: 'image' | 'audio' | 'file'
  filePath: string        // Local path after download
  fileName: string
  mimeType: string
  size: number
  originalFilePath?: string
}
```

### OutgoingMessage

Delivered to `sendMessage()`. The `type` field tells you what kind of agent output this is.

```typescript
interface OutgoingMessage {
  type:
    | 'text'            // Agent response text
    | 'thought'         // Internal agent reasoning
    | 'tool_call'       // A tool/command being invoked
    | 'tool_update'     // Progress update on a running tool
    | 'plan'            // Step-by-step plan from the agent
    | 'usage'           // Token/cost usage summary
    | 'session_end'     // Agent has finished the session
    | 'error'           // An error occurred
    | 'attachment'      // A file or image output
    | 'system_message'  // Internal system-level message
  text: string
  metadata?: Record<string, unknown>
  attachment?: Attachment
}
```

### PermissionRequest

Sent to `sendPermissionRequest()`. The adapter must present the options to the user and call `core.resolvePermission(sessionId, request.id, chosenOptionId)`.

```typescript
interface PermissionRequest {
  id: string                  // Unique request ID — pass back to core.resolvePermission()
  description: string         // Human-readable description of what needs approval
  options: PermissionOption[]
}

interface PermissionOption {
  id: string       // Pass to core.resolvePermission() as chosenOptionId
  label: string    // Display label for the button/option
  isAllow: boolean // Whether this option grants permission
}
```

### NotificationMessage

Sent to `sendNotification()`. Typically delivered to a dedicated notifications channel, not the session thread.

```typescript
interface NotificationMessage {
  sessionId: string
  sessionName?: string
  type: 'completed' | 'error' | 'permission' | 'input_required' | 'budget_warning'
  summary: string
  deepLink?: string   // Optional URL linking back to the session thread
}
```

### AgentCommand

Used in `sendSkillCommands()`. Represents a dynamic slash command or action the agent has registered.

```typescript
interface AgentCommand {
  name: string
  description: string
  input?: unknown
}
```

### ChannelConfig

Passed as the second constructor argument. At minimum it carries `enabled: boolean`, plus any adapter-specific fields from config.

```typescript
interface ChannelConfig {
  enabled: boolean
  [key: string]: unknown
}
```

### Plugin Registration (replaces AdapterFactory)

Adapter plugins now implement the `VibenPlugin` interface. Instead of exporting an `AdapterFactory`, plugins register their adapter in the `setup()` method:

```typescript
import type { VibenPlugin, PluginContext } from '@viben/plugin-sdk'

const plugin: VibenPlugin = {
  name: '@viben/adapter-myplatform',
  version: '1.0.0',
  async setup(ctx: PluginContext) {
    const adapter = new MyPlatformAdapter(ctx)
    ctx.registerAdapter('myplatform', adapter)
  },
}
```

Adapter implementations should extend `MessagingAdapter` (for full-featured platforms with threads/topics) or `StreamAdapter` (for simpler stream-based integrations) from `@viben/plugin-sdk`.

---

## Adapter Lifecycle

```
new MyAdapter(core, config)
        ↓
  core.registerAdapter(id, adapter)
        ↓
  core.start() → adapter.start()
        ↓
  [running: inbound and outbound events flow]
        ↓
  core.stop() → adapter.stop()
```

During the running phase, the order of calls is:

1. User sends message → adapter calls `core.handleIncomingMessage()`
2. Core creates/resumes session, enqueues prompt
3. Agent emits events → core calls `adapter.sendMessage()` for each
4. Agent needs approval → core calls `adapter.sendPermissionRequest()`
5. Session completes → core calls `adapter.sendNotification()`
6. If auto-naming is configured → core calls `adapter.renameSessionThread()` after first prompt

---

## AgentEvent Types

`AgentEvent` is the union type emitted by `AgentInstance`. Adapters do not consume these directly — core translates them into `OutgoingMessage` calls on the adapter. For reference:

| `type` | Key fields | Description |
|--------|-----------|-------------|
| `text` | `content: string` | Agent response text chunk |
| `thought` | `content: string` | Internal agent reasoning |
| `tool_call` | `id`, `name`, `status`, `content` | A tool invocation |
| `tool_update` | `id`, `name`, `status`, `content` | Progress update on a tool call |
| `plan` | `entries: PlanEntry[]` | Multi-step plan with status per entry |
| `usage` | `tokensUsed`, `contextSize`, `cost` | Resource usage summary |
| `commands_update` | `commands: AgentCommand[]` | Dynamic commands from the agent |
| `image_content` | `data: string`, `mimeType: string` | Base64 image output |
| `audio_content` | `data: string`, `mimeType: string` | Base64 audio output |
| `session_end` | `reason: string` | Agent has ended the session |
| `error` | `message: string` | An error from the agent |
| `system_message` | `message: string` | Internal system message |
