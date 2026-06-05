# Discord Media Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional file, image, and audio support to the Discord adapter, matching Telegram adapter's v0.5.2 media capabilities.

**Architecture:** All changes are in the Discord adapter layer (`src/adapters/discord/adapter.ts`). Core infrastructure (FileService, Attachment type, PromptQueue, Session, AgentInstance, SessionBridge) is already media-aware. We add: (1) incoming media extraction from Discord.js `message.attachments`, (2) outgoing `'attachment'` case in `sendMessage()`, (3) FileService integration via `this.core.fileService`.

**Tech Stack:** Discord.js v14 (`message.attachments`, `MessageFlags.IsVoiceMessage`, `thread.send({ files })`), existing `FileService` from `src/core/file-service.ts`.

**Spec:** `docs/superpowers/specs/2026-03-23-discord-media-support-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/adapters/discord/adapter.ts` | Modify | Add `fileService` property, incoming media processing in `setupMessageHandler()`, `'attachment'` case in `sendMessage()` |
| `src/adapters/discord/media.ts` | Create | Pure helper functions: `downloadDiscordAttachment()`, `classifyAttachmentType()`, `buildFallbackText()` — testable without Discord.js mocks |
| `src/adapters/discord/media.test.ts` | Create | Unit tests for media helper functions (type classification, fallback text, size check, download 404) |

---

### Task 1: Create media helper functions with tests

**Files:**
- Create: `src/adapters/discord/media.ts`
- Create: `src/adapters/discord/media.test.ts`

These are pure functions that can be tested without mocking Discord.js.

- [ ] **Step 1: Write failing tests for `classifyAttachmentType()`**

Create `src/adapters/discord/media.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { classifyAttachmentType, buildFallbackText, isAttachmentTooLarge, downloadDiscordAttachment } from './media.js'

describe('classifyAttachmentType', () => {
  it('classifies image/* as image', () => {
    expect(classifyAttachmentType('image/png')).toBe('image')
    expect(classifyAttachmentType('image/jpeg')).toBe('image')
    expect(classifyAttachmentType('image/webp')).toBe('image')
  })

  it('classifies audio/* as audio', () => {
    expect(classifyAttachmentType('audio/ogg')).toBe('audio')
    expect(classifyAttachmentType('audio/mpeg')).toBe('audio')
  })

  it('classifies other types as file', () => {
    expect(classifyAttachmentType('application/pdf')).toBe('file')
    expect(classifyAttachmentType('video/mp4')).toBe('file')
    expect(classifyAttachmentType('text/plain')).toBe('file')
  })

  it('defaults to file for null/undefined contentType', () => {
    expect(classifyAttachmentType(null)).toBe('file')
    expect(classifyAttachmentType(undefined)).toBe('file')
  })
})

describe('buildFallbackText', () => {
  it('generates text from single attachment', () => {
    expect(buildFallbackText([{ type: 'image', fileName: 'photo.png' }]))
      .toBe('[Photo: photo.png]')
  })

  it('generates text from audio attachment', () => {
    expect(buildFallbackText([{ type: 'audio', fileName: 'voice.wav' }]))
      .toBe('[Audio: voice.wav]')
  })

  it('generates text from file attachment', () => {
    expect(buildFallbackText([{ type: 'file', fileName: 'doc.pdf' }]))
      .toBe('[File: doc.pdf]')
  })

  it('joins multiple attachments', () => {
    const result = buildFallbackText([
      { type: 'image', fileName: 'a.png' },
      { type: 'file', fileName: 'b.pdf' },
    ])
    expect(result).toBe('[Photo: a.png] [File: b.pdf]')
  })
})

describe('isAttachmentTooLarge', () => {
  it('returns false for files under 25MB', () => {
    expect(isAttachmentTooLarge(1024)).toBe(false)
    expect(isAttachmentTooLarge(25 * 1024 * 1024)).toBe(false)
  })

  it('returns true for files over 25MB', () => {
    expect(isAttachmentTooLarge(25 * 1024 * 1024 + 1)).toBe(true)
    expect(isAttachmentTooLarge(50 * 1024 * 1024)).toBe(true)
  })
})

describe('downloadDiscordAttachment', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch

    const result = await downloadDiscordAttachment('https://cdn.example.com/file.png', 'file.png')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

    const result = await downloadDiscordAttachment('https://cdn.example.com/file.png', 'file.png')
    expect(result).toBeNull()
  })

  it('returns buffer on success', async () => {
    const fakeData = new Uint8Array([1, 2, 3])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeData.buffer),
    }) as unknown as typeof fetch

    const result = await downloadDiscordAttachment('https://cdn.example.com/file.png', 'file.png')
    expect(result).toBeInstanceOf(Buffer)
    expect(result!.length).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/adapters/discord/media.test.ts`
Expected: FAIL — module `./media.js` not found

- [ ] **Step 3: Implement the helper functions**

Create `src/adapters/discord/media.ts`:

```typescript
import type { Attachment } from '../../core/types.js'
import { log } from '../../core/log.js'

const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024 // 100MB safety cap for downloads
const DISCORD_UPLOAD_LIMIT = 25 * 1024 * 1024 // 25MB — Discord free tier

/**
 * Check if an attachment exceeds Discord's upload limit.
 */
export function isAttachmentTooLarge(size: number): boolean {
  return size > DISCORD_UPLOAD_LIMIT
}

/**
 * Classify a MIME contentType string into an Attachment type.
 */
export function classifyAttachmentType(
  contentType: string | null | undefined,
): Attachment['type'] {
  if (!contentType) return 'file'
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('audio/')) return 'audio'
  return 'file'
}

/**
 * Build fallback text when message.content is empty but attachments exist.
 * Mirrors Telegram adapter's pattern: [Photo: filename], [Audio: filename], [File: filename]
 */
export function buildFallbackText(
  attachments: Array<{ type: Attachment['type']; fileName: string }>,
): string {
  return attachments
    .map((att) => {
      const label = att.type === 'image' ? 'Photo' : att.type === 'audio' ? 'Audio' : 'File'
      return `[${label}: ${att.fileName}]`
    })
    .join(' ')
}

/**
 * Download a file from a Discord attachment URL.
 * Returns the buffer or null on failure.
 */
export async function downloadDiscordAttachment(
  url: string,
  fileName: string,
): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      log.warn({ url, status: response.status, fileName }, '[discord-media] Download failed')
      return null
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_DOWNLOAD_SIZE) {
      log.warn({ fileName, size: buffer.length }, '[discord-media] File exceeds download size cap')
      return null
    }
    return buffer
  } catch (err) {
    log.error({ err, url, fileName }, '[discord-media] Download error')
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/adapters/discord/media.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/discord/media.ts src/adapters/discord/media.test.ts
git commit -m "feat(discord): add media helper functions with tests

classifyAttachmentType, buildFallbackText, downloadDiscordAttachment"
```

---

### Task 2: Add incoming media handling to Discord adapter

**Files:**
- Modify: `src/adapters/discord/adapter.ts` — `setupMessageHandler()` (lines 179-217)

- [ ] **Step 1: Add imports**

At the top of `src/adapters/discord/adapter.ts`, add the `MessageFlags` import and media helpers.

Change line 1 from:
```typescript
import { Client, GatewayIntentBits, type Guild, type ForumChannel, type TextChannel, type ThreadChannel } from 'discord.js'
```
to:
```typescript
import { Client, GatewayIntentBits, MessageFlags, type Guild, type ForumChannel, type TextChannel, type ThreadChannel } from 'discord.js'
```

Remove `handleAssistantMessage` from the assistant.js import (line 30) since it becomes unused — the rewritten handler calls `session.enqueuePrompt()` directly:
```typescript
import {
  spawnAssistant,
  buildWelcomeMessage,
} from './assistant.js'
```

Add after the existing imports:
```typescript
import type { Attachment } from '../../core/types.js'
import type { FileService } from '../../core/file-service.js'
import { classifyAttachmentType, buildFallbackText, downloadDiscordAttachment, isAttachmentTooLarge } from './media.js'
```

- [ ] **Step 2: Add `fileService` property**

After line 46 (`private assistantInitializing = false`), add:
```typescript
private fileService: FileService
```

In the constructor, after line 62 (`this.draftManager = new DraftManager(this.sendQueue)`), add:
```typescript
this.fileService = core.fileService
```

Note: `core.fileService` is initialized in `VibenCore`'s constructor (core.ts:49), so it's available at adapter construction time. This avoids the `!` non-null assertion that would be needed if we initialized in `start()`.

- [ ] **Step 3: Add `processIncomingAttachments()` private method**

Add this private method to the class (before the `// ─── Helper: resolve thread` section):

```typescript
// ─── Incoming media ──────────────────────────────────────────────────

private async processIncomingAttachments(
  message: import('discord.js').Message,
  sessionId: string,
): Promise<Attachment[]> {
  if (message.attachments.size === 0) return []

  const isVoiceMessage = message.flags.has(MessageFlags.IsVoiceMessage)

  const results = await Promise.allSettled(
    message.attachments.map(async (discordAtt) => {
      const buffer = await downloadDiscordAttachment(
        discordAtt.url,
        discordAtt.name ?? 'attachment',
      )
      if (!buffer) return null

      let data = buffer
      let fileName = discordAtt.name ?? 'attachment'
      let mimeType = discordAtt.contentType ?? 'application/octet-stream'

      // Convert voice messages from OGG Opus to WAV
      if (isVoiceMessage && mimeType.includes('ogg')) {
        try {
          data = await this.fileService.convertOggToWav(buffer)
          fileName = 'voice.wav'
          mimeType = 'audio/wav'
        } catch (err) {
          log.warn({ err }, '[discord-media] OGG→WAV conversion failed, saving original')
        }
      }

      return this.fileService.saveFile(sessionId, fileName, data, mimeType)
    }),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<Attachment | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((att): att is Attachment => att !== null)
}
```

- [ ] **Step 4: Update `setupMessageHandler()` to process attachments**

Replace the `setupMessageHandler()` method (lines 179-218) with:

```typescript
private setupMessageHandler(): void {
  this.client.on('messageCreate', async (message) => {
    try {
      // Ignore bots and self
      if (message.author.bot) return

      // Ignore DMs
      if (!message.guild) return

      // Ignore messages from the wrong guild
      if (message.guild.id !== this.guild.id) return

      // Only process messages in threads
      if (!message.channel.isThread()) return

      const threadId = message.channel.id
      const userId = message.author.id
      let text = message.content

      // Ignore messages with no text and no attachments
      if (!text && message.attachments.size === 0) return

      // Resolve sessionId for file storage (fallback to "unknown" for new sessions)
      const sessionId =
        this.core.sessionManager.getSessionByThread('discord', threadId)?.id ?? 'unknown'

      // Process attachments
      const attachments = await this.processIncomingAttachments(message, sessionId)

      // Generate fallback text if message has attachments but no text
      if (!text && attachments.length > 0) {
        text = buildFallbackText(attachments)
      }

      // If all attachment downloads failed and no text, notify user
      if (!text && attachments.length === 0 && message.attachments.size > 0) {
        try {
          await message.reply('Failed to process attachment(s)')
        } catch { /* best effort */ }
        return
      }

      // Route assistant thread messages to assistant
      if (
        this.discordConfig.assistantThreadId &&
        threadId === this.discordConfig.assistantThreadId
      ) {
        if (this.assistantSession && text) {
          await this.assistantSession.enqueuePrompt(text, attachments.length > 0 ? attachments : undefined)
        }
        return
      }

      // Route to core for session dispatch
      await this.core.handleMessage({
        channelId: 'discord',
        threadId,
        userId,
        text,
        ...(attachments.length > 0 ? { attachments } : {}),
      })
    } catch (err) {
      log.error({ err }, '[DiscordAdapter] messageCreate handler error')
    }
  })
}
```

- [ ] **Step 5: Build and verify no type errors**

Run: `pnpm build`
Expected: Compiles successfully with no errors

- [ ] **Step 6: Commit**

```bash
git add src/adapters/discord/adapter.ts
git commit -m "feat(discord): add incoming media support

Extract attachments from Discord messages, download files, convert
voice messages (OGG→WAV), save via FileService, route to agent.
Supports multiple attachments per message with parallel downloads."
```

---

### Task 3: Add outgoing attachment support to `sendMessage()`

**Files:**
- Modify: `src/adapters/discord/adapter.ts` — `sendMessage()` (lines 299-422)

- [ ] **Step 1: Add the `'attachment'` case**

In the `sendMessage()` method, add a new case before the closing `}` of the `switch` block (before the current line 421 `}`). Insert after the `case 'error'` block:

```typescript
case 'attachment': {
  if (!content.attachment) break
  const { attachment } = content
  await this.draftManager.finalize(sessionId, thread, isAssistant)

  // Discord free tier limit: 25MB
  if (isAttachmentTooLarge(attachment.size)) {
    log.warn({ sessionId, fileName: attachment.fileName, size: attachment.size }, '[discord-media] File too large (>25MB)')
    try {
      await this.sendQueue.enqueue(
        () => thread.send({ content: `⚠️ File too large to send (${Math.round(attachment.size / 1024 / 1024)}MB): ${attachment.fileName}` }),
        { type: 'other' },
      )
    } catch { /* best effort */ }
    break
  }

  try {
    await this.sendQueue.enqueue(
      () => thread.send({ files: [{ attachment: attachment.filePath, name: attachment.fileName }] }),
      { type: 'other' },
    )
  } catch (err) {
    log.error({ err, sessionId, fileName: attachment.fileName }, '[discord-media] Failed to send attachment')
  }
  break
}
```

- [ ] **Step 2: Build and verify no type errors**

Run: `pnpm build`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src/adapters/discord/adapter.ts
git commit -m "feat(discord): add outgoing attachment support

Handle 'attachment' case in sendMessage() — sends agent-generated
files, images, and audio to Discord threads. 25MB size limit."
```

---

### Task 4: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All existing tests pass, new media tests pass

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Clean compilation

- [ ] **Step 3: Final commit if any adjustments were needed**

If any fixes were required, commit them:
```bash
git add -A
git commit -m "fix(discord): address test/build issues from media support"
```
