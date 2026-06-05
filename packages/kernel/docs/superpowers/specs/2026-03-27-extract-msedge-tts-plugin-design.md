# Extract msedge-tts into Separate Plugin

**Date:** 2026-03-27
**Status:** Draft

## Problem

`msedge-tts` is bundled into `@viben/kernel` core, adding weight to the main bundle. It also has a `preinstall: npx only-allow pnpm` script that forces the build system to use `noExternal` bundling workaround. TTS is an optional feature — users who don't need it shouldn't carry this dependency.

## Solution

Move the EdgeTTS provider implementation into `@viben/msedge-tts-plugin` (a separate npm package under `built-in-plugins/msedge-tts-plugin/`). The speech plugin (`@viben/speech`) retains the TTS framework (interfaces, SpeechService, /tts command) but no longer ships a TTS provider. When a user tries to enable TTS, the system auto-installs the plugin at runtime.

## Architecture

### Boot sequence

```
@viben/speech boots → registers SpeechService (no TTS provider)
                      → isTTSAvailable() returns false

@viben/msedge-tts-plugin boots (if installed)
  → getService('speech') → registerTTSProvider('edge-tts', new EdgeTTS(voice))
  → isTTSAvailable() now returns true
```

### Auto-install flow

When user triggers TTS (bot menu toggle, `/text_to_speech on`, `/tts on`) and no TTS provider is registered:

```
User triggers TTS
  → check speechService.isTTSAvailable()
  → false → reply: "TTS requires Edge TTS plugin. Install now?" [Yes] [No]
    → user confirms Yes
    → installNpmPlugin('@viben/msedge-tts-plugin')  // from plugin-installer.ts
    → pluginRegistry.register(name, { version, source: 'npm', enabled: true, ... })
    → lifecycleManager.boot([plugin])  // runtime load, no restart needed
    → plugin setup() → registerTTSProvider('edge-tts', ...)
    → reply: "Edge TTS installed and ready!"
    → auto-enable voiceMode on session
  → install fails (network error, npm failure)
    → reply: "Failed to install Edge TTS plugin: <error>. Try manually: viben plugin install @viben/msedge-tts-plugin"
    → do not crash, do not enable voiceMode
```

### Install wizard flow

When user runs `viben plugin install @viben/speech` or first-time setup:

```
Wizard asks: "TTS provider?" → [Edge TTS] [None]
  → user picks "Edge TTS"
  → installNpmPlugin('@viben/msedge-tts-plugin')  // npm install at install-time
  → prompt for voice selection
  → save ttsProvider: 'edge-tts', ttsVoice: '...' to speech settings
  → on next boot: msedge-tts-plugin boots and registers provider
```

## Component Changes

### 1. `@viben/msedge-tts-plugin` (new plugin — `built-in-plugins/msedge-tts-plugin/`)

**package.json:**
- Add `msedge-tts` as dependency (moved from root)
- `peerDependencies: { "@viben/kernel": ">=2026.0327.5" }`

**src/index.ts:**
- `pluginDependencies: { '@viben/speech': '>=1.0.0' }`
- `permissions: ['services:use']`
- `setup(ctx)`: get SpeechService via `ctx.getService('speech')`, call `registerTTSProvider('edge-tts', new EdgeTTS(voice))`
- `teardown()`: call `speechService.unregisterTTSProvider('edge-tts')`
- `install(ctx)`: prompt for voice selection, save to settings
- `configure(ctx)`: reconfigure voice

**src/edge-tts.ts:**
- Move `EdgeTTS` class from `src/plugins/speech/providers/edge-tts.ts`
- Identical implementation using dynamic `import('msedge-tts')`

**src/__tests__/:**
- Move `edge-tts-provider.test.ts` from speech plugin, adapt imports

### 2. `@viben/speech` plugin (`src/plugins/speech/`)

**Remove:**
- `providers/edge-tts.ts` — file deleted
- `EdgeTTS` import/usage from `index.ts` and `exports.ts`
- `service.registerTTSProvider('edge-tts', ...)` from `setup()`
- EdgeTTS from provider factory (only Groq STT remains in factory)
- `__tests__/edge-tts-provider.test.ts` — moved to msedge-tts-plugin

**Add to permissions:**
- `kernel:access` — needed to call `installNpmPlugin`, `pluginRegistry`, `lifecycleManager` for auto-install

**Add auto-install logic:**
- Helper function `autoInstallTTSPlugin(ctx: PluginContext)` that:
  1. Calls `installNpmPlugin('@viben/msedge-tts-plugin')`
  2. Registers in `ctx.core.pluginRegistry`
  3. Calls `ctx.core.lifecycleManager.boot([plugin])`
- `/tts` command handler: check `isTTSAvailable()`, if false → return confirm menu to install plugin
- Expose auto-install as part of command response flow

**Add to `SpeechService`:**
- `unregisterTTSProvider(name: string)` method — for plugin teardown cleanup

**Install wizard changes:**
- When user selects "Edge TTS" → call `installNpmPlugin('@viben/msedge-tts-plugin')` during install flow
- Keep voice prompt in speech plugin install (writes to speech settings, msedge-tts-plugin reads it)

### 3. Telegram adapter (`src/plugins/telegram/commands/admin.ts`)

**`handleTTS()`** (line 276-312):
- Before `session.setVoiceMode('on')`, check `speechService.isTTSAvailable()`
- If false → reply with confirm button "Install Edge TTS plugin?" using callback prefix (e.g. `ti:` for TTS install)
- On confirm callback → trigger `autoInstallTTSPlugin()` → then enable voiceMode

**`setupTTSCallbacks()`** (line 237-274):
- Same check: before toggling voice mode, verify TTS provider available
- If not → prompt install confirm instead of toggling

### 4. Config registry (`src/core/config/config-registry.ts`)

- `speech.tts.provider` select options: change from hardcoded `["edge-tts"]` to dynamic or empty. When no TTS plugin installed, settings UI shows "No TTS providers available".
- `speech.tts.providers.edge-tts.voice` field: move voice list into msedge-tts-plugin. Config registry only shows this if plugin is installed.

### 5. Build system

**`package.json`:**
- Remove `msedge-tts` from dependencies

**`tsup.config.ts`:**
- Remove `noExternal: ['msedge-tts']`

**`scripts/build-publish.ts`:**
- Remove `msedge-tts` from bundledDeps set

### 6. Backward compatibility

- Users with existing `speech.tts.provider: "edge-tts"` in config: speech plugin reads it but `isTTSAvailable()` returns false (no provider registered). First TTS trigger prompts auto-install.
- No data migration needed — settings format unchanged.
- Old EdgeTTS provider factory code removed, but SpeechService API unchanged.

## Testing

### msedge-tts-plugin tests
- Plugin metadata correctness
- `setup()` registers TTS provider into SpeechService mock
- `teardown()` unregisters provider
- `install()` saves voice settings
- EdgeTTS.synthesize() unit tests (moved from speech plugin)

### Speech plugin tests
- `setup()` no longer registers EdgeTTS by default
- `isTTSAvailable()` returns false when no TTS plugin installed
- `/tts on` returns install prompt when no provider available
- Auto-install flow (mock `installNpmPlugin` + `lifecycleManager.boot`)

### Telegram adapter tests
- TTS toggle button triggers install confirm when no provider
- Install confirm callback triggers auto-install
- After install, voiceMode toggles normally

## Files Changed

| Action | File |
|--------|------|
| **Create** | `built-in-plugins/msedge-tts-plugin/src/index.ts` |
| **Create** | `built-in-plugins/msedge-tts-plugin/src/edge-tts.ts` |
| **Create** | `built-in-plugins/msedge-tts-plugin/src/__tests__/index.test.ts` |
| **Create** | `built-in-plugins/msedge-tts-plugin/src/__tests__/edge-tts.test.ts` |
| **Edit** | `built-in-plugins/msedge-tts-plugin/package.json` |
| **Delete** | `src/plugins/speech/providers/edge-tts.ts` |
| **Delete** | `src/plugins/speech/__tests__/edge-tts-provider.test.ts` |
| **Edit** | `src/plugins/speech/index.ts` |
| **Edit** | `src/plugins/speech/exports.ts` |
| **Edit** | `src/plugins/speech/speech-service.ts` |
| **Edit** | `src/plugins/telegram/commands/admin.ts` |
| **Edit** | `src/core/config/config-registry.ts` |
| **Edit** | `package.json` |
| **Edit** | `tsup.config.ts` |
| **Edit** | `scripts/build-publish.ts` |
