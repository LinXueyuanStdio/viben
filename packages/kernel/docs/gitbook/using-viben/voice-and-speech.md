# Voice and Speech

Viben supports two speech features: speech-to-text (STT) for voice input and text-to-speech (TTS) for spoken responses. Both are optional and configured independently.

## Speech-to-text (STT)

**Provider:** Groq (uses the Whisper large v3 turbo model)
**Cost:** Free tier available at [console.groq.com](https://console.groq.com) — 28,800 seconds of audio per day

When STT is configured, you can send voice messages to a session topic and Viben transcribes them before passing the text to the agent. The transcribed text appears in the topic as a system message:

```
You said: "Add a unit test for the login function"
```

The agent then receives the transcription as a normal text prompt. If the agent natively supports audio input, the audio attachment is passed directly instead.

**Supported audio formats:** OGG, WAV, MP3, M4A, WebM, FLAC (maximum 25 MB per file).

### Configuring STT

Add your Groq API key to the config (see [Configuration](../self-hosting/configuration.md) for the full `speech` config reference):

```json
{
  "speech": {
    "stt": {
      "provider": "groq",
      "providers": {
        "groq": {
          "apiKey": "gsk_..."
        }
      }
    }
  }
}
```

Or use `/settings` in Telegram — tap the STT provider field and the assistant will walk you through entering an API key.

### STT error handling

If transcription fails (network issue, rate limit, invalid key), the audio attachment is kept and passed to the agent as-is, with an error message in the topic. The Groq free tier limit is 28,800 seconds per day; if exceeded, transcription fails gracefully.

## Text-to-speech (TTS)

**Provider:** Edge TTS (Microsoft's neural TTS service)
**Cost:** Free, no API key required
**Default voice:** `en-US-AriaNeural`
**Output format:** MP3 (24 kHz, 48 kbps mono)

When TTS is active for a session, the agent is instructed to include a spoken-friendly summary of its response in a `[TTS]...[/TTS]` block. Viben extracts this block, synthesizes audio, and sends it back to the chat as a voice message. TTS synthesis has a 30-second timeout — if it exceeds this, the audio is skipped silently.

The agent decides what to include in the TTS block. It focuses on key information, decisions the user needs to make, or required actions. The response language matches whatever language you are using.

### Voice modes

TTS operates in one of three modes per session:

| Mode | Behavior |
|---|---|
| `off` | No TTS (default) |
| `next` | TTS for the next message only, then reverts to `off` |
| `on` | TTS for every subsequent message |

### Toggling TTS

**Telegram — in a session topic:**
```
/text_to_speech        # next message only
/text_to_speech on     # persistent
/text_to_speech off    # disable
```

**Via the session control keyboard:** Tap the "Text to Speech" toggle button in the session setup message.

**Discord:**
```
/tts             # next message only
/tts on          # persistent
/tts off         # disable
```

### Configuring TTS

Edge TTS works out of the box with no configuration. To change the voice, update your config:

```json
{
  "speech": {
    "tts": {
      "provider": "edge-tts",
      "voice": "en-GB-SoniaNeural"
    }
  }
}
```

Microsoft Edge TTS supports a large number of voices across many languages. Voice names follow the pattern `{language}-{region}-{name}Neural`.

### Enabling TTS in config

```json
{
  "speech": {
    "tts": {
      "provider": "edge-tts"
    }
  }
}
```

Set `provider` to `null` to disable TTS entirely.

## Using both together

STT and TTS work independently. You can use either or both at the same time. A typical voice workflow:

1. Send a voice message in a session topic
2. Viben transcribes it via Groq STT
3. The transcription appears as "You said: ..."
4. The agent processes the text and responds
5. If TTS is on, the response summary is synthesized and sent as audio
