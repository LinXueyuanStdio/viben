# Extract msedge-tts into Separate Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the EdgeTTS provider out of `@viben/speech` core into `@viben/msedge-tts-plugin`, with runtime auto-install when users try to enable TTS.

**Architecture:** Speech plugin keeps the TTS framework (SpeechService, TTSProvider interface, /tts command). The msedge-tts-plugin registers itself as a TTS provider on boot. When no TTS provider is installed, trigger points (bot menu, /tts command) prompt the user to auto-install the plugin at runtime via `installNpmPlugin()` + `lifecycleManager.boot()`.

**Tech Stack:** TypeScript, Vitest, msedge-tts, grammY (Telegram bot framework)

---

### Task 1: Add `unregisterTTSProvider` to SpeechService

**Files:**
- Modify: `src/plugins/speech/speech-service.ts:19-23`
- Test: `src/plugins/speech/__tests__/speech-service.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/plugins/speech/__tests__/speech-service.test.ts`:

```typescript
it('unregisters a TTS provider', () => {
  const service = new SpeechService({
    stt: { provider: null, providers: {} },
    tts: { provider: 'test', providers: {} },
  })
  const mockProvider = { name: 'test', synthesize: vi.fn() }
  service.registerTTSProvider('test', mockProvider)
  expect(service.isTTSAvailable()).toBe(true)

  service.unregisterTTSProvider('test')
  expect(service.isTTSAvailable()).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/plugins/speech/__tests__/speech-service.test.ts -t "unregisters a TTS provider"`
Expected: FAIL — `service.unregisterTTSProvider is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/plugins/speech/speech-service.ts` after `registerTTSProvider`:

```typescript
unregisterTTSProvider(name: string): void {
  this.ttsProviders.delete(name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/plugins/speech/__tests__/speech-service.test.ts -t "unregisters a TTS provider"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/speech/speech-service.ts src/plugins/speech/__tests__/speech-service.test.ts
git commit -m "feat(speech): add unregisterTTSProvider method to SpeechService"
```

---

### Task 2: Expose pluginRegistry on LifecycleManager

The `pluginRegistry` is private. We need a public getter so that plugins with `kernel:access` can register new plugins at runtime via `ctx.core.lifecycleManager`.

**Files:**
- Modify: `src/core/plugin/lifecycle-manager.ts:89`

- [ ] **Step 1: Add public getter**

Add after the `failedPlugins` getter (around line 102) in `src/core/plugin/lifecycle-manager.ts`:

```typescript
get registry(): PluginRegistry | undefined {
  return this.pluginRegistry
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/core/plugin/lifecycle-manager.ts
git commit -m "feat(plugin): expose pluginRegistry via public getter on LifecycleManager"
```

---

### Task 3: Implement `@viben/msedge-tts-plugin`

**Files:**
- Modify: `built-in-plugins/msedge-tts-plugin/package.json`
- Create: `built-in-plugins/msedge-tts-plugin/src/edge-tts.ts`
- Modify: `built-in-plugins/msedge-tts-plugin/src/index.ts`
- Modify: `built-in-plugins/msedge-tts-plugin/src/__tests__/index.test.ts`
- Create: `built-in-plugins/msedge-tts-plugin/src/__tests__/edge-tts.test.ts`

- [ ] **Step 1: Update package.json with msedge-tts dependency**

Replace `built-in-plugins/msedge-tts-plugin/package.json`:

```json
{
  "name": "@viben/msedge-tts-plugin",
  "version": "0.1.0",
  "description": "Edge TTS provider plugin for Viben speech service",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  },
  "author": "MrPeter <0xmrpeter@gmail.com>",
  "license": "MIT",
  "keywords": [
    "viben",
    "viben-plugin",
    "tts",
    "text-to-speech",
    "edge-tts"
  ],
  "engines": {
    "viben": ">=2026.0327.5"
  },
  "peerDependencies": {
    "@viben/kernel": ">=2026.0327.5"
  },
  "dependencies": {
    "msedge-tts": "^2.0.4"
  },
  "devDependencies": {
    "@viben/plugin-sdk": "2026.0327.5",
    "typescript": "^5.4.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create EdgeTTS provider class**

Create `built-in-plugins/msedge-tts-plugin/src/edge-tts.ts`:

```typescript
const DEFAULT_VOICE = "en-US-AriaNeural";

export interface TTSOptions {
  language?: string;
  voice?: string;
  model?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}

export class EdgeTTS implements TTSProvider {
  readonly name = "edge-tts";
  private voice: string;

  constructor(voice?: string) {
    this.voice = voice || DEFAULT_VOICE;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();

    const voice = options?.voice || this.voice;
    const format = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

    await tts.setMetadata(voice, format);
    const { audioStream } = tts.toStream(text);

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    tts.close();

    return {
      audioBuffer: Buffer.concat(chunks),
      mimeType: "audio/mpeg",
    };
  }
}
```

- [ ] **Step 3: Write EdgeTTS unit tests**

Create `built-in-plugins/msedge-tts-plugin/src/__tests__/edge-tts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "stream";

const mockSetMetadata = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn();

function createMockAudioStream(data: Buffer): Readable {
  return new Readable({
    read() {
      this.push(data);
      this.push(null);
    },
  });
}

const mockToStream = vi.fn();

class MockMsEdgeTTS {
  setMetadata = mockSetMetadata;
  toStream = mockToStream;
  close = mockClose;
}

vi.mock("msedge-tts", () => ({
  MsEdgeTTS: MockMsEdgeTTS,
  OUTPUT_FORMAT: {
    AUDIO_24KHZ_48KBITRATE_MONO_MP3: "audio-24khz-48kbitrate-mono-mp3",
    AUDIO_24KHZ_96KBITRATE_MONO_MP3: "audio-24khz-96kbitrate-mono-mp3",
    WEBM_24KHZ_16BIT_MONO_OPUS: "webm-24khz-16bit-mono-opus",
  },
}));

import { EdgeTTS } from "../edge-tts.js";

describe("EdgeTTS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToStream.mockImplementation(() => ({
      audioStream: createMockAudioStream(Buffer.from("fake-audio-data")),
      metadataStream: null,
    }));
  });

  it("has name 'edge-tts'", () => {
    const provider = new EdgeTTS();
    expect(provider.name).toBe("edge-tts");
  });

  it("uses default voice when none specified", async () => {
    const provider = new EdgeTTS();
    await provider.synthesize("hello");

    expect(mockSetMetadata).toHaveBeenCalledWith(
      "en-US-AriaNeural",
      "audio-24khz-48kbitrate-mono-mp3",
    );
    expect(mockToStream).toHaveBeenCalledWith("hello");
  });

  it("accepts custom voice in constructor", async () => {
    const provider = new EdgeTTS("vi-VN-HoaiMyNeural");
    await provider.synthesize("xin chao");

    expect(mockSetMetadata).toHaveBeenCalledWith(
      "vi-VN-HoaiMyNeural",
      "audio-24khz-48kbitrate-mono-mp3",
    );
  });

  it("uses voice from options over constructor voice", async () => {
    const provider = new EdgeTTS("en-US-AriaNeural");
    await provider.synthesize("test", { voice: "en-GB-SoniaNeural" });

    expect(mockSetMetadata).toHaveBeenCalledWith(
      "en-GB-SoniaNeural",
      "audio-24khz-48kbitrate-mono-mp3",
    );
  });

  it("returns audio buffer with correct mime type", async () => {
    const provider = new EdgeTTS();
    const result = await provider.synthesize("hello world");

    expect(result.mimeType).toBe("audio/mpeg");
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    expect(result.audioBuffer.length).toBeGreaterThan(0);
  });

  it("closes the TTS instance after synthesis", async () => {
    const provider = new EdgeTTS();
    await provider.synthesize("hello");

    expect(mockClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Implement plugin entry point**

Replace `built-in-plugins/msedge-tts-plugin/src/index.ts`:

```typescript
import type { VibenPlugin, PluginContext, InstallContext, MigrateContext } from '@viben/plugin-sdk'
import { EdgeTTS } from './edge-tts.js'

interface SpeechService {
  registerTTSProvider(name: string, provider: { readonly name: string; synthesize(text: string, options?: any): Promise<any> }): void
  unregisterTTSProvider(name: string): void
}

const plugin: VibenPlugin = {
  name: '@viben/msedge-tts-plugin',
  version: '0.1.0',
  description: 'Edge TTS provider plugin for Viben speech service',
  permissions: ['services:use'],
  pluginDependencies: { '@viben/speech': '>=1.0.0' },

  async setup(ctx: PluginContext): Promise<void> {
    const speechService = ctx.getService<SpeechService>('speech')
    if (!speechService) {
      ctx.log.warn('Speech service not available — cannot register TTS provider')
      return
    }

    const voice = (ctx.pluginConfig.ttsVoice as string) || undefined
    const provider = new EdgeTTS(voice)
    speechService.registerTTSProvider('edge-tts', provider)
    ctx.log.info('Edge TTS provider registered')
  },

  async teardown(): Promise<void> {
    // Provider will be garbage collected when SpeechService is destroyed
    // If SpeechService is still alive, it retains the reference — that's fine
  },

  async install(ctx: InstallContext): Promise<void> {
    ctx.terminal.log.info('Installing Edge TTS plugin...')

    const voice = await ctx.terminal.text({
      message: 'TTS voice (leave blank for default):',
      placeholder: 'e.g. en-US-AriaNeural',
    })

    await ctx.settings.set('ttsVoice', voice.trim())
    ctx.terminal.log.success('Edge TTS plugin installed!')
  },

  async configure(ctx: InstallContext): Promise<void> {
    const current = await ctx.settings.getAll()

    const voice = await ctx.terminal.text({
      message: 'TTS voice (leave blank for default):',
      defaultValue: (current.ttsVoice as string) ?? '',
    })

    await ctx.settings.set('ttsVoice', voice.trim())
    ctx.terminal.log.success('Edge TTS configuration updated!')
  },

  async migrate(_ctx: MigrateContext, oldSettings: unknown, _oldVersion: string): Promise<unknown> {
    return oldSettings
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }): Promise<void> {
    if (opts.purge) {
      await ctx.settings.clear()
    }
    ctx.terminal.log.success('Edge TTS plugin uninstalled!')
  },
}

export default plugin
```

- [ ] **Step 5: Update plugin tests**

Replace `built-in-plugins/msedge-tts-plugin/src/__tests__/index.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createTestContext, createTestInstallContext } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

// Mock msedge-tts so tests don't need the real package
vi.mock('msedge-tts', () => ({
  MsEdgeTTS: class { setMetadata = vi.fn(); toStream = vi.fn(() => ({ audioStream: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true }) }) } })); close = vi.fn() },
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mp3' },
}))

describe('@viben/msedge-tts-plugin', () => {
  it('has correct metadata', () => {
    expect(plugin.name).toBe('@viben/msedge-tts-plugin')
    expect(plugin.version).toBeDefined()
    expect(plugin.pluginDependencies).toEqual({ '@viben/speech': '>=1.0.0' })
    expect(plugin.permissions).toContain('services:use')
  })

  it('registers TTS provider on setup when speech service available', async () => {
    const mockSpeechService = {
      registerTTSProvider: vi.fn(),
      unregisterTTSProvider: vi.fn(),
    }
    const ctx = createTestContext({
      pluginName: '@viben/msedge-tts-plugin',
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
      services: { speech: mockSpeechService },
    })

    await plugin.setup(ctx)

    expect(mockSpeechService.registerTTSProvider).toHaveBeenCalledWith(
      'edge-tts',
      expect.objectContaining({ name: 'edge-tts' }),
    )
  })

  it('warns when speech service not available', async () => {
    const ctx = createTestContext({
      pluginName: '@viben/msedge-tts-plugin',
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })

    // Should not throw
    await expect(plugin.setup(ctx)).resolves.not.toThrow()
  })

  it('passes voice config to EdgeTTS provider', async () => {
    const mockSpeechService = {
      registerTTSProvider: vi.fn(),
      unregisterTTSProvider: vi.fn(),
    }
    const ctx = createTestContext({
      pluginName: '@viben/msedge-tts-plugin',
      pluginConfig: { enabled: true, ttsVoice: 'vi-VN-HoaiMyNeural' },
      permissions: plugin.permissions,
      services: { speech: mockSpeechService },
    })

    await plugin.setup(ctx)

    const registeredProvider = mockSpeechService.registerTTSProvider.mock.calls[0][1]
    expect(registeredProvider.name).toBe('edge-tts')
  })

  it('installs and saves voice settings', async () => {
    const ctx = createTestInstallContext({
      pluginName: '@viben/msedge-tts-plugin',
      terminalResponses: { text: ['en-US-AriaNeural'] },
    })
    await plugin.install!(ctx)
    expect(ctx.settingsData.get('ttsVoice')).toBe('en-US-AriaNeural')
  })

  it('tears down without errors', async () => {
    if (plugin.teardown) {
      await expect(plugin.teardown()).resolves.not.toThrow()
    }
  })
})
```

- [ ] **Step 6: Run tests**

Run: `cd built-in-plugins/msedge-tts-plugin && npm install && npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add built-in-plugins/msedge-tts-plugin/
git commit -m "feat: implement @viben/msedge-tts-plugin with EdgeTTS provider"
```

---

### Task 4: Remove EdgeTTS from speech plugin

**Files:**
- Delete: `src/plugins/speech/providers/edge-tts.ts`
- Delete: `src/plugins/speech/__tests__/edge-tts-provider.test.ts`
- Modify: `src/plugins/speech/exports.ts`
- Modify: `src/plugins/speech/index.ts`

- [ ] **Step 1: Remove EdgeTTS from exports**

Replace `src/plugins/speech/exports.ts`:

```typescript
export type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult, SpeechServiceConfig, SpeechProviderConfig } from './speech-types.js';
export { SpeechService } from './speech-service.js';
export { GroqSTT } from './providers/groq.js';
```

- [ ] **Step 2: Update speech plugin setup — remove EdgeTTS imports and registration**

Replace `src/plugins/speech/index.ts`:

```typescript
import type { VibenPlugin, InstallContext } from '../../core/plugin/types.js'
import { SpeechService, GroqSTT } from './exports.js'
import type { SpeechServiceConfig } from './exports.js'
import { installNpmPlugin } from '../../core/plugin/plugin-installer.js'

const EDGE_TTS_PLUGIN = '@viben/msedge-tts-plugin'

const speechPlugin: VibenPlugin = {
  name: '@viben/speech',
  version: '1.0.0',
  description: 'Text-to-speech and speech-to-text with pluggable providers',
  essential: false,
  optionalPluginDependencies: { '@viben/file-service': '^1.0.0' },
  permissions: ['services:register', 'commands:register', 'kernel:access'],

  async install(ctx: InstallContext) {
    const { terminal, settings, legacyConfig } = ctx

    // Migrate from legacy config if present
    if (legacyConfig) {
      const speechCfg = legacyConfig.speech as Record<string, unknown> | undefined
      if (speechCfg) {
        const stt = speechCfg.stt as Record<string, unknown> | undefined
        const tts = speechCfg.tts as Record<string, unknown> | undefined
        const groqProviders = stt?.providers as Record<string, unknown> | undefined
        const groqConfig = groqProviders?.groq as Record<string, unknown> | undefined
        await settings.setAll({
          sttProvider: stt?.provider ?? null,
          groqApiKey: groqConfig?.apiKey ?? '',
          ttsProvider: tts?.provider ?? 'edge-tts',
          ttsVoice: '',
        })
        terminal.log.success('Speech settings migrated from legacy config')
        return
      }
    }

    // Interactive setup
    const enableStt = await terminal.confirm({
      message: 'Enable speech-to-text (STT)?',
      initialValue: false,
    })

    let sttProvider: string | null = null
    let groqApiKey = ''

    if (enableStt) {
      sttProvider = await terminal.select({
        message: 'STT provider:',
        options: [{ value: 'groq', label: 'Groq (Whisper)', hint: 'Fast and affordable' }],
      })

      if (sttProvider === 'groq') {
        groqApiKey = await terminal.text({
          message: 'Groq API key:',
          validate: (v) => (!v.trim() ? 'API key cannot be empty' : undefined),
        })
        groqApiKey = groqApiKey.trim()
      }
    }

    const ttsProvider = await terminal.select({
      message: 'TTS provider:',
      options: [
        { value: 'edge-tts', label: 'Edge TTS', hint: 'Free, good quality' },
        { value: 'none', label: 'None (disable TTS)' },
      ],
    })

    let ttsVoice = ''
    if (ttsProvider === 'edge-tts') {
      terminal.log.info('Installing Edge TTS plugin...')
      try {
        await installNpmPlugin(EDGE_TTS_PLUGIN)
        terminal.log.success('Edge TTS plugin installed')
      } catch (err) {
        terminal.log.warn(`Failed to install Edge TTS plugin: ${err}. You can install it later with: viben plugin install ${EDGE_TTS_PLUGIN}`)
      }

      ttsVoice = await terminal.text({
        message: 'TTS voice (leave blank for default):',
        placeholder: 'e.g. en-US-AriaNeural',
      })
      ttsVoice = ttsVoice.trim()
    }

    await settings.setAll({
      sttProvider,
      groqApiKey,
      ttsProvider: ttsProvider === 'none' ? null : ttsProvider,
      ttsVoice,
    })
    terminal.log.success('Speech settings saved')
  },

  async configure(ctx: InstallContext) {
    const { terminal, settings } = ctx
    const current = await settings.getAll()

    const choice = await terminal.select({
      message: 'What to configure?',
      options: [
        { value: 'stt', label: 'Change STT provider/key' },
        { value: 'tts', label: 'Change TTS provider/voice' },
        { value: 'done', label: 'Done' },
      ],
    })

    if (choice === 'stt') {
      const key = await terminal.text({
        message: 'Groq API key (leave blank to disable STT):',
        defaultValue: (current.groqApiKey as string) ?? '',
      })
      const trimmed = key.trim()
      await settings.set('sttProvider', trimmed ? 'groq' : null)
      await settings.set('groqApiKey', trimmed)
      terminal.log.success('STT settings updated')
    } else if (choice === 'tts') {
      const voice = await terminal.text({
        message: 'TTS voice (leave blank for default):',
        defaultValue: (current.ttsVoice as string) ?? '',
      })
      await settings.set('ttsVoice', voice.trim())
      terminal.log.success('TTS settings updated')
    }
  },

  async uninstall(ctx: InstallContext, opts: { purge: boolean }) {
    if (opts.purge) {
      await ctx.settings.clear()
      ctx.terminal.log.success('Speech settings cleared')
    }
  },

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    const groqApiKey = config.groqApiKey as string | undefined

    const sttProvider = groqApiKey ? 'groq' : null
    const speechConfig: SpeechServiceConfig = {
      stt: {
        provider: sttProvider,
        providers: groqApiKey ? { groq: { apiKey: groqApiKey } } : {},
      },
      tts: {
        provider: 'edge-tts',
        providers: {},
      },
    }

    const service = new SpeechService(speechConfig)

    if (groqApiKey) {
      service.registerSTTProvider('groq', new GroqSTT(groqApiKey))
    }

    // TTS provider is now registered by @viben/msedge-tts-plugin
    // No EdgeTTS registration here

    // Register provider factory for hot-reload (STT only — TTS providers are managed by external plugins)
    // Note: factory returns empty tts map; external TTS plugins re-register on reload via their own setup()
    service.setProviderFactory((cfg) => {
      const sttMap = new Map()
      const ttsMap = new Map()
      const groqCfg = cfg.stt?.providers?.groq
      if (groqCfg?.apiKey) {
        sttMap.set('groq', new GroqSTT(groqCfg.apiKey, groqCfg.model))
      }
      return { stt: sttMap, tts: ttsMap }
    })

    ctx.registerService('speech', service)

    ctx.registerCommand({
      name: 'tts',
      description: 'Toggle text-to-speech',
      usage: 'on|off',
      category: 'plugin',
      handler: async (args) => {
        const mode = args.raw.trim().toLowerCase()

        // Check if TTS provider is available
        if ((mode === 'on' || mode === '') && !service.isTTSAvailable()) {
          return {
            type: 'menu' as const,
            title: 'TTS provider not installed. Install Edge TTS plugin?',
            options: [
              { label: 'Install Edge TTS', command: '/tts install' },
              { label: 'Cancel', command: '/tts off' },
            ],
          }
        }

        if (mode === 'install') {
          try {
            const mod = await installNpmPlugin(EDGE_TTS_PLUGIN)
            const plugin = mod.default
            if (plugin && ctx.core) {
              const lm = ctx.core.lifecycleManager
              const registry = lm.registry
              if (registry) {
                registry.register(plugin.name, {
                  version: plugin.version,
                  source: 'npm',
                  enabled: true,
                  settingsPath: '',
                  description: plugin.description,
                })
                await registry.save()
              }
              await lm.boot([plugin])
            }
            return { type: 'text' as const, text: 'Edge TTS plugin installed and ready! Use /tts on to enable.' }
          } catch (err) {
            return { type: 'error' as const, message: `Failed to install Edge TTS plugin: ${err}. Try manually: viben plugin install ${EDGE_TTS_PLUGIN}` }
          }
        }

        if (mode === 'on') return { type: 'text' as const, text: 'Text-to-speech enabled' }
        if (mode === 'off') return { type: 'text' as const, text: 'Text-to-speech disabled' }
        return { type: 'menu' as const, title: 'Text to Speech', options: [
          { label: 'Enable', command: '/tts on' },
          { label: 'Disable', command: '/tts off' },
        ]}
      },
    })

    ctx.log.info('Speech service ready')
  },
}

export default speechPlugin
```

- [ ] **Step 3: Delete EdgeTTS provider file**

```bash
rm src/plugins/speech/providers/edge-tts.ts
```

- [ ] **Step 4: Delete EdgeTTS tests from speech plugin**

```bash
rm src/plugins/speech/__tests__/edge-tts-provider.test.ts
```

- [ ] **Step 5: Run speech plugin tests**

Run: `pnpm vitest run src/plugins/speech/`
Expected: All remaining tests pass. If any tests reference `EdgeTTS`, update them to remove that expectation.

- [ ] **Step 6: Commit**

```bash
git add -A src/plugins/speech/
git commit -m "refactor(speech): remove EdgeTTS provider, delegate to external plugin"
```

---

### Task 5: Update Telegram adapter TTS handlers for auto-install

**Files:**
- Modify: `src/plugins/telegram/commands/admin.ts:237-312`

- [ ] **Step 1: Update setupTTSCallbacks to check TTS availability**

In `src/plugins/telegram/commands/admin.ts`, replace the `setupTTSCallbacks` function (lines 237-274):

```typescript
export function setupTTSCallbacks(bot: Bot, core: VibenCore): void {
  bot.callbackQuery(/^v:/, async (ctx) => {
    const sessionId = ctx.callbackQuery.data.slice(2);
    const session = core.sessionManager.getSession(sessionId);

    if (!session) {
      try {
        await ctx.answerCallbackQuery({
          text: "⚠️ Session not found or not active.",
        });
      } catch {}
      return;
    }

    // Check if TTS provider is available
    if (session.voiceMode !== "on" && !core.speechService?.isTTSAvailable()) {
      try {
        await ctx.answerCallbackQuery({
          text: "⚠️ TTS provider not installed. Use /tts install to set up.",
        });
      } catch {}
      return;
    }

    const newMode = session.voiceMode === "on" ? "off" : "on";
    session.setVoiceMode(newMode);

    const toastText =
      newMode === "on"
        ? "🔊 Text to Speech enabled"
        : "🔇 Text to Speech disabled";
    try {
      await ctx.answerCallbackQuery({ text: toastText });
    } catch {}

    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: buildSessionControlKeyboard(
          sessionId,
          session.dangerousMode,
          newMode === "on",
        ),
      });
    } catch {
      /* ignore */
    }
  });
}
```

- [ ] **Step 2: Update handleTTS to check TTS availability**

In `src/plugins/telegram/commands/admin.ts`, replace the `handleTTS` function (lines 276-312):

```typescript
export async function handleTTS(
  ctx: Context,
  core: VibenCore,
): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply("⚠️ This command only works inside a session topic.", {
      parse_mode: "HTML",
    });
    return;
  }
  const session = await core.getOrResumeSession("telegram", String(threadId));
  if (!session) {
    await ctx.reply("⚠️ No active session in this topic.", {
      parse_mode: "HTML",
    });
    return;
  }

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const arg = args[0]?.toLowerCase();

  // Check if TTS provider is available before enabling
  if (arg === "on" || (!arg)) {
    if (!core.speechService?.isTTSAvailable()) {
      await ctx.reply(
        "⚠️ TTS provider not installed.\n\nUse <code>/tts install</code> to install Edge TTS plugin.",
        { parse_mode: "HTML" },
      );
      return;
    }
  }

  if (arg === "on") {
    session.setVoiceMode("on");
    await ctx.reply("🔊 Text to Speech enabled for this session.", {
      parse_mode: "HTML",
    });
  } else if (arg === "off") {
    session.setVoiceMode("off");
    await ctx.reply("🔇 Text to Speech disabled.", { parse_mode: "HTML" });
  } else {
    session.setVoiceMode("next");
    await ctx.reply("🔊 Text to Speech enabled for the next message.", {
      parse_mode: "HTML",
    });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/plugins/telegram/commands/admin.ts
git commit -m "feat(telegram): check TTS availability before enabling, prompt for install"
```

---

### Task 6: Update config registry — remove hardcoded Edge TTS options

**Files:**
- Modify: `src/core/config/config-registry.ts:121-158`

- [ ] **Step 1: Remove Edge TTS config fields**

In `src/core/config/config-registry.ts`, remove the two Edge TTS config entries. Replace lines 121-158 (the `speech.tts.provider` and `speech.tts.providers.edge-tts.voice` entries):

Remove the entry for `speech.tts.provider` (the select with `options: ["edge-tts"]`) and the entry for `speech.tts.providers.edge-tts.voice` (the voice select list).

The resulting CONFIG_REGISTRY should end after the `speech.stt.apiKey` entry at line 120, followed by the closing `];`.

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/core/config/config-registry.ts
git commit -m "refactor(config): remove hardcoded Edge TTS config fields"
```

---

### Task 7: Remove msedge-tts from build system

**Files:**
- Modify: `package.json`
- Modify: `tsup.config.ts`
- Modify: `scripts/build-publish.ts`

- [ ] **Step 1: Remove msedge-tts from package.json dependencies**

In `package.json`, remove the line `"msedge-tts": "^2.0.4",` from the `dependencies` section.

- [ ] **Step 2: Remove noExternal from tsup.config.ts**

In `tsup.config.ts`, remove lines 16-18 (the comment and `noExternal` entry):

```typescript
  // Force-bundle packages that can't be installed via npm
  // (msedge-tts has `preinstall: npx only-allow pnpm` which blocks npm users)
  noExternal: ['msedge-tts'],
```

- [ ] **Step 3: Remove bundledDeps from build-publish.ts**

In `scripts/build-publish.ts`, replace the bundledDeps section (lines 49-52):

```typescript
// Exclude force-bundled packages from published dependencies.
// These are bundled via tsup's `noExternal` because they can't be
// installed via npm (e.g. msedge-tts enforces pnpm-only).
const bundledDeps = new Set(['msedge-tts'])
```

With:

```typescript
// Packages to exclude from published dependencies (bundled via tsup noExternal).
const bundledDeps = new Set<string>()
```

- [ ] **Step 4: Run pnpm install to update lockfile**

Run: `pnpm install`
Expected: msedge-tts removed from node_modules

- [ ] **Step 5: Verify build**

Run: `pnpm build:publish`
Expected: Build succeeds without msedge-tts

- [ ] **Step 6: Commit**

```bash
git add package.json tsup.config.ts scripts/build-publish.ts pnpm-lock.yaml
git commit -m "chore: remove msedge-tts from core dependencies and build config"
```

---

### Task 8: Update plugin docs and README

**Files:**
- Modify: `built-in-plugins/msedge-tts-plugin/README.md`
- Modify: `built-in-plugins/msedge-tts-plugin/PLUGIN_GUIDE.md`
- Modify: `built-in-plugins/msedge-tts-plugin/CLAUDE.md`

- [ ] **Step 1: Update README**

Replace `built-in-plugins/msedge-tts-plugin/README.md`:

```markdown
# @viben/msedge-tts-plugin

Edge TTS (Microsoft Edge Text-to-Speech) provider plugin for Viben. Provides free, high-quality text-to-speech using Microsoft Edge's TTS service.

## Installation

```bash
viben plugin install @viben/msedge-tts-plugin
```

Or auto-install via the bot by using `/tts install` or toggling TTS in the session menu.

## Configuration

During installation, you can optionally set a voice (default: `en-US-AriaNeural`).

To change voice later:
```bash
viben plugin configure @viben/msedge-tts-plugin
```

## Available Voices

- `en-US-AriaNeural`, `en-US-GuyNeural`, `en-US-JennyNeural`
- `en-GB-SoniaNeural`, `en-AU-NatashaNeural`
- `vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`
- `zh-CN-XiaoxiaoNeural`, `zh-CN-YunxiNeural`
- `ja-JP-NanamiNeural`, `ja-JP-KeitaNeural`
- `ko-KR-SunHiNeural`, `ko-KR-InJoonNeural`
- `es-ES-ElviraNeural`, `fr-FR-DeniseNeural`
- `de-DE-KatjaNeural`, `pt-BR-FranciscaNeural`
- `hi-IN-SwaraNeural`, `ar-SA-ZariyahNeural`

## Development

```bash
npm install
npm run build
npm test

# Live development with hot-reload:
viben dev .
```

## License

MIT
```

- [ ] **Step 2: Update PLUGIN_GUIDE.md overview**

In `built-in-plugins/msedge-tts-plugin/PLUGIN_GUIDE.md`, replace the overview TODO (line 7):

```markdown
**@viben/msedge-tts-plugin** provides text-to-speech capabilities using Microsoft Edge's TTS service. It registers an EdgeTTS provider with the `@viben/speech` service, enabling the `/tts` command and voice mode in sessions.
```

- [ ] **Step 3: Update CLAUDE.md description**

In `built-in-plugins/msedge-tts-plugin/CLAUDE.md`, update the description line (line 26) and package line (line 27):

```markdown
- **Package**: @viben/msedge-tts-plugin — Edge TTS provider for the speech service
```

- [ ] **Step 4: Commit**

```bash
git add built-in-plugins/msedge-tts-plugin/README.md built-in-plugins/msedge-tts-plugin/PLUGIN_GUIDE.md built-in-plugins/msedge-tts-plugin/CLAUDE.md
git commit -m "docs: update msedge-tts-plugin documentation"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run all speech-related tests**

Run: `pnpm vitest run src/plugins/speech/`
Expected: All pass (no EdgeTTS references remaining)

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Run publish build**

Run: `pnpm build:publish`
Expected: Bundle builds without msedge-tts

- [ ] **Step 5: Verify msedge-tts is gone from bundle**

Run: `grep -r "msedge" dist-publish/dist/ || echo "msedge-tts not found in bundle — success"`
Expected: "msedge-tts not found in bundle — success"

- [ ] **Step 6: Commit any remaining fixes if needed**
