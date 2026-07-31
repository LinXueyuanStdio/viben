/**
 * Admin Content Analytics API
 *
 * GET /api/admin/analytics - Get daily aggregated content stats
 *   Query params:
 *     - range: '7d' | '30d' | 'all' (default '7d')
 *     - entity_type: optional filter by entity type
 *     - start_date: ISO date string (overrides range if both start_date and end_date provided)
 *     - end_date: ISO date string
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, entityStatsDaily } from '@/lib/db';
import { sql, eq, and, gte, lte, desc, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', 'all']).default('7d'),
  entity_type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

function getDateRange(params: {
  range: '7d' | '30d' | 'all';
  start_date?: string;
  end_date?: string;
}): { startDate: Date | null; endDate: Date | null } {
  if (params.start_date && params.end_date) {
    return {
      startDate: new Date(params.start_date),
      endDate: new Date(params.end_date),
    };
  }

  if (params.range === 'all') {
    return { startDate: null, endDate: null };
  }

  const now = new Date();
  const days = params.range === '7d' ? 7 : 30;
  return {
    startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    endDate: null,
  };
}

/** @ignore */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'rankings.view');

    const searchParams = request.nextUrl.searchParams;
    const query = analyticsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { startDate, endDate } = getDateRange(query);

    // Build conditions
    const conditions: SQL[] = [];
    if (startDate) {
      conditions.push(gte(entityStatsDaily.statDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(entityStatsDaily.statDate, endDate));
    }
    if (query.entity_type) {
      conditions.push(eq(entityStatsDaily.entityType, query.entity_type));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Daily aggregated stats grouped by stat_date
    const dailyStats = await db
      .select({
        statDate: entityStatsDaily.statDate,
        viewCount: sql<number>`COALESCE(SUM(${entityStatsDaily.viewCount}), 0)`.mapWith(Number),
        uniqueViewerCount: sql<number>`COALESCE(SUM(${entityStatsDaily.uniqueViewerCount}), 0)`.mapWith(Number),
        readCount: sql<number>`COALESCE(SUM(${entityStatsDaily.readCount}), 0)`.mapWith(Number),
        likeCount: sql<number>`COALESCE(SUM(${entityStatsDaily.likeCount}), 0)`.mapWith(Number),
        bookmarkCount: sql<number>`COALESCE(SUM(${entityStatsDaily.bookmarkCount}), 0)`.mapWith(Number),
        commentCount: sql<number>`COALESCE(SUM(${entityStatsDaily.commentCount}), 0)`.mapWith(Number),
        shareCount: sql<number>`COALESCE(SUM(${entityStatsDaily.shareCount}), 0)`.mapWith(Number),
        repostCount: sql<number>`COALESCE(SUM(${entityStatsDaily.repostCount}), 0)`.mapWith(Number),
        subscriberCount: sql<number>`COALESCE(SUM(${entityStatsDaily.subscriberCount}), 0)`.mapWith(Number),
      })
      .from(entityStatsDaily)
      .where(whereClause)
      .groupBy(entityStatsDaily.statDate)
      .orderBy(entityStatsDaily.statDate);

    // 2. Summary totals for the period
    const [summary] = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${entityStatsDaily.viewCount}), 0)`.mapWith(Number),
        totalUniqueViewers: sql<number>`COALESCE(SUM(${entityStatsDaily.uniqueViewerCount}), 0)`.mapWith(Number),
        totalReads: sql<number>`COALESCE(SUM(${entityStatsDaily.readCount}), 0)`.mapWith(Number),
        totalLikes: sql<number>`COALESCE(SUM(${entityStatsDaily.likeCount}), 0)`.mapWith(Number),
        totalBookmarks: sql<number>`COALESCE(SUM(${entityStatsDaily.bookmarkCount}), 0)`.mapWith(Number),
        totalComments: sql<number>`COALESCE(SUM(${entityStatsDaily.commentCount}), 0)`.mapWith(Number),
        totalShares: sql<number>`COALESCE(SUM(${entityStatsDaily.shareCount}), 0)`.mapWith(Number),
        totalReposts: sql<number>`COALESCE(SUM(${entityStatsDaily.repostCount}), 0)`.mapWith(Number),
        totalSubscribers: sql<number>`COALESCE(SUM(${entityStatsDaily.subscriberCount}), 0)`.mapWith(Number),
      })
      .from(entityStatsDaily)
      .where(whereClause);

    // 3. Top 10 entities by total views in the period
    const topEntities = await db
      .select({
        entityType: entityStatsDaily.entityType,
        entityId: entityStatsDaily.entityId,
        totalViews: sql<number>`SUM(${entityStatsDaily.viewCount})`.mapWith(Number),
        totalUniqueViewers: sql<number>`SUM(${entityStatsDaily.uniqueViewerCount})`.mapWith(Number),
        totalReads: sql<number>`SUM(${entityStatsDaily.readCount})`.mapWith(Number),
        totalLikes: sql<number>`SUM(${entityStatsDaily.likeCount})`.mapWith(Number),
        totalBookmarks: sql<number>`SUM(${entityStatsDaily.bookmarkCount})`.mapWith(Number),
        totalComments: sql<number>`SUM(${entityStatsDaily.commentCount})`.mapWith(Number),
        totalShares: sql<number>`SUM(${entityStatsDaily.shareCount})`.mapWith(Number),
        totalReposts: sql<number>`SUM(${entityStatsDaily.repostCount})`.mapWith(Number),
        totalSubscribers: sql<number>`SUM(${entityStatsDaily.subscriberCount})`.mapWith(Number),
      })
      .from(entityStatsDaily)
      .where(whereClause)
      .groupBy(entityStatsDaily.entityType, entityStatsDaily.entityId)
      .orderBy(desc(sql`SUM(${entityStatsDaily.viewCount})`))
      .limit(10);

    return NextResponse.json({
      summary: summary ?? {
        totalViews: 0,
        totalUniqueViewers: 0,
        totalReads: 0,
        totalLikes: 0,
        totalBookmarks: 0,
        totalComments: 0,
        totalShares: 0,
        totalReposts: 0,
        totalSubscribers: 0,
      },
      dailyStats,
      topEntities,
      meta: {
        range: query.range,
        entityType: query.entity_type ?? null,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Content analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
