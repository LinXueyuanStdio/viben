/**
 * Admin Activity Feed API
 *
 * GET /api/admin/activity - List activity events with pagination,
 * joined with users for actor name and target user name.
 * Filterable by eventType.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, activityEvents, users } from '@/lib/db';
import { desc, eq, count, and, gte, lte, aliasedTable, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listActivityQuerySchema = z.object({
  event_type: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'rankings.view');

    const searchParams = request.nextUrl.searchParams;
    const query = listActivityQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [];
    if (query.event_type) {
      conditions.push(eq(activityEvents.eventType, query.event_type));
    }
    if (query.start_date) {
      conditions.push(gte(activityEvents.createdAt, new Date(query.start_date)));
    }
    if (query.end_date) {
      conditions.push(lte(activityEvents.createdAt, new Date(query.end_date)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(activityEvents)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    // Aliased table for target user join
    const targetUsers = aliasedTable(users, 'target_users');

    const events = await db
      .select({
        id: activityEvents.id,
        actorUserId: activityEvents.actorUserId,
        eventType: activityEvents.eventType,
        entityType: activityEvents.entityType,
        entityId: activityEvents.entityId,
        targetUserId: activityEvents.targetUserId,
        metadata: activityEvents.metadata,
        createdAt: activityEvents.createdAt,
        actorUsername: users.username,
        actorDisplayName: users.displayName,
        actorAvatarUrl: users.avatarUrl,
        targetUsername: targetUsers.username,
        targetDisplayName: targetUsers.displayName,
      })
      .from(activityEvents)
      .leftJoin(users, eq(activityEvents.actorUserId, users.id))
      .leftJoin(targetUsers, eq(activityEvents.targetUserId, targetUsers.id))
      .where(whereClause)
      .orderBy(desc(activityEvents.createdAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({
      events,
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
    console.error('List activity events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
