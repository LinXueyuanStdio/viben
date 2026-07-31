import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { listSubscriptionFeed } from '@/lib/services/community';

/**
 * 获取订阅动态
 * @summary 获取订阅动态流
 * @description 获取当前用户的订阅动态流，返回 items（动态条目列表）、next_cursor（分页游标，无更多时为 null）、has_more（是否有更多数据）。支持按来源类型（followed_authors / subscribed_pages / all）过滤和游标分页，需登录
 * @params SubscriptionFeedQuery
 * @response 200:SubscriptionFeedResponse:订阅动态列表及分页信息
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Feed
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const includeSeen = request.nextUrl.searchParams.get('include_seen') !== 'false';
    const rawSource = request.nextUrl.searchParams.get('source');
    const source =
      rawSource === 'followed_authors' || rawSource === 'subscribed_pages'
        ? rawSource
        : 'all';

    return NextResponse.json(
      await listSubscriptionFeed(session, { limit, cursor, includeSeen, source })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
