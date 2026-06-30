/**
 * Admin Rankings API
 *
 * GET /api/admin/rankings - List ranking snapshots
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, rankingSnapshots } from '@/lib/db';
import { desc, eq, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listRankingsQuerySchema = z.object({
  status: z.enum(['all', 'ready', 'building', 'failed', 'expired']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'rankings.view');

    const searchParams = request.nextUrl.searchParams;
    const query = listRankingsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [];
    if (query.status !== 'all') {
      conditions.push(eq(rankingSnapshots.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const snapshots = await db
      .select()
      .from(rankingSnapshots)
      .where(whereClause)
      .orderBy(desc(rankingSnapshots.createdAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({ snapshots });
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
    console.error('List rankings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
