# Plugins API Design

## Overview

Add a `/api/v1/plugins` route group to the `api-server` plugin to expose plugin management
capabilities to the Viben-App UI. Enables listing installed plugins, fetching the marketplace,
and managing plugin state (enable/disable/uninstall) with hot-reload via `LifecycleManager`.

## New Endpoints

### GET /plugins

List all installed plugins from `PluginRegistry`, enriched with live runtime state from
`LifecycleManager`.

**Response:**
```ts
{
  plugins: Array<{
    name: string           // e.g. "@viben/telegram"
    version: string
    description?: string
    source: 'builtin' | 'npm' | 'local'
    enabled: boolean       // from PluginRegistry
    loaded: boolean        // currently in lifecycleManager.loadedPlugins
    failed: boolean        // in lifecycleManager.failedPlugins
    essential: boolean     // see "Field Resolution" below
    hasConfigure: boolean  // see "Field Resolution" below
  }>
}
```

**Field Resolution for `essential` and `hasConfigure`:**

These fields come from the plugin definition (`VibenPlugin`), not the registry. Resolution order:

1. **Loaded plugins**: definition is in `lifecycleManager.loadOrder` → read directly.
2. **Failed plugins**: definition is still in `lifecycleManager.loadOrder` (added before boot fails) → read directly.
3. **Disabled builtin plugins**: look up by name in `corePlugins` array.
4. **Disabled npm plugins not loaded**: definition is unavailable → default `essential: false`, `hasConfigure: false`.

### GET /plugins/marketplace

Proxy to `RegistryClient.getRegistry()`. Cached per `RegistryClient` TTL (1 minute).
Each plugin entry includes an `installed` boolean derived from `PluginRegistry`.

**Response:**
```ts
{
  plugins: Array<RegistryPlugin & { installed: boolean }>
  categories: Array<{ id: string; name: string; icon: string }>
}
```

Returns 503 with `{ error: "Marketplace unavailable" }` if registry fetch fails and no cache exists.

### POST /plugins/:name/enable

Enable a plugin: sets `enabled = true` in `PluginRegistry`, then hot-loads the plugin.

**Loading logic by source:**
- `builtin`: plugin definition is in `corePlugins` — call `lifecycleManager.boot([plugin])` directly.
- `npm` / `local`: dynamically import the module via `importFromDir(name, pluginsDir)`, then call
  `lifecycleManager.boot([plugin])`. If import fails, return 500 with message "Plugin module could
  not be loaded. Try restarting the server."

**Responses:**
- **404** if plugin not in registry
- No-op if plugin is already loaded (idempotent, still returns 200)
- **500** if `boot()` fails (plugin enters `failed` state) or import fails

### POST /plugins/:name/disable

Disable a plugin: calls `lifecycleManager.unloadPlugin(name)`, then sets `enabled = false`
in `PluginRegistry`.

- **404** if plugin not in registry
- **409** if plugin `essential: true` — refuse with message "Essential plugins cannot be disabled"
- No-op if plugin is already unloaded (still sets `enabled = false`, returns 200)

### DELETE /plugins/:name

Uninstall a plugin: calls `lifecycleManager.unloadPlugin(name)`, removes from `PluginRegistry`,
saves registry.

- **400** if `source === 'builtin'` — refuse with message "Builtin plugins cannot be uninstalled. Use disable instead."
- **404** if plugin not in registry
- Does NOT remove npm package from disk (matches CLI behavior — user can re-enable by re-registering)

## RouteDeps Changes

`RouteDeps` in `routes/types.ts` needs one new optional field:

```ts
lifecycleManager?: LifecycleManager
```

Populated when registering the plugins route in `api-server/index.ts`.

Note: `settingsManager` is NOT needed here — plugin settings are managed by the plugins themselves,
not by plugin management endpoints.

## Authorization

All plugin routes require auth + `system:admin` scope (same as restart endpoint).

## Instance Context

The `lifecycleManager` is scoped to the running instance's `instanceRoot`. Plugin operations
always affect the connected instance only.

## Restart vs Hot-reload

| Action                      | Restart needed? | Method                                          |
|-----------------------------|-----------------|--------------------------------------------------|
| Install npm plugin          | Yes             | CLI command shown in app, app shows restart cmd  |
| Enable builtin plugin       | No              | `lifecycleManager.boot()` from `corePlugins`    |
| Enable npm plugin           | No (best effort)| `importFromDir()` + `lifecycleManager.boot()`   |
| Disable plugin              | No              | `lifecycleManager.unloadPlugin()`               |
| Uninstall plugin            | No              | `lifecycleManager.unloadPlugin()`               |
| Configure plugin (settings) | Yes             | CLI command shown in app, app shows restart cmd  |

## File Location

`src/plugins/api-server/routes/plugins.ts`

Registered in `src/plugins/api-server/index.ts` under prefix `/plugins` with auth enabled.
