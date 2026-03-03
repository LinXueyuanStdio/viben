# T15: Collections API

> Implement collections CRUD API routes.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T15 |
| Dependencies | T5 (MCP API), T6 (Skills API) |
| Effort | 3 points |
| Priority | P2 |

---

## Objectives

1. Create collection CRUD endpoints
2. Implement collection items management
3. Add public/private visibility
4. Enable collection sharing

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/collections` | List public collections | No |
| POST | `/api/collections` | Create collection | Yes |
| GET | `/api/collections/[id]` | Get collection details | Partial |
| PATCH | `/api/collections/[id]` | Update collection | Yes |
| DELETE | `/api/collections/[id]` | Delete collection | Yes |
| POST | `/api/collections/[id]/items` | Add item to collection | Yes |
| DELETE | `/api/collections/[id]/items/[itemId]` | Remove item | Yes |
| POST | `/api/collections/[id]/fork` | Fork collection | Yes |

---

## Deliverables

### 1. List Collections (`apps/web/app/api/collections/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, collections, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';

// GET - List public collections (or user's own)
export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const page = Number(searchParams.get('page') || '1');
  const limit = 12;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];

  // Public collections, or user's private ones if logged in
  if (session) {
    conditions.push(
      or(
        eq(collections.isPublic, true),
        eq(collections.ownerId, session.userId)
      )
    );
  } else {
    conditions.push(eq(collections.isPublic, true));
  }

  if (q) {
    conditions.push(
      or(
        ilike(collections.name, `%${q}%`),
        ilike(collections.description, `%${q}%`)
      )
    );
  }

  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      description: collections.description,
      isPublic: collections.isPublic,
      itemCount: collections.itemCount,
      forksCount: collections.forksCount,
      createdAt: collections.createdAt,
      owner: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .leftJoin(users, eq(collections.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(collections.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(collections)
    .where(and(...conditions));

  return NextResponse.json({
    collections: results,
    pagination: {
      page,
      limit,
      total: Number(count),
      totalPages: Math.ceil(Number(count) / limit),
    },
  });
}

const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
});

// POST - Create collection
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug, description, isPublic } = createCollectionSchema.parse(body);

  // Check slug uniqueness for this user
  const existing = await db.query.collections.findFirst({
    where: and(
      eq(collections.ownerId, session.userId),
      eq(collections.slug, slug)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Collection slug already exists' },
      { status: 409 }
    );
  }

  const collectionId = generateId();

  await db.insert(collections).values({
    id: collectionId,
    name,
    slug,
    description: description || null,
    isPublic,
    ownerId: session.userId,
    itemCount: 0,
    forksCount: 0,
  });

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  return NextResponse.json({ collection }, { status: 201 });
}
```

### 2. Collection Detail (`apps/web/app/api/collections/[id]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, collections, collectionItems, mcpPackages, skillPackages } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, or } from 'drizzle-orm';

// GET - Get collection details with items
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check access for private collections
  if (!collection.isPublic) {
    if (!session || session.userId !== collection.ownerId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // Get items
  const items = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, params.id),
    orderBy: (item, { asc }) => [asc(item.position)],
  });

  // Fetch package details
  const mcpIds = items.filter((i) => i.itemType === 'mcp').map((i) => i.itemId);
  const skillIds = items.filter((i) => i.itemType === 'skill').map((i) => i.itemId);

  const [mcps, skills] = await Promise.all([
    mcpIds.length > 0
      ? db.query.mcpPackages.findMany({
          where: (pkg, { inArray }) => inArray(pkg.id, mcpIds),
          columns: {
            id: true,
            name: true,
            slug: true,
            version: true,
            description: true,
            favoritesCount: true,
            downloadsCount: true,
          },
        })
      : [],
    skillIds.length > 0
      ? db.query.skillPackages.findMany({
          where: (pkg, { inArray }) => inArray(pkg.id, skillIds),
          columns: {
            id: true,
            name: true,
            slug: true,
            version: true,
            description: true,
            favoritesCount: true,
            downloadsCount: true,
          },
        })
      : [],
  ]);

  // Merge items with package details
  const packageMap = new Map();
  mcps.forEach((p) => packageMap.set(`mcp:${p.id}`, p));
  skills.forEach((p) => packageMap.set(`skill:${p.id}`, p));

  const enrichedItems = items.map((item) => ({
    ...item,
    package: packageMap.get(`${item.itemType}:${item.itemId}`),
  }));

  return NextResponse.json({
    collection,
    items: enrichedItems,
    isOwner: session?.userId === collection.ownerId,
  });
}

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

// PATCH - Update collection
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
  });

  if (!collection || collection.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const updates = updateCollectionSchema.parse(body);

  await db
    .update(collections)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, params.id));

  const updated = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
  });

  return NextResponse.json({ collection: updated });
}

// DELETE - Delete collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
  });

  if (!collection || collection.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(collections).where(eq(collections.id, params.id));

  return NextResponse.json({ success: true });
}
```

### 3. Collection Items (`apps/web/app/api/collections/[id]/items/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  db,
  collections,
  collectionItems,
  mcpPackages,
  skillPackages,
} from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, and, max } from 'drizzle-orm';

const addItemSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(['mcp', 'skill']),
  note: z.string().max(500).optional(),
});

// POST - Add item to collection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
  });

  if (!collection || collection.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { itemId, itemType, note } = addItemSchema.parse(body);

  // Verify package exists
  if (itemType === 'mcp') {
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, itemId),
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }
  } else {
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, itemId),
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }
  }

  // Check if already in collection
  const existing = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, params.id),
      eq(collectionItems.itemId, itemId)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Item already in collection' },
      { status: 409 }
    );
  }

  // Get max position
  const [{ maxPos }] = await db
    .select({ maxPos: max(collectionItems.position) })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, params.id));

  const position = (maxPos || 0) + 1;

  const itemDbId = generateId();

  await db.insert(collectionItems).values({
    id: itemDbId,
    collectionId: params.id,
    itemId,
    itemType,
    note: note || null,
    position,
  });

  // Update item count
  await db
    .update(collections)
    .set({ itemCount: collection.itemCount + 1 })
    .where(eq(collections.id, params.id));

  return NextResponse.json({ success: true }, { status: 201 });
}
```

### 4. Remove Collection Item (`apps/web/app/api/collections/[id]/items/[itemId]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, collections, collectionItems } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

// DELETE - Remove item from collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
  });

  if (!collection || collection.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const item = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, params.id),
      eq(collectionItems.id, params.itemId)
    ),
  });

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  await db.delete(collectionItems).where(eq(collectionItems.id, params.itemId));

  // Update item count
  await db
    .update(collections)
    .set({ itemCount: Math.max(0, collection.itemCount - 1) })
    .where(eq(collections.id, params.id));

  return NextResponse.json({ success: true });
}
```

### 5. Fork Collection (`apps/web/app/api/collections/[id]/fork/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, collections, collectionItems } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

// POST - Fork collection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const original = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
  });

  if (!original) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Must be public or owned by user
  if (!original.isPublic && original.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Generate unique slug
  let slug = `${original.slug}-fork`;
  let counter = 1;
  while (true) {
    const existing = await db.query.collections.findFirst({
      where: eq(collections.slug, slug),
    });
    if (!existing) break;
    slug = `${original.slug}-fork-${counter++}`;
  }

  const newId = generateId();

  // Create forked collection
  await db.insert(collections).values({
    id: newId,
    name: `${original.name} (Fork)`,
    slug,
    description: original.description,
    isPublic: false, // Forks start private
    ownerId: session.userId,
    forkedFromId: original.id,
    itemCount: original.itemCount,
    forksCount: 0,
  });

  // Copy items
  const items = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, params.id),
  });

  if (items.length > 0) {
    await db.insert(collectionItems).values(
      items.map((item) => ({
        id: generateId(),
        collectionId: newId,
        itemId: item.itemId,
        itemType: item.itemType,
        note: item.note,
        position: item.position,
      }))
    );
  }

  // Increment forks count on original
  await db
    .update(collections)
    .set({ forksCount: original.forksCount + 1 })
    .where(eq(collections.id, params.id));

  const forked = await db.query.collections.findFirst({
    where: eq(collections.id, newId),
  });

  return NextResponse.json({ collection: forked }, { status: 201 });
}
```

---

## Response Shapes

### Collection

```typescript
interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  forksCount: number;
  forkedFromId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
```

### CollectionItem

```typescript
interface CollectionItem {
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  note: string | null;
  position: number;
  package: McpPackage | SkillPackage;
}
```

---

## Acceptance Criteria

- [ ] List public collections with pagination
- [ ] Search collections by name/description
- [ ] Create collection with unique slug
- [ ] Get collection with items
- [ ] Update collection (owner only)
- [ ] Delete collection (owner only)
- [ ] Add items to collection
- [ ] Remove items from collection
- [ ] Fork public collections
- [ ] Private collections hidden from others
- [ ] Item count updated correctly
- [ ] Fork count tracked

---

## Notes

- Collection slugs unique per user
- Items ordered by position
- Forked collections start private
- Fork count incremented on original
- Collections can include both MCP and Skills
