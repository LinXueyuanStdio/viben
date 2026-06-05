# File/Image/Audio Support Design

**Date:** 2026-03-23
**Status:** Draft

## Overview

Add full multimedia support (images, audio, files) to Viben — both directions:
- **User → Agent**: User sends photo/voice/document from Telegram → agent receives it
- **Agent → User**: Agent emits image/audio or references file paths → sent back to user via Telegram

ACP SDK v0.16.1 already supports `ImageContent` and `AudioContent` in the protocol. This design bridges that capability through Viben's core and adapter layers.

## Design Decisions

- **File storage**: Files saved to `~/.viben/files/<sessionId>/` (not in agent's working directory)
- **User → Agent delivery**: Save file to disk, pass absolute path to agent (not base64 inline)
- **Agent → User detection**: Primary via ACP events (`ImageContent`/`AudioContent`), fallback via file path detection in agent text — deferred to follow-up iteration
- **Size limits**: Defer to platform limits (Telegram bot API: 50MB upload, 20MB download via `getFile`)
- **Cleanup**: No auto-cleanup — user manages `~/.viben/files/` themselves
- **PromptCapabilities**: Must check agent's advertised capabilities before sending image/audio content blocks

## Known Platform Limitations

- **Telegram `getFile`**: Bot API limits downloads to 20MB. Files larger than 20MB sent by users cannot be downloaded.
- **Telegram upload**: Bot API limits uploads to 50MB.
- **Base64 memory**: To avoid memory issues, files > 10MB are sent as file-path-in-text regardless of type.

## Section 1: Core Types

### Attachment

```typescript
// src/core/types.ts
interface Attachment {
  type: 'image' | 'audio' | 'file'
  filePath: string        // absolute path on disk (~/.viben/files/...)
  fileName: string        // original name (photo.jpg, report.pdf)
  mimeType: string        // image/png, audio/ogg, application/pdf
  size: number            // bytes
}
```

### IncomingMessage

```typescript
// src/core/types.ts — uncomment and use new Attachment type
interface IncomingMessage {
  channelId: string
  threadId: string
  userId: string
  text: string
  attachments?: Attachment[]
}
```

### AgentEvent

```typescript
// src/core/types.ts — add to union
| { type: 'attachment'; attachment: Attachment }
```

### OutgoingMessage

```typescript
// src/core/types.ts — extend
interface OutgoingMessage {
  type: "text" | "thought" | "tool_call" | "tool_update" | "plan"
       | "usage" | "session_end" | "error" | "attachment"
  text: string
  metadata?: Record<string, unknown>
  attachment?: Attachment
}
```

## Section 2: FileService

New module `src/core/file-service.ts` — manages file download, storage, and lookup.

```typescript
class FileService {
  private baseDir: string  // ~/.viben/files/

  // User → Agent: save downloaded file to disk
  async saveFile(sessionId: string, fileName: string, data: Buffer, mimeType: string): Promise<Attachment>
  // Saves to ~/.viben/files/<sessionId>/<timestamp>-<fileName>
  // Returns Attachment with absolute filePath

  // Agent → User: resolve a file path to Attachment metadata
  async resolveFile(filePath: string): Promise<Attachment | null>
  // Checks file exists, reads size, determines mimeType from extension

  // Derive file extension from mimeType
  static extensionFromMime(mimeType: string): string
  // e.g. image/jpeg → .jpg, audio/mpeg → .mp3, audio/ogg → .ogg
}
```

**Notes:**
- Use simple extension-to-mimeType mapping (no extra dependency)
- No automatic cleanup
- `detectFilePaths` (text → file path extraction) is **deferred to a follow-up iteration** — initial implementation relies solely on ACP `ImageContent`/`AudioContent` events for agent → user media

## Section 3: AgentInstance — Bidirectional

### PromptCapabilities Check

After `connection.initialize()`, store the returned `agentCapabilities.promptCapabilities` on the `AgentInstance`:

```typescript
// agent-instance.ts
private promptCapabilities?: { image?: boolean; audio?: boolean }

// In initialize():
const response = await this.connection.initialize(...)
this.promptCapabilities = response.agentCapabilities?.promptCapabilities
```

### User → Agent (prompt with files)

```typescript
// agent-instance.ts — extend prompt()
async prompt(text: string, attachments?: Attachment[]): Promise<PromptResponse> {
  const contentBlocks: ContentBlock[] = [{ type: "text", text }]

  for (const att of attachments ?? []) {
    const tooLarge = att.size > 10 * 1024 * 1024  // 10MB base64 guard

    if (att.type === 'image' && this.promptCapabilities?.image && !tooLarge) {
      const data = await readFile(att.filePath)
      contentBlocks.push({ type: "image", data: data.toString('base64'), mimeType: att.mimeType })
    } else if (att.type === 'audio' && this.promptCapabilities?.audio && !tooLarge) {
      const data = await readFile(att.filePath)
      contentBlocks.push({ type: "audio", data: data.toString('base64'), mimeType: att.mimeType })
    } else {
      // Fallback: append file path to text for agent to read from disk
      contentBlocks[0].text += `\n\n[Attached file: ${att.filePath}]`
    }
  }

  return this.connection.prompt({ sessionId: this.sessionId, prompt: contentBlocks })
}
```

### Agent → User (receive image/audio events)

Base64 → file conversion is handled in `SessionBridge` (not `AgentInstance`) to keep AgentInstance focused on ACP protocol concerns. See Section 5.

AgentInstance emits raw ACP content types as new AgentEvent variants:

```typescript
// agent-instance.ts — extend agent_message_chunk handling
case "agent_message_chunk":
  if (update.content.type === "text") {
    event = { type: "text", content: update.content.text }
  } else if (update.content.type === "image") {
    event = {
      type: "image_content",
      data: update.content.data,
      mimeType: update.content.mimeType
    }
  } else if (update.content.type === "audio") {
    event = {
      type: "audio_content",
      data: update.content.data,
      mimeType: update.content.mimeType
    }
  }
  break;
```

With corresponding AgentEvent types:

```typescript
| { type: 'image_content'; data: string; mimeType: string }
| { type: 'audio_content'; data: string; mimeType: string }
```

## Section 4: ChannelAdapter & Telegram Implementation

### ChannelAdapter interface

No change to interface signature. `sendMessage` still receives `OutgoingMessage`, but now OutgoingMessage can have `type: "attachment"` with `attachment` field. Each adapter handles it.

### Telegram adapter — incoming (User → Agent)

```typescript
// Handle photo, document, voice, audio, video_note messages
bot.on("message:photo", async (ctx) => {
  const fileId = ctx.message.photo.at(-1).file_id  // highest resolution
  const file = await ctx.api.getFile(fileId)
  const buffer = await downloadFile(file.file_path)  // from Telegram CDN
  const ext = FileService.extensionFromMime("image/jpeg")
  const att = await fileService.saveFile(sessionId, `photo${ext}`, buffer, "image/jpeg")
  core.handleMessage({ ...msg, attachments: [att] })
})

// Similarly for: message:document, message:voice, message:audio, message:video_note
// For document: use ctx.message.document.file_name as fileName, ctx.message.document.mime_type
// For voice: mimeType = "audio/ogg", fileName = "voice.ogg"
```

**Note:** Telegram `getFile` has a 20MB download limit. If file is larger, inform the user that the file is too large to forward to the agent.

### Telegram adapter — outgoing (Agent → User)

```typescript
// In sendMessage(), add case for type: "attachment"
case "attachment": {
  const { attachment } = content
  if (attachment.type === 'image') {
    await bot.api.sendPhoto(chatId, new InputFile(attachment.filePath), { message_thread_id: topicId })
  } else if (attachment.type === 'audio') {
    await bot.api.sendVoice(chatId, new InputFile(attachment.filePath), { message_thread_id: topicId })
  } else {
    await bot.api.sendDocument(chatId, new InputFile(attachment.filePath), { message_thread_id: topicId })
  }
}
```

**Platform limits:** Telegram bot API max 50MB upload. If file > 50MB, skip sending file and log warning.

## Section 5: Core Routing (VibenCore, Session, SessionBridge)

### PromptQueue — extended to carry attachments

```typescript
// prompt-queue.ts — generalize queue item type
interface QueueItem {
  text: string
  attachments?: Attachment[]
  resolve: () => void
}

// Processor callback updated:
type Processor = (text: string, attachments?: Attachment[]) => Promise<void>
```

### Session — enqueuePrompt updated

```typescript
// session.ts — enqueuePrompt accepts attachments
async enqueuePrompt(text: string, attachments?: Attachment[]): Promise<void> {
  return this.promptQueue.enqueue(text, attachments)
}

// processPrompt updated
private async processPrompt(text: string, attachments?: Attachment[]): Promise<void> {
  await this.agent.prompt(text, attachments)
}
```

### VibenCore — handleMessage forwards attachments

```typescript
// core.ts — handleMessage already receives IncomingMessage
// Update the call to session:
await session.enqueuePrompt(message.text, message.attachments)
```

### SessionBridge — handles media event conversion

`SessionBridge.wireSessionToAdapter()` converts raw ACP media events to attachments via FileService:

```typescript
// session-bridge.ts — in the event handler
case "image_content": {
  const buffer = Buffer.from(event.data, 'base64')
  const ext = FileService.extensionFromMime(event.mimeType)
  const att = await this.fileService.saveFile(sessionId, `agent-image${ext}`, buffer, event.mimeType)
  await this.adapter.sendMessage(sessionId, { type: "attachment", text: "", attachment: att })
  break;
}
case "audio_content": {
  const buffer = Buffer.from(event.data, 'base64')
  const ext = FileService.extensionFromMime(event.mimeType)
  const att = await this.fileService.saveFile(sessionId, `agent-audio${ext}`, buffer, event.mimeType)
  await this.adapter.sendMessage(sessionId, { type: "attachment", text: "", attachment: att })
  break;
}
```

### FileService dependency injection

`FileService` is instantiated once in `VibenCore` (or `main.ts`) and passed to:
- `SessionBridge` constructor (for agent → user media conversion)
- Telegram adapter constructor (for user → agent file download/save)
- `AgentInstance` does NOT receive FileService — it stays focused on ACP protocol

## Backward Compatibility

- `IncomingMessage.attachments` is optional — existing adapters/code unaffected
- `OutgoingMessage.attachment` is optional — existing adapters handle known types, ignore unknown
- `AgentEvent` union extended — existing switch/case blocks fall through on unknown types
- `PromptQueue` change is internal — no external API change
- No config schema changes — no migration needed
- `~/.viben/files/` directory created on first use

## Deferred to Follow-up

- **File path detection in agent text**: Heuristic to detect file paths in agent output and auto-send as attachments. Deferred due to complexity of regex/false-positive handling.
- **`ResourceLink` support**: ACP `ResourceLink` content type as an alternative delivery mechanism for files.
- **CLI cleanup command**: `viben cleanup-files` to manage `~/.viben/files/` storage.
