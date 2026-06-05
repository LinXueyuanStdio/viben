# Plugin System Overview

> **Note:** This page provides a quick overview of plugin management from a user's perspective. For the full technical deep dive into the plugin infrastructure, see [Architecture > Plugin System](../architecture/plugin-system.md).

---

## What Are Plugins?

Plugins are modules that extend Viben with new capabilities. Everything beyond the core kernel is a plugin: messaging adapters (Telegram, Discord, Slack), security, speech, tunnels, usage tracking, and more.

Plugins can:

- Register **services** that other plugins consume
- Register **chat commands** available on all platforms
- Register **middleware** to intercept and modify message flows
- Subscribe to **events** for cross-plugin communication
- Use **storage** for persistent data

---

## Installing a Plugin

```bash
viben plugin install @community/my-plugin
```

If the plugin has `essential: true`, its interactive `install()` hook runs immediately. Otherwise, it's registered and available on next restart.

## Listing Plugins

```bash
viben plugins
```

Shows all installed plugins with their version, source (builtin/npm), and enabled state.

## Configuring a Plugin

```bash
viben plugin configure @community/my-plugin
```

Runs the plugin's interactive `configure()` hook.

## Disabling / Enabling

```bash
viben plugin disable @viben/speech
viben plugin enable @viben/speech
```

Built-in plugins cannot be uninstalled, but they can be disabled.

## Uninstalling

```bash
viben plugin uninstall @community/my-plugin
viben plugin uninstall @community/my-plugin --purge  # also delete settings
```

---

## Plugin Interface (Quick Reference)

```typescript
interface VibenPlugin {
  name: string
  version: string
  description?: string
  pluginDependencies?: Record<string, string>
  permissions?: PluginPermission[]
  settingsSchema?: ZodSchema
  essential?: boolean

  setup(ctx: PluginContext): Promise<void>
  teardown?(): Promise<void>
  install?(ctx: InstallContext): Promise<void>
  configure?(ctx: InstallContext): Promise<void>
  migrate?(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown>
  uninstall?(ctx: InstallContext, opts: { purge: boolean }): Promise<void>
}
```

---

## Further Reading

- [Architecture > Plugin System](../architecture/plugin-system.md) -- complete plugin infrastructure deep dive
- [Architecture > Writing Plugins](../architecture/writing-plugins.md) -- step-by-step guide for plugin authors
- [Architecture > Built-in Plugins](../architecture/built-in-plugins.md) -- reference for all 11 built-in plugins
- [Architecture > Command System](../architecture/command-system.md) -- how chat commands work
- [Building Adapters](building-adapters.md) -- building adapter plugins specifically
