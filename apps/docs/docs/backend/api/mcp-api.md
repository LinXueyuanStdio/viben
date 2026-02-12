# T5: MCP API

> Implement MCP package management API routes.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T5 |
| Dependencies | T4 (User API) |
| Effort | 5 points |
| Priority | P0 |

---

## Objectives

1. Implement MCP package CRUD
2. Implement search and filtering
3. Implement pagination
4. Add author verification

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/mcp` | List packages (paginated) | No |
| GET | `/api/mcp/search` | Search packages | No |
| GET | `/api/mcp/[id]` | Get package details | No |
| POST | `/api/mcp` | Create package | Yes (developer) |
| PUT | `/api/mcp/[id]` | Update package | Yes (owner) |
| DELETE | `/api/mcp/[id]` | Delete package | Yes (owner) |

---

## Deliverables

### 1. List & Search (`apps/web/app/api/mcp/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, mcpPackages, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, desc, like, or, and, sql } from 'drizzle-orm';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  sort: z.enum(['latest', 'popular', 'downloads']).default('latest'),
});

// GET - List packages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = listQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      category: searchParams.get('category'),
      sort: searchParams.get('sort'),
    });

    const { page, limit, category, sort } = query;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereConditions = [];
    if (category) {
      whereConditions.push(eq(mcpPackages.category, category));
    }

    // Build order by
    let orderBy;
    switch (sort) {
      case 'popular':
        orderBy = desc(mcpPackages.favoritesCount);
        break;
      case 'downloads':
        orderBy = desc(mcpPackages.downloadsCount);
        break;
      default:
        orderBy = desc(mcpPackages.createdAt);
    }

    // Query packages
    const packages = await db
      .select({
        id: mcpPackages.id,
        name: mcpPackages.name,
        slug: mcpPackages.slug,
        version: mcpPackages.version,
        description: mcpPackages.description,
        category: mcpPackages.category,
        tags: mcpPackages.tags,
        transport: mcpPackages.transport,
        favoritesCount: mcpPackages.favoritesCount,
        downloadsCount: mcpPackages.downloadsCount,
        ratingAvg: mcpPackages.ratingAvg,
        createdAt: mcpPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(mcpPackages)
      .leftJoin(users, eq(mcpPackages.authorId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcpPackages)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

    return NextResponse.json({
      packages,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  } catch (error) {
    console.error('List MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  longDescription: z.string().optional(),
  repositoryUrl: z.string().url().optional(),
  homepageUrl: z.string().url().optional(),
  license: z.string().optional(),
  transport: z.enum(['stdio', 'sse', 'http']),
  entryPoint: z.string().min(1),
  configSchema: z.record(z.unknown()).optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

// POST - Create package
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if developer role
    if (session.role !== 'developer' && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only developers can create packages' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    // Check slug uniqueness
    const existing = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.slug, data.slug),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Package slug already exists' },
        { status: 400 }
      );
    }

    const packageId = generateId();

    await db.insert(mcpPackages).values({
      id: packageId,
      ...data,
      authorId: session.userId,
    });

    return NextResponse.json({ id: packageId, slug: data.slug });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Create MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Search (`apps/web/app/api/mcp/search/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, mcpPackages, users } from '@/lib/db';
import { eq, or, ilike, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q') || '';
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);

  if (!q.trim()) {
    return NextResponse.json({ packages: [] });
  }

  const searchTerm = `%${q}%`;

  const packages = await db
    .select({
      id: mcpPackages.id,
      name: mcpPackages.name,
      slug: mcpPackages.slug,
      version: mcpPackages.version,
      description: mcpPackages.description,
      category: mcpPackages.category,
      transport: mcpPackages.transport,
      favoritesCount: mcpPackages.favoritesCount,
      downloadsCount: mcpPackages.downloadsCount,
      author: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(mcpPackages)
    .leftJoin(users, eq(mcpPackages.authorId, users.id))
    .where(
      or(
        ilike(mcpPackages.name, searchTerm),
        ilike(mcpPackages.description, searchTerm),
        ilike(mcpPackages.slug, searchTerm)
      )
    )
    .orderBy(desc(mcpPackages.downloadsCount))
    .limit(limit);

  return NextResponse.json({ packages });
}
```

### 3. Package Detail (`apps/web/app/api/mcp/[id]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, mcpPackages, users, packageReleases } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, desc } from 'drizzle-orm';

// GET - Package detail
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const pkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!pkg) {
    return NextResponse.json(
      { error: 'Package not found' },
      { status: 404 }
    );
  }

  // Get releases
  const releases = await db.query.packageReleases.findMany({
    where: and(
      eq(packageReleases.packageType, 'mcp'),
      eq(packageReleases.packageId, id),
      eq(packageReleases.status, 'published')
    ),
    orderBy: desc(packageReleases.publishedAt),
    limit: 10,
  });

  return NextResponse.json({ package: pkg, releases });
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  longDescription: z.string().optional(),
  repositoryUrl: z.string().url().optional(),
  homepageUrl: z.string().url().optional(),
  license: z.string().optional(),
  configSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

// PUT - Update package
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

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

  const body = await request.json();
  const data = updateSchema.parse(body);

  await db
    .update(mcpPackages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mcpPackages.id, id));

  return NextResponse.json({ success: true });
}

// DELETE - Delete package
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

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

  await db.delete(mcpPackages).where(eq(mcpPackages.id, id));

  return NextResponse.json({ success: true });
}
```

---

## Query Parameters

### List (`/api/mcp`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `category` | string | - | Filter by category |
| `sort` | string | `latest` | Sort: `latest`, `popular`, `downloads` |

### Search (`/api/mcp/search`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Search query |
| `limit` | number | 20 | Max results (max 100) |

---

## Response Shapes

### Package (List)

```typescript
interface PackageListItem {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  category: string | null;
  tags: string[];
  transport: 'stdio' | 'sse' | 'http';
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
```

### Package (Detail)

```typescript
interface PackageDetail extends PackageListItem {
  longDescription: string | null;
  repositoryUrl: string | null;
  homepageUrl: string | null;
  license: string | null;
  entryPoint: string;
  configSchema: Record<string, unknown> | null;
  dependencies: string[];
  updatedAt: string;
}
```

---

## Acceptance Criteria

- [ ] List packages with pagination
- [ ] Filter by category
- [ ] Sort by latest/popular/downloads
- [ ] Search by name/description
- [ ] Get package detail with releases
- [ ] Create package (developer only)
- [ ] Update package (owner only)
- [ ] Delete package (owner only)
- [ ] Proper error responses

---

## Notes

- Slug must be URL-safe and unique
- Version must be semver format
- Only developers can create packages
- Only owners can update/delete
