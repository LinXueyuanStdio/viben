# File/Image/Audio Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional multimedia support (images, audio, files) between messaging adapters and AI agents via ACP protocol.

**Architecture:** Core `FileService` handles file storage/lookup. `AgentInstance.prompt()` extended with optional attachments, checked against ACP `PromptCapabilities`. `SessionBridge` converts ACP media events to `Attachment`-based `OutgoingMessage`. Telegram adapter handles incoming media download and outgoing media send.

**Tech Stack:** Node.js, TypeScript, ACP SDK v0.16.1, grammY (Telegram), vitest

---

### Task 1: Core Types — Attachment + Extended Messages

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Add Attachment interface and extend types**

```typescript
// Add before IncomingMessage:
export interface Attachment {
  type: 'image' | 'audio' | 'file'
  filePath: string
  fileName: string
  mimeType: string
  size: number
}

// Add attachments to IncomingMessage:
export interface IncomingMessage {
  channelId: string
  threadId: string
  userId: string
  text: string
  attachments?: Attachment[]
}

// Add "attachment" to OutgoingMessage type union:
export interface OutgoingMessage {
  type:
    | "text"
    | "thought"
    | "tool_call"
    | "tool_update"
    | "plan"
    | "usage"
    | "session_end"
    | "error"
    | "attachment";
  text: string;
  metadata?: Record<string, unknown>;
  attachment?: Attachment;
}

// Add to AgentEvent union:
  | { type: 'image_content'; data: string; mimeType: string }
  | { type: 'audio_content'; data: string; mimeType: string }
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: No errors (all new fields are optional, existing code unaffected)

---

### Task 2: FileService

**Files:**
- Create: `src/core/file-service.ts`
- Modify: `src/core/index.ts` (add export)
- Create: `src/core/__tests__/file-service.test.ts`

- [ ] **Step 1: Write tests for FileService**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FileService } from '../file-service.js'

describe('FileService', () => {
  let service: FileService
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-test-'))
    service = new FileService(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('saveFile', () => {
    it('saves file and returns Attachment with correct metadata', async () => {
      const data = Buffer.from('hello world')
      const att = await service.saveFile('session1', 'test.txt', data, 'text/plain')

      expect(att.type).toBe('file')
      expect(att.fileName).toBe('test.txt')
      expect(att.mimeType).toBe('text/plain')
      expect(att.size).toBe(11)
      expect(fs.existsSync(att.filePath)).toBe(true)
      expect(fs.readFileSync(att.filePath).toString()).toBe('hello world')
    })

    it('saves image with correct type', async () => {
      const data = Buffer.from('fake png')
      const att = await service.saveFile('session1', 'photo.png', data, 'image/png')
      expect(att.type).toBe('image')
    })

    it('saves audio with correct type', async () => {
      const data = Buffer.from('fake ogg')
      const att = await service.saveFile('session1', 'voice.ogg', data, 'audio/ogg')
      expect(att.type).toBe('audio')
    })

    it('creates session subdirectory', async () => {
      const data = Buffer.from('test')
      const att = await service.saveFile('session-abc', 'f.txt', data, 'text/plain')
      expect(att.filePath).toContain('session-abc')
    })
  })

  describe('resolveFile', () => {
    it('returns Attachment for existing file', async () => {
      const filePath = path.join(tmpDir, 'test.jpg')
      fs.writeFileSync(filePath, 'fake jpeg')

      const att = await service.resolveFile(filePath)
      expect(att).not.toBeNull()
      expect(att!.type).toBe('image')
      expect(att!.mimeType).toBe('image/jpeg')
      expect(att!.size).toBe(9)
    })

    it('returns null for non-existent file', async () => {
      const att = await service.resolveFile('/nonexistent/file.txt')
      expect(att).toBeNull()
    })
  })

  describe('extensionFromMime', () => {
    it('maps common image types', () => {
      expect(FileService.extensionFromMime('image/jpeg')).toBe('.jpg')
      expect(FileService.extensionFromMime('image/png')).toBe('.png')
      expect(FileService.extensionFromMime('image/webp')).toBe('.webp')
    })

    it('maps common audio types', () => {
      expect(FileService.extensionFromMime('audio/ogg')).toBe('.ogg')
      expect(FileService.extensionFromMime('audio/mpeg')).toBe('.mp3')
    })

    it('returns .bin for unknown types', () => {
      expect(FileService.extensionFromMime('application/octet-stream')).toBe('.bin')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/core/__tests__/file-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FileService**

```typescript
// src/core/file-service.ts
import fs from 'node:fs'
import path from 'node:path'
import type { Attachment } from './types.js'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.webm': 'audio/webm', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf', '.txt': 'text/plain',
}

function classifyMime(mimeType: string): Attachment['type'] {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export class FileService {
  constructor(private baseDir: string) {}

  async saveFile(
    sessionId: string,
    fileName: string,
    data: Buffer,
    mimeType: string,
  ): Promise<Attachment> {
    const sessionDir = path.join(this.baseDir, sessionId)
    await fs.promises.mkdir(sessionDir, { recursive: true })

    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(sessionDir, safeName)
    await fs.promises.writeFile(filePath, data)

    return {
      type: classifyMime(mimeType),
      filePath,
      fileName,
      mimeType,
      size: data.length,
    }
  }

  async resolveFile(filePath: string): Promise<Attachment | null> {
    try {
      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) return null

      const ext = path.extname(filePath).toLowerCase()
      const mimeType = EXT_TO_MIME[ext] || 'application/octet-stream'

      return {
        type: classifyMime(mimeType),
        filePath,
        fileName: path.basename(filePath),
        mimeType,
        size: stat.size,
      }
    } catch {
      return null
    }
  }

  static extensionFromMime(mimeType: string): string {
    return MIME_TO_EXT[mimeType] || '.bin'
  }
}
```

- [ ] **Step 4: Export FileService from core/index.ts**

Add to `src/core/index.ts`:
```typescript
export { FileService } from './file-service.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/core/__tests__/file-service.test.ts`
Expected: All PASS

- [ ] **Step 6: Run full build**

Run: `pnpm build`
Expected: PASS

---

### Task 3: PromptQueue — Accept Attachments

**Files:**
- Modify: `src/core/prompt-queue.ts`
- Modify: `src/core/__tests__/prompt-queue.test.ts`

- [ ] **Step 1: Add test for attachments passing through queue**

Add to existing test file `src/core/__tests__/prompt-queue.test.ts`:

```typescript
it('passes attachments to processor', async () => {
  const processor = vi.fn().mockResolvedValue(undefined)
  const queue = new PromptQueue(processor)
  const attachments = [{ type: 'image' as const, filePath: '/tmp/x.png', fileName: 'x.png', mimeType: 'image/png', size: 100 }]

  await queue.enqueue('hello', attachments)

  expect(processor).toHaveBeenCalledWith('hello', attachments)
})

it('passes undefined attachments when not provided', async () => {
  const processor = vi.fn().mockResolvedValue(undefined)
  const queue = new PromptQueue(processor)

  await queue.enqueue('hello')

  expect(processor).toHaveBeenCalledWith('hello', undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/__tests__/prompt-queue.test.ts`
Expected: FAIL — enqueue only accepts 1 arg

- [ ] **Step 3: Update PromptQueue to support attachments**

Modify `src/core/prompt-queue.ts`:
- Queue item type: `{ text: string; attachments?: Attachment[]; resolve: () => void }`
- Processor type: `(text: string, attachments?: Attachment[]) => Promise<void>`
- `enqueue(text: string, attachments?: Attachment[])` — pass attachments through
- `process(text, attachments)` — forward to processor
- `drainNext()` — pass `next.attachments`

Import `Attachment` type from `./types.js`.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/core/__tests__/prompt-queue.test.ts`
Expected: All PASS

---

### Task 4: Session — Forward Attachments

**Files:**
- Modify: `src/core/session.ts`

- [ ] **Step 1: Update Session to pass attachments**

In `src/core/session.ts`:

1. Import `Attachment` from `./types.js`
2. Update `PromptQueue` constructor: processor callback takes `(text, attachments?)`
3. Update `enqueuePrompt(text: string, attachments?: Attachment[])`
4. Update `processPrompt(text: string, attachments?: Attachment[])`
5. Pass `attachments` to `this.agentInstance.prompt(text, attachments)`

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS (AgentInstance.prompt doesn't accept attachments yet, but that's Task 5)

Note: Build may show type error until Task 5 is done. That's OK — we'll fix it in Task 5.

---

### Task 5: AgentInstance — Bidirectional Media

**Files:**
- Modify: `src/core/agent-instance.ts`

- [ ] **Step 1: Store promptCapabilities from initialize response**

In `spawnSubprocess()`, capture the return value:
```typescript
private promptCapabilities?: { image?: boolean; audio?: boolean }

// In spawnSubprocess:
const initResponse = await instance.connection.initialize({
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: true,
  },
});
instance.promptCapabilities = initResponse.agentCapabilities?.promptCapabilities;
```

- [ ] **Step 2: Extend prompt() to accept attachments**

```typescript
async prompt(text: string, attachments?: Attachment[]): Promise<PromptResponse> {
  const contentBlocks: Array<{ type: string; [key: string]: unknown }> = [{ type: "text", text }]

  for (const att of attachments ?? []) {
    const tooLarge = att.size > 10 * 1024 * 1024 // 10MB base64 guard

    if (att.type === 'image' && this.promptCapabilities?.image && !tooLarge) {
      const data = await fs.promises.readFile(att.filePath)
      contentBlocks.push({ type: "image", data: data.toString('base64'), mimeType: att.mimeType })
    } else if (att.type === 'audio' && this.promptCapabilities?.audio && !tooLarge) {
      const data = await fs.promises.readFile(att.filePath)
      contentBlocks.push({ type: "audio", data: data.toString('base64'), mimeType: att.mimeType })
    } else {
      // Fallback: append file path to text
      (contentBlocks[0] as { text: string }).text += `\n\n[Attached file: ${att.filePath}]`
    }
  }

  return this.connection.prompt({
    sessionId: this.sessionId,
    prompt: contentBlocks as any,
  })
}
```

Import `Attachment` from `./types.js`.

- [ ] **Step 3: Handle image/audio in agent_message_chunk**

In the `sessionUpdate` handler, extend the `agent_message_chunk` case:

```typescript
case "agent_message_chunk":
  if (update.content.type === "text") {
    event = { type: "text", content: update.content.text };
  } else if (update.content.type === "image") {
    event = {
      type: "image_content",
      data: (update.content as any).data,
      mimeType: (update.content as any).mimeType,
    };
  } else if (update.content.type === "audio") {
    event = {
      type: "audio_content",
      data: (update.content as any).data,
      mimeType: (update.content as any).mimeType,
    };
  }
  break;
```

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: PASS

---

### Task 6: SessionBridge — Media Event Conversion

**Files:**
- Modify: `src/core/session-bridge.ts`

- [ ] **Step 1: Add FileService to BridgeDeps**

```typescript
import type { FileService } from './file-service.js'

export interface BridgeDeps {
  messageTransformer: MessageTransformer;
  notificationManager: NotificationManager;
  sessionManager: SessionManager;
  fileService?: FileService;  // optional for backward compat
}
```

- [ ] **Step 2: Handle image_content and audio_content events in wireSessionToAdapter**

Add cases in the `agentEventHandler` switch:

```typescript
case "image_content": {
  if (!this.deps.fileService) break;
  const buffer = Buffer.from(event.data, 'base64');
  const ext = FileService.extensionFromMime(event.mimeType);
  const att = await this.deps.fileService.saveFile(
    this.session.id, `agent-image${ext}`, buffer, event.mimeType,
  );
  this.adapter.sendMessage(this.session.id, {
    type: "attachment", text: "", attachment: att,
  });
  break;
}
case "audio_content": {
  if (!this.deps.fileService) break;
  const buffer = Buffer.from(event.data, 'base64');
  const ext = FileService.extensionFromMime(event.mimeType);
  const att = await this.deps.fileService.saveFile(
    this.session.id, `agent-audio${ext}`, buffer, event.mimeType,
  );
  this.adapter.sendMessage(this.session.id, {
    type: "attachment", text: "", attachment: att,
  });
  break;
}
```

Import `FileService` from `./file-service.js`.

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: PASS

---

### Task 7: VibenCore — Wire FileService + Forward Attachments

**Files:**
- Modify: `src/core/core.ts`

- [ ] **Step 1: Instantiate FileService in constructor**

```typescript
import os from 'node:os'
import path from 'node:path'
import { FileService } from './file-service.js'

// In constructor:
this.fileService = new FileService(path.join(os.homedir(), '.viben', 'files'))

// Add field:
fileService: FileService
```

- [ ] **Step 2: Pass FileService to SessionBridge**

In `createBridge()`:
```typescript
createBridge(session: Session, adapter: ChannelAdapter): SessionBridge {
  return new SessionBridge(session, adapter, {
    messageTransformer: this.messageTransformer,
    notificationManager: this.notificationManager,
    sessionManager: this.sessionManager,
    fileService: this.fileService,
  });
}
```

- [ ] **Step 3: Forward attachments in handleMessage**

In `handleMessage()`, change:
```typescript
await session.enqueuePrompt(message.text);
```
to:
```typescript
await session.enqueuePrompt(message.text, message.attachments);
```

- [ ] **Step 4: Run build + tests**

Run: `pnpm build && pnpm test`
Expected: PASS

---

### Task 8: MessageTransformer — Handle Attachment Events

**Files:**
- Modify: `src/core/message-transformer.ts`
- Modify: `src/core/__tests__/message-transformer.test.ts`

- [ ] **Step 1: Add test for attachment event transform**

Add to existing `message-transformer.test.ts`:
```typescript
it('transforms image_content event to empty text (no fileService)', () => {
  const transformer = new MessageTransformer()
  const event = { type: 'image_content' as const, data: 'base64data', mimeType: 'image/png' }
  const result = transformer.transform(event)
  expect(result.type).toBe('text')
  expect(result.text).toBe('')
})
```

- [ ] **Step 2: Update transform to handle new event types**

The `image_content` and `audio_content` events are handled by SessionBridge directly (converting to attachment OutgoingMessage), so MessageTransformer's default case already returns `{ type: "text", text: "" }` for unknown events. No change needed here — the existing `default` branch handles it.

Verify: the existing `default` case in `transform()` returns `{ type: "text", text: "" }`.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- src/core/__tests__/message-transformer.test.ts`
Expected: PASS

---

### Task 9: Telegram Adapter — Incoming Media

**Files:**
- Modify: `src/adapters/telegram/adapter.ts`

- [ ] **Step 1: Add FileService dependency**

In `TelegramAdapter`:
```typescript
private fileService!: FileService
```

In `start()`, before routes setup:
```typescript
this.fileService = this.core.fileService
```

- [ ] **Step 2: Add media message handlers in setupRoutes**

Add handlers after the existing `message:text` handler:

```typescript
// Photo handler
this.bot.on("message:photo", async (ctx) => {
  const threadId = ctx.message.message_thread_id
  if (!threadId || threadId === this.notificationTopicId) return

  const photos = ctx.message.photo
  const largest = photos[photos.length - 1]
  const file = await ctx.api.getFile(largest.file_id)
  if (!file.file_path) return

  const url = `https://api.telegram.org/file/bot${this.telegramConfig.botToken}/${file.file_path}`
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const ext = path.extname(file.file_path) || '.jpg'
  const att = await this.fileService.saveFile(
    this.resolveSessionId(threadId) || 'unknown',
    `photo${ext}`, buffer, 'image/jpeg',
  )

  const caption = ctx.message.caption || ''
  const text = caption || `[Photo: ${att.fileName}]`

  if (threadId === this.assistantTopicId) {
    if (this.assistantSession) {
      await this.assistantSession.enqueuePrompt(text, [att])
    }
    return
  }

  ctx.replyWithChatAction("typing").catch(() => {})
  this.core.handleMessage({
    channelId: "telegram",
    threadId: String(threadId),
    userId: String(ctx.from.id),
    text,
    attachments: [att],
  }).catch((err) => log.error({ err }, "handleMessage error"))
})

// Document handler
this.bot.on("message:document", async (ctx) => {
  const threadId = ctx.message.message_thread_id
  if (!threadId || threadId === this.notificationTopicId) return

  const doc = ctx.message.document
  const file = await ctx.api.getFile(doc.file_id)
  if (!file.file_path) return

  const url = `https://api.telegram.org/file/bot${this.telegramConfig.botToken}/${file.file_path}`
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const att = await this.fileService.saveFile(
    this.resolveSessionId(threadId) || 'unknown',
    doc.file_name || 'document', buffer, doc.mime_type || 'application/octet-stream',
  )

  const caption = ctx.message.caption || ''
  const text = caption || `[File: ${att.fileName}]`

  if (threadId === this.assistantTopicId) {
    if (this.assistantSession) {
      await this.assistantSession.enqueuePrompt(text, [att])
    }
    return
  }

  ctx.replyWithChatAction("typing").catch(() => {})
  this.core.handleMessage({
    channelId: "telegram",
    threadId: String(threadId),
    userId: String(ctx.from.id),
    text,
    attachments: [att],
  }).catch((err) => log.error({ err }, "handleMessage error"))
})

// Voice handler
this.bot.on("message:voice", async (ctx) => {
  const threadId = ctx.message.message_thread_id
  if (!threadId || threadId === this.notificationTopicId) return

  const voice = ctx.message.voice
  const file = await ctx.api.getFile(voice.file_id)
  if (!file.file_path) return

  const url = `https://api.telegram.org/file/bot${this.telegramConfig.botToken}/${file.file_path}`
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const att = await this.fileService.saveFile(
    this.resolveSessionId(threadId) || 'unknown',
    'voice.ogg', buffer, voice.mime_type || 'audio/ogg',
  )

  const text = '[Voice message]'

  if (threadId === this.assistantTopicId) {
    if (this.assistantSession) {
      await this.assistantSession.enqueuePrompt(text, [att])
    }
    return
  }

  ctx.replyWithChatAction("typing").catch(() => {})
  this.core.handleMessage({
    channelId: "telegram",
    threadId: String(threadId),
    userId: String(ctx.from.id),
    text,
    attachments: [att],
  }).catch((err) => log.error({ err }, "handleMessage error"))
})

// Audio handler
this.bot.on("message:audio", async (ctx) => {
  const threadId = ctx.message.message_thread_id
  if (!threadId || threadId === this.notificationTopicId) return

  const audio = ctx.message.audio
  const file = await ctx.api.getFile(audio.file_id)
  if (!file.file_path) return

  const url = `https://api.telegram.org/file/bot${this.telegramConfig.botToken}/${file.file_path}`
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const att = await this.fileService.saveFile(
    this.resolveSessionId(threadId) || 'unknown',
    audio.file_name || 'audio.mp3', buffer, audio.mime_type || 'audio/mpeg',
  )

  const caption = ctx.message.caption || ''
  const text = caption || `[Audio: ${att.fileName}]`

  if (threadId === this.assistantTopicId) {
    if (this.assistantSession) {
      await this.assistantSession.enqueuePrompt(text, [att])
    }
    return
  }

  ctx.replyWithChatAction("typing").catch(() => {})
  this.core.handleMessage({
    channelId: "telegram",
    threadId: String(threadId),
    userId: String(ctx.from.id),
    text,
    attachments: [att],
  }).catch((err) => log.error({ err }, "handleMessage error"))
})
```

- [ ] **Step 3: Add helper method resolveSessionId**

```typescript
private resolveSessionId(threadId: number): string | undefined {
  return this.core.sessionManager.getSessionByThread("telegram", String(threadId))?.id
}
```

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: PASS

---

### Task 10: Telegram Adapter — Outgoing Media

**Files:**
- Modify: `src/adapters/telegram/adapter.ts`

- [ ] **Step 1: Add attachment case in sendMessage switch**

Add before the `session_end` case in `sendMessage()`:

```typescript
case "attachment": {
  if (!content.attachment) break
  const { attachment } = content
  const inputFile = new InputFile(attachment.filePath)

  try {
    if (attachment.type === 'image') {
      await this.sendQueue.enqueue(() =>
        this.bot.api.sendPhoto(this.telegramConfig.chatId, inputFile, {
          message_thread_id: threadId,
        }),
      )
    } else if (attachment.type === 'audio') {
      await this.sendQueue.enqueue(() =>
        this.bot.api.sendVoice(this.telegramConfig.chatId, inputFile, {
          message_thread_id: threadId,
        }),
      )
    } else {
      await this.sendQueue.enqueue(() =>
        this.bot.api.sendDocument(this.telegramConfig.chatId, inputFile, {
          message_thread_id: threadId,
        }),
      )
    }
  } catch (err) {
    log.error({ err, sessionId, attachment: attachment.fileName }, "Failed to send attachment")
  }
  break
}
```

- [ ] **Step 2: Add InputFile import**

Add to imports at top of file:
```typescript
import { InputFile } from "grammy";
```

- [ ] **Step 3: Import path module**

Add if not present:
```typescript
import path from "node:path";
```

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: PASS

---

### Task 11: Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All existing tests PASS, new tests PASS

- [ ] **Step 2: Run full build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Verify no type regressions**

Run: `pnpm build 2>&1 | grep -i error`
Expected: No output
