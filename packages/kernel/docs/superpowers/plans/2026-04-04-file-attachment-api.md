# File Attachment API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `attachments` array to `POST /sessions/:id/prompt` (REST and SSE routes) so clients can upload base64-encoded files alongside a prompt.

**Architecture:** Schema validation (Zod) rejects bad mimeTypes and path traversal before any file I/O. A shared `decodeAttachments()` helper decodes base64 and saves via `FileService`, with cleanup on partial failure. REST and SSE routes both use the helper and preserve their existing `routing` argument to `enqueuePrompt`. Fastify `bodyLimit` is raised to 160 MB to allow the maximum payload.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, `FileService` (existing plugin)

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `src/plugins/api-server/schemas/sessions.ts` | Add `AttachmentInputSchema`, extend `PromptBodySchema` |
| Create | `src/plugins/api-server/routes/attachments.ts` | Shared `decodeAttachments()` helper |
| Modify | `src/plugins/api-server/routes/sessions.ts` | Use `decodeAttachments`, fix `enqueuePrompt` call |
| Modify | `src/plugins/sse-adapter/routes.ts` | Same as above for SSE route |
| Modify | `src/plugins/api-server/server.ts` | Add `bodyLimit: 160 MB` |
| Modify | `.gitignore` | Add `**/.DS_Store` |
| Modify | `src/plugins/api-server/__tests__/routes-sessions.test.ts` | Add attachment test cases |

---

### Task 1: Schema — validation tests then implementation

**Files:**
- Modify: `src/plugins/api-server/__tests__/routes-sessions.test.ts`
- Modify: `src/plugins/api-server/schemas/sessions.ts`

- [ ] **Step 1: Add `fileService` mock to `createMockDeps`**

Open `src/plugins/api-server/__tests__/routes-sessions.test.ts`. In `createMockDeps()`, add `fileService` to the `core` mock object (at the same level as `sessionManager`):

```typescript
fileService: {
  saveFile: vi.fn().mockResolvedValue({
    type: 'image',
    filePath: '/tmp/.viben/files/sess-1/1234567890-photo.jpg',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 100,
  }),
},
```

The full `createMockDeps` core section should look like:

```typescript
core: {
  sessionManager: { ... },   // existing
  configManager: { ... },    // existing
  agentCatalog: { ... },      // existing
  adapters: new Map(),        // existing
  createSession: vi.fn()...,  // existing
  adoptSession: vi.fn()...,   // existing
  archiveSession: vi.fn()..., // existing
  agentManager: { ... },      // existing
  fileService: {
    saveFile: vi.fn().mockResolvedValue({
      type: 'image',
      filePath: '/tmp/.viben/files/sess-1/1234567890-photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 100,
    }),
  },
} as any,
```

- [ ] **Step 2: Write failing schema validation tests**

Add a new `describe` block after the existing `POST /api/v1/sessions/:sessionId/prompt` block:

```typescript
describe('POST /api/v1/sessions/:sessionId/prompt — attachment validation', () => {
  it('rejects more than 10 attachments with 400', async () => {
    const attachments = Array.from({ length: 11 }, (_, i) => ({
      fileName: `file${i}.jpg`,
      mimeType: 'image/jpeg',
      data: Buffer.from('x').toString('base64'),
    }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions/sess-1/prompt',
      payload: { prompt: 'hello', attachments },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects path traversal in fileName with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions/sess-1/prompt',
      payload: {
        prompt: 'hello',
        attachments: [{ fileName: '../../etc/passwd', mimeType: 'image/jpeg', data: 'aGk=' }],
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects unsupported mimeType with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions/sess-1/prompt',
      payload: {
        prompt: 'hello',
        attachments: [{ fileName: 'script.html', mimeType: 'text/html', data: 'aGk=' }],
      },
    });
    expect(response.statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm test -- --reporter=verbose src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -30
```

Expected: 3 new tests FAIL (schema doesn't have `AttachmentInputSchema` yet, so attachments pass through and don't get validated — or Zod just ignores the unknown field).

- [ ] **Step 4: Implement `AttachmentInputSchema` and extend `PromptBodySchema`**

Open `src/plugins/api-server/schemas/sessions.ts`. Add before `PromptBodySchema`:

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
    .refine((v) => ALLOWED_MIME_TYPES.has(v), { message: 'mimeType is not supported' }),
  data: z.string().max(15_000_000), // ~10 MB base64 ≈ 13.3 MB string
});

export type AttachmentInput = z.infer<typeof AttachmentInputSchema>;
```

Then update `PromptBodySchema` to add the `attachments` field:

```typescript
export const PromptBodySchema = z.object({
  // 100 KB limit — prevents memory exhaustion / DoS via enormous payloads
  prompt: z.string().min(1).max(100_000),
  // Multi-adapter routing fields
  sourceAdapterId: z.string().optional(),
  responseAdapterId: z.string().nullable().optional(),
  // Optional file attachments — decoded from base64 and saved via FileService
  attachments: z.array(AttachmentInputSchema).max(10).optional(),
});
```

- [ ] **Step 5: Run the schema validation tests — expect all 3 to pass**

```bash
pnpm test -- --reporter=verbose src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -30
```

Expected: 3 new tests PASS, all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/lucas/code/viben-workspace/Viben
git add src/plugins/api-server/schemas/sessions.ts src/plugins/api-server/__tests__/routes-sessions.test.ts
git commit -m "feat(api): add AttachmentInputSchema with mimeType allowlist and path traversal validation"
```

---

### Task 2: Shared `decodeAttachments` helper

**Files:**
- Create: `src/plugins/api-server/routes/attachments.ts`
- Modify: `src/plugins/api-server/__tests__/routes-sessions.test.ts`

- [ ] **Step 1: Write failing integration tests for attachment decode + enqueuePrompt**

Add to the `POST /api/v1/sessions/:sessionId/prompt` describe block in `routes-sessions.test.ts`:

```typescript
it('decodes attachment and passes it to enqueuePrompt with routing args', async () => {
  const imageData = Buffer.from('fake-image-bytes').toString('base64');
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/sessions/sess-1/prompt',
    payload: {
      prompt: 'describe this',
      attachments: [{ fileName: 'photo.jpg', mimeType: 'image/jpeg', data: imageData }],
    },
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.ok).toBe(true);

  // FileService.saveFile was called with decoded buffer
  expect(deps.core.fileService.saveFile).toHaveBeenCalledWith(
    'sess-1',
    'photo.jpg',
    Buffer.from('fake-image-bytes'),
    'image/jpeg',
  );

  // enqueuePrompt received the saved Attachment and preserved routing
  const session = (deps.core.sessionManager.getSession as any).mock.results[0].value;
  expect(session.enqueuePrompt).toHaveBeenCalledWith(
    'describe this',
    [expect.objectContaining({ fileName: 'photo.jpg', mimeType: 'image/jpeg' })],
    expect.objectContaining({ sourceAdapterId: 'api' }),
  );
});

it('returns 500 and cleans up saved files when saveFile fails mid-batch', async () => {
  // First call succeeds, second fails
  (deps.core.fileService.saveFile as any)
    .mockResolvedValueOnce({
      type: 'image',
      filePath: '/tmp/saved-first.jpg',
      fileName: 'first.jpg',
      mimeType: 'image/jpeg',
      size: 50,
    })
    .mockRejectedValueOnce(new Error('disk full'));

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/sessions/sess-1/prompt',
    payload: {
      prompt: 'two files',
      attachments: [
        { fileName: 'first.jpg', mimeType: 'image/jpeg', data: 'aGk=' },
        { fileName: 'second.jpg', mimeType: 'image/jpeg', data: 'aGk=' },
      ],
    },
  });

  expect(response.statusCode).toBe(500);
  // enqueuePrompt must NOT have been called (no partial state)
  const session = (deps.core.sessionManager.getSession as any).mock.results[0].value;
  expect(session.enqueuePrompt).not.toHaveBeenCalled();
});
```

Also add `fs` mock at the top of the test file (needed for cleanup verification):

```typescript
import { vi } from 'vitest';
// already imported — no change needed
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test -- --reporter=verbose src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -30
```

Expected: 2 new tests FAIL (route doesn't call `fileService.saveFile` yet).

- [ ] **Step 3: Create `src/plugins/api-server/routes/attachments.ts`**

```typescript
import fs from 'node:fs';
import type { Attachment } from '../../../core/types.js';
import type { FileServiceInterface } from '../../../core/plugin/types.js';
import type { AttachmentInput } from '../schemas/sessions.js';

/**
 * Decode base64 attachments and save them via FileService.
 * On partial failure, cleans up already-saved files before rethrowing.
 */
export async function decodeAttachments(
  fileService: FileServiceInterface,
  sessionId: string,
  rawAttachments: AttachmentInput[],
): Promise<Attachment[]> {
  const saved: Attachment[] = [];
  try {
    for (const att of rawAttachments) {
      const buf = Buffer.from(att.data, 'base64');
      const attachment = await fileService.saveFile(sessionId, att.fileName, buf, att.mimeType);
      saved.push(attachment);
    }
    return saved;
  } catch (err) {
    // Clean up files saved before the failure
    await Promise.allSettled(
      saved.map((att) => fs.promises.rm(att.filePath, { force: true })),
    );
    throw err;
  }
}
```

- [ ] **Step 4: Run tests — expect both new tests to pass**

```bash
pnpm test -- --reporter=verbose src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -30
```

Expected: still FAIL — routes haven't been updated yet to call `decodeAttachments`. That's fine; we'll fix in Task 3.

- [ ] **Step 5: Commit the helper file**

```bash
git add src/plugins/api-server/routes/attachments.ts
git commit -m "feat(api): add decodeAttachments helper with partial-failure cleanup"
```

---

### Task 3: Wire REST route + run all tests

**Files:**
- Modify: `src/plugins/api-server/routes/sessions.ts`

- [ ] **Step 1: Update imports in `sessions.ts`**

At the top of `src/plugins/api-server/routes/sessions.ts`, add the import:

```typescript
import { decodeAttachments } from './attachments.js';
```

The existing import block already imports `PromptBodySchema` from `../schemas/sessions.js` — no change needed there.

- [ ] **Step 2: Update the prompt route handler**

Find this block (around line 197–208):

```typescript
const body = PromptBodySchema.parse(request.body);

await session.enqueuePrompt(body.prompt, undefined, {
  sourceAdapterId: body.sourceAdapterId ?? 'api',
  responseAdapterId: body.responseAdapterId,
});
```

Replace it with:

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

- [ ] **Step 3: Run all route tests — expect all to pass**

```bash
pnpm test -- --reporter=verbose src/plugins/api-server/__tests__/routes-sessions.test.ts 2>&1 | tail -40
```

Expected: ALL tests pass including the 5 new ones from Tasks 1–2.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/api-server/routes/sessions.ts
git commit -m "feat(api): wire attachment decoding in REST prompt route"
```

---

### Task 4: Wire SSE route

**Files:**
- Modify: `src/plugins/sse-adapter/routes.ts`

- [ ] **Step 1: Add import to `sse-adapter/routes.ts`**

At the top of `src/plugins/sse-adapter/routes.ts`, add:

```typescript
import { decodeAttachments } from '../api-server/routes/attachments.js';
```

- [ ] **Step 2: Update the SSE prompt route handler**

Find this block (around line 109–110):

```typescript
const body = PromptBodySchema.parse(request.body);
await session.enqueuePrompt(body.prompt, undefined, { sourceAdapterId: 'sse' });
```

Replace it with:

```typescript
const body = PromptBodySchema.parse(request.body);

const attachments = body.attachments?.length
  ? await decodeAttachments(deps.core.fileService, sessionId, body.attachments)
  : undefined;

await session.enqueuePrompt(body.prompt, attachments, { sourceAdapterId: 'sse' });
```

- [ ] **Step 3: Build to verify TypeScript is happy**

```bash
cd /Users/lucas/code/viben-workspace/Viben
pnpm build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/sse-adapter/routes.ts
git commit -m "feat(sse): wire attachment decoding in SSE prompt route"
```

---

### Task 5: Fastify body limit + .gitignore

**Files:**
- Modify: `src/plugins/api-server/server.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add `bodyLimit` to Fastify init**

In `src/plugins/api-server/server.ts`, find:

```typescript
const app = Fastify({ logger: options.logger ?? false, forceCloseConnections: true });
```

Replace with:

```typescript
const app = Fastify({
  logger: options.logger ?? false,
  forceCloseConnections: true,
  // Support up to 10 attachments × ~15 MB base64 each
  bodyLimit: 160 * 1024 * 1024,
});
```

- [ ] **Step 2: Add `.DS_Store` to `.gitignore`**

Open `.gitignore`, add at the top under the first comment:

```
**/.DS_Store
```

Full top section should read:

```gitignore
# References (external/third-party code)
references/
**/.DS_Store
node_modules/
dist/
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Final build check**

```bash
pnpm build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/server.ts .gitignore
git commit -m "chore: raise Fastify bodyLimit to 160 MB for attachment uploads, add .DS_Store to .gitignore"
```
