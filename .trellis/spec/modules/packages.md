# T13: Package Upload/Download

> Implement package upload and download API routes.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T13 |
| Dependencies | T11 (Social API), T12 (Storage) |
| Effort | 5 points |
| Priority | P0 (Critical Path) |

---

## Objectives

1. Implement package upload with validation
2. Implement release management
3. Implement package download with tracking
4. Add download statistics

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/packages/upload` | Upload package | Yes (developer) |
| GET | `/api/mcp/[id]/releases` | List releases | No |
| GET | `/api/mcp/[id]/releases/[version]` | Get release | No |
| POST | `/api/mcp/[id]/releases/[version]/publish` | Publish release | Yes (owner) |
| DELETE | `/api/mcp/[id]/releases/[version]` | Delete draft | Yes (owner) |
| GET | `/api/packages/[type]/[id]/download` | Download latest | No |
| GET | `/api/packages/[type]/[id]/download/[version]` | Download version | No |

---

## Deliverables

### 1. Package Upload (`apps/web/app/api/packages/upload/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, mcpPackages, skillPackages, packageReleases } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { storage } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';
import JSZip from 'jszip';

const manifestSchema = z.object({
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  type: z.enum(['mcp', 'skill']),
  description: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
  }),
  license: z.string().optional(),

  // MCP specific
  mcp: z.object({
    transport: z.enum(['stdio', 'sse', 'http']),
    entryPoint: z.string(),
    configSchema: z.string().optional(),
  }).optional(),

  // Skill specific
  skill: z.object({
    type: z.enum(['command', 'prompt', 'agent']),
    triggerPatterns: z.array(z.string()).optional(),
  }).optional(),

  dependencies: z.object({
    python: z.string().optional(),
    packages: z.array(z.string()).optional(),
  }).optional(),

  keywords: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'developer' && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only developers can upload packages' },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read and parse zip
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    // Find and parse manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return NextResponse.json(
        { error: 'manifest.json not found in package' },
        { status: 400 }
      );
    }

    const manifestContent = await manifestFile.async('string');
    const manifest = manifestSchema.parse(JSON.parse(manifestContent));

    // Verify package exists and user owns it
    const packagesTable = manifest.type === 'mcp' ? mcpPackages : skillPackages;
    const pkg = await db.query[manifest.type === 'mcp' ? 'mcpPackages' : 'skillPackages'].findFirst({
      where: eq(packagesTable.slug, manifest.name),
    });

    if (!pkg) {
      return NextResponse.json(
        { error: 'Package not found. Create it first.' },
        { status: 404 }
      );
    }

    if (pkg.authorId !== session.userId && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not own this package' },
        { status: 403 }
      );
    }

    // Check if version already exists
    const existingRelease = await db.query.packageReleases.findFirst({
      where: and(
        eq(packageReleases.packageType, manifest.type),
        eq(packageReleases.packageId, pkg.id),
        eq(packageReleases.version, manifest.version)
      ),
    });

    if (existingRelease && existingRelease.status !== 'draft') {
      return NextResponse.json(
        { error: 'Version already published' },
        { status: 400 }
      );
    }

    // Upload to storage
    const storageResult = await storage.upload(
      pkg.id,
      manifest.version,
      buffer,
      'package.zip'
    );

    // Create or update release
    const releaseId = existingRelease?.id || generateId();

    if (existingRelease) {
      await db
        .update(packageReleases)
        .set({
          storageRef: storageResult.storageRef,
          fileSize: storageResult.size,
          checksum: storageResult.checksum,
        })
        .where(eq(packageReleases.id, releaseId));
    } else {
      await db.insert(packageReleases).values({
        id: releaseId,
        packageType: manifest.type,
        packageId: pkg.id,
        version: manifest.version,
        status: 'draft',
        storageRef: storageResult.storageRef,
        fileSize: storageResult.size,
        checksum: storageResult.checksum,
        publishedBy: session.userId,
      });
    }

    return NextResponse.json({
      releaseId,
      version: manifest.version,
      status: 'draft',
      message: 'Package uploaded as draft. Publish when ready.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid manifest', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Publish Release (`apps/web/app/api/mcp/[id]/releases/[version]/publish/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, mcpPackages, packageReleases } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; version: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, version } = params;

  // Verify ownership
  const pkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
  });

  if (!pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  if (pkg.authorId !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Find release
  const release = await db.query.packageReleases.findFirst({
    where: and(
      eq(packageReleases.packageType, 'mcp'),
      eq(packageReleases.packageId, id),
      eq(packageReleases.version, version)
    ),
  });

  if (!release) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 });
  }

  if (release.status === 'published') {
    return NextResponse.json(
      { error: 'Release already published' },
      { status: 400 }
    );
  }

  // Publish
  await db
    .update(packageReleases)
    .set({
      status: 'published',
      publishedAt: new Date(),
    })
    .where(eq(packageReleases.id, release.id));

  // Update package version
  await db
    .update(mcpPackages)
    .set({
      version,
      updatedAt: new Date(),
    })
    .where(eq(mcpPackages.id, id));

  return NextResponse.json({ success: true, status: 'published' });
}
```

### 3. Package Download (`apps/web/app/api/packages/[type]/[id]/download/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, mcpPackages, skillPackages, packageReleases, downloadRecords } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { storage } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: { type: 'mcp' | 'skill'; id: string } }
) {
  const { type, id } = params;

  // Find latest published release
  const release = await db.query.packageReleases.findFirst({
    where: and(
      eq(packageReleases.packageType, type),
      eq(packageReleases.packageId, id),
      eq(packageReleases.status, 'published')
    ),
    orderBy: desc(packageReleases.publishedAt),
  });

  if (!release || !release.storageRef) {
    return NextResponse.json(
      { error: 'No published release found' },
      { status: 404 }
    );
  }

  // Record download
  const session = await getSession();
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  await db.insert(downloadRecords).values({
    id: generateId(),
    packageType: type,
    packageId: id,
    releaseId: release.id,
    userId: session?.userId || null,
    ipHash,
    userAgent: request.headers.get('user-agent') || null,
  });

  // Update download counts
  await db
    .update(packageReleases)
    .set({ downloadsCount: release.downloadsCount + 1 })
    .where(eq(packageReleases.id, release.id));

  const packagesTable = type === 'mcp' ? mcpPackages : skillPackages;
  await db
    .update(packagesTable)
    .set({ downloadsCount: (await db.query[type === 'mcp' ? 'mcpPackages' : 'skillPackages'].findFirst({ where: eq(packagesTable.id, id) }))!.downloadsCount + 1 })
    .where(eq(packagesTable.id, id));

  // Redirect to storage URL
  const downloadUrl = await storage.getDownloadUrl(release.storageRef);

  return NextResponse.redirect(downloadUrl);
}
```

### 4. Download Specific Version (`apps/web/app/api/packages/[type]/[id]/download/[version]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, packageReleases, downloadRecords } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { storage } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: { type: 'mcp' | 'skill'; id: string; version: string } }
) {
  const { type, id, version } = params;

  const release = await db.query.packageReleases.findFirst({
    where: and(
      eq(packageReleases.packageType, type),
      eq(packageReleases.packageId, id),
      eq(packageReleases.version, version),
      eq(packageReleases.status, 'published')
    ),
  });

  if (!release || !release.storageRef) {
    return NextResponse.json(
      { error: 'Release not found' },
      { status: 404 }
    );
  }

  // Record download (same as above)
  const session = await getSession();
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  await db.insert(downloadRecords).values({
    id: generateId(),
    packageType: type,
    packageId: id,
    releaseId: release.id,
    userId: session?.userId || null,
    ipHash,
    userAgent: request.headers.get('user-agent') || null,
  });

  await db
    .update(packageReleases)
    .set({ downloadsCount: release.downloadsCount + 1 })
    .where(eq(packageReleases.id, release.id));

  const downloadUrl = await storage.getDownloadUrl(release.storageRef);
  return NextResponse.redirect(downloadUrl);
}
```

---

## Package Manifest Schema

```json
{
  "$schema": "https://browse-mcp.dev/schemas/manifest.v1.json",
  "name": "my-mcp-package",
  "version": "1.0.0",
  "type": "mcp",
  "description": "A helpful MCP server",
  "author": {
    "name": "Developer",
    "email": "dev@example.com"
  },
  "license": "MIT",
  "mcp": {
    "transport": "stdio",
    "entryPoint": "python -m my_mcp"
  },
  "dependencies": {
    "python": ">=3.10",
    "packages": ["httpx>=0.24"]
  },
  "keywords": ["search", "api"]
}
```

---

## Upload Flow

```
Developer                API                    Storage
    |                     |                        |
    |  POST /packages/upload                       |
    |  (multipart: file.zip)                       |
    |-------------------->|                        |
    |                     |                        |
    |                     | Parse manifest.json    |
    |                     | Validate ownership     |
    |                     |                        |
    |                     | Upload to storage      |
    |                     |----------------------->|
    |                     |                        |
    |                     | storageRef, checksum   |
    |                     |<-----------------------|
    |                     |                        |
    |                     | Create release (draft) |
    |                     |                        |
    |  { releaseId, status: "draft" }              |
    |<--------------------|                        |
    |                     |                        |
    |  POST /mcp/:id/releases/:version/publish     |
    |-------------------->|                        |
    |                     |                        |
    |  { status: "published" }                     |
    |<--------------------|                        |
```

---

## Acceptance Criteria

- [ ] Package upload parses and validates manifest
- [ ] Package files stored in HuggingFace
- [ ] Releases can be draft or published
- [ ] Download redirects to storage URL
- [ ] Download counts are tracked
- [ ] IP hashes stored for analytics (not raw IPs)
- [ ] Version-specific downloads work
- [ ] Only package owners can publish

---

## Notes

- Maximum package size: 100MB
- Manifest must be at root of zip
- Draft releases can be overwritten
- Published releases are immutable
