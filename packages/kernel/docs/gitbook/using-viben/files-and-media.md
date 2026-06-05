# Files and Media

You can send files, images, and audio directly to an active session. The agent receives them as attachments alongside your text message.

## Sending files

In a session topic or thread, attach a file to your message the same way you would in any other chat. Viben detects the attachment, saves it, and includes it in the prompt sent to the agent.

You can combine text and files in a single message:

```
Here is the screenshot of the error — can you explain what went wrong?
[attach: screenshot.png]
```

If you send an attachment without text, Viben still forwards it to the agent.

## Supported types

| Type | Formats |
|---|---|
| Images | JPEG, PNG, GIF, WebP, SVG |
| Audio | OGG, MP3, WAV, M4A, WebM |
| Video | MP4, WebM |
| Documents | PDF, plain text (.txt) |
| Other | Any file type — passed as a generic attachment |

Images and audio are classified automatically. Everything else is treated as a generic file attachment.

## How it works

When you send a file, Viben:

1. Downloads the file from the messaging platform
2. Saves it to `~/.viben/files/{sessionId}/` with a timestamp prefix
3. Constructs an `Attachment` object with the file path, MIME type, and size
4. Includes the attachment in the prompt sent to the agent via ACP

The agent receives the file path and can read the file from disk. Files persist for the lifetime of the session.

### Audio attachments and STT

If you send an audio file (including Telegram voice messages) and STT is configured, Viben transcribes the audio and sends the text to the agent instead of the raw file. See [Voice and Speech](voice-and-speech.md) for details.

If the agent natively supports audio input, the audio is passed directly without transcription.

Telegram voice messages are in OGG Opus format. Viben can convert them to WAV for agents that cannot read OGG directly.

## File viewer via tunnel

When an agent produces output files — generated images, edited documents, reports — you can view them through the tunnel feature. Use `/tunnel 3000` (or whichever port) to expose a local web server with a public URL.

Viben's tunnel integration supports Monaco editor for code files and inline image preview.

See [Chat Commands — /tunnel](chat-commands.md#tunnel-port-label-telegram-only) for how to create and manage tunnels.

## Size limits

Platform-imposed limits apply before Viben processes the file:

| Platform | Limit |
|---|---|
| Telegram | 20 MB for bots (standard API) |
| Discord | 8 MB (free), 50 MB (Nitro) |

For audio transcription via Groq STT, the additional limit is 25 MB per file.

Files that exceed the platform limit are never delivered to Viben. If you need to share large files, point the agent at a path on the server's local filesystem in your message text instead.
