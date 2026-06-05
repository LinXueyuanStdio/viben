# Plugin Setup Workflow Design

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Phase 2b Plugin System (`2026-03-26-phase2b-plugin-system.md`)

## Overview

Design a plugin setup workflow that allows each plugin to manage its own installation, configuration, settings persistence, and migration independently. Core orchestrates lifecycle hooks but does not know plugin-specific details.

### Goals

1. Each plugin fully owns its install/configure/uninstall flow
2. Per-plugin `settings.json` replaces shared `config.json` for plugin settings
3. Built-in plugins use CLI-orchestrated first-run setup (user-friendly, guided)
4. Community plugins use `essential` flag for post-install setup
5. Settings accessible via API for future Web UI
6. Transparent migration from legacy `config.json` on first boot

### Non-Goals

- Auto-generated UI from schema (plugins write their own interactive flows)
- Web UI implementation (only API endpoints defined)
- Community plugin marketplace/discovery

---

## 1. Plugin Interface Extensions

### New Lifecycle Hooks

```typescript
interface VibenPlugin {
  // === Identity (existing) ===
  name: string
  version: string
  description?: string
  pluginDependencies?: Record<string, string>
  optionalPluginDependencies?: Record<string, string>
  overrides?: string
  permissions: PluginPermission[]

  // === Runtime (existing) ===
  setup(ctx: PluginContext): Promise<void>
  teardown?(): Promise<void>

  // === NEW: Lifecycle hooks ===
  install?(ctx: InstallContext): Promise<void>
  uninstall?(ctx: InstallContext, opts: { purge: boolean }): Promise<void>
  configure?(ctx: InstallContext): Promise<void>
  migrate?(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown>

  // === NEW: Settings ===
  settingsSchema?: ZodSchema    // validation only, not UI generation
  essential?: boolean            // true = needs setup before system can run
}
```

### Hook Lifecycle Table

| Hook | Trigger | Has Settings? | Has Services? | Interactive? |
|------|---------|---------------|---------------|-------------|
| `install()` | `viben plugins install <name>` or first-run | No (creating) | No | Yes |
| `configure()` | `viben plugins configure <name>` | Yes (read/write) | No | Yes |
| `migrate()` | Boot — version mismatch detected | Yes (old data) | No | No |
| `setup()` | Every boot, after migrate | Yes (validated) | Yes | No |
| `teardown()` | Shutdown | Yes | Yes | No |
| `uninstall()` | `viben plugins uninstall <name>` | Yes | No | Yes |

### Boot Sequence (Updated)

```
Load plugin code from registry
  → Check plugins.json: stored version vs plugin.version
  → Version mismatch? → call plugin.migrate(migrateCtx, oldSettings, oldVersion)
                       → Plugin returns new settings → core writes to settings.json
                       → Update plugins.json version
  → Validate settings against settingsSchema (if provided)
  → Create PluginContext with settings from settings.json
  → Call plugin.setup(pluginContext)
```

---

## 2. InstallContext & TerminalIO

### InstallContext

Provided to `install()`, `configure()`, and `uninstall()`. Does NOT have core/services access (system not booted yet).

```typescript
interface InstallContext {
  pluginName: string
  terminal: TerminalIO              // interactive I/O
  settings: SettingsAPI             // read/write plugin settings
  legacyConfig?: Record<string, unknown>  // old config.json data for migration
  dataDir: string                   // ~/.viben/plugins/@scope/name/data/
  log: Logger
}
```

**`legacyConfig`**: On first boot after upgrade, core extracts plugin-relevant fields from old `config.json` and passes them here. Plugin decides how to migrate. Mapping uses existing `plugin-config-migration.ts` paths:

| Plugin | Legacy config path |
|--------|-------------------|
| `@viben/telegram` | `config.channels.telegram` |
| `@viben/discord` | `config.channels.discord` |
| `@viben/slack` | `config.channels.slack` |
| `@viben/speech` | `config.speech` |
| `@viben/tunnel` | `config.tunnel` |
| `@viben/usage` | `config.usage` |
| `@viben/api-server` | `config.api` |
| `@viben/security` | `config.security` |

After all built-in plugins migrate, core strips these fields from `config.json`.

### TerminalIO

Wraps `@clack/prompts` for plugin interactive flows.

```typescript
interface TerminalIO {
  // Input
  text(opts: {
    message: string
    placeholder?: string
    defaultValue?: string
    validate?: (value: string) => string | undefined
  }): Promise<string>

  select<T>(opts: {
    message: string
    options: { value: T; label: string; hint?: string }[]
  }): Promise<T>

  confirm(opts: {
    message: string
    initialValue?: boolean
  }): Promise<boolean>

  password(opts: {
    message: string
    validate?: (value: string) => string | undefined
  }): Promise<string>

  multiselect<T>(opts: {
    message: string
    options: { value: T; label: string; hint?: string }[]
    required?: boolean
  }): Promise<T[]>

  // Output
  log: {
    info(message: string): void
    success(message: string): void
    warning(message: string): void
    error(message: string): void
    step(message: string): void
  }

  spinner(): {
    start(message: string): void
    stop(message?: string): void
    fail(message?: string): void
  }

  // Display
  note(message: string, title?: string): void
  cancel(message?: string): void
}
```

### SettingsAPI

Typed read/write for per-plugin settings. Persists to `~/.viben/plugins/@scope/name/settings.json`.

```typescript
interface SettingsAPI {
  get<T = unknown>(key: string): Promise<T | undefined>
  set<T = unknown>(key: string, value: T): Promise<void>
  getAll(): Promise<Record<string, unknown>>
  setAll(settings: Record<string, unknown>): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  has(key: string): Promise<boolean>
}
```

---

## 3. MigrateContext

Lightweight — runs at boot time, no interactive I/O.

```typescript
interface MigrateContext {
  pluginName: string
  settings: SettingsAPI
  log: Logger
}
```

### Migration Flow

```
Boot → Load plugin code → Read plugins.json
  → Stored version "1.0.0" vs plugin.version "2.0.0"
  → Read current settings.json → pass as oldSettings
  → Call plugin.migrate(migrateCtx, oldSettings, "1.0.0")
  → Plugin returns transformed settings
  → Core writes new settings to settings.json
  → Core updates plugins.json version to "2.0.0"
```

### Plugin Migration Example

```typescript
async migrate(ctx, oldSettings, oldVersion) {
  const old = oldSettings as Record<string, unknown>

  if (oldVersion === '1.0.0') {
    // v1 → v2: rename field, add new field
    return {
      botToken: old.botToken,
      groupId: old.chatId,           // renamed
      displayVerbosity: old.displayVerbosity ?? 'medium',
      webhookMode: false,             // new field
    }
  }

  // Unknown version — return as-is
  return oldSettings
}
```

**Key principle:** Plugin handles ALL migration logic. Core only detects version mismatch and calls `migrate()`. No auto-merge, no magic defaults.

---

## 4. Plugin Registry

### `~/.viben/plugins.json`

```json
{
  "installed": {
    "@viben/telegram": {
      "version": "1.0.0",
      "installedAt": "2026-03-26T10:00:00Z",
      "updatedAt": "2026-03-26T10:00:00Z",
      "source": "builtin",
      "enabled": true,
      "settingsPath": "~/.viben/plugins/@viben/telegram/settings.json",
      "description": "Telegram messaging adapter"
    },
    "@community/translator": {
      "version": "2.1.0",
      "installedAt": "2026-03-26T12:00:00Z",
      "updatedAt": "2026-03-26T12:00:00Z",
      "source": "npm",
      "enabled": true,
      "settingsPath": "~/.viben/plugins/@community/translator/settings.json",
      "description": "Auto-translate messages"
    }
  }
}
```

### PluginRegistry Class

```typescript
interface PluginEntry {
  version: string
  installedAt: string
  updatedAt: string
  source: 'builtin' | 'npm' | 'local'
  enabled: boolean
  settingsPath: string
  description?: string
}

class PluginRegistry {
  constructor(registryPath: string)  // ~/.viben/plugins.json

  // CRUD
  list(): Map<string, PluginEntry>
  get(name: string): PluginEntry | undefined
  register(name: string, entry: Omit<PluginEntry, 'installedAt' | 'updatedAt'>): void
  remove(name: string): void

  // State
  setEnabled(name: string, enabled: boolean): void
  updateVersion(name: string, version: string): void

  // Query
  listEnabled(): Map<string, PluginEntry>
  listBySource(source: PluginEntry['source']): Map<string, PluginEntry>

  // Persistence
  load(): Promise<void>
  save(): Promise<void>
}
```

---

## 5. Settings Persistence

### Directory Structure

```
~/.viben/
  config.json                              ← core settings ONLY
  plugins.json                             ← Plugin Registry
  plugins/
    @viben/
      telegram/
        settings.json                      ← plugin settings (managed by SettingsAPI)
        data/                              ← plugin data dir (cache, files, etc.)
      speech/
        settings.json
        data/
      discord/
        settings.json
        data/
      tunnel/
        settings.json
        data/
    @community/
      translator/
        settings.json
        data/
```

### SettingsManager

Core module that creates SettingsAPI instances per plugin.

```typescript
class SettingsManager {
  constructor(basePath: string)  // ~/.viben/plugins/

  // Factory
  createAPI(pluginName: string): SettingsAPI

  // For LifecycleManager (boot)
  loadSettings(pluginName: string): Promise<Record<string, unknown>>
  validateSettings(pluginName: string, settings: unknown, schema?: ZodSchema): ValidationResult

  // For Web UI / API
  getPluginSettings(pluginName: string): Promise<Record<string, unknown>>
  updatePluginSettings(pluginName: string, updates: Record<string, unknown>): Promise<void>
  getSettingsPath(pluginName: string): string
}
```

### Validation

If plugin provides `settingsSchema` (Zod), core validates after:
1. `migrate()` returns new settings
2. `install()` completes (validate what plugin saved)
3. API/Web UI updates settings

Validation failure → log warning + prevent boot (plugin marked as failed).

---

## 6. config.json Simplification

### Before (current — everything in one file)

```json
{
  "channels": {
    "telegram": { "botToken": "...", "chatId": "...", "displayVerbosity": "medium" },
    "discord": { "botToken": "...", "guildId": "..." }
  },
  "defaultAgent": "claude-code",
  "workspace": { "baseDir": "~/viben-workspace" },
  "security": { "allowedUserIds": ["123"], "maxConcurrentSessions": 3 },
  "logging": { "level": "info" },
  "runMode": "foreground",
  "speech": { "stt": { "provider": "groq" }, "tts": { "provider": "edge-tts" } },
  "tunnel": { "enabled": true, "provider": "cloudflare" },
  "usage": { "enabled": true, "monthlyBudget": 50 },
  "api": { "port": 21420 }
}
```

### After (core only)

```json
{
  "defaultAgent": "claude-code",
  "workspace": { "baseDir": "~/viben-workspace" },
  "security": { "allowedUserIds": ["123"], "maxConcurrentSessions": 3 },
  "logging": { "level": "info", "logDir": "~/.viben/logs", "maxFileSize": "10m", "maxFiles": 7, "sessionLogRetentionDays": 30 },
  "runMode": "foreground",
  "autoStart": false,
  "sessionStore": { "ttlDays": 30 }
}
```

Plugin-specific fields moved to respective `settings.json` files.

---

## 7. First-Run Setup Flow

### Built-in Plugins: CLI Orchestrated

CLI controls the order for a user-friendly experience. Each plugin's `install()` handles its own interactive steps.

```
$ viben

"Let's set up Viben"

Step 1: "Which messaging platform do you want to use?"
  → Telegram / Discord / Both

  if Telegram selected:
    → telegramPlugin.install(ctx)
      Plugin handles: ask token → verify → ask chatId → auto-detect → save settings

  if Discord selected:
    → discordPlugin.install(ctx)
      Plugin handles: ask token → ask guildId → verify → save settings

Step 2: "Choose your AI agent"
  → detectAgents() → user selects → save to config.json

Step 3: "Set workspace directory"
  → core setup → save to config.json

Step 4: "Run mode"
  → foreground/daemon → save to config.json

Register all installed plugins in plugins.json
→ Start server
```

**Key:** CLI knows the ORDER (platform → agent → workspace → runMode) but delegates DETAILS to `plugin.install()`. This keeps UX friendly while plugins remain independent.

### Community Plugins: Self-Contained

```
$ viben plugins install @community/whatsapp

1. npm install → ~/.viben/plugins/node_modules/
2. Load plugin module → validate VibenPlugin interface
3. If plugin.essential === true:
   → Call plugin.install(ctx) — plugin runs its own interactive setup
4. If plugin.essential === false:
   → Register in plugins.json, skip install (optional plugin)
   → User can run `viben plugins configure @community/whatsapp` later
5. Register in plugins.json (version, source, settingsPath, enabled: true)
6. "Plugin installed! Restart to activate."
```

### Onboard / Reconfigure

```
$ viben onboard

1. Load plugins.json → show current state
2. Menu:
   [Core Settings]     — workspace, logging, security, runMode
   [Telegram]          — (installed, enabled) → call configure()
   [Discord]           — (installed, disabled) → call configure() or enable
   [Speech]            — (installed, not configured) → call install()
   [Install Plugin]    → prompt for plugin name → npm install + install()
3. User navigates, makes changes
4. "Restart to apply changes"
```

---

## 8. Uninstall Flow

```
$ viben plugins uninstall @community/translator
$ viben plugins uninstall @community/translator --purge
```

### Flow

```
1. Load plugin module
2. Create InstallContext (terminal, settings, dataDir)
3. Call plugin.uninstall(ctx, { purge: false })
   → Plugin cleans up: revoke webhooks, delete downloaded binaries, etc.
   → If purge: plugin also calls ctx.settings.clear()
4. If purge: core deletes entire plugin directory (~/.viben/plugins/@community/translator/)
5. Remove from plugins.json
6. npm uninstall (if source === 'npm')
```

### Built-in plugins

Cannot be uninstalled (source === 'builtin'). Can only be disabled:

```
$ viben plugins disable @viben/speech
→ Set enabled: false in plugins.json
→ Plugin skipped during boot
```

---

## 9. Web UI API Endpoints

For future Web UI to manage plugin settings.

```
GET  /api/plugins                         → list all plugins from registry
GET  /api/plugins/:name                   → plugin entry + current settings
GET  /api/plugins/:name/schema            → Zod schema → JSON Schema conversion
PUT  /api/plugins/:name/settings          → update settings, validate, persist
POST /api/plugins/:name/enable            → set enabled: true
POST /api/plugins/:name/disable           → set enabled: false

GET  /api/config                          → core config.json (simplified)
PUT  /api/config                          → update core config
```

Schema endpoint converts Zod to JSON Schema for frontend form auto-generation:

```json
GET /api/plugins/@viben/telegram/schema
{
  "type": "object",
  "properties": {
    "botToken": { "type": "string", "description": "Telegram Bot Token from @BotFather" },
    "chatId": { "type": "string", "description": "Supergroup Chat ID" },
    "displayVerbosity": { "type": "string", "enum": ["low", "medium", "high"], "default": "medium" }
  },
  "required": ["botToken", "chatId"]
}
```

---

## 10. Plugin Install Example: Telegram

Complete example showing how the Telegram adapter plugin implements all lifecycle hooks.

```typescript
import { z } from 'zod'
import type { VibenPlugin, InstallContext, MigrateContext } from '@viben/kernel'

const settingsSchema = z.object({
  botToken: z.string(),
  chatId: z.string(),
  displayVerbosity: z.enum(['low', 'medium', 'high']).default('medium'),
  enabled: z.boolean().default(true),
})

export default {
  name: '@viben/telegram',
  version: '1.0.0',
  description: 'Telegram messaging adapter',
  essential: true,
  permissions: ['services:register', 'kernel:access', 'events:read', 'events:emit'],
  settingsSchema,

  async install(ctx: InstallContext) {
    // Legacy migration — if upgrading from old config.json
    if (ctx.legacyConfig?.botToken && ctx.legacyConfig?.chatId) {
      await ctx.settings.setAll({
        botToken: ctx.legacyConfig.botToken,
        chatId: ctx.legacyConfig.chatId,
        displayVerbosity: ctx.legacyConfig.displayVerbosity ?? 'medium',
        enabled: true,
      })
      ctx.terminal.log.success('Migrated Telegram settings from config.json')
      return
    }

    // Fresh install — interactive setup
    ctx.terminal.note('Telegram Adapter Setup', 'Step 1')

    const token = await ctx.terminal.password({
      message: 'Enter Telegram Bot Token (from @BotFather):',
      validate: (v) => v.match(/^\d+:[\w-]+$/) ? undefined : 'Invalid token format',
    })

    const spinner = ctx.terminal.spinner()
    spinner.start('Verifying bot token...')
    try {
      const botInfo = await verifyBotToken(token)
      spinner.stop(`Bot verified: @${botInfo.username}`)
    } catch {
      spinner.fail('Invalid bot token')
      ctx.terminal.cancel('Setup cancelled')
      return
    }

    const chatId = await ctx.terminal.text({
      message: 'Enter Telegram Chat ID:',
      placeholder: '-100xxxxxxxxxx',
      validate: (v) => v.startsWith('-100') ? undefined : 'Must be a supergroup ID (starts with -100)',
    })

    await ctx.settings.setAll({
      botToken: token,
      chatId,
      displayVerbosity: 'medium',
      enabled: true,
    })

    ctx.terminal.log.success('Telegram adapter configured!')
  },

  async configure(ctx: InstallContext) {
    const current = await ctx.settings.getAll()

    const action = await ctx.terminal.select({
      message: 'What do you want to change?',
      options: [
        { value: 'token', label: 'Bot Token', hint: current.botToken ? 'Set' : 'Not set' },
        { value: 'chatId', label: 'Chat ID', hint: String(current.chatId ?? 'Not set') },
        { value: 'verbosity', label: 'Display Verbosity', hint: String(current.displayVerbosity ?? 'medium') },
      ],
    })

    switch (action) {
      case 'token': {
        const token = await ctx.terminal.password({ message: 'Enter new Bot Token:' })
        const spinner = ctx.terminal.spinner()
        spinner.start('Verifying...')
        try {
          await verifyBotToken(token)
          spinner.stop('Verified')
          await ctx.settings.set('botToken', token)
        } catch {
          spinner.fail('Invalid token')
        }
        break
      }
      case 'chatId': {
        const chatId = await ctx.terminal.text({
          message: 'Enter new Chat ID:',
          defaultValue: String(current.chatId ?? ''),
        })
        await ctx.settings.set('chatId', chatId)
        break
      }
      case 'verbosity': {
        const v = await ctx.terminal.select({
          message: 'Display verbosity:',
          options: [
            { value: 'low', label: 'Low', hint: 'Only results' },
            { value: 'medium', label: 'Medium', hint: 'Results + tool calls' },
            { value: 'high', label: 'High', hint: 'Everything' },
          ],
        })
        await ctx.settings.set('displayVerbosity', v)
        break
      }
    }

    ctx.terminal.log.success('Settings updated! Restart to apply.')
  },

  async migrate(ctx: MigrateContext, oldSettings: unknown, oldVersion: string) {
    // Handle version-specific migrations
    // Return transformed settings
    return oldSettings
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
    ctx.terminal.log.info('Cleaning up Telegram adapter...')
    // Revoke webhook if set, clean up any external resources
    if (opts.purge) {
      await ctx.settings.clear()
      ctx.terminal.log.info('Settings purged')
    }
    ctx.terminal.log.success('Telegram adapter uninstalled')
  },

  async setup(pluginCtx) {
    const config = pluginCtx.pluginConfig as Record<string, unknown>
    if (!config.botToken || !config.chatId) {
      pluginCtx.log.warn('Telegram not configured — run: viben plugins configure @viben/telegram')
      return
    }
    // Normal adapter startup...
  },
} satisfies VibenPlugin
```

---

## 11. Legacy Migration Strategy

### First Boot After Upgrade

```
1. Core detects: config.json has plugin fields (channels, speech, tunnel, etc.)
   AND plugins.json does NOT exist

2. Create plugins.json — auto-register all built-in plugins

3. For each built-in plugin:
   a. Extract legacy config from config.json using plugin-config-migration.ts mappings
   b. Call plugin.install(ctx) with legacyConfig set
   c. Plugin reads legacyConfig → saves to settings.json → done (no interactive prompts)

4. Strip plugin-specific fields from config.json (keep core only)

5. Save cleaned config.json + plugins.json

6. Normal boot continues
```

### Edge Cases

- **Plugin install() fails during migration**: Log error, keep legacy config intact for that plugin, continue with others. User can retry with `viben plugins configure <name>`.
- **Partial migration (crash mid-way)**: On next boot, core checks each plugin: has settings.json? If not, re-attempt migration from legacy config.
- **config.json already clean + plugins.json exists**: Skip migration entirely. Normal boot.
- **User manually edited plugins.json**: Core respects it. No auto-override.

---

## 12. Changes to Existing Modules

### `src/core/plugin/types.ts`
- Add `install()`, `uninstall()`, `configure()`, `migrate()` to VibenPlugin
- Add `settingsSchema` and `essential` fields
- Add `InstallContext`, `MigrateContext` interfaces
- Add `TerminalIO`, `SettingsAPI` interfaces

### `src/core/plugin/lifecycle-manager.ts`
- Before `setup()`: check version mismatch → call `migrate()`
- Read plugin config from SettingsManager instead of ConfigManager
- Use PluginRegistry for plugin discovery

### `src/core/plugin/plugin-loader.ts`
- Add `installPlugin()` flow: npm install → load → validate → call install()
- Add `uninstallPlugin()` flow: call uninstall() → npm remove → deregister
- Add `configurePlugin()` flow: load → create InstallContext → call configure()

### `src/core/plugin/plugin-context.ts`
- `pluginConfig` reads from per-plugin `settings.json` via SettingsManager

### `src/core/setup/wizard.ts`
- Refactor: core settings only (workspace, logging, security, runMode)
- Delegate platform setup to `plugin.install()` via InstallContext
- Keep user-friendly guided flow: CLI knows ORDER, plugins know DETAILS

### `src/main.ts`
- First boot: init PluginRegistry, detect legacy migration, auto-register built-ins
- Pass SettingsManager to LifecycleManager

### `src/cli/commands/` (plugins command)
- Add `plugins configure <name>`
- Add `plugins enable <name>` / `plugins disable <name>`
- Update `plugins install` to call `plugin.install()`
- Update `plugins uninstall` to support `--purge` flag

### `src/core/config/config.ts`
- Remove plugin-specific Zod fields (channels, speech, tunnel, usage, api)
- Keep core-only schema
- Remove env overrides for plugin fields (VIBEN_TELEGRAM_BOT_TOKEN, etc.)
  - Plugins handle their own env overrides in `setup()`:
    ```typescript
    async setup(ctx) {
      const token = process.env.VIBEN_TELEGRAM_BOT_TOKEN ?? ctx.pluginConfig.botToken
    }
    ```

---

## 13. New Modules

| Module | File | Responsibility |
|--------|------|----------------|
| PluginRegistry | `src/core/plugin/plugin-registry.ts` | Track installed plugins, versions, enabled state. Persists to `plugins.json` |
| SettingsManager | `src/core/plugin/settings-manager.ts` | Per-plugin settings I/O, validation, factory for SettingsAPI |
| InstallContext factory | `src/core/plugin/install-context.ts` | Create InstallContext with TerminalIO + SettingsAPI |
| TerminalIO | `src/core/plugin/terminal-io.ts` | Wrap @clack/prompts for plugin interactive flows |

---

## 14. Testing Strategy

### Unit Tests

- **PluginRegistry**: register/remove/enable/disable, persistence to file, load from existing
- **SettingsManager**: create API, read/write/validate, per-plugin isolation
- **SettingsAPI**: get/set/getAll/setAll/delete/clear/has
- **TerminalIO**: mock @clack/prompts, verify delegation
- **InstallContext**: creation, legacyConfig passing, dataDir resolution

### Integration Tests

- **Install flow**: npm install → plugin.install() → settings saved → registry updated
- **Migration flow**: version mismatch → migrate() called → settings updated → version bumped
- **Legacy migration**: old config.json → first boot → per-plugin settings.json created → config.json cleaned
- **Uninstall flow**: uninstall() called → settings cleared (purge) or kept → registry removed
- **Configure flow**: configure() called → settings modified → persisted
- **Boot with disabled plugin**: plugin in registry but enabled=false → skip setup()

### Edge Case Tests

- Plugin install() throws → registry not updated, clean state
- Plugin migrate() throws → keep old settings, log error, continue boot
- Plugin with missing settings.json → skip setup(), log warning
- Concurrent settings writes → safe (single-process, sequential)
- settings.json manually corrupted → validation catches, plugin marked failed
