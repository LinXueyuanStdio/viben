import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { markNotificationsRead } from '@/lib/services/community';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const notificationIds = Array.isArray(body.notification_ids)
      ? body.notification_ids.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    const beforeCursor =
      typeof body.before_cursor === 'string' ? body.before_cursor : null;

    return NextResponse.json(
      await markNotificationsRead({
        session,
        notificationIds,
        beforeCursor,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
