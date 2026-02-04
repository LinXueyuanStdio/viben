import { db, favorites, comments, ratings, mcpPackages, skillPackages, users } from '@/lib/db';
import { eq, and, avg, count, desc } from 'drizzle-orm';

type EntityType = 'mcp' | 'skill';

// ============================================
// Favorites Service
// ============================================

export async function toggleFavorite(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<{ isFavorited: boolean; count: number }> {
  const existing = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.entityType, entityType),
      eq(favorites.entityId, entityId)
    ),
  });

  if (existing) {
    // Remove favorite
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.entityType, entityType),
          eq(favorites.entityId, entityId)
        )
      );
    await updateFavoritesCount(entityType, entityId, -1);
    const newCount = await getFavoritesCount(entityType, entityId);
    return { isFavorited: false, count: newCount };
  } else {
    // Add favorite
    await db.insert(favorites).values({
      userId,
      entityType,
      entityId,
    });
    await updateFavoritesCount(entityType, entityId, 1);
    const newCount = await getFavoritesCount(entityType, entityId);
    return { isFavorited: true, count: newCount };
  }
}

export async function isFavorited(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<boolean> {
  const result = await db.query.favorites.findFirst({
    where: and(
      eq(favorites.userId, userId),
      eq(favorites.entityType, entityType),
      eq(favorites.entityId, entityId)
    ),
  });
  return !!result;
}

async function updateFavoritesCount(
  entityType: EntityType,
  entityId: string,
  delta: number
): Promise<void> {
  if (entityType === 'mcp') {
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, entityId),
    });
    if (pkg) {
      await db
        .update(mcpPackages)
        .set({ favoritesCount: Math.max(0, pkg.favoritesCount + delta) })
        .where(eq(mcpPackages.id, entityId));
    }
  } else {
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, entityId),
    });
    if (pkg) {
      await db
        .update(skillPackages)
        .set({ favoritesCount: Math.max(0, pkg.favoritesCount + delta) })
        .where(eq(skillPackages.id, entityId));
    }
  }
}

async function getFavoritesCount(
  entityType: EntityType,
  entityId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(favorites)
    .where(
      and(eq(favorites.entityType, entityType), eq(favorites.entityId, entityId))
    );
  return result?.count ?? 0;
}

// ============================================
// Comments Service
// ============================================

export interface CommentWithAuthor {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replies?: CommentWithAuthor[];
}

export async function getComments(
  entityType: EntityType | 'collection',
  entityId: string
): Promise<CommentWithAuthor[]> {
  const results = await db.query.comments.findMany({
    where: and(
      eq(comments.entityType, entityType),
      eq(comments.entityId, entityId)
    ),
    orderBy: [desc(comments.createdAt)],
    with: {
      user: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Build nested structure
  const commentMap = new Map<string, CommentWithAuthor>();
  const topLevel: CommentWithAuthor[] = [];

  for (const c of results) {
    const comment: CommentWithAuthor = {
      id: c.id,
      content: c.content,
      parentId: c.parentId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: c.user,
      replies: [],
    };
    commentMap.set(c.id, comment);
  }

  for (const c of commentMap.values()) {
    if (c.parentId && commentMap.has(c.parentId)) {
      commentMap.get(c.parentId)!.replies!.push(c);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel;
}

export async function createComment(
  userId: string,
  entityType: EntityType | 'collection',
  entityId: string,
  content: string,
  parentId?: string
): Promise<CommentWithAuthor> {
  const [result] = await db
    .insert(comments)
    .values({
      userId,
      entityType,
      entityId,
      content,
      parentId: parentId || null,
    })
    .returning();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  return {
    id: result.id,
    content: result.content,
    parentId: result.parentId,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    author: user!,
    replies: [],
  };
}

export async function deleteComment(
  commentId: string,
  userId: string
): Promise<boolean> {
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!comment || comment.userId !== userId) {
    return false;
  }

  // Delete replies first (cascade)
  await db.delete(comments).where(eq(comments.parentId, commentId));
  await db.delete(comments).where(eq(comments.id, commentId));

  return true;
}

// ============================================
// Ratings Service
// ============================================

export interface RatingInfo {
  userRating: number | null;
  average: number;
  count: number;
}

export async function getRating(
  userId: string | null,
  entityType: EntityType,
  entityId: string
): Promise<RatingInfo> {
  let userRating: number | null = null;

  if (userId) {
    const userRatingResult = await db.query.ratings.findFirst({
      where: and(
        eq(ratings.userId, userId),
        eq(ratings.entityType, entityType),
        eq(ratings.entityId, entityId)
      ),
    });
    userRating = userRatingResult?.score ?? null;
  }

  const [stats] = await db
    .select({
      average: avg(ratings.score),
      count: count(),
    })
    .from(ratings)
    .where(
      and(eq(ratings.entityType, entityType), eq(ratings.entityId, entityId))
    );

  return {
    userRating,
    average: Number(stats?.average ?? 0),
    count: stats?.count ?? 0,
  };
}

export async function setRating(
  userId: string,
  entityType: EntityType,
  entityId: string,
  score: number
): Promise<RatingInfo> {
  // Validate score
  if (score < 1 || score > 5) {
    throw new Error('Score must be between 1 and 5');
  }

  // Upsert rating
  const existing = await db.query.ratings.findFirst({
    where: and(
      eq(ratings.userId, userId),
      eq(ratings.entityType, entityType),
      eq(ratings.entityId, entityId)
    ),
  });

  if (existing) {
    await db
      .update(ratings)
      .set({ score })
      .where(
        and(
          eq(ratings.userId, userId),
          eq(ratings.entityType, entityType),
          eq(ratings.entityId, entityId)
        )
      );
  } else {
    await db.insert(ratings).values({
      userId,
      entityType,
      entityId,
      score,
    });
  }

  // Update package rating stats
  await updateRatingStats(entityType, entityId);

  return getRating(userId, entityType, entityId);
}

async function updateRatingStats(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  const [stats] = await db
    .select({
      average: avg(ratings.score),
      count: count(),
    })
    .from(ratings)
    .where(
      and(eq(ratings.entityType, entityType), eq(ratings.entityId, entityId))
    );

  const ratingAvg = Number(stats?.average ?? 0);
  const ratingCount = stats?.count ?? 0;

  if (entityType === 'mcp') {
    await db
      .update(mcpPackages)
      .set({ ratingAvg, ratingCount })
      .where(eq(mcpPackages.id, entityId));
  } else {
    await db
      .update(skillPackages)
      .set({ ratingAvg, ratingCount })
      .where(eq(skillPackages.id, entityId));
  }
}
