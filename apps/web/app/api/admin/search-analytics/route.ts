/**
 * Admin Search Analytics API
 *
 * GET /api/admin/search-analytics - Search query analytics
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, searchQueries } from '@/lib/db';
import { desc, count, sql } from 'drizzle-orm';
import { z } from 'zod';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'rankings.view');

    const searchParams = request.nextUrl.searchParams;
    const query = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const offset = (query.page - 1) * query.limit;

    // Aggregated top searches
    const topSearches = await db
      .select({
        query: searchQueries.query,
        count: count(searchQueries.id),
        lastSearchedAt: sql<string>`MAX(${searchQueries.searchedAt})`.as('last_searched_at'),
      })
      .from(searchQueries)
      .groupBy(searchQueries.query)
      .orderBy(desc(count(searchQueries.id)))
      .limit(50);

    // Recent searches (paginated)
    const recentSearches = await db
      .select({
        id: searchQueries.id,
        query: searchQueries.query,
        resultCount: searchQueries.resultCount,
        searchedAt: searchQueries.searchedAt,
        userId: searchQueries.userId,
      })
      .from(searchQueries)
      .orderBy(desc(searchQueries.searchedAt))
      .limit(query.limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(searchQueries);
    const total = totalResult?.count ?? 0;

    return NextResponse.json({
      topSearches,
      recentSearches,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('Search analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
