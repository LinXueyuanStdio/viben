# Design: File Attachment Support for Prompt Endpoint

**Date:** 2026-04-04
**Based on:** PR #199 (feat/file-upload-api) with security and correctness fixes

## Overview

Extend `POST /sessions/:id/prompt` (REST and SSE routes) to accept an optional `attachments` array alongside the prompt text. Attachments are base64-encoded by the client, decoded on the server, saved via `FileService`, and passed to `session.enqueuePrompt()`.

## Schema (`src/plugins/api-server/schemas/sessions.ts`)

Add `AttachmentInputSchema`:

```typescript
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
  'video/mp4', 'video/webm',
  'application/pdf',
  'text/plain',
]);

const AttachmentInputSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(500)
    .refine(
      (v) => !v.includes('..') && !v.startsWith('/') && !v.startsWith('~'),
      { message: 'fileName must not contain path traversal sequences' },
    ),
  mimeType: z
    .string()
    .refine((v) => ALLOWED_MIME_TYPES.has(v), {
      message: 'mimeType is not supported',
    }),
  data: z.string().max(15_000_000), // ~10 MB base64 ≈ 13.3 MB string
});
```

Extend `PromptBodySchema`:

```typescript
export const PromptBodySchema = z.object({
  prompt: z.string().min(1).max(100_000),
  sourceAdapterId: z.string().optional(),
  responseAdapterId: z.string().nullable().optional(),
  attachments: z.array(AttachmentInputSchema).max(10).optional(),
});
```

## Shared Helper (`src/plugins/api-server/routes/attachments.ts`)

Extract decode+save logic into a shared utility to avoid duplication between REST and SSE routes:

```typescript
export async function decodeAttachments(
  fileService: FileServiceInterface,
  sessionId: string,
  rawAttachments: AttachmentInput[],
): Promise<Attachment[]>
```

Behavior:
- Decode each `data` field from base64 → `Buffer`
- Call `fileService.saveFile(sessionId, fileName, buffer, mimeType)` for each
- On any failure: clean up already-saved files, rethrow
- Uses `Promise.all()` — all files processed concurrently

## Route Handlers

### REST (`src/plugins/api-server/routes/sessions.ts`)

```typescript
const body = PromptBodySchema.parse(request.body);
const attachments = body.attachments?.length
  ? await decodeAttachments(deps.core.fileService, sessionId, body.attachments)
  : undefined;

await session.enqueuePrompt(body.prompt, attachments, {
  sourceAdapterId: body.sourceAdapterId ?? 'api',
  responseAdapterId: body.responseAdapterId,
});
```

### SSE (`src/plugins/sse-adapter/routes.ts`)

```typescript
const body = PromptBodySchema.parse(request.body);
const attachments = body.attachments?.length
  ? await decodeAttachments(deps.core.fileService, sessionId, body.attachments)
  : undefined;

await session.enqueuePrompt(body.prompt, attachments, { sourceAdapterId: 'sse' });
```

## Fastify Body Limit (`src/plugins/api-server/server.ts`)

Add `bodyLimit` to `Fastify()` init to support up to 10 × ~15MB attachments:

```typescript
const app = Fastify({
  logger: options.logger ?? false,
  forceCloseConnections: true,
  bodyLimit: 160 * 1024 * 1024, // 160 MB — supports up to 10 × ~15 MB base64 attachments
});
```

## `.gitignore`

Add `**/.DS_Store` to prevent accidental binary file commits.

## Tests (`src/plugins/api-server/__tests__/routes-sessions.test.ts`)

Add `fileService` mock to `createMockDeps()`. New test cases:

1. **Attachment decoded and passed to `enqueuePrompt`** — send valid attachment, assert `saveFile` called, `enqueuePrompt` called with `Attachment[]`, routing args preserved
2. **`saveFile` failure → 500, no partial state leak** — mock `saveFile` to throw, assert cleanup called and response is 500
3. **Too many attachments → 400** — send 11 attachments, assert Zod rejects with 400
4. **Path traversal in `fileName` → 400** — send `../../etc/passwd`, assert 400
5. **Unsupported mimeType → 400** — send `text/html`, assert 400

## What is NOT in scope

- Rate limit per upload endpoint (follow-up)
- Magic byte / content-type verification (follow-up)
- Video/large file streaming (follow-up)
