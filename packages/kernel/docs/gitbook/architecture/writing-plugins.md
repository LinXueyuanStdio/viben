# Writing Your Own Plugin — Full API Reference

This is the **complete API reference** for building Viben plugins. It covers every API surface: services, commands, middleware, events, settings, storage, overrides, and publishing.

> **New to plugin development?** Start with [Getting Started: Your First Plugin](../extending/getting-started-plugin.md) — a hands-on tutorial that walks you through scaffolding, developing, testing, and publishing your first plugin. Come back here when you need the full API details.
>
> **Plugin SDK**: For type exports, base classes, and testing utilities, see the [Plugin SDK Reference](../extending/plugin-sdk-reference.md).
>
> **Dev Mode**: For hot-reload development workflow, see the [Dev Mode guide](../extending/dev-mode.md).

---

## Plugin Structure

A plugin is a module that exports an `VibenPlugin` object. At minimum:

```
my-plugin/
  src/
    index.ts          <- exports VibenPlugin
  package.json
  tsconfig.json
```

### Minimal Plugin

```typescript
// src/index.ts
import type { VibenPlugin, PluginContext } from '@viben/kernel'

export default {
  name: '@community/my-plugin',
  version: '1.0.0',
  description: 'My first Viben plugin',
  permissions: [],

  async setup(ctx: PluginContext) {
    ctx.log.info('My plugin loaded!')
  },
} satisfies VibenPlugin
```

This plugin does nothing useful, but it's valid. It loads on boot, logs a message, and that's it.

---

## Declaring Dependencies

If your plugin needs services from other plugins, declare them as dependencies:

```typescript
export default {
  name: '@community/my-plugin',
  version: '1.0.0',

  // Required: must be loaded before your plugin
  pluginDependencies: {
    '@viben/speech': '>=1.0.0',
  },

  // Optional: used if available, graceful degrade if not
  optionalPluginDependencies: {
    '@viben/tunnel': '>=1.0.0',
  },

  permissions: ['services:use'],

  async setup(ctx) {
    // Guaranteed to exist (required dependency)
    const speech = ctx.getService<SpeechServiceInterface>('speech')!

    // May be undefined (optional dependency)
    const tunnel = ctx.getService<TunnelServiceInterface>('tunnel')
    if (tunnel) {
      ctx.log.info('Tunnel available')
    }
  },
} satisfies VibenPlugin
```

### Overriding a built-in

To replace a built-in plugin entirely:

```typescript
export default {
  name: '@community/better-security',
  version: '1.0.0',
  overrides: '@viben/security',  // replaces the built-in security plugin
  permissions: ['services:register', 'events:read', 'middleware:register'],

  async setup(ctx) {
    // Register the same service name the built-in would
    ctx.registerService('security', new MyBetterSecurityGuard())
  },
} satisfies VibenPlugin
```

When `overrides` is set, the overridden plugin's `setup()` never runs. Your plugin takes its place in the dependency graph.

---

## Declaring Permissions

Permissions control what your plugin can do. Only request what you need:

```typescript
permissions: [
  'events:read',          // subscribe to events with ctx.on()
  'events:emit',          // emit events with ctx.emit()
  'services:register',    // provide services with ctx.registerService()
  'services:use',         // consume services with ctx.getService()
  'middleware:register',  // intercept flows with ctx.registerMiddleware()
  'commands:register',    // add chat commands with ctx.registerCommand()
  'storage:read',         // read plugin storage
  'storage:write',        // write plugin storage
  'kernel:access',        // access ctx.sessions, ctx.config, ctx.eventBus
]
```

Calling a method without the required permission throws `PluginPermissionError`, which counts against your error budget.

---

## Using the PluginContext API

### Registering a service

```typescript
async setup(ctx) {
  const myService = new TranslationService()
  ctx.registerService('translation', myService)
}
```

Other plugins can then access your service:

```typescript
const translator = ctx.getService<TranslationService>('translation')
```

### Subscribing to events

```typescript
async setup(ctx) {
  ctx.on('session:afterDestroy', (data) => {
    ctx.log.info(`Session ${data.sessionId} destroyed after ${data.durationMs}ms`)
  })

  ctx.on('system:ready', () => {
    ctx.log.info('System is ready!')
  })
}
```

Event listeners are automatically cleaned up on teardown.

### Emitting events

Community plugins must prefix event names with their plugin name:

```typescript
ctx.emit('@community/my-plugin:translation-complete', {
  sessionId: '123',
  language: 'es',
})
```

Built-in plugins can use short names (e.g., `security:blocked`).

### Sending messages to sessions

```typescript
ctx.sendMessage(sessionId, {
  type: 'system_message',
  text: 'Translation complete!',
})
```

Messages go through the `message:outgoing` middleware chain, so other plugins can modify them before delivery.

---

## Registering Commands

```typescript
async setup(ctx) {
  ctx.registerCommand({
    name: 'translate',
    description: 'Translate last message',
    usage: '<language>',
    category: 'plugin',

    handler: async (args) => {
      const lang = args.raw.trim()
      if (!lang) {
        return { type: 'error', message: 'Usage: /translate <language>' }
      }

      const translated = await translateLastMessage(args.sessionId, lang)
      return { type: 'text', text: translated }
    },
  })
}
```

Your command will be available as `/translate` (if no conflict) and `/my-plugin:translate` (qualified name, always available).

Return a `CommandResponse` object -- adapters handle rendering automatically. See [Command System](command-system.md) for all response types.

---

## Registering Middleware

Middleware lets you intercept and modify the message flow:

```typescript
async setup(ctx) {
  // Translate outgoing messages
  ctx.registerMiddleware('message:outgoing', {
    priority: 50,  // lower = earlier execution within same dependency level
    handler: async (payload, next) => {
      // Modify before downstream handlers
      payload.message.text = await translate(payload.message.text, 'es')

      // Continue the chain
      const result = await next()

      // Observe after downstream (optional)
      return result
    },
  })
}
```

### Blocking a flow

Return `null` to stop the chain:

```typescript
ctx.registerMiddleware('message:incoming', {
  handler: async (payload, next) => {
    if (containsSpam(payload.text)) {
      ctx.log.warn(`Blocked spam from user ${payload.userId}`)
      return null  // message is dropped
    }
    return next()
  },
})
```

### Available hooks

See [Core Design > MiddlewareChain](core-design.md#middlewarechain) for the full list of 18 hook points and their payload types.

---

## Settings Schema and Install Flow

If your plugin needs configuration, define a settings schema and install hook:

```typescript
import { z } from 'zod'

const settingsSchema = z.object({
  apiKey: z.string(),
  targetLanguage: z.string().default('en'),
  autoTranslate: z.boolean().default(false),
})

export default {
  name: '@community/translator',
  version: '1.0.0',
  essential: true,  // requires setup before system can run
  settingsSchema,
  permissions: ['services:register', 'middleware:register'],

  async install(ctx) {
    // Interactive setup -- runs once on install
    const apiKey = await ctx.terminal.password({
      message: 'Enter your translation API key:',
      validate: (v) => v.length > 10 ? undefined : 'Key too short',
    })

    const lang = await ctx.terminal.select({
      message: 'Default target language:',
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
      ],
    })

    await ctx.settings.setAll({
      apiKey,
      targetLanguage: lang,
      autoTranslate: false,
    })

    ctx.terminal.log.success('Translator configured!')
  },

  async configure(ctx) {
    // Reconfiguration -- runs on `viben plugins configure`
    const current = await ctx.settings.getAll()
    // Show menu to change settings...
  },

  async migrate(ctx, oldSettings, oldVersion) {
    // Handle version upgrades
    if (oldVersion === '1.0.0') {
      return { ...oldSettings, autoTranslate: false }  // new field
    }
    return oldSettings
  },

  async setup(ctx) {
    const config = ctx.pluginConfig
    if (!config.apiKey) {
      ctx.log.warn('Translator not configured')
      return
    }
    // Normal startup with validated settings...
  },
} satisfies VibenPlugin
```

### InstallContext

The `install()`, `configure()`, and `uninstall()` hooks receive an `InstallContext`:

```typescript
interface InstallContext {
  pluginName: string
  terminal: TerminalIO        // interactive I/O (text, select, confirm, password)
  settings: SettingsAPI       // read/write plugin settings
  legacyConfig?: Record<string, unknown>  // old config.json data for migration
  dataDir: string             // ~/.viben/plugins/@scope/name/data/
  log: Logger
}
```

### TerminalIO

Wraps `@clack/prompts` for interactive flows:

```typescript
interface TerminalIO {
  text(opts: { message: string; placeholder?: string; validate?: (v: string) => string | undefined }): Promise<string>
  select<T>(opts: { message: string; options: { value: T; label: string }[] }): Promise<T>
  confirm(opts: { message: string }): Promise<boolean>
  password(opts: { message: string; validate?: (v: string) => string | undefined }): Promise<string>
  multiselect<T>(opts: { message: string; options: { value: T; label: string }[] }): Promise<T[]>
  log: { info, success, warning, error, step }
  spinner(): { start, stop, fail }
  note(message: string, title?: string): void
}
```

---

## Using Plugin Storage

For persistent data beyond settings (caches, state, databases):

```typescript
async setup(ctx) {
  // Key-value store
  await ctx.storage.set('lastRun', Date.now())
  const lastRun = await ctx.storage.get<number>('lastRun')

  // Data directory for files
  const dataDir = ctx.storage.getDataDir()
  // dataDir = ~/.viben/plugins/data/@community/my-plugin/
  // Store SQLite databases, large files, etc.
}
```

---

## Testing Your Plugin

Create a test file alongside your plugin:

```typescript
// src/__tests__/my-plugin.test.ts
import { describe, it, expect, vi } from 'vitest'
import plugin from '../index.js'

function mockPluginContext() {
  return {
    pluginName: '@community/my-plugin',
    pluginConfig: { apiKey: 'test-key' },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    registerService: vi.fn(),
    getService: vi.fn(),
    registerMiddleware: vi.fn(),
    registerCommand: vi.fn(),
    sendMessage: vi.fn(),
    storage: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getDataDir: vi.fn().mockReturnValue('/tmp/test-data'),
    },
  } as any
}

describe('my-plugin', () => {
  it('registers service on setup', async () => {
    const ctx = mockPluginContext()
    await plugin.setup(ctx)
    expect(ctx.registerService).toHaveBeenCalledWith('translation', expect.anything())
  })

  it('registers commands on setup', async () => {
    const ctx = mockPluginContext()
    await plugin.setup(ctx)
    expect(ctx.registerCommand).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'translate' })
    )
  })
})
```

---

## Publishing to npm

### package.json

```json
{
  "name": "@community/viben-translator",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js"
  },
  "peerDependencies": {
    "@viben/kernel": ">=2026.0326.0"
  },
  "keywords": ["viben", "viben-plugin"]
}
```

### Build and publish

```bash
# Build
tsc

# Test
vitest run

# Publish
npm publish --access public
```

### Users install your plugin

```bash
viben plugins install @community/viben-translator
```

This runs `npm install` into `~/.viben/plugins/`, validates the plugin interface, and calls `install()` if the plugin has `essential: true`.

---

## Checklist

Before publishing:

- [ ] Plugin exports an `VibenPlugin` object (default export)
- [ ] `name` follows `@scope/name` convention
- [ ] `version` is valid semver
- [ ] `permissions` only includes what's needed
- [ ] `pluginDependencies` declares all required plugins
- [ ] `settingsSchema` validates all settings (if applicable)
- [ ] `install()` handles both fresh install and legacy migration
- [ ] `migrate()` handles version upgrades
- [ ] `teardown()` cleans up resources (timers, connections)
- [ ] Tests cover setup, commands, and error cases
- [ ] `package.json` has `@viben/kernel` as peer dependency

---

## Further Reading

- [Getting Started: Your First Plugin](../extending/getting-started-plugin.md) -- scaffold, develop, test, and publish
- [Plugin SDK Reference](../extending/plugin-sdk-reference.md) -- types, base classes, and testing utilities
- [Dev Mode](../extending/dev-mode.md) -- hot-reload development workflow
- [Plugin System](plugin-system.md) -- complete plugin infrastructure
- [Command System](command-system.md) -- command registration and rendering
- [Built-in Plugins](built-in-plugins.md) -- examples of real plugins
- [Core Design](core-design.md) -- core modules your plugin interacts with
