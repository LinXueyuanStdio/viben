import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { getBrowseHistory } from '@/lib/services/community';

/**
 * 获取浏览历史
 * @summary 获取浏览历史
 * @description 获取当前用户的浏览历史记录，支持游标分页。需通过 requireAuth 中间件登录。limit 参数需为正整数，默认 30，最大 100。
 * @params CommunityHistoryQuery
 * @response 200:BrowseHistoryResponse:浏览历史列表
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Community
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
    const cursor = request.nextUrl.searchParams.get('cursor');

    return NextResponse.json(await getBrowseHistory(session, limit, cursor));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
