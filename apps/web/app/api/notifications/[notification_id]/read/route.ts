import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { markNotificationsRead } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ notification_id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { notification_id: notificationId } = await params;
    return NextResponse.json(
      await markNotificationsRead({
        session,
        notificationIds: [notificationId],
        beforeCursor: null,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
