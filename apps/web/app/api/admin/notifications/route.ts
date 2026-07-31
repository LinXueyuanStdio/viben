/**
 * Admin Notifications API
 *
 * GET /api/admin/notifications - List notifications for admin overview
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, notifications, users } from '@/lib/db';
import { eq, desc, count, and, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.string().optional(),
  read_status: z.enum(['all', 'read', 'unread']).default('all'),
});

/** @ignore */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'users.view');

    const searchParams = request.nextUrl.searchParams;
    const query = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));

    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(notifications.type, query.type));
    if (query.read_status === 'read') conditions.push(isNotNull(notifications.readAt));
    else if (query.read_status === 'unread') conditions.push(isNull(notifications.readAt));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(whereClause);
    const total = totalResult?.count ?? 0;

    const list = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        recipientId: notifications.recipientUserId,
        recipientName: users.displayName,
        actorName: notifications.actorName,
        pageUid: notifications.pageUid,
        pageAuthorSlug: notifications.pageAuthorSlug,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.recipientUserId))
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({
      notifications: list,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('List admin notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
