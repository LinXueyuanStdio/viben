# TTS Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Text-to-Speech capability so agents can send voice summaries alongside text responses, triggered by user via `/voice` command or inline toggle button.

**Architecture:** User activates voice mode per-session. Session injects a TTS instruction into the prompt. Agent responds with a `[TTS]...[/TTS]` block. Session parses it, synthesizes audio via `SpeechService` + `msedge-tts`, and emits `audio_content` event. Adapter strips the block from text and sends voice message.

**Tech Stack:** TypeScript, msedge-tts (MIT), Vitest, grammY (Telegram)

**Spec:** `docs/superpowers/specs/2026-03-24-tts-feature-design.md`

---

### Task 1: Make SpeechProviderConfig.apiKey optional

**Files:**
- Modify: `src/core/speech/types.ts:33-37`
- Modify: `src/core/config.ts:75-80`
- Modify: `src/core/speech/speech-service.ts:22-25,39-43`
- Test: `src/core/__tests__/speech-service-tts.test.ts` (new)

- [ ] **Step 1: Write tests for TTS availability without apiKey**

```typescript
// src/core/__tests__/speech-service-tts.test.ts
import { describe, it, expect, vi } from "vitest";
import { SpeechService } from "../speech/index.js";
import type { SpeechServiceConfig } from "../speech/index.js";
import type { TTSProvider } from "../speech/index.js";

function mockTTSProvider(name = "edge-tts"): TTSProvider {
  return {
    name,
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("fake audio"),
      mimeType: "audio/mpeg",
    }),
  };
}

describe("SpeechService TTS", () => {
  it("isTTSAvailable returns true when provider configured without apiKey", () => {
    const config: SpeechServiceConfig = {
      stt: { provider: null, providers: {} },
      tts: { provider: "edge-tts", providers: { "edge-tts": {} } },
    };
    const service = new SpeechService(config);
    service.registerTTSProvider("edge-tts", mockTTSProvider());
    expect(service.isTTSAvailable()).toBe(true);
  });

  it("isTTSAvailable returns false when no provider configured", () => {
    const config: SpeechServiceConfig = {
      stt: { provider: null, providers: {} },
      tts: { provider: null, providers: {} },
    };
    const service = new SpeechService(config);
    expect(service.isTTSAvailable()).toBe(false);
  });

  it("isTTSAvailable returns false when provider set but not registered", () => {
    const config: SpeechServiceConfig = {
      stt: { provider: null, providers: {} },
      tts: { provider: "edge-tts", providers: { "edge-tts": {} } },
    };
    const service = new SpeechService(config);
    // Not registering the provider
    expect(service.isTTSAvailable()).toBe(false);
  });

  it("synthesize works without apiKey for edge-tts", async () => {
    const config: SpeechServiceConfig = {
      stt: { provider: null, providers: {} },
      tts: { provider: "edge-tts", providers: { "edge-tts": {} } },
    };
    const provider = mockTTSProvider();
    const service = new SpeechService(config);
    service.registerTTSProvider("edge-tts", provider);

    const result = await service.synthesize("hello");
    expect(result.audioBuffer).toBeDefined();
    expect(provider.synthesize).toHaveBeenCalledWith("hello", undefined);
  });

  it("synthesize throws when provider not registered", async () => {
    const config: SpeechServiceConfig = {
      stt: { provider: null, providers: {} },
      tts: { provider: "edge-tts", providers: { "edge-tts": {} } },
    };
    const service = new SpeechService(config);
    await expect(service.synthesize("hello")).rejects.toThrow(/not registered/);
  });

  it("isSTTAvailable still requires apiKey", () => {
    const config: SpeechServiceConfig = {
      stt: { provider: "groq", providers: { groq: {} } },
      tts: { provider: null, providers: {} },
    };
    const service = new SpeechService(config);
    expect(service.isSTTAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/speech-service-tts.test.ts`
Expected: Multiple failures — `isTTSAvailable` returns false (checks apiKey), `synthesize` throws apiKey error.

- [ ] **Step 3: Update SpeechProviderConfig interface**

In `src/core/speech/types.ts`, change:
```typescript
export interface SpeechProviderConfig {
  apiKey?: string;
  model?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 4: Update Zod schema**

In `src/core/config.ts`, change `SpeechProviderSchema`:
```typescript
const SpeechProviderSchema = z
  .object({
    apiKey: z.string().min(1).optional(),
    model: z.string().optional(),
  })
  .passthrough();
```

- [ ] **Step 5: Update SpeechService**

In `src/core/speech/speech-service.ts`:

Change `isTTSAvailable()`:
```typescript
isTTSAvailable(): boolean {
  const { provider } = this.config.tts;
  return provider !== null && this.ttsProviders.has(provider);
}
```

Change `synthesize()` guard clause:
```typescript
async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
  const providerName = this.config.tts.provider;
  if (!providerName) {
    throw new Error("TTS not configured. Set speech.tts.provider in config.");
  }
  const provider = this.ttsProviders.get(providerName);
  if (!provider) {
    throw new Error(`TTS provider "${providerName}" not registered. Available: ${[...this.ttsProviders.keys()].join(", ") || "none"}`);
  }
  return provider.synthesize(text, options);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- src/core/__tests__/speech-service-tts.test.ts`
Expected: All PASS

- [ ] **Step 7: Run full test suite to check no regressions**

Run: `pnpm test`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add src/core/speech/types.ts src/core/config.ts src/core/speech/speech-service.ts src/core/__tests__/speech-service-tts.test.ts
git commit -m "feat(speech): make apiKey optional for TTS providers like edge-tts"
```

---

### Task 2: Add voice field to TTS config schema and SpeechServiceConfig

**Files:**
- Modify: `src/core/config.ts:82-98` (SpeechSchema)
- Modify: `src/core/speech/types.ts:39-48` (SpeechServiceConfig interface)

- [ ] **Step 1: Add `voice` field to TTS Zod schema**

In `src/core/config.ts`, update `SpeechSchema`'s tts section:
```typescript
tts: z
  .object({
    provider: z.string().nullable().default(null),
    providers: z.record(SpeechProviderSchema).default({}),
    voice: z.string().optional(),
  })
  .default({}),
```

- [ ] **Step 2: Update SpeechServiceConfig TypeScript interface**

In `src/core/speech/types.ts`, update the `tts` section of `SpeechServiceConfig` to include `voice`:
```typescript
export interface SpeechServiceConfig {
  stt: {
    provider: string | null;
    providers: Record<string, SpeechProviderConfig>;
  };
  tts: {
    provider: string | null;
    providers: Record<string, SpeechProviderConfig>;
    voice?: string;
  };
}
```

This keeps the TS interface in sync with the Zod schema. Without this, code reading `speechConfig.tts.voice` would fail type-checking.

- [ ] **Step 3: Run tests to verify no regressions**

Run: `pnpm test`
Expected: All pass. Adding optional fields doesn't break anything.

- [ ] **Step 4: Commit**

```bash
git add src/core/config.ts src/core/speech/types.ts
git commit -m "feat(config): add speech.tts.voice shorthand field"
```

---

### Task 3: Install msedge-tts and implement EdgeTTS provider

**Files:**
- Create: `src/core/speech/providers/edge-tts.ts`
- Modify: `src/core/speech/index.ts`
- Test: `src/core/__tests__/edge-tts-provider.test.ts` (new)

- [ ] **Step 1: Install msedge-tts**

Run: `pnpm add msedge-tts`

- [ ] **Step 2: Write test for EdgeTTS provider**

```typescript
// src/core/__tests__/edge-tts-provider.test.ts
import { describe, it, expect, vi } from "vitest";
import { EdgeTTS } from "../speech/providers/edge-tts.js";

// Mock msedge-tts module
vi.mock("msedge-tts", () => {
  const mockStream = {
    on: vi.fn().mockReturnThis(),
    pipe: vi.fn().mockReturnThis(),
  };
  return {
    MsEdgeTTS: vi.fn().mockImplementation(() => ({
      setMetadata: vi.fn().mockResolvedValue(undefined),
      toStream: vi.fn().mockResolvedValue({
        audioStream: mockStream,
      }),
    })),
    OUTPUT_FORMAT: {
      AUDIO_24KHZ_48KBITRATE_MONO_MP3: "audio-24khz-48kbitrate-mono-mp3",
      WEBM_24KHZ_16BIT_MONO_OPUS: "webm-24khz-16bit-mono-opus",
    },
  };
});

describe("EdgeTTS provider", () => {
  it("has name 'edge-tts'", () => {
    const provider = new EdgeTTS();
    expect(provider.name).toBe("edge-tts");
  });

  it("uses default voice when none specified", () => {
    const provider = new EdgeTTS();
    expect(provider).toBeDefined();
  });

  it("accepts custom voice in constructor", () => {
    const provider = new EdgeTTS("vi-VN-HoaiMyNeural");
    expect(provider).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- src/core/__tests__/edge-tts-provider.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement EdgeTTS provider**

```typescript
// src/core/speech/providers/edge-tts.ts
import type { TTSProvider, TTSOptions, TTSResult } from '../types.js';

const DEFAULT_VOICE = "en-US-AriaNeural";

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
    const readable = tts.toStream(text);

    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      audioBuffer: Buffer.concat(chunks),
      mimeType: "audio/mpeg",
    };
  }
}
```

Note: `msedge-tts` API may vary — check actual exports during implementation. The key pattern: create instance, set voice + format, stream text to audio buffer. Use dynamic import to keep it lazy-loaded.

- [ ] **Step 5: Export from speech/index.ts**

Add to `src/core/speech/index.ts`:
```typescript
export { EdgeTTS } from './providers/edge-tts.js';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- src/core/__tests__/edge-tts-provider.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/speech/providers/edge-tts.ts src/core/speech/index.ts src/core/__tests__/edge-tts-provider.test.ts package.json pnpm-lock.yaml
git commit -m "feat(speech): add edge-tts provider using msedge-tts"
```

---

### Task 4: Register EdgeTTS provider in core startup

**Files:**
- Modify: `src/core/core.ts` (registration block, ~line 84-90)

- [ ] **Step 1: Add EdgeTTS registration alongside GroqSTT**

**Note:** The spec says `main.ts` but registration belongs in `core.ts` where GroqSTT is already registered. This follows the existing pattern.

In `src/core/core.ts`, add to the import at top:
```typescript
import { SpeechService, GroqSTT, EdgeTTS } from "./speech/index.js";
```

After the GroqSTT registration block (around line 90), add:
```typescript
// Register built-in TTS providers
if (speechConfig.tts?.provider === "edge-tts") {
  const edgeConfig = speechConfig.tts.providers?.["edge-tts"];
  const voice = (edgeConfig?.voice as string) || speechConfig.tts.voice;
  this.speechService.registerTTSProvider("edge-tts", new EdgeTTS(voice));
}
```

After Task 2, `speechConfig.tts.voice` is typed as `string | undefined` — no cast needed.

- [ ] **Step 2: Add EdgeTTS to hot-reload handler**

In the existing `if (configPath.startsWith("speech."))` block (around line 109), after GroqSTT re-registration, add:

```typescript
// Re-register TTS providers on config change
const ttsCfg = newSpeechConfig.tts;
if (ttsCfg?.provider === "edge-tts") {
  const edgeConfig = ttsCfg.providers?.["edge-tts"];
  const voice = (edgeConfig?.voice as string) || ttsCfg.voice;
  this.speechService.registerTTSProvider("edge-tts", new EdgeTTS(voice));
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/core/core.ts
git commit -m "feat(core): register edge-tts provider on startup and hot-reload"
```

---

### Task 5: Add voiceMode to Session + TTS prompt injection

**Files:**
- Modify: `src/core/session.ts`
- Test: `src/core/__tests__/session-tts.test.ts` (new)

- [ ] **Step 1: Write tests for voice mode and prompt injection**

```typescript
// src/core/__tests__/session-tts.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "../session.js";
import type { AgentInstance } from "../agent-instance.js";
import type { SpeechService } from "../speech/index.js";

function mockAgent(): AgentInstance {
  return {
    sessionId: "test-session",
    promptCapabilities: {},
    prompt: vi.fn().mockResolvedValue({}),
    cancel: vi.fn(),
    cleanup: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as any;
}

function mockSpeechService(ttsAvailable: boolean): SpeechService {
  return {
    isSTTAvailable: () => false,
    isTTSAvailable: () => ttsAvailable,
    synthesize: vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("fake audio"),
      mimeType: "audio/mpeg",
    }),
  } as any;
}

describe("Session TTS", () => {
  it("voiceMode defaults to 'off'", () => {
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: mockAgent(),
    });
    expect(session.voiceMode).toBe("off");
  });

  it("setVoiceMode changes voiceMode", () => {
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: mockAgent(),
    });
    session.setVoiceMode("on");
    expect(session.voiceMode).toBe("on");
    session.setVoiceMode("next");
    expect(session.voiceMode).toBe("next");
    session.setVoiceMode("off");
    expect(session.voiceMode).toBe("off");
  });

  it("appends TTS instruction when voiceMode is 'on' and TTS available", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    session.setVoiceMode("on");
    await session.enqueuePrompt("fix the bug");

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text] = (agent.prompt as any).mock.calls[0];
    expect(text).toContain("fix the bug");
    expect(text).toContain("[TTS]");
  });

  it("does NOT inject TTS when voiceMode is 'off'", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    await session.enqueuePrompt("fix the bug");

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text] = (agent.prompt as any).mock.calls[0];
    expect(text).toBe("fix the bug");
  });

  it("resets voiceMode to 'off' after injection when mode is 'next'", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    session.setVoiceMode("next");
    await session.enqueuePrompt("hello");

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    expect(session.voiceMode).toBe("off");
  });

  it("keeps voiceMode 'on' after injection when mode is 'on'", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    session.setVoiceMode("on");
    await session.enqueuePrompt("hello");

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    expect(session.voiceMode).toBe("on");
  });

  it("does NOT inject TTS when TTS is not available", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(false);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    session.setVoiceMode("on");
    await session.enqueuePrompt("hello");

    await vi.waitFor(() => {
      expect(agent.prompt).toHaveBeenCalled();
    });

    const [text] = (agent.prompt as any).mock.calls[0];
    expect(text).not.toContain("[TTS]");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/session-tts.test.ts`
Expected: FAIL — `voiceMode` and `setVoiceMode` don't exist

- [ ] **Step 3: Implement voiceMode and TTS prompt injection in Session**

In `src/core/session.ts`:

Add property after `archiving`:
```typescript
voiceMode: "off" | "next" | "on" = "off";
```

Add method:
```typescript
setVoiceMode(mode: "off" | "next" | "on"): void {
  this.voiceMode = mode;
  this.log.info({ voiceMode: mode }, "Voice mode changed");
}
```

Add TTS instruction constant at top of file:
```typescript
const TTS_PROMPT_INSTRUCTION = `\n\nAdditionally, include a [TTS]...[/TTS] block with a spoken-friendly summary of your response. Focus on key information, decisions the user needs to make, or actions required. The agent decides what to say and how long. Respond in the same language the user is using. This instruction applies to this message only.`;
```

In `processPrompt()`, after STT transcription and before `agentInstance.prompt()`:
```typescript
// TTS: inject instruction if voice mode active
let finalText = processed.text;
if (this.voiceMode !== "off" && this.speechService?.isTTSAvailable()) {
  finalText = processed.text + TTS_PROMPT_INSTRUCTION;
  if (this.voiceMode === "next") {
    this.voiceMode = "off";
  }
}

await this.agentInstance.prompt(finalText, processed.attachments);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/core/__tests__/session-tts.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/core/__tests__/session-tts.test.ts
git commit -m "feat(session): add voiceMode and TTS prompt injection"
```

---

### Task 6: Add post-response TTS pipeline (accumulate, parse, synthesize, emit)

**Files:**
- Modify: `src/core/session.ts`
- Modify: `src/core/__tests__/session-tts.test.ts`

- [ ] **Step 1: Write tests for TTS response processing**

Add to `src/core/__tests__/session-tts.test.ts`:

```typescript
describe("Session TTS post-response pipeline", () => {
  it("emits audio_content when agent response contains [TTS] block", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    // Make agent emit text events including TTS block
    (agent.prompt as any).mockImplementation(() => {
      session.emit("agent_event", { type: "text", content: "I fixed the bug.\n\n[TTS]I fixed the bug in auth.ts.[/TTS]" });
      return Promise.resolve();
    });

    const events: any[] = [];
    session.on("agent_event", (e) => events.push(e));

    session.setVoiceMode("on");
    await session.enqueuePrompt("fix the bug");

    await vi.waitFor(() => {
      expect(events.some(e => e.type === "audio_content")).toBe(true);
    });

    const audioEvent = events.find(e => e.type === "audio_content");
    expect(audioEvent.mimeType).toBe("audio/mpeg");
    expect(audioEvent.data).toBeDefined(); // base64 string
  });

  it("does not emit audio_content when no [TTS] block in response", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    (agent.prompt as any).mockImplementation(() => {
      session.emit("agent_event", { type: "text", content: "I fixed the bug." });
      return Promise.resolve();
    });

    const events: any[] = [];
    session.on("agent_event", (e) => events.push(e));

    session.setVoiceMode("on");
    await session.enqueuePrompt("fix the bug");

    // Wait a tick for any async processing
    await new Promise(r => setTimeout(r, 50));
    expect(events.some(e => e.type === "audio_content")).toBe(false);
  });

  it("skips TTS silently when synthesize fails", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    (speech.synthesize as any).mockRejectedValue(new Error("TTS failed"));

    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    (agent.prompt as any).mockImplementation(() => {
      session.emit("agent_event", { type: "text", content: "[TTS]hello[/TTS]" });
      return Promise.resolve();
    });

    session.setVoiceMode("on");
    // Should not throw
    await session.enqueuePrompt("test");

    await new Promise(r => setTimeout(r, 50));
    // No crash — test passes if we get here
  });

  it("truncates TTS text at 5000 characters", async () => {
    const agent = mockAgent();
    const speech = mockSpeechService(true);
    const session = new Session({
      channelId: "test",
      agentName: "agent",
      workingDirectory: "/tmp",
      agentInstance: agent,
      speechService: speech,
    });

    const longText = "a".repeat(6000);
    (agent.prompt as any).mockImplementation(() => {
      session.emit("agent_event", { type: "text", content: `[TTS]${longText}[/TTS]` });
      return Promise.resolve();
    });

    session.setVoiceMode("on");
    await session.enqueuePrompt("test");

    await vi.waitFor(() => {
      expect(speech.synthesize).toHaveBeenCalled();
    });

    const [text] = (speech.synthesize as any).mock.calls[0];
    expect(text.length).toBeLessThanOrEqual(5003); // 5000 + "..."
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/session-tts.test.ts`
Expected: New tests FAIL — no TTS post-processing implemented

- [ ] **Step 3: Implement post-response TTS pipeline in Session**

In `src/core/session.ts`, add constants:
```typescript
const TTS_BLOCK_REGEX = /\[TTS\]([\s\S]*?)\[\/TTS\]/;
const TTS_MAX_LENGTH = 5000;
const TTS_TIMEOUT_MS = 30_000;
```

In `processPrompt()`, wrap the agent prompt call with accumulation when voice mode is active:

```typescript
// TTS: accumulate response text if voice mode was active for this prompt
const ttsActive = this.voiceMode !== "off" && this.speechService?.isTTSAvailable();
let accumulatedText = "";
const ttsAccumulator = ttsActive
  ? (event: AgentEvent) => {
      if (event.type === "text") accumulatedText += event.content;
    }
  : undefined;

if (ttsAccumulator) {
  this.on("agent_event", ttsAccumulator);
}

// ... inject TTS instruction, send to agent ...

try {
  await this.agentInstance.prompt(finalText, processed.attachments);
} finally {
  if (ttsAccumulator) {
    this.off("agent_event", ttsAccumulator);
  }
}

// TTS: post-response processing (fire-and-forget)
if (ttsActive && accumulatedText) {
  this.processTTSResponse(accumulatedText).catch((err) =>
    this.log.warn({ err }, "TTS processing failed")
  );
}
```

Add private method:
```typescript
private async processTTSResponse(responseText: string): Promise<void> {
  const match = TTS_BLOCK_REGEX.exec(responseText);
  if (!match?.[1]) return;

  let ttsText = match[1].trim();
  if (!ttsText) return;

  if (ttsText.length > TTS_MAX_LENGTH) {
    ttsText = ttsText.slice(0, TTS_MAX_LENGTH) + "...";
  }

  try {
    const result = await Promise.race([
      this.speechService!.synthesize(ttsText),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TTS synthesis timeout")), TTS_TIMEOUT_MS)
      ),
    ]);

    const base64 = result.audioBuffer.toString("base64");
    this.emit("agent_event", {
      type: "audio_content",
      data: base64,
      mimeType: result.mimeType,
    });
    // TTS strip is handled adapter-side: when the adapter receives audio_content
    // after text streaming, it edits the last text message to remove [TTS]...[/TTS]
  } catch (err) {
    this.log.warn({ err }, "TTS synthesis failed, skipping voice message");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/core/__tests__/session-tts.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/core/session.ts src/core/__tests__/session-tts.test.ts
git commit -m "feat(session): add post-response TTS pipeline with accumulation, parsing, synthesis"
```

---

### Task 7: (No-op — removed)

**Rationale:** The spec originally proposed a `tts_strip` event wired through SessionBridge. During planning, we determined this is unnecessary — the adapter already receives `audio_content` events through the existing bridge. When it receives TTS audio, it can detect and strip `[TTS]...[/TTS]` from the last streamed text message directly. No bridge changes needed. TTS strip is handled in Task 10 (adapter-side).

---

### Task 8: Add TTS config registry entries

**Files:**
- Modify: `src/core/config-registry.ts`

- [ ] **Step 1: Add TTS fields to CONFIG_REGISTRY**

In `src/core/config-registry.ts`, add after the STT entries:

```typescript
{
  path: 'speech.tts.provider',
  displayName: 'Text to Speech',
  group: 'speech',
  type: 'select',
  options: ['edge-tts'],
  scope: 'safe',
  hotReload: true,
},
{
  path: 'speech.tts.voice',
  displayName: 'TTS Voice',
  group: 'speech',
  type: 'string',
  scope: 'safe',
  hotReload: true,
},
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All pass (config-registry tests should still pass)

- [ ] **Step 3: Commit**

```bash
git add src/core/config-registry.ts
git commit -m "feat(config): add TTS provider and voice to settings registry"
```

---

### Task 9: Telegram adapter — voice toggle button + /voice command

**Files:**
- Modify: `src/adapters/telegram/commands/admin.ts`
- Modify: `src/adapters/telegram/commands/index.ts`
- Modify: `src/adapters/telegram/commands/new-session.ts`

- [ ] **Step 1: Add voice toggle keyboard builder and callback handler**

In `src/adapters/telegram/commands/admin.ts`, add:

```typescript
export function buildVoiceModeKeyboard(sessionId: string, enabled: boolean): InlineKeyboard {
  return new InlineKeyboard().text(
    enabled ? "🔊 Voice On" : "🔇 Voice Off",
    `v:${sessionId}`,
  );
}

export function buildSessionControlKeyboard(sessionId: string, dangerousMode: boolean, voiceMode: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      dangerousMode ? "🔐 Disable Dangerous Mode" : "☠️ Enable Dangerous Mode",
      `d:${sessionId}`,
    )
    .text(
      voiceMode ? "🔊 Voice On" : "🔇 Voice Off",
      `v:${sessionId}`,
    );
}

export function setupVoiceModeCallbacks(bot: Bot, core: VibenCore): void {
  bot.callbackQuery(/^v:/, async (ctx) => {
    const sessionId = ctx.callbackQuery.data.slice(2);
    const session = core.sessionManager.getSession(sessionId);

    if (!session) {
      try { await ctx.answerCallbackQuery({ text: "⚠️ Session not found or not active." }); } catch { }
      return;
    }

    const newMode = session.voiceMode === "on" ? "off" : "on";
    session.setVoiceMode(newMode);

    const toastText = newMode === "on"
      ? "🔊 Voice mode enabled — agent will send voice summaries"
      : "🔇 Voice mode disabled";
    try { await ctx.answerCallbackQuery({ text: toastText }); } catch { }

    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: buildSessionControlKeyboard(
          sessionId,
          session.dangerousMode,
          newMode === "on",
        ),
      });
    } catch { /* ignore */ }
  });
}
```

- [ ] **Step 2: Update new-session.ts to use combined keyboard**

In `src/adapters/telegram/commands/new-session.ts`, replace `buildDangerousModeKeyboard` import with `buildSessionControlKeyboard`:

```typescript
import { buildSessionControlKeyboard } from "./admin.js";
```

Update all places that use `buildDangerousModeKeyboard(session.id, false)` to:
```typescript
buildSessionControlKeyboard(session.id, false, false)
```

- [ ] **Step 3: Add re-exports in commands/index.ts**

In `src/adapters/telegram/commands/index.ts`, add to re-exports:
```typescript
export { setupVoiceModeCallbacks, buildVoiceModeKeyboard, buildSessionControlKeyboard, handleVoice } from "./admin.js";
```

**Important:** Do NOT call `setupVoiceModeCallbacks` inside `setupAllCallbacks()`. The callback registration happens in `adapter.ts` directly (Task 11), same pattern as `setupDangerousModeCallbacks`. Adding it here too would cause double-registration.

- [ ] **Step 4: Add /voice command**

In `src/adapters/telegram/commands/admin.ts`, add:

```typescript
export async function handleVoice(ctx: Context, core: VibenCore): Promise<void> {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply("⚠️ This command only works inside a session topic.", { parse_mode: "HTML" });
    return;
  }
  const session = core.sessionManager.getSessionByThread("telegram", String(threadId));
  if (!session) {
    await ctx.reply("⚠️ No active session in this topic.", { parse_mode: "HTML" });
    return;
  }

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const arg = args[0]?.toLowerCase();

  if (arg === "on") {
    session.setVoiceMode("on");
    await ctx.reply("🔊 Voice mode enabled for this session.", { parse_mode: "HTML" });
  } else if (arg === "off") {
    session.setVoiceMode("off");
    await ctx.reply("🔇 Voice mode disabled.", { parse_mode: "HTML" });
  } else {
    // No arg = one-shot
    session.setVoiceMode("next");
    await ctx.reply("🔊 Voice mode enabled for the next message.", { parse_mode: "HTML" });
  }
}
```

In `src/adapters/telegram/commands/index.ts`, register:
```typescript
bot.command("voice", (ctx) => handleVoice(ctx, core));
```

Add to `STATIC_COMMANDS`:
```typescript
{ command: "voice", description: "Toggle voice mode (one-shot, /voice on, /voice off)" },
```

- [ ] **Step 5: Register voice callbacks in adapter.ts**

In `src/adapters/telegram/adapter.ts`, where `setupDangerousModeCallbacks` is called, add nearby:

```typescript
import { setupVoiceModeCallbacks } from "./commands/index.js";
```

Call it before the broad `m:` handler (next to `setupDangerousModeCallbacks`):
```typescript
setupVoiceModeCallbacks(this.bot, this.core);
```

- [ ] **Step 6: Run tests and build**

Run: `pnpm test && pnpm build`
Expected: All pass, build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/adapters/telegram/commands/admin.ts src/adapters/telegram/commands/index.ts src/adapters/telegram/commands/new-session.ts src/adapters/telegram/adapter.ts
git commit -m "feat(telegram): add voice toggle button, /voice command, combined session keyboard"
```

---

### Task 10: Telegram adapter — TTS text strip after audio send

**Files:**
- Modify: `src/adapters/telegram/adapter.ts` (onAttachment handler)
- Modify: `src/adapters/telegram/streaming.ts` (add stripPattern method to MessageDraft)

The `SessionBridge` already handles `audio_content` events — it saves the file and calls `adapter.sendMessage(sid, { type: "attachment", text: "", attachment })`. The Telegram adapter's `onAttachment` handler sends audio files. **Audio sending already works** — this task only handles stripping `[TTS]` from text.

- [ ] **Step 1: Add `stripPattern` method to MessageDraft**

In `src/adapters/telegram/streaming.ts`, add a method to `MessageDraft`:

```typescript
/**
 * Edit the last sent message to remove content matching the given pattern.
 * Used to strip [TTS]...[/TTS] blocks after voice message is sent.
 */
async stripPattern(pattern: RegExp): Promise<void> {
  if (!this.lastMessageId || !this.fullText) return;

  const stripped = this.fullText.replace(pattern, "").trim();
  if (stripped === this.fullText) return; // nothing to strip

  this.fullText = stripped;
  try {
    // Re-render and edit the message with stripped content
    await this.editMessage(stripped);
  } catch {
    // Ignore edit failures (message may have been deleted, or too old)
  }
}
```

Check the actual `MessageDraft` class for the correct property names (`lastMessageId`, `fullText`, `editMessage`). The implementation must use whatever the draft uses to track its accumulated text and last sent message ID. Read `streaming.ts` during implementation to get the exact field names.

- [ ] **Step 2: Call stripPattern in onAttachment handler**

In the Telegram adapter's `onAttachment` message handler (in `adapter.ts`), after sending an audio attachment, strip TTS blocks:

```typescript
// In the onAttachment handler, after sending audio
if (attachment.type === "audio") {
  const draft = this.draftManager.getDraft(sessionId);
  if (draft) {
    draft.stripPattern(/\[TTS\][\s\S]*?\[\/TTS\]/g).catch(() => {});
  }
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/adapters/telegram/adapter.ts src/adapters/telegram/streaming.ts
git commit -m "feat(telegram): strip [TTS] block from text after sending voice message"
```

---

### Task 11: (Merged into Task 9)

Voice callback registration in `adapter.ts` is now part of Task 9, Step 5.

---

### Task 12: Final integration test + cleanup

**Files:**
- Test: run full suite
- Verify: build succeeds

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 3: Run build:publish**

Run: `pnpm build:publish`
Expected: Bundle succeeds

- [ ] **Step 4: Manual smoke test checklist**

If possible, start the server and verify:
1. `/voice` command in a session topic responds with one-shot confirmation
2. `/voice on` enables persistent voice mode
3. Voice toggle button appears in new session keyboard
4. Button toggles between 🔊/🔇 states
5. Settings menu shows TTS provider and voice fields
6. Config set via CLI: `viben config set speech.tts.provider edge-tts`

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "feat: complete TTS feature implementation"
```
