# Built-in Plugins Reference

Viben ships with 11 built-in plugins. They live in `src/plugins/` and are loaded automatically on boot. Built-in plugins cannot be uninstalled, but they can be disabled.

---

## Adapter Plugins

### @viben/telegram

Telegram messaging adapter using the grammY framework.

- **Service**: `adapter:telegram`
- **Dependencies**: `@viben/security`, `@viben/file-service`
- **Permissions**: `services:register`, `kernel:access`, `events:read`, `events:emit`, `commands:register`

**What it does**: Connects Viben to Telegram. Creates forum topics for sessions, renders agent output as HTML messages with inline keyboards, handles permission buttons, and supports voice messages.

**Settings** (`settings.json`):

| Key | Type | Description |
|-----|------|-------------|
| `botToken` | string | Telegram Bot Token from @BotFather |
| `chatId` | string | Supergroup Chat ID |
| `outputMode` | `'low' \| 'medium' \| 'high'` | How much agent output to show. The legacy key `displayVerbosity` is accepted for backward compatibility. |

**Commands**: `/outputmode`, `/verbosity` (deprecated alias for `/outputmode`), `/archive` (adapter-specific), plus overrides for `/new`, `/resume`, `/settings` with multi-step wizards.

---

### @viben/discord

Discord messaging adapter using discord.js.

- **Service**: `adapter:discord`
- **Dependencies**: `@viben/security`, `@viben/file-service`
- **Permissions**: `services:register`, `kernel:access`, `events:read`, `events:emit`, `commands:register`

**What it does**: Connects Viben to Discord. Creates threads for sessions, renders output with embeds and markdown, registers slash commands, and supports file uploads.

**Settings**:

| Key | Type | Description |
|-----|------|-------------|
| `botToken` | string | Discord Bot Token |
| `guildId` | string | Discord Server ID |
| `outputMode` | `'low' \| 'medium' \| 'high'` | How much agent output to show. The legacy key `displayVerbosity` is accepted for backward compatibility. |

**Commands**: `/outputmode`, `/verbosity` (deprecated alias).

---

### @viben/slack

Slack messaging adapter using @slack/bolt.

- **Service**: `adapter:slack`
- **Dependencies**: `@viben/security`, `@viben/file-service`
- **Permissions**: `services:register`, `kernel:access`, `events:read`, `events:emit`, `commands:register`

**What it does**: Connects Viben to Slack via Socket Mode. Creates channels/threads for sessions, renders output with Block Kit, and handles interactive components.

**Settings**:

| Key | Type | Description |
|-----|------|-------------|
| `botToken` | string | Slack Bot Token |
| `appToken` | string | Slack App-Level Token (for Socket Mode) |
| `signingSecret` | string | Slack Signing Secret |

---

## Service Plugins

### @viben/security

Access control and rate limiting.

- **Service**: `security` (implements `SecurityService`)
- **Dependencies**: none
- **Permissions**: `services:register`, `events:read`, `middleware:register`

**What it does**: Checks if users are allowed to interact with Viben (`allowedUserIds`), enforces session limits (`maxConcurrentSessions`), and provides user role management.

**Service interface**:

```typescript
interface SecurityService {
  checkAccess(userId: string): Promise<{ allowed: boolean; reason?: string }>
  checkSessionLimit(userId: string): Promise<{ allowed: boolean; reason?: string }>
  getUserRole(userId: string): Promise<'admin' | 'user' | 'blocked'>
}
```

**Commands**: `/bypass on|off` -- toggle auto-approve mode for all permissions.

**Config**: Uses core `config.json` security section (`allowedUserIds`, `maxConcurrentSessions`).

---

### @viben/file-service

File I/O for agent operations.

- **Service**: `file-service` (implements `FileServiceInterface`)
- **Dependencies**: none
- **Permissions**: `services:register`, `middleware:register`

**What it does**: Handles file operations that agents request -- saving attachments, resolving file paths, reading file contents with line ranges, and audio format conversion (OGG to WAV for speech).

**Service interface**:

```typescript
interface FileServiceInterface {
  saveFile(sessionId: string, fileName: string, data: Buffer, mimeType: string): Promise<Attachment>
  resolveFile(filePath: string): Promise<Attachment | null>
  readTextFileWithRange(path: string, opts?: { line?: number; limit?: number }): Promise<string>
  convertOggToWav(oggData: Buffer): Promise<Buffer>
}
```

---

### @viben/speech

Text-to-speech and speech-to-text with pluggable providers.

- **Service**: `speech` (implements `SpeechServiceInterface`)
- **Dependencies**: `@viben/file-service`
- **Optional dependencies**: none
- **Permissions**: `services:register`, `services:use`, `commands:register`

**What it does**: Provides TTS (text-to-speech) and STT (speech-to-text) capabilities. Ships with two built-in providers: Edge TTS and Groq STT. Community plugins can add more providers via `registerTTSProvider()` / `registerSTTProvider()`.

**Service interface**:

```typescript
interface SpeechServiceInterface {
  textToSpeech(text: string, opts?: { language?: string; voice?: string }): Promise<Buffer>
  speechToText(audio: Buffer, opts?: { language?: string }): Promise<string>
  registerTTSProvider(name: string, provider: TTSProvider): void
  registerSTTProvider(name: string, provider: STTProvider): void
}
```

**Settings**:

| Key | Type | Description |
|-----|------|-------------|
| `stt.provider` | string | STT provider name (default: `'groq'`) |
| `tts.provider` | string | TTS provider name (default: `'edge-tts'`) |

**Commands**: `/tts on|off` -- toggle text-to-speech for the current session.

**Extension point**: Community plugins can add providers:
```typescript
// @community/speech-elevenlabs setup()
const speech = ctx.getService<SpeechServiceInterface>('speech')
speech.registerTTSProvider('elevenlabs', new ElevenLabsTTS())
```

---

### @viben/tunnel

Expose local ports publicly via tunnel providers.

- **Service**: `tunnel` (implements `TunnelServiceInterface`)
- **Dependencies**: none
- **Permissions**: `services:register`, `commands:register`

**What it does**: Creates public URLs for local development servers. Useful when agents need to preview web applications they're building. Ships with providers: Cloudflare Tunnel, ngrok, bore, tailscale.

**Service interface**:

```typescript
interface TunnelServiceInterface {
  getPublicUrl(): string | undefined
  isConnected(): boolean
  start(): Promise<string>   // returns public URL
  stop(): Promise<void>
}
```

**Settings**:

| Key | Type | Description |
|-----|------|-------------|
| `enabled` | boolean | Enable tunnel on startup |
| `provider` | string | Tunnel provider (`'cloudflare'`, `'ngrok'`, `'bore'`, `'tailscale'`) |

**Commands**: `/tunnel start|stop|status`, `/tunnels` -- manage and list tunnels.

---

### @viben/usage

Cost tracking and budget management.

- **Service**: `usage` (implements `UsageService`)
- **Dependencies**: none
- **Permissions**: `services:register`, `events:read`, `commands:register`, `storage:read`, `storage:write`

**What it does**: Tracks API usage costs per session and month. Enforces monthly budgets and sends warnings when approaching limits.

**Service interface**:

```typescript
interface UsageService {
  trackUsage(record: UsageRecord): Promise<void>
  checkBudget(sessionId: string): Promise<{ ok: boolean; percent: number; warning?: string }>
  getSummary(period: string): Promise<UsageSummary>
}
```

**Settings**:

| Key | Type | Description |
|-----|------|-------------|
| `enabled` | boolean | Enable usage tracking |
| `monthlyBudget` | number | Monthly budget in USD |

**Commands**: `/usage` -- view usage summary and budget status.

---

### @viben/notifications

Cross-session notification delivery.

- **Service**: `notifications` (implements `NotificationService`)
- **Dependencies**: none
- **Permissions**: `services:register`, `events:read`

**What it does**: Delivers notifications across sessions. When a session completes, errors, or hits a budget warning, notifications are sent to dedicated notification channels/topics on all active adapters.

**Service interface**:

```typescript
interface NotificationService {
  notify(channelId: string, notification: NotificationMessage): Promise<void>
  notifyAll(notification: NotificationMessage): Promise<void>
}
```

---

### @viben/context

Conversation history and session resume.

- **Service**: `context` (implements `ContextService`)
- **Dependencies**: none
- **Permissions**: `services:register`, `events:read`, `storage:read`, `storage:write`

**What it does**: Stores conversation context and enables session resume. When resuming a session, builds a context summary that can be injected into the new agent's initial prompt. Supports pluggable context providers.

**Service interface**:

```typescript
interface ContextService {
  buildContext(sessionId: string, opts?: { maxTokens?: number }): Promise<string>
  registerProvider(provider: ContextProvider): void
}
```

---

### @viben/api-server

REST API, Server-Sent Events, and authentication for external integrations.

- **Service**: `api-server` (implements `ApiServerService`)
- **Dependencies**: `@viben/security`
- **Permissions**: `services:register`, `kernel:access`, `events:read`

**What it does**: Exposes a Fastify-based REST API with schema validation (Zod), Swagger/OpenAPI documentation, CORS, and rate limiting. Provides session management, prompt delivery, agent events via SSE, JWT authentication, and file viewer routes. Plugins can register additional routes via `ApiServerService.registerPlugin()`.

**Settings**:

| Key | Type | Description |
|-----|------|-------------|
| `port` | number | HTTP port (default: `21420`) |

**Key capabilities**:

- **Structured routes** — `/api/v1/*` endpoints for sessions, agents, config, system, commands, and auth
- **JWT authentication** — two-tier auth with secret token (master key) and scoped JWT access tokens
- **SSE streaming** — real-time session events, agent output, and health pings via `GET /api/v1/sse/sessions/:id/stream`
- **File viewer** — serves file, diff, and output viewer routes (merged from the former standalone viewer server)
- **Plugin extensibility** — plugins register additional Fastify routes via the `ApiServerService`
- **Swagger UI** — auto-generated API documentation at `/docs`

See the [REST API reference](../api-reference/rest-api.md) for the full endpoint list.

---

### SSE Manager (part of @viben/api-server)

The SSE (Server-Sent Events) manager is integrated into the API server plugin rather than being a separate plugin. It provides real-time event streaming for app clients.

**What it does**: Broadcasts session lifecycle events, agent output, and health pings over SSE connections. Supports per-session filtering and automatic cleanup on disconnect.

**Event types**:

| Event | Description |
|-------|-------------|
| `session:created` | A new session was created |
| `session:updated` | Session state changed (status, name, etc.) |
| `session:deleted` | A session was destroyed |
| `agent:event` | Agent output (text, tool calls, errors) |
| `permission:request` | A permission request is pending |
| `health` | Periodic health ping (every 30s) with memory and uptime stats |

**Connection**: `GET /api/v1/sse/sessions/:id/stream?token=<jwt>` for per-session streams, or `GET /api/events?token=<api-secret>` for all events.

**Reconnect support**: A 100-event circular buffer per session enables replay on reconnect — if the client missed fewer than 100 events, they are replayed on reconnection.

---

## Plugin Dependency Graph

```
@viben/security          (no deps)
@viben/file-service      (no deps)
@viben/notifications     (no deps)
@viben/context           (no deps)
@viben/usage             (no deps)
@viben/tunnel            (no deps)
@viben/speech            -> @viben/file-service
@viben/api-server        -> @viben/security
@viben/telegram          -> @viben/security, @viben/file-service
@viben/discord           -> @viben/security, @viben/file-service
@viben/slack             -> @viben/security, @viben/file-service
```

Plugins at the top (no deps) load first. Adapter plugins load last since they depend on services being available.

---

## Further Reading

- [Architecture Overview](README.md) -- high-level picture
- [Plugin System](plugin-system.md) -- how plugins work
- [Writing Plugins](writing-plugins.md) -- build your own
- [Command System](command-system.md) -- how commands are registered and dispatched
