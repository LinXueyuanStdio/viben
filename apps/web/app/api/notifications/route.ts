import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { listNotifications } from '@/lib/services/community';

/**
 * 获取通知列表
 * @summary 获取通知列表
 * @description 获取当前用户的通知列表，需登录。支持 unread_only（仅未读）过滤和游标分页，limit 默认 30 最大 100
 * @params NotificationsQuery — 通知列表查询参数
 * @response 200:NotificationListResponse:通知列表数据
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Notifications
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
    const unreadOnly = request.nextUrl.searchParams.get('unread_only') === 'true';
    const cursor = request.nextUrl.searchParams.get('cursor');
    return NextResponse.json(await listNotifications(session, limit, unreadOnly, cursor));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
