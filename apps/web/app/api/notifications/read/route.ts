import { and, inArray, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db, notifications } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const notificationIds = Array.isArray(body.notification_ids)
      ? body.notification_ids.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    if (notificationIds.length === 0) {
      return NextResponse.json({ success: true, updated_count: 0 });
    }

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientUserId, session.userId),
          inArray(notifications.id, notificationIds)
        )
      );

    return NextResponse.json({ success: true, updated_count: notificationIds.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
