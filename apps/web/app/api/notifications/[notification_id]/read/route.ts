import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { markNotificationsRead } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ notification_id: string }>;
}

/**
 * 标记单条通知已读
 * @summary 标记单条通知已读
 * @description 将指定通知标记为已读，需登录。通过路径参数 notification_id 指定目标通知
 * @pathParams NotificationIdParams — 通知 ID
 * @response 200:SuccessResponse:标记成功
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Notifications
 */
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
