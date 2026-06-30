# T11: Social API

> Implement favorites, comments, and ratings API routes.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T11 |
| Dependencies | T5 (MCP API), T6 (Skills API) |
| Effort | 3 points |
| Priority | P1 |

---

## Objectives

1. Implement favorites toggle
2. Implement comments CRUD
3. Implement ratings
4. Update aggregate counts

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/mcp/[id]/favorite` | Toggle favorite | Yes |
| GET | `/api/mcp/[id]/comments` | List comments | No |
| POST | `/api/mcp/[id]/comments` | Add comment | Yes |
| DELETE | `/api/mcp/[id]/comments/[commentId]` | Delete comment | Yes |
| POST | `/api/mcp/[id]/rating` | Add/update rating | Yes |

Same endpoints for `/api/skill/[id]/...`

---

## Deliverables

### 1. Favorites (`apps/web/app/api/mcp/[id]/favorite/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, favorites, mcpPackages } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const entityType = 'mcp';

  // Check if already favorited
  const existing = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, session.userId),
      eq(favorites.entityType, entityType),
      eq(favorites.entityId, id)
    ),
  });

  let isFavorited: boolean;

  if (existing) {
    // Remove favorite
    await db.delete(favorites).where(
      and(
        eq(favorites.userId, session.userId),
        eq(favorites.entityType, entityType),
        eq(favorites.entityId, id)
      )
    );
    isFavorited = false;

    // Decrement count
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
    });
    if (pkg) {
      await db
        .update(mcpPackages)
        .set({ favoritesCount: Math.max(0, pkg.favoritesCount - 1) })
        .where(eq(mcpPackages.id, id));
    }
  } else {
    // Add favorite
    await db.insert(favorites).values({
      userId: session.userId,
      entityType,
      entityId: id,
    });
    isFavorited = true;

    // Increment count
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
    });
    if (pkg) {
      await db
        .update(mcpPackages)
        .set({ favoritesCount: pkg.favoritesCount + 1 })
        .where(eq(mcpPackages.id, id));
    }
  }

  return NextResponse.json({ isFavorited });
}

// GET - Check if favorited
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ isFavorited: false });
  }

  const { id } = params;

  const existing = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, session.userId),
      eq(favorites.entityType, 'mcp'),
      eq(favorites.entityId, id)
    ),
  });

  return NextResponse.json({ isFavorited: !!existing });
}
```

### 2. Comments (`apps/web/app/api/mcp/[id]/comments/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, comments, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, and, isNull, desc } from 'drizzle-orm';

// GET - List comments
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const allComments = await db
    .select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(
      and(
        eq(comments.entityType, 'mcp'),
        eq(comments.entityId, id)
      )
    )
    .orderBy(desc(comments.createdAt));

  // Build tree structure
  const commentMap = new Map();
  const rootComments: any[] = [];

  allComments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  allComments.forEach((comment) => {
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies.push(commentMap.get(comment.id));
      }
    } else {
      rootComments.push(commentMap.get(comment.id));
    }
  });

  return NextResponse.json({ comments: rootComments });
}

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

// POST - Add comment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();
  const { content, parentId } = createCommentSchema.parse(body);

  const commentId = generateId();

  await db.insert(comments).values({
    id: commentId,
    entityType: 'mcp',
    entityId: id,
    userId: session.userId,
    content,
    parentId: parentId || null,
  });

  // Fetch the created comment with author
  const [comment] = await db
    .select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.id, commentId));

  return NextResponse.json({ comment });
}
```

### 3. Delete Comment (`apps/web/app/api/mcp/[id]/comments/[commentId]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, comments } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { commentId } = params;

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Only author or admin can delete
  if (comment.userId !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete comment (cascades to replies)
  await db.delete(comments).where(eq(comments.id, commentId));

  return NextResponse.json({ success: true });
}
```

### 4. Ratings (`apps/web/app/api/mcp/[id]/rating/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, ratings, mcpPackages } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, avg, count } from 'drizzle-orm';

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();
  const { score } = ratingSchema.parse(body);

  // Upsert rating
  const existing = await db.query.ratings.findFirst({
    where: and(
      eq(ratings.userId, session.userId),
      eq(ratings.entityType, 'mcp'),
      eq(ratings.entityId, id)
    ),
  });

  if (existing) {
    await db
      .update(ratings)
      .set({ score })
      .where(
        and(
          eq(ratings.userId, session.userId),
          eq(ratings.entityType, 'mcp'),
          eq(ratings.entityId, id)
        )
      );
  } else {
    await db.insert(ratings).values({
      userId: session.userId,
      entityType: 'mcp',
      entityId: id,
      score,
    });
  }

  // Update aggregate on package
  const [stats] = await db
    .select({
      avgRating: avg(ratings.score),
      ratingCount: count(ratings.score),
    })
    .from(ratings)
    .where(
      and(
        eq(ratings.entityType, 'mcp'),
        eq(ratings.entityId, id)
      )
    );

  await db
    .update(mcpPackages)
    .set({
      ratingAvg: Number(stats.avgRating) || 0,
      ratingCount: Number(stats.ratingCount) || 0,
    })
    .where(eq(mcpPackages.id, id));

  return NextResponse.json({
    success: true,
    ratingAvg: Number(stats.avgRating) || 0,
    ratingCount: Number(stats.ratingCount) || 0,
  });
}

// GET - Get user's rating
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ userRating: null });
  }

  const { id } = params;

  const rating = await db.query.ratings.findFirst({
    where: and(
      eq(ratings.userId, session.userId),
      eq(ratings.entityType, 'mcp'),
      eq(ratings.entityId, id)
    ),
  });

  return NextResponse.json({ userRating: rating?.score || null });
}
```

---

## Shared Service (`apps/web/lib/services/social.ts`)

```typescript
import { db, favorites, comments, ratings } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export type EntityType = 'mcp' | 'skill' | 'datasource';

export async function toggleFavorite(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  const existing = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.entityType, entityType),
      eq(favorites.entityId, entityId)
    ),
  });

  if (existing) {
    await db.delete(favorites).where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.entityType, entityType),
        eq(favorites.entityId, entityId)
      )
    );
    return false;
  } else {
    await db.insert(favorites).values({
      userId,
      entityType,
      entityId,
    });
    return true;
  }
}

export async function getUserFavorites(
  userId: string,
  entityType: EntityType
) {
  return db.query.favorites.findMany({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.entityType, entityType)
    ),
  });
}
```

---

## Response Shapes

### Comment

```typescript
interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replies: Comment[];
}
```

---

## Acceptance Criteria

- [ ] Toggle favorites (add/remove)
- [ ] Get favorite status
- [ ] List comments with nested replies
- [ ] Add comment (top-level or reply)
- [ ] Delete comment (owner only)
- [ ] Add/update rating (1-5)
- [ ] Get user's rating
- [ ] Aggregate counts updated correctly

---

## Notes

- Comments support one level of nesting (replies)
- Ratings are upserted (one per user per entity)
- Aggregate counts updated on each action
- Same pattern used for Skills API
