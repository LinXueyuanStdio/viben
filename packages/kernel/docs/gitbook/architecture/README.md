# Architecture Overview

Viben uses a **microkernel architecture**: a thin core provides infrastructure (sessions, events, config, plugin lifecycle), while all features -- adapters, security, speech, tunnels, usage tracking -- are implemented as plugins.

This means:

- **Any feature can be added** without touching core code
- **Any built-in can be replaced** by a community plugin using the `overrides` declaration
- **Each module is self-contained** with explicit dependencies
- **Plugins update independently** of the core

---

## Message Flow

```
User (Telegram/Discord/Slack)
        |
        v
  Adapter Plugin          ← platform SDK listener
        |
        v
  [middleware: message:incoming]
        |
        v
  VibenCore             ← route to session
        |
        v
  Session                 ← prompt queue (serial processing)
        |
        v
  [middleware: agent:beforePrompt]
        |
        v
  AgentInstance            ← ACP subprocess (Claude, etc.)
        |
        v
  AgentEvents emitted
        |
        v
  [middleware: agent:afterEvent]
        |
        v
  MessageTransformer       ← convert to OutgoingMessage
        |
        v
  [middleware: message:outgoing]
        |
        v
  Adapter Plugin           ← deliver to platform
        |
        v
  User sees response
```

Every step marked with `[middleware: ...]` is a hook point where plugins can intercept, modify, or block the flow.

---

## Core vs Plugin Responsibilities

### What stays in core

| Component | Why it's core |
|-----------|---------------|
| **EventBus** | Communication backbone -- must exist before any plugin |
| **ConfigManager** | Plugins need config to know if they're enabled |
| **SessionManager** | Every adapter and plugin interacts with sessions |
| **AgentManager** | ACP subprocess management, tightly coupled with sessions |
| **MessageTransformer** | Core pipeline that transforms agent events to messages |
| **Plugin infrastructure** | LifecycleManager, ServiceRegistry, MiddlewareChain, etc. |

### What lives in plugins

| Plugin | Service | What it does |
|--------|---------|-------------|
| `@viben/telegram` | `adapter:telegram` | Telegram messaging adapter |
| `@viben/discord` | `adapter:discord` | Discord messaging adapter |
| `@viben/slack` | `adapter:slack` | Slack messaging adapter |
| `@viben/security` | `security` | Access control, rate limiting |
| `@viben/file-service` | `file-service` | File I/O for agents |
| `@viben/speech` | `speech` | TTS/STT providers |
| `@viben/tunnel` | `tunnel` | Expose local ports publicly |
| `@viben/usage` | `usage` | Cost tracking and budgets |
| `@viben/notifications` | `notifications` | Cross-session alerts |
| `@viben/context` | `context` | Conversation history/resume |
| `@viben/api-server` | `api-server` | REST API + SSE |

---

## Folder Structure

```
src/
  cli.ts                  — CLI entry point
  main.ts                 — Bootstrap: init infrastructure, boot plugins
  index.ts                — Public API exports

  core/
    config/               — Zod-validated config (core settings only)
    sessions/             — SessionManager, session lifecycle
    agents/               — AgentManager, agent catalog
    plugin/               — Plugin infrastructure
      lifecycle-manager.ts    — Boot/shutdown orchestration
      plugin-loader.ts        — Discovery, validation, topo-sort
      plugin-context.ts       — Scoped PluginContext factory
      service-registry.ts     — Service discovery
      middleware-chain.ts     — 18 hook points
      error-tracker.ts        — Per-plugin error budget
      plugin-storage.ts       — KV store per plugin
      plugin-registry.ts      — Track installed plugins (plugins.json)
      settings-manager.ts     — Per-plugin settings I/O
      types.ts                — All plugin types
    adapter-primitives/   — Shared framework for adapter plugins
      messaging-adapter.ts    — Base class with drafts, queues, tracking
      stream-adapter.ts       — Lightweight base for WebSocket/API
      draft-manager.ts        — Text buffering and batch updates
      send-queue.ts           — Rate-limited send queue
      tool-call-tracker.ts    — Track tool calls for message editing
      activity-tracker.ts     — Thinking indicators
      renderer.ts             — IRenderer + BaseRenderer
    commands/             — System command handlers
    core.ts               — VibenCore orchestrator
    channel.ts            — IChannelAdapter interface
    message-transformer.ts — ACP events to OutgoingMessage
    types.ts              — Shared types + service interfaces

  plugins/
    telegram/             — All Telegram code (adapter + plugin lifecycle)
    discord/              — All Discord code
    slack/                — All Slack code
    security/             — Access control plugin
    file-service/         — File I/O plugin
    speech/               — TTS/STT plugin
    tunnel/               — Port forwarding plugin
    usage/                — Cost tracking plugin
    notifications/        — Cross-session alerts plugin
    context/              — Conversation history plugin
    api-server/           — REST API plugin
    core-plugins.ts       — List of all built-in plugins
```

---

## Boot Sequence

```
1. KERNEL BOOT
   Load config → Init Logger → Init EventBus → Init ServiceRegistry
   → Init MiddlewareChain → Init SessionManager → Init AgentManager

2. PLUGIN DISCOVERY
   Scan built-in plugins → Scan community plugins
   → Check enabled/disabled → Apply overrides
   → Validate dependencies → Topo-sort load order

3. PLUGIN SETUP (dependency order)
   For each plugin: create PluginContext → call setup() (30s timeout)
   → Plugin registers services, middleware, commands, event handlers

4. POST-SETUP
   Emit 'system:commands-ready' → Verify at least one adapter loaded
   → Log startup summary

5. READY
   Emit 'system:ready' → Adapters start accepting messages
```

Shutdown runs in reverse: stop accepting messages, teardown plugins in reverse order, cancel sessions, clean up.

---

## How Pieces Fit Together

The key insight is **inversion of control**. Core does not create services -- plugins do:

```typescript
// OLD: core.ts created everything directly
const guard = new SecurityGuard(config)
const fileService = new FileService(config)
const adapter = new TelegramAdapter(core, config)

// NEW: plugins register themselves during setup()
// security/index.ts
async setup(ctx) {
  const guard = new SecurityGuard(ctx.pluginConfig)
  ctx.registerService('security', guard)
}

// telegram/index.ts
async setup(ctx) {
  const adapter = new TelegramAdapter(core, ctx.pluginConfig)
  core.registerAdapter('telegram', adapter)
  ctx.registerService('adapter:telegram', adapter)
}
```

Core accesses services through the **ServiceRegistry**:

```typescript
class VibenCore {
  get security(): SecurityService | undefined {
    return this.serviceRegistry.get<SecurityService>('security')
  }
}
```

This means any service can be replaced by a community plugin that declares `overrides: '@viben/security'` and registers a different implementation under the same service name.

---

## Further Reading

- [Core Design](core-design.md) -- detailed core module documentation
- [Plugin System](plugin-system.md) -- complete plugin infrastructure guide
- [Command System](command-system.md) -- how chat commands work
- [Built-in Plugins](built-in-plugins.md) -- reference for all 11 plugins
- [Writing Plugins](writing-plugins.md) -- step-by-step guide for plugin authors
