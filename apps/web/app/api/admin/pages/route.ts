/**
 * Admin Pages API
 *
 * GET /api/admin/pages - List published pages for moderation review
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, publishedPages, users } from '@/lib/db';
import { eq, desc, count, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listPagesQuerySchema = z.object({
  moderation_status: z.enum(['pending', 'approved', 'rejected', 'hidden', 'all']).default('pending'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'pages.review');

    const searchParams = request.nextUrl.searchParams;
    const query = listPagesQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [];
    if (query.moderation_status !== 'all') {
      conditions.push(eq(publishedPages.moderationStatus, query.moderation_status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(publishedPages)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const pages = await db
      .select({
        id: publishedPages.id,
        uid: publishedPages.uid,
        userId: publishedPages.userId,
        title: publishedPages.title,
        description: publishedPages.description,
        coverUrl: publishedPages.coverUrl,
        visibility: publishedPages.visibility,
        moderationStatus: publishedPages.moderationStatus,
        publishedAt: publishedPages.publishedAt,
        lastPublishedAt: publishedPages.lastPublishedAt,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        commentCount: publishedPages.commentCount,
        authorName: publishedPages.authorName,
        authorAvatarUrl: publishedPages.authorAvatarUrl,
        authorUsername: users.username,
      })
      .from(publishedPages)
      .leftJoin(users, eq(users.id, publishedPages.userId))
      .where(whereClause)
      .orderBy(desc(publishedPages.lastPublishedAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({
      pages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
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
    console.error('List pages for review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
