# Speech Module Design

## Overview

A standalone speech module for Viben providing STT (Speech-to-Text) and TTS (Text-to-Speech) capabilities with a pluggable provider architecture. Default provider: Groq Whisper (free tier, 100+ languages).

## Architecture

```
src/core/speech/
  ├── index.ts              — public API exports
  ├── speech-service.ts     — orchestrator (provider selection, routing)
  ├── types.ts              — STTProvider, TTSProvider interfaces
  └── providers/
      ├── groq.ts           — Groq Whisper STT (default)
      └── openai.ts         — OpenAI Whisper STT (future)
```

## Provider Interfaces

```typescript
interface STTProvider {
  name: string
  transcribe(audioBuffer: Buffer, mimeType: string, options?: STTOptions): Promise<STTResult>
}

interface TTSProvider {
  name: string
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>
}

interface STTOptions {
  language?: string      // BCP-47 code, e.g. "vi", "en" — auto-detect if not set
  model?: string         // override model from config
}

interface STTResult {
  text: string
  language?: string      // detected language
  duration?: number      // audio duration in seconds
}

interface TTSOptions {
  language?: string
  voice?: string         // provider-specific voice ID
  model?: string
}

interface TTSResult {
  audioBuffer: Buffer
  mimeType: string       // e.g. "audio/wav", "audio/mp3"
}
```

## SpeechService Orchestrator

```typescript
class SpeechService {
  private sttProviders: Map<string, STTProvider>
  private ttsProviders: Map<string, TTSProvider>
  private config: SpeechConfig

  constructor(config: SpeechConfig)

  // STT: transcribe audio file
  async transcribe(audioPath: string, options?: STTOptions): Promise<STTResult>

  // TTS: synthesize text to audio file
  async synthesize(text: string, outputPath: string, options?: TTSOptions): Promise<string>

  // Availability checks
  isSTTAvailable(): boolean
  isTTSAvailable(): boolean
}
```

Key behaviors:
- Lazy init: providers only instantiated when first called
- `isSTTAvailable()` checks provider configured + API key present
- `transcribe()` accepts file path (aligns with FileService pattern)
- Throws descriptive errors for missing config, invalid keys, rate limits

## Groq Provider (Default)

- API: `POST https://api.groq.com/openai/v1/audio/transcriptions`
- OpenAI-compatible format (multipart/form-data: file, model, language)
- Default model: `whisper-large-v3-turbo` (fastest)
- Free tier: 28,800 audio seconds/day (~8 hours)
- 100+ languages supported
- Max file size: 25MB
- HTTP via native `fetch` — no extra dependencies

Error handling:
- 401 → invalid API key, message guides user to check key
- 413 → file too large
- 429 → rate limit exceeded, throw with retry hint

## Config Integration

```json
{
  "speech": {
    "stt": {
      "provider": "groq",
      "providers": {
        "groq": {
          "apiKey": "gsk_...",
          "model": "whisper-large-v3-turbo"
        },
        "openai": {
          "apiKey": "sk-...",
          "model": "whisper-1"
        }
      }
    },
    "tts": {
      "provider": null,
      "providers": {}
    }
  }
}
```

Zod schema:

```typescript
const SpeechProviderSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().optional(),
}).passthrough();  // allow provider-specific fields

const STTSchema = z.object({
  provider: z.string().nullable().default(null),
  providers: z.record(SpeechProviderSchema).default({}),
}).default({});

const TTSSchema = z.object({
  provider: z.string().nullable().default(null),
  providers: z.record(SpeechProviderSchema).default({}),
}).default({});

const SpeechSchema = z.object({
  stt: STTSchema,
  tts: TTSSchema,
}).optional().default({});
```

All fields have `.default()` or `.optional()` — old configs without `speech` field work without changes.

Env overrides:
- `VIBEN_SPEECH_STT_PROVIDER` → `speech.stt.provider`
- `VIBEN_SPEECH_GROQ_API_KEY` → `speech.stt.providers.groq.apiKey`

Config Registry entries for settings UI:
- `speech.stt.provider` — type: select, scope: safe, hot-reload: yes (requires handler in `config:changed` listener to re-init SpeechService)
- `speech.stt.providers.groq.apiKey` — type: string, scope: sensitive

## Message Flow Integration

When user sends voice message:

```
Voice message (OGG)
  ↓
Adapter: download → save original OGG + convert to WAV → saveFile() both
  ↓
Session.processPrompt() checks each audio attachment:
  ├── agent.promptCapabilities.audio? → pass audio attachment through (AgentInstance handles base64)
  └── else → speechService.isSTTAvailable()?
        ├── YES → transcribe (send original OGG to API, smaller file size)
        │         → replace audio attachment with transcribed text in prompt
        │         → on error: send error message to adapter, then fallback to file path text
        └── NO → no change, fallback to file path as text (same behavior as today)
```

Integration point: `Session.processPrompt()`, NOT `AgentInstance.prompt()`. Reason: `AgentInstance` is a low-level ACP subprocess wrapper with no application-level dependencies. `Session` already handles prompt pre-processing and has access to application services.

STT error UX: On transcription failure, send a brief error message to the user in the thread (e.g., "Failed to transcribe voice message: rate limit exceeded"), then fall back to sending the file path as text so the prompt is not lost.

Audio format for STT: Send the original OGG/Opus file to the STT API (not the converted WAV). OGG is compressed (~10x smaller than WAV), reducing upload time and avoiding unnecessary 413 errors on longer messages. WAV conversion is only for agents that accept audio directly.

## CLI, Bot Menu & Assistant

**CLI:** No new commands. Speech settings managed via existing `viben config` command.

**Bot Menu (`/settings`):** Add "Speech" section:
```
⚙️ Settings
  ...existing items...
  ── Speech ──
  🎤 STT Provider: Groq ✅  (or "Not configured")
  🔊 TTS Provider: Not configured
```

Tap into submenu for provider selection, API key, model config.

**Assistant chat:** Assistant session knows about speech module. When user asks about voice/speech/transcription, guides setup: "You need a Groq API key. Get one at console.groq.com, then send it here or set via /settings."

## Backward Compatibility

- Config: `speech` field is `.optional().default({})` — old configs work without changes
- Runtime: No existing behavior changes. STT/TTS only activates when explicitly configured
- CLI: No commands/flags removed or renamed
- Plugin API: No interface changes. Adapters that don't handle speech continue working
- Menu: Speech section appended to existing settings, nothing moved or removed
- Setup: Voice transcription setup is optional step, skippable

## Dependencies

- No new npm dependencies. Groq API uses native `fetch` + `FormData`
- Existing `ogg-opus-decoder` + `node-wav` continue handling OGG→WAV conversion

## Implementation Priority

1. Provider interfaces + types
2. SpeechService orchestrator
3. Groq STT provider
4. Config schema + env overrides
5. Session.processPrompt() integration
6. Bot menu settings UI
7. Assistant chat awareness
8. TTS placeholder (interface only, no implementation yet)
