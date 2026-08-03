/**
 * Admin Rankings Rebuild API
 *
 * POST /api/admin/rankings/rebuild - Trigger a ranking rebuild
 *
 * Rebuilds ranking snapshots for published pages based on engagement metrics.
 * The scoring algorithm uses a weighted sum of viewCount, likeCount, commentCount,
 * repostCount, and bookmarkCount with time decay applied.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, rankingSnapshots, rankingItems, publishedPages } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

// ============================================
// Schemas
// ============================================

const rebuildRankingSchema = z.object({
  entityType: z.enum(['published_page', 'mcp_package', 'skill_package']).default('published_page'),
  timeWindow: z.enum(['1d', '7d', '30d', 'all']).default('7d'),
});

// ============================================
// Scoring
// ============================================

const ENGAGEMENT_WEIGHTS = {
  view: 0.3,
  like: 1.5,
  comment: 3.0,
  repost: 4.0,
  bookmark: 2.0,
} as const;

interface PageForRanking {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  categoryId: string | null;
  tags: string[];
  publishedAt: Date;
  lastPublishedAt: Date;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
}

interface ScoredPage extends PageForRanking {
  score: number;
  rawScore: number;
  decayFactor: number;
}

function calculateScore(page: PageForRanking, sourceFrom: Date | null, sourceUntil: Date): ScoredPage {
  const rawScore =
    (page.viewCount || 0) * ENGAGEMENT_WEIGHTS.view +
    (page.likeCount || 0) * ENGAGEMENT_WEIGHTS.like +
    (page.commentCount || 0) * ENGAGEMENT_WEIGHTS.comment +
    (page.repostCount || 0) * ENGAGEMENT_WEIGHTS.repost +
    (page.bookmarkCount || 0) * ENGAGEMENT_WEIGHTS.bookmark;

  let decayFactor = 1.0;
  if (sourceFrom) {
    const age = sourceUntil.getTime() - new Date(page.publishedAt).getTime();
    const windowMs = sourceUntil.getTime() - sourceFrom.getTime();
    if (windowMs > 0) {
      decayFactor = 0.5 + 0.5 * (1 - Math.min(Math.max(age / windowMs, 0), 1));
    }
  }

  return {
    ...page,
    score: rawScore * decayFactor,
    rawScore,
    decayFactor,
  };
}

function buildBreakdown(page: ScoredPage): Record<string, unknown> {
  return {
    rawScore: page.rawScore,
    decayFactor: page.decayFactor,
    components: {
      viewCount: page.viewCount || 0,
      likeCount: page.likeCount || 0,
      commentCount: page.commentCount || 0,
      repostCount: page.repostCount || 0,
      bookmarkCount: page.bookmarkCount || 0,
    },
    weights: ENGAGEMENT_WEIGHTS,
  };
}

// ============================================
// Handler
// ============================================

/** @ignore */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'rankings.manage');

    const body = await request.json();
    const { entityType, timeWindow } = rebuildRankingSchema.parse(body);

    // Calculate time window bounds
    const now = new Date();
    let sourceFrom: Date | null = null;
    const sourceUntil = now;

    switch (timeWindow) {
      case '1d':
        sourceFrom = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        sourceFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        sourceFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        sourceFrom = null;
        break;
    }

    if (entityType !== 'published_page') {
      return NextResponse.json(
        { error: `Entity type "${entityType}" is not yet supported for ranking rebuilds. Only "published_page" is currently available.` },
        { status: 400 }
      );
    }

    const rankingKey = entityType;
    const algorithmVersion = '1.0.0';

    // Query published pages for scoring.
    // Time window is used for decay calculation only — all public/approved pages
    // are eligible so older content with strong engagement can still rank.
    const pages = await db
      .select({
        id: publishedPages.id,
        title: publishedPages.title,
        description: publishedPages.description,
        userId: publishedPages.userId,
        categoryId: publishedPages.categoryId,
        tags: publishedPages.tags,
        publishedAt: publishedPages.publishedAt,
        lastPublishedAt: publishedPages.lastPublishedAt,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        commentCount: publishedPages.commentCount,
        repostCount: publishedPages.repostCount,
        bookmarkCount: publishedPages.bookmarkCount,
        authorDisplayName: publishedPages.authorDisplayName,
        authorAvatarUrl: publishedPages.authorAvatarUrl,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.moderationStatus, 'approved'),
          eq(publishedPages.visibility, 'public'),
        )
      )
      .orderBy(desc(publishedPages.publishedAt));

    // Score and rank pages
    const scored: ScoredPage[] = pages
      .map((p) => calculateScore(p as PageForRanking, sourceFrom, sourceUntil))
      .sort((a, b) => b.score - a.score);

    // Build ranking items
    const rankingItemsData = scored.map((page, index) => ({
      snapshotId: '', // Will be filled after snapshot creation
      rank: index + 1,
      entityType: 'published_page',
      entityId: page.id,
      score: page.score,
      rawScore: page.rawScore,
      decayFactor: page.decayFactor,
      reason: `weighted_engagement(v=${ENGAGEMENT_WEIGHTS.view},l=${ENGAGEMENT_WEIGHTS.like},c=${ENGAGEMENT_WEIGHTS.comment},r=${ENGAGEMENT_WEIGHTS.repost},f=${ENGAGEMENT_WEIGHTS.bookmark})`,
      breakdown: buildBreakdown(page),
      title: page.title,
      description: page.description,
      userId: page.userId,
      categoryId: page.categoryId,
      tags: page.tags,
      publishedAt: page.publishedAt,
      lastPublishedAt: page.lastPublishedAt,
      viewCount: page.viewCount,
      likeCount: page.likeCount,
      commentCount: page.commentCount,
      authorDisplayName: page.authorDisplayName,
      authorAvatarUrl: page.authorAvatarUrl,
      scoreLabel: '热度',
    }));

    // 1. Mark existing ready snapshots as expired
    await db
      .update(rankingSnapshots)
      .set({ status: 'expired', validUntil: new Date() })
      .where(
        and(
          eq(rankingSnapshots.rankingKey, rankingKey),
          eq(rankingSnapshots.timeWindow, timeWindow),
          eq(rankingSnapshots.status, 'ready')
        )
      );

    // 2-4. Create snapshot + items (with cleanup on failure)
    const snapshotId = crypto.randomUUID();
    try {
      await db.insert(rankingSnapshots).values({
        id: snapshotId,
        rankingKey,
        entityType: 'published_page',
        timeWindow,
        scopeType: 'global',
        algorithmVersion,
        status: 'building',
        validFrom: now,
        sourceFrom,
        sourceUntil,
        itemCount: 0,
      });

      // Batch insert ranking items
      const chunkSize = 100;
      for (let i = 0; i < rankingItemsData.length; i += chunkSize) {
        const chunk = rankingItemsData.slice(i, i + chunkSize).map((item) => ({
          ...item,
          snapshotId,
        }));
        await db.insert(rankingItems).values(chunk);
      }

      await db
        .update(rankingSnapshots)
        .set({
          status: 'ready',
          itemCount: rankingItemsData.length,
          generatedAt: new Date(),
        })
        .where(eq(rankingSnapshots.id, snapshotId));
    } catch (innerError) {
      // Clean up orphaned snapshot on failure
      await db.delete(rankingSnapshots).where(eq(rankingSnapshots.id, snapshotId)).catch(() => {});
      throw innerError;
    }

    // 重建完成后刷新首页和推荐缓存
    revalidateTag("homepage");
    revalidateTag("page-recommendations");

    // Fetch the final snapshot
    const [result] = await db
      .select()
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.id, snapshotId));

    return NextResponse.json({
      success: true,
      message: `榜单重建完成，共收录 ${result.itemCount} 条记录`,
      snapshot: {
        id: result.id,
        rankingKey: result.rankingKey,
        itemCount: result.itemCount,
        status: result.status,
        validFrom: result.validFrom,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Rebuild rankings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
