/**
 * Admin Moments API
 *
 * GET /api/admin/moments - List moments for moderation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, moments, users } from '@/lib/db';
import { eq, desc, count, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listMomentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  kind: z.enum(['all', 'post', 'page_update', 'repost', 'system']).default('all'),
  visibility: z.enum(['all', 'public', 'unlisted', 'private']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listMomentsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [eq(moments.isDeleted, false)];
    if (query.kind !== 'all') {
      conditions.push(eq(moments.kind, query.kind));
    }
    if (query.visibility !== 'all') {
      conditions.push(eq(moments.visibility, query.visibility));
    }

    const whereClause = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(moments)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const momentList = await db
      .select({
        id: moments.id,
        uid: moments.uid,
        kind: moments.kind,
        body: moments.body,
        visibility: moments.visibility,
        likeCount: moments.likeCount,
        commentCount: moments.commentCount,
        repostCount: moments.repostCount,
        viewCount: moments.viewCount,
        isPinned: moments.isPinned,
        createdAt: moments.createdAt,
        authorId: moments.authorUserId,
        authorName: users.displayName,
        authorUsername: users.username,
      })
      .from(moments)
      .leftJoin(users, eq(users.id, moments.authorUserId))
      .where(whereClause)
      .orderBy(desc(moments.createdAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({
      moments: momentList,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
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
    console.error('List admin moments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
