/**
 * Admin Feedbacks API
 *
 * GET /api/admin/feedbacks - List user feedbacks
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, feedbacks, users } from '@/lib/db';
import { eq, desc, count, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listFeedbacksQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  category: z.enum(['all', 'bug', 'suggestion', 'other']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'reports.view');

    const searchParams = request.nextUrl.searchParams;
    const query = listFeedbacksQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [];
    if (query.category !== 'all') {
      conditions.push(eq(feedbacks.category, query.category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(feedbacks)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const feedbackList = await db
      .select({
        id: feedbacks.id,
        pageId: feedbacks.pageId,
        category: feedbacks.category,
        rating: feedbacks.rating,
        content: feedbacks.content,
        createdAt: feedbacks.createdAt,
        reporterId: feedbacks.reporterId,
        reporterName: users.username,
        reporterDisplayName: users.displayName,
      })
      .from(feedbacks)
      .leftJoin(users, eq(users.id, feedbacks.reporterId))
      .where(whereClause)
      .orderBy(desc(feedbacks.createdAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({
      feedbacks: feedbackList,
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
    console.error('List admin feedbacks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
