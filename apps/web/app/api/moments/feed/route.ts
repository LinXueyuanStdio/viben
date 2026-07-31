import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, getOptionalSession } from '@/lib/auth/middleware';
import { listMoments } from '@/lib/services/community';
import { MomentsFeedQuery } from '@/lib/validations/moments';

/**
 * 获取动态 Feed 流
 * @summary 获取动态信息流
 * @description 获取动态信息流，必须指定 feed_type（following / latest / recommended），支持游标分页。following 时需要登录（未登录返回 401），无效 feed_type 返回 400。返回 items、nextCursor、hasMore
 * @params MomentsFeedQuery
 * @response 200:MomentFeedResponse:动态列表及分页信息
 * @response 400:ErrorResponse:feed_type 无效或缺失
 * @response 401:ErrorResponse:following 模式下未登录
 * @tag Moments
 */
export async function GET(request: NextRequest) {
  const feedType = request.nextUrl.searchParams.get('feed_type');
  if (feedType !== 'following' && feedType !== 'latest' && feedType !== 'recommended') {
    return NextResponse.json({ error: 'invalid_feed_type' }, { status: 400 });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
  const session = await getOptionalSession(request);

  try {
    return NextResponse.json(await listMoments({ feedType, session, limit }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'login_required' ? 401 : 500 });
  }
}
