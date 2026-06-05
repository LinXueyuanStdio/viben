# Speech Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pluggable speech module (STT/TTS) to Viben with Groq Whisper as default STT provider, integrated into the message flow so voice messages are automatically transcribed when the agent doesn't support audio.

**Architecture:** New `src/core/speech/` folder with provider interfaces (`STTProvider`, `TTSProvider`), a `SpeechService` orchestrator, and individual provider implementations. Integrates at `Session.processPrompt()` level to transcribe audio attachments before forwarding to the agent. Config uses provider-centric pattern where users can configure multiple providers and switch between them.

**Tech Stack:** Native `fetch` + `FormData` for API calls (no new dependencies), Zod for config validation, existing `FileService` for file operations.

**Spec:** `docs/superpowers/specs/2026-03-23-speech-module-design.md`

---

## File Structure

```
Create: src/core/speech/types.ts           — STTProvider, TTSProvider interfaces, options, results
Create: src/core/speech/speech-service.ts   — SpeechService orchestrator
Create: src/core/speech/providers/groq.ts   — Groq Whisper STT implementation
Create: src/core/speech/index.ts            — Public exports
Create: src/core/__tests__/speech-service.test.ts  — SpeechService tests
Create: src/core/__tests__/groq-provider.test.ts   — Groq provider tests
Modify: src/core/config.ts:60-93           — Add SpeechSchema to ConfigSchema
Modify: src/core/config.ts:247-302         — Add speech env overrides
Modify: src/core/config-registry.ts:16-84  — Add speech config fields
Modify: src/core/core.ts:35-59            — Create SpeechService, add hot-reload handler
Modify: src/core/session.ts:45-68         — Accept SpeechService in constructor
Modify: src/core/session.ts:127-150       — Add STT logic in processPrompt()
Modify: src/core/core.ts:179-230          — Pass speechService to Session constructor
Modify: src/adapters/telegram/adapter.ts:837-858 — Save original OGG alongside WAV
```

---

### Task 1: Speech Types

**Files:**
- Create: `src/core/speech/types.ts`

- [ ] **Step 1: Create speech types file**

```typescript
// src/core/speech/types.ts

export interface STTOptions {
  language?: string;
  model?: string;
}

export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface TTSOptions {
  language?: string;
  voice?: string;
  model?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
}

export interface STTProvider {
  readonly name: string;
  transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult>;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}

export interface SpeechProviderConfig {
  apiKey: string;
  model?: string;
  [key: string]: unknown;
}

export interface SpeechServiceConfig {
  stt: {
    provider: string | null;
    providers: Record<string, SpeechProviderConfig>;
  };
  tts: {
    provider: string | null;
    providers: Record<string, SpeechProviderConfig>;
  };
}
```

- [ ] **Step 2: Create index.ts barrel export**

```typescript
// src/core/speech/index.ts
export type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult, SpeechServiceConfig, SpeechProviderConfig } from './types.js';
export { SpeechService } from './speech-service.js';
```

Note: `speech-service.js` import will fail until Task 2 is done. That's fine — this file is created now and updated as we go.

- [ ] **Step 3: Verify TypeScript compiles the types**

Run: `npx tsc --noEmit src/core/speech/types.ts`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/speech/types.ts src/core/speech/index.ts
git commit -m "feat(speech): add provider interfaces and types"
```

---

### Task 2: SpeechService Orchestrator

**Files:**
- Create: `src/core/speech/speech-service.ts`
- Create: `src/core/__tests__/speech-service.test.ts`

- [ ] **Step 1: Write tests for SpeechService**

```typescript
// src/core/__tests__/speech-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpeechService } from "../speech/speech-service.js";
import type { STTProvider, SpeechServiceConfig } from "../speech/types.js";

function makeConfig(overrides?: Partial<SpeechServiceConfig>): SpeechServiceConfig {
  return {
    stt: { provider: null, providers: {} },
    tts: { provider: null, providers: {} },
    ...overrides,
  };
}

describe("SpeechService", () => {
  describe("isSTTAvailable", () => {
    it("returns false when no provider configured", () => {
      const svc = new SpeechService(makeConfig());
      expect(svc.isSTTAvailable()).toBe(false);
    });

    it("returns false when provider set but no matching config", () => {
      const svc = new SpeechService(makeConfig({
        stt: { provider: "groq", providers: {} },
      }));
      expect(svc.isSTTAvailable()).toBe(false);
    });

    it("returns true when provider configured with API key", () => {
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "groq",
          providers: { groq: { apiKey: "gsk_test" } },
        },
      }));
      expect(svc.isSTTAvailable()).toBe(true);
    });
  });

  describe("isTTSAvailable", () => {
    it("returns false when no provider configured", () => {
      const svc = new SpeechService(makeConfig());
      expect(svc.isTTSAvailable()).toBe(false);
    });
  });

  describe("transcribe", () => {
    it("throws when STT not configured", async () => {
      const svc = new SpeechService(makeConfig());
      await expect(svc.transcribe(Buffer.from("test"), "audio/wav"))
        .rejects.toThrow("STT not configured");
    });

    it("delegates to registered provider", async () => {
      const mockProvider: STTProvider = {
        name: "test",
        transcribe: vi.fn().mockResolvedValue({ text: "hello world" }),
      };

      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "test",
          providers: { test: { apiKey: "key123" } },
        },
      }));
      svc.registerSTTProvider("test", mockProvider);

      const result = await svc.transcribe(Buffer.from("audio"), "audio/wav");
      expect(result.text).toBe("hello world");
      expect(mockProvider.transcribe).toHaveBeenCalledWith(
        Buffer.from("audio"), "audio/wav", undefined,
      );
    });

    it("throws when provider not registered", async () => {
      const svc = new SpeechService(makeConfig({
        stt: {
          provider: "unknown",
          providers: { unknown: { apiKey: "key" } },
        },
      }));
      await expect(svc.transcribe(Buffer.from("test"), "audio/wav"))
        .rejects.toThrow('STT provider "unknown" not registered');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/__tests__/speech-service.test.ts`
Expected: FAIL (SpeechService not found)

- [ ] **Step 3: Implement SpeechService**

```typescript
// src/core/speech/speech-service.ts
import type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult, SpeechServiceConfig } from './types.js';

export class SpeechService {
  private sttProviders = new Map<string, STTProvider>();
  private ttsProviders = new Map<string, TTSProvider>();

  constructor(private config: SpeechServiceConfig) {}

  registerSTTProvider(name: string, provider: STTProvider): void {
    this.sttProviders.set(name, provider);
  }

  registerTTSProvider(name: string, provider: TTSProvider): void {
    this.ttsProviders.set(name, provider);
  }

  isSTTAvailable(): boolean {
    const { provider, providers } = this.config.stt;
    return provider !== null && providers[provider]?.apiKey !== undefined;
  }

  isTTSAvailable(): boolean {
    const { provider, providers } = this.config.tts;
    return provider !== null && providers[provider]?.apiKey !== undefined;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult> {
    const providerName = this.config.stt.provider;
    if (!providerName || !this.config.stt.providers[providerName]?.apiKey) {
      throw new Error("STT not configured. Set speech.stt.provider and API key in config.");
    }

    const provider = this.sttProviders.get(providerName);
    if (!provider) {
      throw new Error(`STT provider "${providerName}" not registered. Available: ${[...this.sttProviders.keys()].join(", ") || "none"}`);
    }

    return provider.transcribe(audioBuffer, mimeType, options);
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const providerName = this.config.tts.provider;
    if (!providerName || !this.config.tts.providers[providerName]?.apiKey) {
      throw new Error("TTS not configured. Set speech.tts.provider and API key in config.");
    }

    const provider = this.ttsProviders.get(providerName);
    if (!provider) {
      throw new Error(`TTS provider "${providerName}" not registered. Available: ${[...this.ttsProviders.keys()].join(", ") || "none"}`);
    }

    return provider.synthesize(text, options);
  }

  updateConfig(config: SpeechServiceConfig): void {
    this.config = config;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/__tests__/speech-service.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/speech/speech-service.ts src/core/__tests__/speech-service.test.ts
git commit -m "feat(speech): add SpeechService orchestrator with tests"
```

---

### Task 3: Groq STT Provider

**Files:**
- Create: `src/core/speech/providers/groq.ts`
- Create: `src/core/__tests__/groq-provider.test.ts`

- [ ] **Step 1: Write tests for Groq provider**

```typescript
// src/core/__tests__/groq-provider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GroqSTT } from "../speech/providers/groq.js";

describe("GroqSTT", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends correct request to Groq API", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "hello world" }),
    });

    const provider = new GroqSTT("gsk_test123", "whisper-large-v3-turbo");
    const result = await provider.transcribe(
      Buffer.from("fake-audio"), "audio/ogg",
    );

    expect(result.text).toBe("hello world");
    const call = (global.fetch as any).mock.calls[0];
    expect(call[0]).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    const opts = call[1];
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer gsk_test123");
    // Body is FormData
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it("passes language option when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "xin chao" }),
    });

    const provider = new GroqSTT("gsk_test", "whisper-large-v3-turbo");
    await provider.transcribe(Buffer.from("audio"), "audio/ogg", { language: "vi" });

    const body = (global.fetch as any).mock.calls[0][1].body as FormData;
    expect(body.get("language")).toBe("vi");
  });

  it("throws on 401 with helpful message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const provider = new GroqSTT("bad_key", "whisper-large-v3-turbo");
    await expect(provider.transcribe(Buffer.from("audio"), "audio/ogg"))
      .rejects.toThrow(/invalid.*api.*key/i);
  });

  it("throws on 429 with rate limit message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    const provider = new GroqSTT("gsk_test", "whisper-large-v3-turbo");
    await expect(provider.transcribe(Buffer.from("audio"), "audio/ogg"))
      .rejects.toThrow(/rate limit/i);
  });

  it("throws on 413 with file too large message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      text: () => Promise.resolve("Payload too large"),
    });

    const provider = new GroqSTT("gsk_test", "whisper-large-v3-turbo");
    await expect(provider.transcribe(Buffer.from("audio"), "audio/ogg"))
      .rejects.toThrow(/too large/i);
  });

  it("uses model override from options", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "test" }),
    });

    const provider = new GroqSTT("gsk_test", "whisper-large-v3-turbo");
    await provider.transcribe(Buffer.from("audio"), "audio/ogg", { model: "whisper-large-v3" });

    const body = (global.fetch as any).mock.calls[0][1].body as FormData;
    expect(body.get("model")).toBe("whisper-large-v3");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/__tests__/groq-provider.test.ts`
Expected: FAIL (GroqSTT not found)

- [ ] **Step 3: Implement Groq STT provider**

```typescript
// src/core/speech/providers/groq.ts
import type { STTProvider, STTOptions, STTResult } from '../types.js';

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export class GroqSTT implements STTProvider {
  readonly name = "groq";

  constructor(
    private apiKey: string,
    private defaultModel: string = "whisper-large-v3-turbo",
  ) {}

  async transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult> {
    const ext = mimeToExt(mimeType);
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: mimeType }), `audio${ext}`);
    form.append("model", options?.model || this.defaultModel);
    form.append("response_format", "verbose_json");
    if (options?.language) {
      form.append("language", options.language);
    }

    const resp = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!resp.ok) {
      const body = await resp.text();
      if (resp.status === 401) {
        throw new Error("Invalid Groq API key. Check your key at console.groq.com.");
      }
      if (resp.status === 413) {
        throw new Error("Audio file too large for Groq API (max 25MB).");
      }
      if (resp.status === 429) {
        throw new Error("Groq rate limit exceeded. Free tier: 28,800 seconds/day. Try again later.");
      }
      throw new Error(`Groq STT error (${resp.status}): ${body}`);
    }

    const data = await resp.json() as { text: string; language?: string; duration?: number };
    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
    };
  }
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm",
    "audio/flac": ".flac",
  };
  return map[mimeType] || ".bin";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/core/__tests__/groq-provider.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/speech/providers/groq.ts src/core/__tests__/groq-provider.test.ts
git commit -m "feat(speech): add Groq Whisper STT provider"
```

---

### Task 4: Config Schema Integration

**Files:**
- Modify: `src/core/config.ts:60-93` — Add SpeechSchema
- Modify: `src/core/config.ts:247-302` — Add env overrides
- Modify: `src/core/config-registry.ts:16-84` — Add registry entries

- [ ] **Step 1: Add SpeechSchema to config.ts**

In `src/core/config.ts`, before the `ConfigSchema` definition (around line 60), add:

```typescript
const SpeechProviderSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().optional(),
}).passthrough();

const STTConfigSchema = z.object({
  provider: z.string().nullable().default(null),
  providers: z.record(SpeechProviderSchema).default({}),
}).default({});

const TTSConfigSchema = z.object({
  provider: z.string().nullable().default(null),
  providers: z.record(SpeechProviderSchema).default({}),
}).default({});

const SpeechSchema = z.object({
  stt: STTConfigSchema,
  tts: TTSConfigSchema,
}).optional().default({});
```

Then add `speech: SpeechSchema,` to `ConfigSchema` (after `integrations` at line 92).

- [ ] **Step 2: Add env var overrides in applyEnvOverrides()**

In `src/core/config.ts` inside `applyEnvOverrides()`, add after the tunnel overrides section (around line 301):

```typescript
// Speech env var overrides
if (process.env.VIBEN_SPEECH_STT_PROVIDER) {
  raw.speech = raw.speech || {};
  const speech = raw.speech as Record<string, any>;
  speech.stt = speech.stt || {};
  speech.stt.provider = process.env.VIBEN_SPEECH_STT_PROVIDER;
}
if (process.env.VIBEN_SPEECH_GROQ_API_KEY) {
  raw.speech = raw.speech || {};
  const speech = raw.speech as Record<string, any>;
  speech.stt = speech.stt || {};
  speech.stt.providers = speech.stt.providers || {};
  speech.stt.providers.groq = speech.stt.providers.groq || {};
  speech.stt.providers.groq.apiKey = process.env.VIBEN_SPEECH_GROQ_API_KEY;
}
```

- [ ] **Step 3: Add config registry entries**

In `src/core/config-registry.ts`, add to the `CONFIG_REGISTRY` array (before the closing `]`):

```typescript
{
  path: 'speech.stt.provider',
  displayName: 'STT Provider',
  group: 'speech',
  type: 'select',
  options: ['groq'],  // expand as more providers are added
  scope: 'safe',
  hotReload: true,
},
```

Note: API key is sensitive and not exposed in the UI registry — it's set via config file, env var, or assistant chat.

- [ ] **Step 4: Verify config backward compatibility**

Run: `pnpm test`
Expected: All existing tests pass (old configs without `speech` field work via `.optional().default({})`)

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts src/core/config-registry.ts
git commit -m "feat(speech): add speech config schema with env overrides"
```

---

### Task 5: Wire SpeechService into Core

**Files:**
- Modify: `src/core/core.ts:35-59` — Create SpeechService, register providers, add hot-reload
- Modify: `src/core/speech/index.ts` — Export GroqSTT

- [ ] **Step 1: Update speech/index.ts to export GroqSTT**

```typescript
// src/core/speech/index.ts
export type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult, SpeechServiceConfig, SpeechProviderConfig } from './types.js';
export { SpeechService } from './speech-service.js';
export { GroqSTT } from './providers/groq.js';
```

- [ ] **Step 2: Create and wire SpeechService in VibenCore constructor**

In `src/core/core.ts`, add import at top:

```typescript
import { SpeechService, GroqSTT } from './speech/index.js';
```

Add property to class:

```typescript
readonly speechService: SpeechService;
```

In constructor (after `this.fileService = ...` at line 49), add:

```typescript
// Initialize speech service
const speechConfig = config.speech ?? { stt: { provider: null, providers: {} }, tts: { provider: null, providers: {} } };
this.speechService = new SpeechService(speechConfig);

// Register built-in STT providers
const groqConfig = speechConfig.stt?.providers?.groq;
if (groqConfig?.apiKey) {
  this.speechService.registerSTTProvider("groq", new GroqSTT(groqConfig.apiKey, groqConfig.model));
}
```

In the `config:changed` handler (line 52-58), add:

```typescript
if (configPath.startsWith('speech.')) {
  const newConfig = this.configManager.get();
  const newSpeechConfig = newConfig.speech ?? { stt: { provider: null, providers: {} }, tts: { provider: null, providers: {} } };
  this.speechService.updateConfig(newSpeechConfig);
  // Re-register providers with potentially new API keys
  const groqCfg = newSpeechConfig.stt?.providers?.groq;
  if (groqCfg?.apiKey) {
    this.speechService.registerSTTProvider("groq", new GroqSTT(groqCfg.apiKey, groqCfg.model));
  }
  log.info('Speech service config updated at runtime');
}
```

- [ ] **Step 3: Verify build compiles**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/core.ts src/core/speech/index.ts
git commit -m "feat(speech): wire SpeechService into VibenCore"
```

---

### Task 6: Session Integration — STT in processPrompt()

**Files:**
- Modify: `src/core/session.ts:45-68` — Accept SpeechService
- Modify: `src/core/session.ts:127-150` — Add transcription logic
- Modify: `src/core/core.ts:179-230` — Pass speechService to Session
- Create: `src/core/__tests__/session-speech.test.ts` — Test STT integration

- [ ] **Step 1: Write tests for speech integration in Session**

```typescript
// src/core/__tests__/session-speech.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "../session.js";
import type { AgentInstance } from "../agent-instance.js";
import type { SpeechService } from "../speech/index.js";

function mockAgent(hasAudio = false): AgentInstance {
  return {
    sessionId: "test-session",
    promptCapabilities: hasAudio ? { audio: true } : {},
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn(),
    cleanup: vi.fn(),
  } as any;
}

function mockSpeechService(available: boolean, transcribeResult?: string): SpeechService {
  return {
    isSTTAvailable: () => available,
    transcribe: vi.fn().mockResolvedValue({ text: transcribeResult || "transcribed text" }),
  } as any;
}

describe("Session speech integration", () => {
  it("transcribes audio when agent lacks audio capability and STT is available", async () => {
    const agent = mockAgent(false);
    const speech = mockSpeechService(true, "hello from voice");

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    // Wait for queue to process
    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text, attachments] = (agent.prompt as any).mock.calls[0];
    // Audio attachment should be removed, text should contain transcription
    expect(text).toContain("hello from voice");
    expect(attachments?.some((a: any) => a.type === "audio")).toBeFalsy();
  });

  it("passes audio through when agent supports audio", async () => {
    const agent = mockAgent(true);
    const speech = mockSpeechService(true);

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("check this", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text, attachments] = (agent.prompt as any).mock.calls[0];
    expect(text).toBe("check this");
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe("audio");
    // Speech.transcribe should NOT have been called
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it("falls back gracefully when STT not configured", async () => {
    const agent = mockAgent(false);
    const speech = mockSpeechService(false);

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("[Audio: voice.ogg]", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    // Audio attachment passed through unchanged (AgentInstance handles fallback)
    const [, attachments] = (agent.prompt as any).mock.calls[0];
    expect(attachments).toHaveLength(1);
  });

  it("emits error and keeps attachment when transcription fails", async () => {
    const agent = mockAgent(false);
    const speech = {
      isSTTAvailable: () => true,
      transcribe: vi.fn().mockRejectedValue(new Error("Groq rate limit exceeded")),
    } as any;

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    const errorEvents: any[] = [];
    session.on("agent_event", (e) => { if (e.type === "error") errorEvents.push(e); });

    await session.enqueuePrompt("[Audio: voice.ogg]", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    // Original attachment preserved as fallback
    const [, attachments] = (agent.prompt as any).mock.calls[0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe("audio");
    // Error event emitted to user
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].message).toContain("Groq rate limit exceeded");
  });

  it("works without speechService (backward compat)", async () => {
    const agent = mockAgent(false);

    const session = new Session({
      channelId: "test",
      agentName: "test-agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
    });

    await session.enqueuePrompt("hello", [{
      type: "audio",
      filePath: "/tmp/voice.ogg",
      fileName: "voice.ogg",
      mimeType: "audio/ogg",
      size: 1000,
    }]);

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    // Should not crash, attachments pass through
    const [, attachments] = (agent.prompt as any).mock.calls[0];
    expect(attachments).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/core/__tests__/session-speech.test.ts`
Expected: FAIL (Session constructor doesn't accept speechService yet)

- [ ] **Step 3: Modify Session to accept and use SpeechService**

In `src/core/session.ts`:

Add import:
```typescript
import type { SpeechService } from "./speech/index.js";
import * as fs from "node:fs";
```

Add property to class (after `private readonly queue: PromptQueue;` at line 43):
```typescript
private speechService?: SpeechService;
```

Update constructor opts (line 45-51) to accept optional speechService:
```typescript
constructor(opts: {
  id?: string;
  channelId: string;
  agentName: string;
  workingDirectory: string;
  agentInstance: AgentInstance;
  speechService?: SpeechService;
}) {
```

Set it in constructor body (after line 58):
```typescript
this.speechService = opts.speechService;
```

Modify `processPrompt()` (line 127-150) to add STT logic before calling `agentInstance.prompt()`:

```typescript
private async processPrompt(text: string, attachments?: Attachment[]): Promise<void> {
  if (text === "\x00__warmup__") {
    await this.runWarmup();
    return;
  }

  if (this._status === "initializing") {
    this.activate();
  }
  const promptStart = Date.now();
  this.log.debug("Prompt execution started");

  // STT: transcribe audio attachments if agent doesn't support audio
  const processedAttachments = await this.maybeTranscribeAudio(text, attachments);

  await this.agentInstance.prompt(
    processedAttachments.text,
    processedAttachments.attachments,
  );
  this.log.info(
    { durationMs: Date.now() - promptStart },
    "Prompt execution completed",
  );

  if (!this.name) {
    await this.autoName();
  }
}

private async maybeTranscribeAudio(
  text: string,
  attachments?: Attachment[],
): Promise<{ text: string; attachments?: Attachment[] }> {
  if (!attachments?.length || !this.speechService) {
    return { text, attachments };
  }

  const hasAudioCapability = this.agentInstance.promptCapabilities?.audio === true;
  if (hasAudioCapability) {
    return { text, attachments };
  }

  if (!this.speechService.isSTTAvailable()) {
    return { text, attachments };
  }

  let transcribedText = text;
  const remainingAttachments: Attachment[] = [];

  for (const att of attachments) {
    if (att.type !== "audio") {
      remainingAttachments.push(att);
      continue;
    }

    try {
      const audioBuffer = await fs.promises.readFile(att.filePath);
      const result = await this.speechService.transcribe(audioBuffer, att.mimeType);
      this.log.info({ provider: "stt", duration: result.duration }, "Voice transcribed");
      // Append transcription to text
      transcribedText = transcribedText
        ? `${transcribedText}\n${result.text}`
        : result.text;
    } catch (err) {
      this.log.warn({ err }, "STT transcription failed, keeping audio attachment");
      // Emit error to user via agent_event
      this.emit("agent_event", {
        type: "error",
        message: `Voice transcription failed: ${(err as Error).message}`,
      });
      // Keep original attachment as fallback
      remainingAttachments.push(att);
    }
  }

  return {
    text: transcribedText,
    attachments: remainingAttachments.length > 0 ? remainingAttachments : undefined,
  };
}
```

- [ ] **Step 4: Pass speechService when creating Session in core.ts**

In `src/core/core.ts`, update `createSession()` (around line 201):

```typescript
const session = new Session({
  id: params.existingSessionId,
  channelId: params.channelId,
  agentName: params.agentName,
  workingDirectory: params.workingDirectory,
  agentInstance,
  speechService: this.speechService,
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: All tests pass (new + existing)

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/core/core.ts src/core/__tests__/session-speech.test.ts
git commit -m "feat(speech): integrate STT into session prompt processing"
```

---

### Task 7: Save Original OGG for STT

**Files:**
- Modify: `src/adapters/telegram/adapter.ts:837-858` — Save OGG before converting

Currently, `handleIncomingMedia` converts OGG→WAV and discards the original OGG. For STT, we need the original OGG (smaller file, STT APIs accept it). The change: save original OGG first, then convert to WAV for the attachment that goes to the agent.

- [ ] **Step 1: Modify handleIncomingMedia to preserve original OGG path**

In `src/adapters/telegram/adapter.ts`, modify `handleIncomingMedia()` (lines 837-886):

Add to `Attachment` type a new optional field. Actually, simpler approach: save the OGG file separately and store its path on the attachment via a convention. But the cleanest way is to add an `originalFilePath` to the Attachment type.

In `src/core/types.ts`, add to Attachment interface:
```typescript
export interface Attachment {
  type: 'image' | 'audio' | 'file';
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  originalFilePath?: string;  // Original file before conversion (e.g., OGG before WAV)
}
```

Then in `handleIncomingMedia()`, modify the OGG conversion block:

```typescript
let buffer = downloaded.buffer;
let originalFilePath: string | undefined;
const sessionId = this.resolveSessionId(threadId) || "unknown";

if (convertOggToWav) {
  // Save original OGG for STT (smaller, API-compatible)
  const oggAtt = await this.fileService.saveFile(sessionId, "voice.ogg", downloaded.buffer, "audio/ogg");
  originalFilePath = oggAtt.filePath;

  try {
    buffer = await this.fileService.convertOggToWav(buffer);
  } catch (err) {
    log.warn({ err }, "OGG→WAV conversion failed, saving original OGG");
    fileName = "voice.ogg";
    mimeType = "audio/ogg";
    originalFilePath = undefined; // already using OGG as primary
  }
}

const att = await this.fileService.saveFile(sessionId, fileName, buffer, mimeType);
if (originalFilePath) {
  att.originalFilePath = originalFilePath;
}
```

Note: The existing `const sessionId = this.resolveSessionId(threadId) || "unknown"` at line 860 must be moved up before the `if (convertOggToWav)` block, and the duplicate declaration removed.

Then in `Session.maybeTranscribeAudio()`, prefer originalFilePath for STT:

```typescript
const audioPath = att.originalFilePath || att.filePath;
const audioMime = att.originalFilePath ? "audio/ogg" : att.mimeType;
const audioBuffer = await fs.promises.readFile(audioPath);
const result = await this.speechService.transcribe(audioBuffer, audioMime);
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts src/adapters/telegram/adapter.ts src/core/session.ts
git commit -m "feat(speech): preserve original OGG for STT transcription"
```

---

### Task 8: Config Registry & Bot Menu Integration

**Files:**
- Modify: `src/adapters/telegram/commands/settings.ts` — No changes needed if CONFIG_REGISTRY drives the UI

The settings UI is already driven by `CONFIG_REGISTRY` entries added in Task 4. The `buildSettingsKeyboard()` function in `settings.ts` iterates `getSafeFields()` and renders them. Since we added `speech.stt.provider` as a safe/select field, it will automatically appear in the settings menu.

- [ ] **Step 1: Verify settings menu renders speech option**

Run: `pnpm build && pnpm start` (manual test with Telegram)
Expected: /settings shows "STT Provider" under a "speech" group

If the settings menu groups by `group` field, the "speech" group will appear automatically.

- [ ] **Step 2: Commit (if any adjustments needed)**

```bash
git commit -m "feat(speech): verify bot menu integration"
```

---

### Task 9: Update index.ts Exports

**Files:**
- Modify: `src/core/speech/index.ts` — Ensure all public types exported
- Modify: `src/index.ts` — Re-export speech module for plugin access

- [ ] **Step 1: Ensure speech/index.ts is complete**

```typescript
// src/core/speech/index.ts
export type {
  STTProvider, TTSProvider,
  STTOptions, STTResult,
  TTSOptions, TTSResult,
  SpeechServiceConfig, SpeechProviderConfig,
} from './types.js';
export { SpeechService } from './speech-service.js';
export { GroqSTT } from './providers/groq.js';
```

- [ ] **Step 2: Add speech exports to main index.ts**

In `src/index.ts`, add:
```typescript
export { SpeechService, GroqSTT } from './core/speech/index.js';
export type { STTProvider, TTSProvider, STTOptions, STTResult, TTSOptions, TTSResult } from './core/speech/index.js';
```

- [ ] **Step 3: Run full test suite and build**

Run: `pnpm test && pnpm build`
Expected: All pass, no build errors

- [ ] **Step 4: Commit**

```bash
git add src/core/speech/index.ts src/index.ts
git commit -m "feat(speech): export speech module public API"
```

---

### Task 10: Assistant Chat Awareness

**Files:**
- Modify: `src/adapters/telegram/assistant.ts:109-228` — Add speech section to system prompt

- [ ] **Step 1: Add speech section to buildAssistantSystemPrompt()**

In `src/adapters/telegram/assistant.ts`, in the `buildAssistantSystemPrompt()` function, add a "Voice / Speech" section to the Action Playbook. Insert after the "Configuration" section (around line 170):

```typescript
### Voice / Speech-to-Text
- Viben can transcribe voice messages to text using STT providers (Groq Whisper, OpenAI Whisper)
- Current STT provider: ${config.speech?.stt?.provider ?? "Not configured"}
- To enable: user needs an API key from the STT provider
  - Groq (recommended, free tier ~8h/day): Get key at console.groq.com → API Keys
  - Set via: \`viben config set speech.stt.provider groq\` then \`viben config set speech.stt.providers.groq.apiKey <key>\`
- When STT is configured, voice messages are automatically transcribed before sending to agents that don't support audio
- Agents with audio capability receive the audio directly (no transcription needed)
- User can also configure via /settings → STT Provider
```

Also add dynamic state to the "Current State" section:

```typescript
- STT: ${config.speech?.stt?.provider ? `${config.speech.stt.provider} ✅` : "Not configured"}
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/adapters/telegram/assistant.ts
git commit -m "feat(speech): add speech awareness to assistant system prompt"
```

---

### Task 11: Final Integration Test & Cleanup

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Verify backward compatibility — test with empty config**

Add to an existing config test or create inline:
```typescript
// Quick sanity check: config without speech field validates fine
import { ConfigSchema } from "../config.js";
const oldConfig = { channels: {}, defaultAgent: "test", agents: {} };
const result = ConfigSchema.parse(oldConfig);
assert(result.speech.stt.provider === null);
assert(Object.keys(result.speech.stt.providers).length === 0);
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(speech): complete speech module with Groq STT provider"
```
