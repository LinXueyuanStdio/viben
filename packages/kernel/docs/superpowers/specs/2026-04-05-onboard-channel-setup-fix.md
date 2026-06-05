# Fix: Onboard Channel Setup Flow

## Problem Summary

The `configureChannels()` flow in `src/core/setup/setup-channels.ts` has three bugs
that cause incorrect behavior during `viben onboard` (reconfigure mode):

1. **Wrong hook called**: When a channel is NOT yet configured, the code calls
   `plugin.configure()` instead of `plugin.install()`, giving the user a
   field-by-field edit form instead of the full guided setup wizard.
2. **Discord import broken**: `configureViaPlugin('discord', ...)` tries
   `import('discord')`, which always fails silently — no setup flow runs at all.
3. **Discord status detection uses wrong plugin name**: `getChannelStatuses()` reads
   settings from `@viben/adapter-discord`, but the installed package may register
   under a different name (e.g. `@viben/discord-adapter`), causing a configured
   adapter to always appear as "not configured".

---

## Root Cause Trace

### Bug 1 — `configureViaPlugin()` always calls `configure()`

```
configureChannels()
  ├── isConfigured = false  → falls through (no prompt)
  └── configureViaPlugin()  → always calls plugin.configure()   ← WRONG
                                        should call plugin.install()
```

The `configure()` hook on the Telegram plugin shows "Change bot token" /
"Change chat ID" as separate fields. The `install()` hook runs the full guided
flow (validate token → detect chat ID → confirm admin). A first-time setup
must use `install()`.

**Fix:** Pass `isConfigured` to `configureViaPlugin()` and branch:

```typescript
// if not yet configured → install (full guided setup)
if (!isConfigured && plugin.install) {
  await plugin.install(ctx);
// if already configured and user chose "modify" → configure (edit fields)
} else if (plugin.configure) {
  await plugin.configure(ctx);
}
```

---

### Bug 2 — Discord plugin import uses short channel ID

```typescript
// channelId = "discord" (key from CHANNEL_META)
const pluginModule = await import(channelId);   // import('discord') → FAIL
```

The CHANNEL_META key `"discord"` is a logical ID, not an npm package name.

**Fix:** Add a mapping from logical channel ID to npm package name, and use
that for dynamic import:

```typescript
const CHANNEL_PACKAGE_MAP: Record<string, string> = {
  discord: '@viben/discord-adapter',
  // add other community/official adapters here as they ship
};

const packageName = CHANNEL_PACKAGE_MAP[channelId] ?? channelId;
const pluginModule = await import(packageName);
```

---

### Bug 3 — Discord status detection reads wrong settings key

```typescript
// Hard-coded name that may not match what the plugin registered under
const ps = await settingsManager.loadSettings("@viben/adapter-discord");
```

Settings are stored under `plugin.name` as declared by the package itself.
If `@viben/discord-adapter` declares `name: "@viben/discord"`, the
settings file is at `<data>/@viben/discord/settings.json`, not
`@viben/adapter-discord/settings.json`.

**Fix:** Align the status-detection key with the same mapping used for import:

```typescript
} else if (settingsManager && id === "discord") {
  const ps = await settingsManager.loadSettings("@viben/discord-adapter"); // match plugin.name
  if (ps.guildId || ps.token) { ... }
}
```

> **Note:** Verify the exact `plugin.name` value from the Discord adapter
> package before applying this fix. The correct name can be confirmed by
> inspecting `node_modules/@viben/discord-adapter/dist/index.js` after a
> test install.

---

## Files to Change

| File | Changes |
|------|---------|
| `src/core/setup/setup-channels.ts` | Fix `configureViaPlugin()` signature + install/configure branch; fix Discord import; fix Discord status key |

---

## Generalization

The same pattern applies to any future community adapter added to `CHANNEL_META`.
The rule is:

- `CHANNEL_META` key = logical ID for display/routing
- `CHANNEL_PACKAGE_MAP` = logical ID → npm package name (for import)
- `getChannelStatuses()` = logical ID → plugin settings name (must match `plugin.name`)
- `configureViaPlugin()` = call `install()` for first-time, `configure()` for edit

These three mappings must be kept in sync whenever a new adapter is added.
