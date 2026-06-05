# Config Legacy Removal Design

**Date:** 2026-04-05
**Scope:** Viben core + all built-in plugins

## Problem

The config system has evolved through three layers that now coexist awkwardly:

1. **`config.json`** (original) — contains channels, security, speech, tunnel, usage, api sections
2. **Plugin settings files** (`~/.viben/plugins/<name>/settings.json`) — the intended destination for all plugin config
3. **`plugin-config-migration.ts`** — scaffolding for migrating layer 1 → layer 2, never integrated

This creates several pain points:
- Same env vars (e.g. `VIBEN_TELEGRAM_BOT_TOKEN`) handled in two places: `applyEnvOverrides()` and `applyEnvToPluginSettings()`
- Dual-source fields: some values can exist in either `config.json` or plugin settings, making reads ambiguous
- Every plugin `install()` hook has boilerplate to check `ctx.legacyConfig` and manually migrate old fields
- `config-registry.ts` hardcodes plugin-specific editable fields that belong to the plugins themselves

## Goals

- Single source of truth per field: core fields live in `config.json`, plugin fields live in plugin settings
- Single env override path per field: no duplicate handling
- Plugins self-declare their editable fields instead of relying on a central registry
- Remove unused migration scaffolding and legacy compatibility code

## Non-Goals

- Backward compatibility with old `config.json` format (assumed all users already migrated)
- Changes to the plugin settings file format or SettingsManager API
- Changes to how agents are stored (agents.json is separate)

## Approach: Two-Phase Config First

### Phase 1 — Core Cleanup

#### 1.1 ConfigSchema Cleanup

Remove these sections from `ConfigSchema` in `config.ts`:

| Section | Moves to plugin |
|---------|----------------|
| `channels` (telegram, discord, slack, etc.) | `@viben/telegram`, `@viben/discord`, `@viben/slack` |
| `security` | `@viben/security` |
| `speech` | `@viben/speech` |
| `tunnel` | `@viben/tunnel` |
| `usage` | `@viben/usage` |
| `api` | `@viben/api-server` |

**ConfigSchema after cleanup** retains only core fields:
```
instanceName, defaultAgent, workspace, logging,
runMode, autoStart, sessionStore, integrations,
agentSwitch, outputMode
```

Note: `agents` field is already empty after the `migrate-agents-to-store` migration (agents live in `agents.json`). Remove it from schema too.

#### 1.2 Config Migrations Cleanup

Remove these migrations from `config-migrations.ts` (no longer needed):
- `add-tunnel-section`
- `fix-agent-commands`
- `migrate-agents-to-store`
- `migrate-display-verbosity-to-output-mode`
- `migrate-tunnel-provider-to-viben`

**Keep:** `add-instance-name` (still relevant for new users who have never run setup)

If no migrations remain besides `add-instance-name`, simplify `config-migrations.ts` accordingly.

#### 1.3 Delete Unused Files

- Delete `src/core/config/plugin-config-migration.ts` (unused scaffolding, never integrated)

#### 1.4 Env Vars Cleanup

**`applyEnvOverrides()` — core fields only:**

| Env Var | Config Path |
|---------|------------|
| `VIBEN_DEFAULT_AGENT` | `defaultAgent` |
| `VIBEN_RUN_MODE` | `runMode` |
| `VIBEN_LOG_LEVEL` | `logging.level` |
| `VIBEN_LOG_DIR` | `logging.logDir` |
| `VIBEN_DEBUG` | `logging.level = "debug"` (if no `VIBEN_LOG_LEVEL`) |

Remove from `applyEnvOverrides()`: all channel tokens, `VIBEN_TUNNEL_*`, `VIBEN_API_PORT`, `VIBEN_SPEECH_*`.

**`applyEnvToPluginSettings()` — plugin fields only (unchanged mapping):**

| Env Var | Plugin | Settings Key |
|---------|--------|-------------|
| `VIBEN_TELEGRAM_BOT_TOKEN` | `@viben/telegram` | `botToken` |
| `VIBEN_TELEGRAM_CHAT_ID` | `@viben/telegram` | `chatId` (Number) |
| `VIBEN_DISCORD_BOT_TOKEN` | `@viben/discord` | `botToken` |
| `VIBEN_DISCORD_GUILD_ID` | `@viben/discord` | `guildId` |
| `VIBEN_SLACK_BOT_TOKEN` | `@viben/slack` | `botToken` |
| `VIBEN_SLACK_APP_TOKEN` | `@viben/slack` | `appToken` |
| `VIBEN_SLACK_SIGNING_SECRET` | `@viben/slack` | `signingSecret` |
| `VIBEN_TUNNEL_ENABLED` | `@viben/tunnel` | `enabled` (Boolean) |
| `VIBEN_TUNNEL_PORT` | `@viben/tunnel` | `port` (Number) |
| `VIBEN_TUNNEL_PROVIDER` | `@viben/tunnel` | `provider` |
| `VIBEN_API_PORT` | `@viben/api-server` | `port` (Number) |
| `VIBEN_SPEECH_STT_PROVIDER` | `@viben/speech` | `sttProvider` |
| `VIBEN_SPEECH_GROQ_API_KEY` | `@viben/speech` | `groqApiKey` |

Each env var now handled in exactly one place.

#### 1.5 Test Updates (Phase 1)

- Remove test cases for deleted migrations
- Remove assertions for plugin-specific env vars that moved out of `applyEnvOverrides()`
- Do not change test structure or add new test logic

---

### Phase 2 — Plugin API

#### 2.1 Plugin Field Declaration API

Add `registerEditableFields()` to `PluginContext`:

```typescript
interface FieldDef {
  key: string;          // settings key, e.g. "botToken"
  displayName: string;  // UI label
  type: "toggle" | "select" | "number" | "string";
  scope: "safe" | "sensitive";
  hotReload?: boolean;  // default: false
  options?: string[];   // for "select" type only
}

// In PluginContext:
registerEditableFields(fields: FieldDef[]): void;
```

Plugins call this in `setup()`:

```typescript
async setup(ctx) {
  ctx.registerEditableFields([
    { key: "botToken", displayName: "Bot Token", type: "string", scope: "sensitive" },
    { key: "chatId",   displayName: "Chat ID",   type: "number", scope: "safe" },
  ]);
  // ... rest of setup
}
```

The registry stores `Map<pluginName, FieldDef[]>` accessible by the API/config editor.

#### 2.2 config-registry.ts Cleanup

Remove all plugin-mapped field definitions. Keep only core fields:
- `defaultAgent`
- `logging.level`
- `workspace.baseDir`
- `sessionStore.ttlDays`
- `agentSwitch.labelHistory`
- `outputMode` (global default)

Remove the `plugin?: { name, key }` mapping from `ConfigFieldDef` if no core field uses it after cleanup.

#### 2.3 Plugin `install()` Cleanup

Remove `legacyConfig` from `InstallContext`. Update these plugins:

| Plugin | Change |
|--------|--------|
| `@viben/telegram` | Remove `legacyConfig.channels.telegram` migration branch |
| `@viben/discord` | Remove `legacyConfig.channels.discord` migration branch |
| `@viben/slack` | Remove `legacyConfig.channels.slack` migration branch |
| `@viben/security` | Remove `legacyConfig.security` migration branch |
| `@viben/speech` | Remove `legacyConfig.speech` migration branch |
| `@viben/tunnel` | Remove `legacyConfig.tunnel` migration branch |
| `@viben/usage` | Remove `legacyConfig.usage` migration branch |
| `@viben/api-server` | Remove `legacyConfig.api` migration branch |

Each plugin's `install()` retains only the interactive setup path.

Add `registerEditableFields()` calls to each plugin's `setup()` based on their `settingsSchema`.

#### 2.4 Test Updates (Phase 2)

- Remove test branches that exercise legacy migration paths in plugin `install()`
- Do not change interactive setup test logic
- Add minimal tests for `registerEditableFields()` registration (that fields appear in registry)

---

## File Impact Summary

### Phase 1
- `src/core/config/config.ts` — remove schema sections, slim down `applyEnvOverrides()`
- `src/core/config/config-migrations.ts` — remove 5 migrations, keep `add-instance-name`
- `src/core/config/plugin-config-migration.ts` — **delete**
- `src/core/config/__tests__/` — trim tests matching removed code

### Phase 2
- `src/core/plugin/plugin-context.ts` — add `registerEditableFields()`
- `src/core/plugin/plugin-context-types.ts` — add `FieldDef` interface, update `PluginContextAPI`
- `src/core/config/config-registry.ts` — remove plugin-mapped fields, keep core only
- `src/packages/plugin-sdk/` — export `FieldDef` type
- `src/plugins/telegram/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/discord/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/slack/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/security/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/speech/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/tunnel/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/usage/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/api-server/index.ts` — cleanup install, add registerEditableFields
- `src/plugins/*/` — test cleanup for legacy branches
