import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { markNotificationsRead } from '@/lib/services/community';

/**
 * 批量标记通知已读
 * @summary 批量标记通知已读
 * @description 将指定通知批量标记为已读，需登录。支持两种方式：按 notification_ids（通知 ID 列表）或按 before_cursor（标记该游标之前的全部通知已读），两者可同时使用
 * @body NotificationsReadBody
 * @response 200:SuccessResponse:标记成功
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Notifications
 */
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
