/**
 * Admin Moments API
 *
 * GET /api/admin/moments - List moments for moderation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, moments, users } from '@/lib/db';
import { eq, desc, count, and, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';

const listMomentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  kind: z.enum(['all', 'post', 'page_update', 'repost', 'system']).default('all'),
  visibility: z.enum(['all', 'public', 'unlisted', 'private']).default('all'),
  search: z.string().optional(),
  include_deleted: z.coerce.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'moments.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listMomentsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [];
    if (!query.include_deleted) {
      conditions.push(eq(moments.isDeleted, false));
    }
    if (query.kind !== 'all') {
      conditions.push(eq(moments.kind, query.kind));
    }
    if (query.visibility !== 'all') {
      conditions.push(eq(moments.visibility, query.visibility));
    }
    if (query.search && query.search.trim()) {
      const searchTerm = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${moments.body} ILIKE ${searchTerm} OR ${moments.uid} ILIKE ${searchTerm})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const countQuery = db
      .select({ count: count() })
      .from(moments)
      .$dynamic();
    const listQuery = db
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
        attachmentCount: moments.attachmentCount,
        isPinned: moments.isPinned,
        isDeleted: moments.isDeleted,
        createdAt: moments.createdAt,
        authorId: moments.authorUserId,
        authorDisplayName: users.displayName,
        authorUsername: users.username,
      })
      .from(moments)
      .leftJoin(users, eq(users.id, moments.authorUserId))
      .$dynamic();

    if (whereClause) {
      countQuery.where(whereClause);
      listQuery.where(whereClause);
    }

    const [totalResult] = await countQuery;
    const total = totalResult?.count ?? 0;

    const momentList = await listQuery
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
