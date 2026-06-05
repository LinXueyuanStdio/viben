# Discord Media Support — Design Spec

**Date:** 2026-03-23
**Status:** Draft
**Scope:** Add file, image, and audio support to the Discord adapter, matching Telegram adapter's v0.5.2 capabilities.

## Context

The Telegram adapter (v0.5.2) has full bidirectional media support: incoming photos, documents, voice messages, audio files, and video notes, plus outgoing agent-generated images/audio. The Discord adapter currently handles text only — `message.attachments` is ignored on incoming, and `sendMessage()` has no `'attachment'` case handler.

The core infrastructure (FileService, Attachment type, PromptQueue, Session, AgentInstance, SessionBridge) is already media-aware. This work is adapter-level only.

## Approach

Mirror the Telegram adapter's pattern directly in the Discord adapter. No shared abstraction layer — FileService is already the right shared component. Download logic differs between platforms (Telegram requires API call to get file URL; Discord provides URLs directly).

## Design

### Incoming Media (User → Agent)

**Location:** `src/adapters/discord/adapter.ts` — `setupMessageHandler()`

In the existing `messageCreate` handler, after extracting `message.content`:

1. Check `message.attachments` collection (Discord.js `Collection<string, Attachment>`)
2. Download all attachments in parallel via `Promise.allSettled()` — each attachment:
   - Download via `fetch(attachment.url)` — Discord provides direct URLs, no extra API call needed
   - Determine type from `attachment.contentType`: `image/*` → `'image'`, `audio/*` → `'audio'`, else `'file'`
   - For voice messages: detect via `message.flags.has(MessageFlags.IsVoiceMessage)` (flag is on the **message**, not the attachment), then convert OGG→WAV via `FileService.convertOggToWav()`
   - Resolve `sessionId` via existing thread→session mapping, fallback to `"unknown"` if session doesn't exist yet (mirrors Telegram pattern)
   - Save via `FileService.saveFile(sessionId, fileName, buffer, mimeType)` → returns `Attachment` object
   - Filter out failed downloads, collect successful ones into `Attachment[]`
3. If `message.content` is empty but attachments exist, generate fallback text: `[Attachment: filename.ext]` (mirrors Telegram's `[Photo: photo.jpg]` pattern)
4. Pass `attachments` to `core.handleMessage()`:
   ```typescript
   await this.core.handleMessage({
     channelId: 'discord',
     threadId,
     userId,
     text,
     attachments,
   })
   ```

**Assistant thread routing:** If the message is in the assistant thread, call `this.assistantSession.enqueuePrompt(text, attachments)` directly (bypassing `handleAssistantMessage()` which currently only accepts text). This matches the Telegram adapter's approach where media in the assistant topic calls `session.enqueuePrompt(text, [att])` directly rather than going through a helper function.

**Key difference from Telegram:** Discord supports multiple attachments per message natively. Telegram separates media types into distinct event handlers; Discord puts everything in `message.attachments`.

### Outgoing Media (Agent → User)

**Location:** `src/adapters/discord/adapter.ts` — `sendMessage()`

Add `case 'attachment'` handler:

1. Finalize any pending draft via `draftManager.finalize()` before sending attachment (consistent with how other non-text cases like `tool_call`, `usage`, `error` already finalize drafts first in the Discord adapter)
2. Extract `content.attachment` (type `Attachment`) — guard against null/undefined: `if (!content.attachment) break;`
3. Size check: if `attachment.size > 25 * 1024 * 1024` (25MB, Discord free tier limit), send text warning instead
   - Known limitation: boosted servers support 50MB/100MB but we hardcode 25MB for safety
4. Send file via Discord.js:
   ```typescript
   await this.sendQueue.enqueue(() =>
     thread.send({ files: [{ attachment: att.filePath, name: att.fileName }] })
   )
   ```

Discord.js handles all file types uniformly via `thread.send({ files })` — no need to branch on image/audio/document like Telegram.

### FileService Integration

Add `fileService` property to `DiscordAdapter`, initialized in `start()`:
```typescript
this.fileService = this.core.fileService
```

No changes to FileService itself — it already supports all needed operations.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Download fails | Log error, skip attachment, still send text if present |
| Message is attachment-only and all downloads fail | Send "Failed to process attachment(s)" error in thread |
| OGG→WAV conversion fails | Fallback to OGG (FileService already handles this) |
| One of multiple attachments fails | Process remaining attachments (Promise.allSettled) |
| Outgoing file > 25MB | Send text warning, skip file send |
| Outgoing file send fails | Log error, continue |
| Null contentType on attachment | Default to `'file'` type, `application/octet-stream` MIME |
| Zero-byte file | Process normally, agent decides what to do |
| Attachment URL returns 404 | Treat as download failure |

### Intents

`GatewayIntentBits.MessageContent` is already enabled in the constructor — this is required to read attachment metadata. No changes needed.

### Files Changed

| File | Change |
|------|--------|
| `src/adapters/discord/adapter.ts` | Add `fileService` property, incoming media extraction in `messageCreate`, assistant thread media routing, `'attachment'` case in `sendMessage()` |

### Out of Scope

- Stickers, embeds, reactions
- Video-specific handling (treated as generic file)
- Configurable size limits (hardcoded 25MB; boosted servers not auto-detected)
- Shared media handler abstraction

## Testing

- Unit test: incoming attachment type detection (`image/*` → image, `audio/*` → audio, other → file, null → file)
- Unit test: voice message detection via `MessageFlags.IsVoiceMessage`
- Unit test: outgoing attachment size check (under/over 25MB)
- Unit test: fallback text generation when `message.content` is empty
- Unit test: attachment URL 404 handling
- Manual test: send image/document/voice to Discord bot, verify agent receives it
- Manual test: agent generates image, verify it appears in Discord thread
- Manual test: send multiple attachments in one message, verify all are processed
