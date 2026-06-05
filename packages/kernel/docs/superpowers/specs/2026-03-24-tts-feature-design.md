# Text-to-Speech (TTS) Feature Design

## Overview

Add TTS capability to Viben so agents can send voice summaries alongside text responses. User-driven: activated via `/voice` command or inline toggle button per session.

## Trigger Mechanism

### Voice Mode States

Per-session `voiceMode` property:

- `"off"` — default, no TTS
- `"next"` — TTS for the next prompt only, resets to `"off"` after processing
- `"on"` — TTS for all prompts in this session

### Activation Methods

1. **Command in session topic:** `/voice` (one-shot), `/voice on`, `/voice off`
2. **Inline button:** Toggle button next to Dangerous Mode button in session menu — `🔇 Voice` / `🔊 Voice`
3. **Settings menu (Telegram):** TTS provider selection, voice selection in `⚙️ Settings`
4. **CLI:** `viben config set speech.tts.provider edge-tts`
5. **Assistant chat:** Natural language in Assistant topic (e.g., "enable voice", "change TTS voice to vi-VN")

## Prompt Injection

When `voiceMode !== "off"` and TTS is available, `Session.processPrompt()` appends to the prompt text:

```
Additionally, include a [TTS]...[/TTS] block with a spoken-friendly summary of your response. Focus on key information, decisions the user needs to make, or actions required. The agent decides what to say and how long. Respond in the same language the user is using. This instruction applies to this message only.
```

The agent responds normally (full code, markdown, etc.) plus a `[TTS]...[/TTS]` block with a spoken-friendly summary. The agent decides content and length.

## Response Pipeline

### Text Streaming (unchanged)

Text events stream through `MessageDraft` as usual, including any `[TTS]...[/TTS]` block that appears in the stream. Users may briefly see the raw block during streaming — this is acceptable as it gets stripped after response completes.

### Post-Response TTS Processing

After the agent response completes (prompt resolves):

1. **Accumulate** the full text response from the agent
2. **Parse** `[TTS]...[/TTS]` block via regex: `/\[TTS\]([\s\S]*?)\[\/TTS\]/`
3. **Synthesize** extracted text via `SpeechService.synthesize()` — fire-and-forget, does not block the prompt queue
4. **Send** audio as voice message in the session topic
5. **Emit** a `tts_strip` event so the adapter can edit the last text message to remove the `[TTS]...[/TTS]` block

If no `[TTS]` block found, skip silently (text already sent). If TTS synthesis fails, log warning and skip — text is already delivered.

**Timeout:** TTS synthesis has a 30-second timeout. If exceeded, skip and log warning.

**Max text length:** Cap TTS input at 5000 characters. If longer, truncate with "..." suffix.

## TTS Provider Architecture

### Provider Interface (existing)

```typescript
// src/core/speech/types.ts — already defined
interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}

interface TTSOptions {
  language?: string;
  voice?: string;
  model?: string;
}

interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
}
```

### SpeechProviderConfig Change

```typescript
// Before
apiKey: z.string().min(1)

// After
apiKey: z.string().min(1).optional()
```

This allows providers like edge-tts that don't require API keys. Each provider validates its own config requirements.

### SpeechService Changes

- `isTTSAvailable()`: Check `provider !== null` and provider is registered (remove apiKey check)
- `isSTTAvailable()`: Keep existing apiKey check (all STT providers need keys)
- `synthesize()`: Remove apiKey guard clause — provider validates its own config internally. Edge-tts needs no key; paid providers throw if key missing.

### Default Provider: edge-tts (msedge-tts)

**Package:** `msedge-tts` (MIT license, TypeScript, actively maintained)

**Why:** Zero configuration — no API key, no account needed. 400+ neural voices, good quality, free unlimited usage.

**File:** `src/core/speech/providers/edge-tts.ts`

**Config:**
```json
{
  "speech": {
    "tts": {
      "provider": "edge-tts",
      "providers": {
        "edge-tts": {
          "voice": "en-US-AriaNeural"
        }
      }
    }
  }
}
```

No `apiKey` required. `voice` is optional (defaults based on locale or a sensible default like `en-US-AriaNeural`).

**Output format:** `msedge-tts` supports multiple output codecs via `OUTPUT_FORMAT` enum including WebM Opus and MP3. For Telegram voice messages (inline player), need OGG Opus — if `msedge-tts` does not support OGG Opus directly, output WebM Opus or MP3 and convert to OGG Opus using an audio conversion utility (e.g., `opusenc` or a lightweight npm package). Fallback: send as `sendAudio` (MP3) instead of `sendVoice` if conversion is not available.

**Risk:** Unofficial Microsoft API. Stable for years but could break. Mitigated by multi-provider support — user can switch to paid provider if edge-tts breaks.

### Future Paid Providers (Phase 2)

Priority order:

1. **Groq TTS** — Already have SDK and API key in project. `src/core/speech/providers/groq-tts.ts`
2. **OpenAI TTS** — Widely used, flexible output formats. `src/core/speech/providers/openai-tts.ts`
3. **ElevenLabs** — Premium quality option. `src/core/speech/providers/elevenlabs-tts.ts`

## Session Integration

### Session Class Changes

```typescript
class Session {
  voiceMode: "off" | "next" | "on" = "off";

  setVoiceMode(mode: "off" | "next" | "on"): void {
    this.voiceMode = mode;
  }
}
```

### processPrompt() Changes

```
processPrompt(text, attachments):
  1. STT transcription (existing)
  2. If voiceMode !== "off" && speechService.isTTSAvailable():
     a. Append TTS instruction to text
     b. If voiceMode === "next": reset to "off" (immediately, before agent prompt)
  3. Set up text accumulator: listen to own "agent_event" for type "text", collect into buffer
  4. Send to agent (existing: agentInstance.prompt())
  5. After agent responds (prompt resolves):
     a. Stop accumulator, get full response text
     b. Parse [TTS] block from accumulated text
     c. If found: fire-and-forget async TTS pipeline:
        - synthesize(ttsText) with 30s timeout
        - base64-encode audioBuffer
        - emit audio_content event { type: "audio_content", data: base64, mimeType }
        - emit tts_strip event so adapter can edit message to remove [TTS] block
```

### Response Accumulation

Inside `processPrompt()`, temporarily listen to own `agent_event` emissions for `type === "text"`, collecting content into a string buffer. Similar pattern to existing `autoName()` which also listens post-prompt. Reset accumulator at start of each prompt. This stays in Session — no changes to SessionBridge needed for accumulation.

### TTS Strip Event

New event type on Session: `tts_strip`. SessionBridge listens to this and forwards to the adapter, which edits the last streamed text message to remove `[TTS]...[/TTS]` content. This keeps Session decoupled from adapter specifics.

## Adapter Integration (Telegram)

### Voice Toggle Button

Add to session creation flow, alongside Dangerous Mode button:

```typescript
// In session topic, after creation
// Button: 🔇 Voice / 🔊 Voice
// Callback data: v:<sessionId>
```

**Callback prefix:** `v:` (follows existing pattern: `d:` for dangerous, `p:` for permissions, `m:` for menu)

**Handler:** Toggle `session.voiceMode` between `"on"` and `"off"`. Update button label. Toast notification.

**Note:** Button toggles between `"on"`/`"off"` (persistent for session). `/voice` command (no args) sets `"next"` (one-shot). This is intentional — button is for "always voice" mode, command is for one-time use.

### Audio Sending

When TTS audio is ready:
1. Save buffer to temp file via `FileService`
2. Send as voice message: `bot.api.sendVoice(chatId, InputFile(filePath), { message_thread_id })` for OGG Opus
3. Or `bot.api.sendAudio()` for MP3

OGG Opus preferred — Telegram renders it as inline voice player (no download needed).

### Text Message Edit

After sending audio, edit the streamed text message to remove `[TTS]...[/TTS]` block. `MessageDraft` already supports `editMessage()`.

## Settings Integration

### Config Registry

Add TTS fields to `CONFIG_REGISTRY`:

```typescript
{
  path: 'speech.tts.provider',
  displayName: 'Text to Speech',
  group: 'speech',
  type: 'select',
  options: ['edge-tts'],  // expand as providers added
  scope: 'safe',
  hotReload: true,
},
{
  path: 'speech.tts.voice',
  displayName: 'TTS Voice',
  group: 'speech',
  type: 'string',  // input via assistant, too many voices for select
  scope: 'safe',
  hotReload: true,
}

**Note on `speech.tts.voice` path:** This is a convenience shorthand at the `speech.tts` level in the config schema (new field), not nested inside `providers.edge-tts`. It serves as a global default voice override regardless of provider. Each provider falls back to this if no provider-specific voice is set.
```

### CLI

`viben config set speech.tts.provider edge-tts` — works with existing config set infrastructure.

### Assistant

The assistant system prompt already includes config guidance. Add TTS to the action playbook so assistant can handle "enable voice" / "change voice" requests.

## Backward Compatibility

- **Config:** `speech.tts` already has `.default({})`. New `apiKey` optional change is backward compatible — existing configs with `apiKey` still work.
- **Session state:** `voiceMode` defaults to `"off"` — no impact on existing sessions.
- **Session store:** `voiceMode` is runtime-only, not persisted to store (resets on restart, which is correct behavior).
- **CLI:** No command changes.
- **Plugin API:** `ChannelAdapter` interface unchanged — TTS audio sent via existing `sendMessage` with attachment type.

## Dependencies

- `msedge-tts` — MIT, TypeScript, ~5 deps (axios, ws, buffer, stream-browserify, isomorphic-ws)

## File Changes Summary

| File | Change |
|------|--------|
| `src/core/speech/providers/edge-tts.ts` | New: edge-tts provider implementation |
| `src/core/speech/speech-service.ts` | Update: `isTTSAvailable()` and `synthesize()` remove apiKey check |
| `src/core/speech/types.ts` | Update: `SpeechProviderConfig.apiKey` optional in TS interface |
| `src/core/config.ts` | Update: `SpeechProviderSchema.apiKey` optional in Zod schema, add `voice` field to TTS schema |
| `src/core/session.ts` | Update: add `voiceMode`, TTS prompt injection, response accumulator, post-response TTS pipeline, `tts_strip` event |
| `src/core/session-bridge.ts` | Update: wire `tts_strip` event to adapter |
| `src/core/config-registry.ts` | Update: add TTS provider and voice fields |
| `src/adapters/telegram/commands/admin.ts` | Update: add voice toggle button builder and callback handler |
| `src/adapters/telegram/commands/index.ts` | Update: register voice toggle callbacks |
| `src/adapters/telegram/adapter.ts` | Update: send voice button with session creation, handle `/voice` command |
| `src/main.ts` | Update: register edge-tts provider on startup |
| `package.json` | Update: add `msedge-tts` dependency |
