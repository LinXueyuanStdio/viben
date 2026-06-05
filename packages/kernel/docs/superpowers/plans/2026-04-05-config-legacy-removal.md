# Config Legacy Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all legacy config sections (channels, security, speech, tunnel, usage, api) from ConfigSchema, eliminate duplicate env var handling, and add a plugin self-declaration API for editable fields.

**Architecture:** Two phases — Phase 1 strips the core config schema and fixes env var routing so each var is handled in exactly one place. Phase 2 adds `registerEditableFields()` to PluginContext and removes `legacyConfig` from all plugin install hooks.

**Tech Stack:** TypeScript, Zod, Vitest. Worktree: `Viben/.worktrees/refactor/config-legacy-removal`.

---

## Phase 1 — Core Cleanup

### Task 1: Trim ConfigSchema, remove dead schemas and exported types

**Files:**
- Modify: `src/core/config/config.ts`

- [ ] **Step 1: Check for imports of TunnelConfig and UsageConfig**

Run from worktree root:
```bash
grep -rn "TunnelConfig\|UsageConfig" src/ --include="*.ts" | grep -v "config\.ts"
```
Expected: zero or a handful of results to fix in later steps.

- [ ] **Step 2: Remove dead schemas and exports from config.ts**

In `src/core/config/config.ts`, delete these entire blocks:
- `BaseChannelSchema` (lines 11–20)
- `AgentSchema` (lines 22–27)
- `TunnelAuthSchema` (lines 43–48)
- `TunnelSchema` (lines 50–62)
- `export type TunnelConfig = z.infer<typeof TunnelSchema>` (line 64)
- `UsageSchema` (lines 67–75)
- `export type UsageConfig = z.infer<typeof UsageSchema>` (line 77)
- `SpeechProviderSchema` (lines 79–84)
- `SpeechSchema` (lines 86–102)

- [ ] **Step 3: Replace ConfigSchema with core-only version**

Replace the entire `ConfigSchema` block (lines 104–160) with:

```typescript
export const ConfigSchema = z.object({
  instanceName: z.string().optional(),
  defaultAgent: z.string(),
  workspace: z
    .object({
      baseDir: z.string().default("~/viben-workspace"),
      security: z
        .object({
          allowedPaths: z.array(z.string()).default([]),
          envWhitelist: z.array(z.string()).default([]),
        })
        .default({}),
    })
    .default({}),
  logging: LoggingSchema,
  runMode: z.enum(["foreground", "daemon"]).default("foreground"),
  autoStart: z.boolean().default(false),
  sessionStore: z
    .object({
      ttlDays: z.number().default(30),
    })
    .default({}),
  integrations: z
    .record(
      z.string(),
      z.object({
        installed: z.boolean(),
        installedAt: z.string().optional(),
      }),
    )
    .default({}),
  outputMode: z.enum(["low", "medium", "high"]).default("medium").optional(),
  agentSwitch: z.object({
    labelHistory: z.boolean().default(true),
  }).default({}),
});
```

- [ ] **Step 4: Trim DEFAULT_CONFIG**

Replace the entire `DEFAULT_CONFIG` block (lines 171–210) with:

```typescript
const DEFAULT_CONFIG = {
  defaultAgent: "claude",
  workspace: { baseDir: "~/viben-workspace" },
  sessionStore: { ttlDays: 30 },
};
```

Also update the log message in load() just below it:
```typescript
log.info(
  "Run 'viben setup' to configure channels and agents, then restart.",
);
```

- [ ] **Step 5: Build to surface type errors**

```bash
pnpm build 2>&1 | grep "error TS" | head -30
```
Expected: TypeScript errors referencing removed types (TunnelConfig, UsageConfig, config.agents, etc.). Note them for fixing in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add src/core/config/config.ts
git commit -m "refactor: remove legacy sections from ConfigSchema

Remove channels, agents, security, api, tunnel, usage, speech sections.
These now live exclusively in plugin settings files.
BaseChannelSchema, AgentSchema, TunnelSchema, UsageSchema, SpeechSchema
and their exported types are deleted.
DEFAULT_CONFIG simplified to core-only fields."
```

---

### Task 2: Trim applyEnvOverrides — remove plugin-specific overrides

**Files:**
- Modify: `src/core/config/config.ts`

- [ ] **Step 1: Replace applyEnvOverrides with core-only version**

Replace the entire `private applyEnvOverrides(raw: Record<string, unknown>): void` method (lines 399–480) with:

```typescript
private applyEnvOverrides(raw: Record<string, unknown>): void {
  // Core config env overrides only.
  // Plugin-specific env vars (VIBEN_TELEGRAM_*, VIBEN_TUNNEL_*, etc.)
  // are handled in applyEnvToPluginSettings() instead.
  const overrides: [string, string[]][] = [
    ["VIBEN_DEFAULT_AGENT", ["defaultAgent"]],
    ["VIBEN_RUN_MODE", ["runMode"]],
  ];
  for (const [envVar, configPath] of overrides) {
    const value = process.env[envVar];
    if (value !== undefined) {
      let target: Record<string, unknown> = raw;
      for (let i = 0; i < configPath.length - 1; i++) {
        if (!target[configPath[i]!]) target[configPath[i]!] = {};
        target = target[configPath[i]!] as Record<string, unknown>;
      }
      const key = configPath[configPath.length - 1]!;
      target[key] = value;
    }
  }

  // Logging overrides
  if (process.env.VIBEN_LOG_LEVEL) {
    raw.logging = raw.logging || {};
    (raw.logging as Record<string, unknown>).level = process.env.VIBEN_LOG_LEVEL;
  }
  if (process.env.VIBEN_LOG_DIR) {
    raw.logging = raw.logging || {};
    (raw.logging as Record<string, unknown>).logDir = process.env.VIBEN_LOG_DIR;
  }
  if (process.env.VIBEN_DEBUG && !process.env.VIBEN_LOG_LEVEL) {
    raw.logging = raw.logging || {};
    (raw.logging as Record<string, unknown>).level = "debug";
  }
}
```

- [ ] **Step 2: Build to verify no regressions**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/core/config/config.ts
git commit -m "refactor: slim down applyEnvOverrides to core fields only

Remove channel, tunnel, api, speech env overrides from applyEnvOverrides().
These are already handled by applyEnvToPluginSettings() — removing the
duplicate handling so each env var has exactly one code path."
```

---

### Task 3: Trim config-migrations, delete unused files

**Files:**
- Modify: `src/core/config/config-migrations.ts`
- Delete: `src/core/config/plugin-config-migration.ts`
- Delete: `src/core/config/__tests__/plugin-config-migration.test.ts`

- [ ] **Step 1: Trim migrations to only add-instance-name**

Replace the entire contents of `src/core/config/config-migrations.ts` with:

```typescript
import { createChildLogger } from "../utils/log.js";
const log = createChildLogger({ module: "config-migrations" });

type RawConfig = Record<string, unknown>;

export interface MigrationContext {
  configDir: string;
}

export interface Migration {
  name: string;
  apply: (raw: RawConfig, ctx?: MigrationContext) => boolean;
}

export const migrations: Migration[] = [
  {
    name: "add-instance-name",
    apply(raw) {
      if (raw.instanceName) return false;
      raw.instanceName = "Main";
      log.info("Added instanceName to config");
      return true;
    },
  },
];

/**
 * Apply all migrations to raw config (mutates in place).
 * Returns whether any changes were made.
 */
export function applyMigrations(
  raw: RawConfig,
  migrationList: Migration[] = migrations,
  ctx?: MigrationContext,
): { changed: boolean } {
  let changed = false;
  for (const migration of migrationList) {
    if (migration.apply(raw, ctx)) {
      changed = true;
    }
  }
  return { changed };
}
```

- [ ] **Step 2: Delete plugin-config-migration.ts and its test**

```bash
rm src/core/config/plugin-config-migration.ts
rm src/core/config/__tests__/plugin-config-migration.test.ts
```

- [ ] **Step 3: Build to check for broken imports**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```
Expected: no new errors from this step.

- [ ] **Step 4: Commit**

```bash
git add -A src/core/config/config-migrations.ts src/core/config/plugin-config-migration.ts src/core/config/__tests__/plugin-config-migration.test.ts
git commit -m "refactor: remove legacy config migrations

Keep only add-instance-name migration (needed for new installs).
Remove: add-tunnel-section, fix-agent-commands, migrate-agents-to-store,
migrate-display-verbosity-to-output-mode, migrate-tunnel-provider-to-viben.
Delete plugin-config-migration.ts (unused scaffolding, never integrated)."
```

---

### Task 4: Trim config-registry — remove plugin-mapped fields

**Files:**
- Modify: `src/core/config/config-registry.ts`

- [ ] **Step 1: Replace config-registry.ts with core-only registry**

Replace the entire contents of `src/core/config/config-registry.ts` with:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { Config } from "./config.js";
import { getGlobalRoot } from "../instance/instance-context.js";

export interface ConfigFieldDef {
  path: string;
  displayName: string;
  group: string;
  type: "toggle" | "select" | "number" | "string";
  options?: string[] | ((config: Config) => string[]);
  scope: "safe" | "sensitive";
  hotReload: boolean;
}

export const CONFIG_REGISTRY: ConfigFieldDef[] = [
  {
    path: "defaultAgent",
    displayName: "Default Agent",
    group: "agent",
    type: "select",
    options: () => {
      try {
        const agentsPath = path.join(getGlobalRoot(), "agents.json");
        if (fs.existsSync(agentsPath)) {
          const data = JSON.parse(fs.readFileSync(agentsPath, "utf-8"));
          return Object.keys(data.installed ?? {});
        }
      } catch {
        /* fallback */
      }
      return [];
    },
    scope: "safe",
    hotReload: true,
  },
  {
    path: "logging.level",
    displayName: "Log Level",
    group: "logging",
    type: "select",
    options: ["silent", "debug", "info", "warn", "error", "fatal"],
    scope: "safe",
    hotReload: true,
  },
  {
    path: "workspace.baseDir",
    displayName: "Workspace Directory",
    group: "workspace",
    type: "string",
    scope: "safe",
    hotReload: true,
  },
  {
    path: "sessionStore.ttlDays",
    displayName: "Session Store TTL (days)",
    group: "storage",
    type: "number",
    scope: "safe",
    hotReload: true,
  },
  {
    path: "agentSwitch.labelHistory",
    displayName: "Label Agent in History",
    group: "agent",
    type: "toggle",
    scope: "safe",
    hotReload: true,
  },
];

export function getFieldDef(path: string): ConfigFieldDef | undefined {
  return CONFIG_REGISTRY.find((f) => f.path === path);
}

export function getSafeFields(): ConfigFieldDef[] {
  return CONFIG_REGISTRY.filter((f) => f.scope === "safe");
}

export function isHotReloadable(path: string): boolean {
  const def = getFieldDef(path);
  return def?.hotReload ?? false;
}

export function resolveOptions(
  def: ConfigFieldDef,
  config: Config,
): string[] | undefined {
  if (!def.options) return undefined;
  return typeof def.options === "function" ? def.options(config) : def.options;
}

export function getConfigValue(config: Config, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

function validateFieldValue(field: ConfigFieldDef, value: unknown): void {
  switch (field.type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new ConfigValidationError(`"${field.path}" expects a number, got ${typeof value}`);
      }
      break;
    case "toggle":
      if (typeof value !== "boolean") {
        throw new ConfigValidationError(`"${field.path}" expects a boolean, got ${typeof value}`);
      }
      break;
    case "string":
      if (typeof value !== "string") {
        throw new ConfigValidationError(`"${field.path}" expects a string, got ${typeof value}`);
      }
      break;
    case "select": {
      if (typeof value !== "string") {
        throw new ConfigValidationError(`"${field.path}" expects a string, got ${typeof value}`);
      }
      break;
    }
  }
}

export async function setFieldValueAsync(
  field: ConfigFieldDef,
  value: unknown,
  configManager: { setPath(path: string, value: unknown): Promise<void>; emit?(event: string, data: unknown): void },
): Promise<{ needsRestart: boolean }> {
  validateFieldValue(field, value);
  await configManager.setPath(field.path, value);
  return { needsRestart: !field.hotReload };
}
```

Note: `getFieldValueAsync` is removed (no longer needed — no plugin-mapped fields). `setFieldValueAsync` no longer needs a `settingsManager` parameter. Check for callers that pass `settingsManager` and remove that argument.

- [ ] **Step 2: Find and fix callers of the removed/changed functions**

```bash
grep -rn "getFieldValueAsync\|setFieldValueAsync" src/ --include="*.ts"
```

For each caller of `setFieldValueAsync` that passes a `settingsManager` argument as 3rd param, remove it.

- [ ] **Step 3: Build**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/core/config/config-registry.ts
git commit -m "refactor: remove plugin-mapped fields from config-registry

Remove: channels.telegram.outputMode, channels.discord.outputMode,
tunnel.enabled, security.maxConcurrentSessions, security.sessionTimeoutMinutes,
speech.stt.provider, speech.stt.apiKey.
Remove plugin? field from ConfigFieldDef — plugins will self-declare
their editable fields via registerEditableFields() in Phase 2.
Remove getFieldValueAsync (no longer needed without plugin-mapped fields)."
```

---

### Task 5: Fix config-editor.ts — drop config.json fallback in plugin functions

**Files:**
- Modify: `src/core/config/config-editor.ts`

- [ ] **Step 1: Fix editTelegram — always use plugin settings**

Replace the entire `editTelegram` function (lines 53–190 approx) with:

```typescript
async function editTelegram(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/telegram') : {}
  const currentToken = (ps.botToken as string) ?? ''
  const currentChatId = (ps.chatId as number) ?? 0
  const currentEnabled = (ps.enabled as boolean) ?? false

  console.log(header('Telegram'))
  console.log(`  Enabled   : ${currentEnabled ? ok('yes') : dim('no')}`)
  const tokenDisplay = currentToken.length > 12
    ? currentToken.slice(0, 6) + '...' + currentToken.slice(-6)
    : currentToken || dim('(not set)')
  console.log(`  Bot Token : ${tokenDisplay}`)
  console.log(`  Chat ID   : ${currentChatId || dim('(not set)')}`)
  console.log('')

  while (true) {
    const isEnabled = settingsManager
      ? ((await settingsManager.loadSettings('@viben/telegram')).enabled as boolean) ?? currentEnabled
      : currentEnabled

    const choice = await select({
      message: 'Telegram settings:',
      choices: [
        { name: isEnabled ? 'Disable Telegram' : 'Enable Telegram', value: 'toggle' },
        { name: 'Change Bot Token', value: 'token' },
        { name: 'Change Chat ID', value: 'chatid' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'toggle') {
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/telegram', { enabled: !isEnabled })
        console.log(!isEnabled ? ok('Telegram enabled') : ok('Telegram disabled'))
      }
    }

    if (choice === 'token') {
      const token = await input({
        message: 'New bot token:',
        validate: (val) => val.trim().length > 0 || 'Token cannot be empty',
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/telegram', { botToken: token.trim() })
        console.log(ok('Bot token updated'))
      }
    }

    if (choice === 'chatid') {
      const chatId = await input({
        message: 'New chat ID:',
        validate: (val) => !isNaN(Number(val.trim())) || 'Must be a number',
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/telegram', { chatId: Number(chatId.trim()) })
        console.log(ok(`Chat ID set to ${chatId.trim()}`))
      }
    }
  }
}
```

- [ ] **Step 2: Fix editSecurity — always use plugin settings**

Replace the entire `editSecurity` function (lines ~342–414) with:

```typescript
async function editSecurity(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/security') : {}
  const sec = {
    allowedUserIds: (ps.allowedUserIds as string[]) ?? [],
    maxConcurrentSessions: (ps.maxConcurrentSessions as number) ?? 20,
    sessionTimeoutMinutes: (ps.sessionTimeoutMinutes as number) ?? 60,
  }

  console.log(header('Security'))
  console.log(`  Allowed user IDs        : ${sec.allowedUserIds?.length ? sec.allowedUserIds.join(', ') : dim('(all users allowed)')}`)
  console.log(`  Max concurrent sessions : ${sec.maxConcurrentSessions}`)
  console.log(`  Session timeout (min)   : ${sec.sessionTimeoutMinutes}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Security settings:',
      choices: [
        { name: 'Max concurrent sessions', value: 'maxSessions' },
        { name: 'Session timeout (minutes)', value: 'timeout' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'maxSessions') {
      const val = await input({
        message: 'Max concurrent sessions:',
        default: String(sec.maxConcurrentSessions),
        validate: (v) => {
          const n = Number(v.trim())
          if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer'
          return true
        },
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/security', { maxConcurrentSessions: Number(val.trim()) })
      }
      console.log(ok(`Max concurrent sessions set to ${val.trim()}`))
    }

    if (choice === 'timeout') {
      const val = await input({
        message: 'Session timeout in minutes:',
        default: String(sec.sessionTimeoutMinutes),
        validate: (v) => {
          const n = Number(v.trim())
          if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer'
          return true
        },
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/security', { sessionTimeoutMinutes: Number(val.trim()) })
      }
      console.log(ok(`Session timeout set to ${val.trim()} minutes`))
    }
  }
}
```

- [ ] **Step 3: Fix editApi — always use plugin settings**

Replace the entire `editApi` function (lines ~564–595) with:

```typescript
async function editApi(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/api-server') : {}
  const currentPort = (ps.port as number) ?? 21420
  const currentHost = (ps.host as string) ?? '127.0.0.1'

  console.log(header('API'))
  console.log(`  Port : ${currentPort}`)
  console.log(`  Host : ${currentHost} ${dim('(localhost only)')}`)
  console.log('')

  const newPort = await input({
    message: 'API port:',
    default: String(currentPort),
    validate: (v) => {
      const n = Number(v.trim())
      if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Must be a valid port (1-65535)'
      return true
    },
  })

  if (settingsManager) {
    await settingsManager.updatePluginSettings('@viben/api-server', { port: Number(newPort.trim()) })
  }
  console.log(ok(`API port set to ${newPort.trim()}`))
}
```

- [ ] **Step 4: Fix editTunnel — always use plugin settings**

Replace the entire `editTunnel` function (lines ~599–716) with:

```typescript
async function editTunnel(config: Config, updates: ConfigUpdates, settingsManager?: SettingsManager): Promise<void> {
  const ps = settingsManager ? await settingsManager.loadSettings('@viben/tunnel') : {}
  const tunnel = {
    enabled: (ps.enabled as boolean) ?? false,
    port: (ps.port as number) ?? 3100,
    provider: (ps.provider as string) ?? 'viben',
    options: (ps.options as Record<string, unknown>) ?? {},
    storeTtlMinutes: (ps.storeTtlMinutes as number) ?? 60,
    auth: (ps.auth as { enabled: boolean; token?: string }) ?? { enabled: false },
  }

  // Local display state — not written to config.json (tunnel removed from schema)
  const tun: Record<string, unknown> = { ...tunnel }

  const getVal = <T>(key: string, fallback: T): T =>
    (key in tun ? tun[key] : (tunnel as Record<string, unknown>)[key] ?? fallback) as T

  console.log(header('Tunnel'))
  console.log(`  Enabled  : ${getVal('enabled', false) ? ok('yes') : dim('no')}`)
  console.log(`  Provider : ${c.bold}${getVal('provider', 'viben')}${c.reset}`)
  console.log(`  Port     : ${getVal('port', 3100)}`)
  const authEnabled = (getVal('auth', { enabled: false }) as { enabled: boolean }).enabled
  console.log(`  Auth     : ${authEnabled ? ok('enabled') : dim('disabled')}`)
  console.log('')

  while (true) {
    const choice = await select({
      message: 'Tunnel settings:',
      choices: [
        { name: getVal('enabled', false) ? 'Disable tunnel' : 'Enable tunnel', value: 'toggle' },
        { name: 'Change provider', value: 'provider' },
        { name: 'Change port', value: 'port' },
        { name: 'Provider options', value: 'options' },
        { name: authEnabled ? 'Disable auth' : 'Enable auth', value: 'auth' },
        { name: 'Back', value: 'back' },
      ],
    })

    if (choice === 'back') break

    if (choice === 'toggle') {
      const current = getVal('enabled', false)
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { enabled: !current })
      }
      tun.enabled = !current
      console.log(!current ? ok('Tunnel enabled') : ok('Tunnel disabled'))
    }

    if (choice === 'provider') {
      const provider = await select({
        message: 'Select tunnel provider:',
        choices: [
          { name: 'Viben (managed)', value: 'viben' },
          { name: 'Cloudflare', value: 'cloudflare' },
          { name: 'ngrok', value: 'ngrok' },
          { name: 'bore', value: 'bore' },
          { name: 'Tailscale Funnel', value: 'tailscale' },
        ],
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { provider, options: {} })
      }
      tun.provider = provider
      tun.options = {}
      console.log(ok(`Provider set to ${provider}`))
    }

    if (choice === 'port') {
      const val = await input({
        message: 'Tunnel port:',
        default: String(getVal('port', 3100)),
        validate: (v) => {
          const n = Number(v.trim())
          if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Must be a valid port (1-65535)'
          return true
        },
      })
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { port: Number(val.trim()) })
      }
      tun.port = Number(val.trim())
      console.log(ok(`Tunnel port set to ${val.trim()}`))
    }

    if (choice === 'options') {
      const provider = getVal('provider', 'viben')
      const currentOptions = getVal('options', {}) as Record<string, unknown>
      await editProviderOptions(provider, currentOptions, tun)
      if (settingsManager) {
        await settingsManager.updatePluginSettings('@viben/tunnel', { options: tun.options })
      }
    }

    if (choice === 'auth') {
      const currentAuth = getVal('auth', { enabled: false }) as { enabled: boolean; token?: string }
      if (currentAuth.enabled) {
        if (settingsManager) {
          await settingsManager.updatePluginSettings('@viben/tunnel', { auth: { enabled: false } })
        }
        tun.auth = { enabled: false }
        console.log(ok('Tunnel auth disabled'))
      } else {
        const token = await input({
          message: 'Auth token (leave empty to auto-generate):',
          default: '',
        })
        const newAuth = token.trim() ? { enabled: true, token: token.trim() } : { enabled: true }
        if (settingsManager) {
          await settingsManager.updatePluginSettings('@viben/tunnel', { auth: newAuth })
        }
        tun.auth = newAuth
        console.log(ok('Tunnel auth enabled'))
      }
    }
  }
}
```

- [ ] **Step 5: Build**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/core/config/config-editor.ts
git commit -m "refactor: config-editor reads/writes plugin fields via settings only

Drop config.json fallback in editTelegram, editSecurity, editApi, editTunnel.
These functions now exclusively use SettingsManager for plugin-owned fields.
editLogging, editWorkspace, editAgent, editRunMode are unchanged."
```

---

### Task 6: Update tests for Phase 1

**Files:**
- Delete: `src/core/config/__tests__/config-env-overrides.test.ts` (tests Slack/Telegram/Discord channel env overrides — removed functionality)
- Modify: `src/core/config/__tests__/config-migrations.test.ts`
- Modify: `src/core/config/__tests__/config-registry-plugin.test.ts`
- Modify: `src/core/config/__tests__/config-registry.test.ts`
- Modify: `src/core/config/__tests__/config-registry-extended.test.ts`

- [ ] **Step 1: Delete config-env-overrides.test.ts**

```bash
rm src/core/config/__tests__/config-env-overrides.test.ts
```

- [ ] **Step 2: Trim config-migrations.test.ts — keep only add-instance-name test**

Replace the contents of `src/core/config/__tests__/config-migrations.test.ts` with only the `add-instance-name` tests:

```typescript
import { describe, it, expect } from 'vitest'
import { applyMigrations } from '../config-migrations.js'

describe('Config Migrations', () => {
  describe('migration: add-instance-name', () => {
    it('adds instanceName "Main" when missing', () => {
      const raw: Record<string, unknown> = { defaultAgent: 'claude' }
      applyMigrations(raw)
      expect(raw.instanceName).toBe('Main')
    })

    it('does not overwrite existing instanceName', () => {
      const raw: Record<string, unknown> = { defaultAgent: 'claude', instanceName: 'My Instance' }
      applyMigrations(raw)
      expect(raw.instanceName).toBe('My Instance')
    })
  })
})
```

- [ ] **Step 3: Fix config-registry-plugin.test.ts**

Read the file first:
```bash
cat src/core/config/__tests__/config-registry-plugin.test.ts
```

Then remove any test cases that reference plugin-mapped fields (tunnel.enabled, security.*, speech.*) or the `plugin` property on ConfigFieldDef. Keep any tests that cover `getConfigValue`, `setFieldValueAsync`, or `validateFieldValue` for core fields.

If all tests in the file reference plugin-mapped functionality, delete the file:
```bash
rm src/core/config/__tests__/config-registry-plugin.test.ts
```

- [ ] **Step 4: Fix config-registry.test.ts and config-registry-extended.test.ts**

Read each:
```bash
cat src/core/config/__tests__/config-registry.test.ts
cat src/core/config/__tests__/config-registry-extended.test.ts
```

Remove test cases that reference removed fields (channels.telegram.outputMode, channels.discord.outputMode, tunnel.enabled, security.*, speech.*). Keep tests for the 5 remaining core fields and utility functions.

- [ ] **Step 5: Run all tests**

```bash
pnpm test 2>&1 | tail -15
```
Expected: all tests pass. If any fail, investigate and fix.

- [ ] **Step 6: Commit**

```bash
git add -A src/core/config/__tests__/
git commit -m "test: remove legacy config test cases

Delete tests for removed functionality: config-env-overrides (channel tokens),
plugin-config-migration, and migration tests for removed migrations.
Trim config-registry tests to cover only remaining core fields."
```

---

## Phase 2 — Plugin API

### Task 7: Add FieldDef type and registerEditableFields to PluginContext + create PluginFieldRegistry

**Files:**
- Modify: `src/core/plugin/types.ts`
- Create: `src/core/plugin/plugin-field-registry.ts`
- Modify: `src/core/plugin/plugin-context.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing test for PluginFieldRegistry**

Create `src/core/plugin/__tests__/plugin-field-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PluginFieldRegistry } from '../plugin-field-registry.js'
import type { FieldDef } from '../types.js'

describe('PluginFieldRegistry', () => {
  it('registers fields for a plugin', () => {
    const registry = new PluginFieldRegistry()
    const fields: FieldDef[] = [
      { key: 'botToken', displayName: 'Bot Token', type: 'string', scope: 'sensitive' },
      { key: 'chatId', displayName: 'Chat ID', type: 'number', scope: 'safe' },
    ]
    registry.register('@viben/telegram', fields)
    expect(registry.getForPlugin('@viben/telegram')).toEqual(fields)
  })

  it('returns empty array for unknown plugin', () => {
    const registry = new PluginFieldRegistry()
    expect(registry.getForPlugin('@viben/unknown')).toEqual([])
  })

  it('overwrites previous registration for same plugin', () => {
    const registry = new PluginFieldRegistry()
    registry.register('@viben/test', [{ key: 'a', displayName: 'A', type: 'string', scope: 'safe' }])
    registry.register('@viben/test', [{ key: 'b', displayName: 'B', type: 'toggle', scope: 'safe' }])
    expect(registry.getForPlugin('@viben/test')).toHaveLength(1)
    expect(registry.getForPlugin('@viben/test')[0]!.key).toBe('b')
  })

  it('getAll returns map of all registered plugins', () => {
    const registry = new PluginFieldRegistry()
    registry.register('@viben/a', [{ key: 'x', displayName: 'X', type: 'string', scope: 'safe' }])
    registry.register('@viben/b', [{ key: 'y', displayName: 'Y', type: 'toggle', scope: 'safe' }])
    const all = registry.getAll()
    expect(all.size).toBe(2)
    expect(all.has('@viben/a')).toBe(true)
    expect(all.has('@viben/b')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/core/plugin/__tests__/plugin-field-registry.test.ts 2>&1 | tail -10
```
Expected: FAIL — `PluginFieldRegistry` and `FieldDef` not defined.

- [ ] **Step 3: Add FieldDef to types.ts and registerEditableFields to PluginContext**

In `src/core/plugin/types.ts`, add after the `SettingsAPI` interface (after line 83):

```typescript
// ─── Plugin Field Declaration ───

/** Describes a settings field that a plugin exposes as editable via API/UI */
export interface FieldDef {
  /** Settings key (matches the key in plugin settings.json) */
  key: string
  /** Human-readable label for UI display */
  displayName: string
  type: "toggle" | "select" | "number" | "string"
  /** safe = readable via API; sensitive = write-only (e.g., tokens) */
  scope: "safe" | "sensitive"
  /** Whether the change takes effect without restart. Default: false */
  hotReload?: boolean
  /** Valid values for "select" type */
  options?: string[]
}
```

In the `PluginContext` interface (around line 258), add after `registerAssistantSection`:

```typescript
/**
 * Declare this plugin's settings fields as editable via API/UI.
 * Call in setup() after registering services.
 * Requires 'commands:register'.
 */
registerEditableFields(fields: FieldDef[]): void
```

- [ ] **Step 4: Create PluginFieldRegistry**

Create `src/core/plugin/plugin-field-registry.ts`:

```typescript
import type { FieldDef } from './types.js'

/**
 * Central registry for plugin-declared editable fields.
 * Registered as service 'field-registry' in main.ts.
 */
export class PluginFieldRegistry {
  private fields = new Map<string, FieldDef[]>()

  register(pluginName: string, fields: FieldDef[]): void {
    this.fields.set(pluginName, fields)
  }

  getForPlugin(pluginName: string): FieldDef[] {
    return this.fields.get(pluginName) ?? []
  }

  getAll(): Map<string, FieldDef[]> {
    return new Map(this.fields)
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test src/core/plugin/__tests__/plugin-field-registry.test.ts 2>&1 | tail -10
```
Expected: PASS (4 tests).

- [ ] **Step 6: Implement registerEditableFields in plugin-context.ts**

In `src/core/plugin/plugin-context.ts`, add the implementation in the `ctx` object after `unregisterAssistantSection`:

```typescript
registerEditableFields(fields: import('./types.js').FieldDef[]): void {
  requirePermission(permissions, 'commands:register', 'registerEditableFields()')
  const registry = serviceRegistry.get<{ register(pluginName: string, fields: import('./types.js').FieldDef[]): void }>('field-registry')
  if (registry && typeof registry.register === 'function') {
    registry.register(pluginName, fields)
    log.debug(`Registered ${fields.length} editable field(s) for ${pluginName}`)
  }
},
```

- [ ] **Step 7: Register PluginFieldRegistry in main.ts**

In `src/main.ts`, following the same pattern as `command-registry` (around lines 127–130), add:

```typescript
// Register PluginFieldRegistry as service
import { PluginFieldRegistry } from './core/plugin/plugin-field-registry.js'
// ...
const fieldRegistry = new PluginFieldRegistry()
serviceRegistry.register('field-registry', fieldRegistry, 'core')
```

Add the import at the top of main.ts with other imports:
```typescript
import { PluginFieldRegistry } from './core/plugin/plugin-field-registry.js'
```

And add the registration after the commandRegistry registration:
```typescript
const fieldRegistry = new PluginFieldRegistry()
serviceRegistry.register('field-registry', fieldRegistry, 'core')
```

- [ ] **Step 8: Build**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 9: Run all tests**

```bash
pnpm test 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/core/plugin/types.ts src/core/plugin/plugin-field-registry.ts src/core/plugin/plugin-context.ts src/core/plugin/__tests__/plugin-field-registry.test.ts src/main.ts
git commit -m "feat: add FieldDef type and registerEditableFields to PluginContext

Plugins can now declare their editable settings fields in setup():
  ctx.registerEditableFields([
    { key: 'botToken', displayName: 'Bot Token', type: 'string', scope: 'sensitive' },
  ])
Fields are stored in PluginFieldRegistry (service: 'field-registry').
Requires 'commands:register' permission."
```

---

### Task 8: Remove legacyConfig from InstallContext and fix install-context.ts

**Files:**
- Modify: `src/core/plugin/types.ts`
- Modify: `src/core/plugin/install-context.ts`

- [ ] **Step 1: Read install-context.ts**

```bash
cat src/core/plugin/install-context.ts
```

- [ ] **Step 2: Remove legacyConfig from InstallContext in types.ts**

In `src/core/plugin/types.ts`, remove `legacyConfig?: Record<string, unknown>` from the `InstallContext` interface:

```typescript
export interface InstallContext {
  pluginName: string
  terminal: TerminalIO
  settings: SettingsAPI
  dataDir: string
  log: Logger
  /** Root of the Viben instance directory (e.g. ~/.viben) */
  instanceRoot?: string
}
```

- [ ] **Step 3: Remove legacyConfig from install-context.ts**

In `src/core/plugin/install-context.ts`, remove any code that sets or passes `legacyConfig`. After removing, verify the file builds cleanly.

- [ ] **Step 4: Build to see all call sites that need updating**

```bash
pnpm build 2>&1 | grep "legacyConfig" | head -20
```
Note all files that reference `legacyConfig` — they will be fixed in Tasks 9 and 10.

- [ ] **Step 5: Commit**

```bash
git add src/core/plugin/types.ts src/core/plugin/install-context.ts
git commit -m "refactor: remove legacyConfig from InstallContext

Plugin install() hooks no longer receive legacy config.json data.
Interactive setup is the only install path going forward."
```

---

### Task 9: Update telegram, security, speech plugins

**Files:**
- Modify: `src/plugins/telegram/index.ts`
- Modify: `src/plugins/security/index.ts`
- Modify: `src/plugins/speech/index.ts`

- [ ] **Step 1: Update telegram install() — remove legacyConfig branch**

In `src/plugins/telegram/index.ts`, replace the `install` hook:

```typescript
async install(ctx: InstallContext) {
  const { terminal, settings } = ctx

  // Interactive setup via terminal
  const { validateBotToken, validateChatId, validateBotAdmin } = await import('./validators.js')

  let botToken = ''
  while (true) {
    botToken = await terminal.text({
      message: 'Telegram bot token (from @BotFather):',
      validate: (val) => {
        if (!val.trim()) return 'Token cannot be empty'
        return undefined
      },
    })
    botToken = botToken.trim()

    const spin = terminal.spinner()
    spin.start('Validating token...')
    const result = await validateBotToken(botToken)
    if (result.ok) {
      spin.stop(`Connected to @${result.botUsername}`)
      break
    }
    spin.fail(result.error)
    const action = await terminal.select({
      message: 'What to do?',
      options: [
        { label: 'Re-enter token', value: 'retry' },
        { label: 'Use as-is (skip validation)', value: 'skip' },
      ],
    })
    if (action === 'skip') break
  }
  // ... keep the rest of the interactive setup unchanged (chat ID detection, admin check, etc.)
```

Remove the `legacyConfig` destructuring and the `if (legacyConfig)` block at the top.

- [ ] **Step 2: Add registerEditableFields to telegram setup()**

In `src/plugins/telegram/index.ts`, in the `setup(ctx)` hook, add at the beginning:

```typescript
async setup(ctx) {
  ctx.registerEditableFields([
    { key: 'enabled', displayName: 'Enabled', type: 'toggle', scope: 'safe', hotReload: false },
    { key: 'botToken', displayName: 'Bot Token', type: 'string', scope: 'sensitive', hotReload: false },
    { key: 'chatId', displayName: 'Chat ID', type: 'number', scope: 'safe', hotReload: false },
  ])
  // ... rest of setup unchanged
```

- [ ] **Step 3: Update security install() and setup()**

In `src/plugins/security/index.ts`:

Replace `install` hook — remove `legacyConfig` branch, keep only the part that saves defaults:

```typescript
async install(ctx: InstallContext) {
  await ctx.settings.setAll({
    allowedUserIds: [],
    maxConcurrentSessions: 20,
    sessionTimeoutMinutes: 60,
  })
}
```

In `setup(ctx)`, add at the beginning:
```typescript
ctx.registerEditableFields([
  { key: 'maxConcurrentSessions', displayName: 'Max Concurrent Sessions', type: 'number', scope: 'safe', hotReload: true },
  { key: 'sessionTimeoutMinutes', displayName: 'Session Timeout (min)', type: 'number', scope: 'safe', hotReload: true },
])
```

- [ ] **Step 4: Update speech install() and setup()**

In `src/plugins/speech/index.ts`:

Replace `install` hook — remove `legacyConfig` branch. Read the current file first to keep the interactive setup intact:
```bash
cat src/plugins/speech/index.ts | head -60
```

Remove only the `if (legacyConfig)` block at the top of `install()`. Keep the interactive STT/TTS provider setup.

In `setup(ctx)`, add at the beginning:
```typescript
ctx.registerEditableFields([
  { key: 'sttProvider', displayName: 'Speech to Text', type: 'select', scope: 'safe', hotReload: true, options: ['groq'] },
  { key: 'groqApiKey', displayName: 'STT API Key', type: 'string', scope: 'sensitive', hotReload: true },
  { key: 'ttsProvider', displayName: 'Text to Speech', type: 'select', scope: 'safe', hotReload: true, options: ['edge-tts'] },
])
```

- [ ] **Step 5: Build**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 6: Run tests**

```bash
pnpm test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/plugins/telegram/index.ts src/plugins/security/index.ts src/plugins/speech/index.ts
git commit -m "refactor: remove legacyConfig from telegram, security, speech plugins

Each plugin's install() now has only the interactive setup path.
Added registerEditableFields() calls in each plugin's setup() hook."
```

---

### Task 10: Update tunnel, api-server, file-service plugins

**Files:**
- Modify: `src/plugins/tunnel/index.ts`
- Modify: `src/plugins/api-server/index.ts`
- Modify: `src/plugins/file-service/index.ts`

- [ ] **Step 1: Read current install hooks**

```bash
head -50 src/plugins/tunnel/index.ts
head -130 src/plugins/api-server/index.ts
cat src/plugins/file-service/index.ts
```

- [ ] **Step 2: Update tunnel install() and setup()**

In `src/plugins/tunnel/index.ts`, remove `legacyConfig` destructuring and `if (legacyConfig)` migration block from `install()`. Keep the interactive provider selection setup.

In `setup(ctx)`, add at the beginning:
```typescript
ctx.registerEditableFields([
  { key: 'enabled', displayName: 'Tunnel', type: 'toggle', scope: 'safe', hotReload: false },
  { key: 'port', displayName: 'Tunnel Port', type: 'number', scope: 'safe', hotReload: false },
  { key: 'provider', displayName: 'Provider', type: 'select', scope: 'safe', hotReload: false, options: ['viben', 'cloudflare', 'ngrok', 'bore', 'tailscale'] },
])
```

Also check if tunnel's setup() references `config.tunnel` (from legacy config). If so, replace those references with plugin settings reads via `ctx.pluginConfig`.

- [ ] **Step 3: Update api-server install() and setup()**

In `src/plugins/api-server/index.ts`, remove `legacyConfig` destructuring and migration block from `install()`.

In `setup(ctx)`, add at the beginning:
```typescript
ctx.registerEditableFields([
  { key: 'port', displayName: 'API Port', type: 'number', scope: 'safe', hotReload: false },
])
```

- [ ] **Step 4: Update file-service install() and setup()**

In `src/plugins/file-service/index.ts`, remove `legacyConfig` destructuring and migration block from `install()`.

In `setup(ctx)`, add at the beginning:
```typescript
ctx.registerEditableFields([
  { key: 'baseDir', displayName: 'File Storage Directory', type: 'string', scope: 'safe', hotReload: false },
])
```

- [ ] **Step 5: Build — fix any remaining TunnelConfig/type errors**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

If `TunnelConfig` was imported from `config.ts` in tunnel plugin, define a local type instead:
```typescript
// In tunnel/index.ts — local type replacing the removed TunnelConfig export
interface TunnelPluginSettings {
  enabled: boolean
  port: number
  provider: string
  options: Record<string, unknown>
  storeTtlMinutes: number
  auth: { enabled: boolean; token?: string }
}
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test 2>&1 | tail -15
```
Expected: all 2722+ tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/tunnel/index.ts src/plugins/api-server/index.ts src/plugins/file-service/index.ts
git commit -m "refactor: remove legacyConfig from tunnel, api-server, file-service plugins

Completes legacyConfig removal from all plugins.
Added registerEditableFields() to each plugin's setup() hook."
```

---

### Task 11: Export FieldDef from plugin-sdk + final test run

**Files:**
- Modify: `packages/plugin-sdk/src/index.ts` (or equivalent)

- [ ] **Step 1: Find plugin-sdk entry point**

```bash
cat packages/plugin-sdk/src/index.ts | head -30
```

- [ ] **Step 2: Add FieldDef export**

In `packages/plugin-sdk/src/index.ts`, add `FieldDef` to the types export:

```typescript
export type { FieldDef } from '@viben/kernel/core/plugin/types.js'
// or if re-exported from a barrel:
export type { FieldDef } from './types.js'
```

Follow the existing export pattern for other types in the file.

- [ ] **Step 3: Build both packages**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

- [ ] **Step 4: Run the full test suite**

```bash
pnpm test 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 5: Fix any remaining TypeScript errors found during full build**

Address each error from the build output. Common ones:
- `config.agents` references → replace with agents.json reads or remove
- `config.security` references outside plugins → replace with settingsManager reads
- `TunnelConfig` or `UsageConfig` imports → replace with local types or remove

- [ ] **Step 6: Final commit**

```bash
git add packages/plugin-sdk/src/index.ts
git commit -m "feat: export FieldDef from plugin-sdk

Plugin authors can now import FieldDef from @viben/plugin-sdk
to type their registerEditableFields() calls."
```

- [ ] **Step 7: Final build and test verification**

```bash
pnpm build && pnpm test 2>&1 | tail -10
```
Expected: build succeeds, all tests pass.
