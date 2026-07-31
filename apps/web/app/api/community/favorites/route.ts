import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { listCommunityBookmarks } from '@/lib/services/community';

function toLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

/**
 * 获取收藏列表
 * @summary 获取收藏列表
 * @description 获取当前用户的所有收藏内容，支持按实体类型（published_page / moment）过滤和游标分页。需通过 requireAuth 中间件登录。limit 默认 30，最大 100。
 * @params CommunityBookmarksQuery
 * @response 200:BookmarkListResponse:收藏列表数据
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Community
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const rawEntityType = searchParams.get('entity_type');
    const entityType =
      rawEntityType === 'published_page' || rawEntityType === 'moment'
        ? rawEntityType
        : undefined;

    return NextResponse.json(
      await listCommunityBookmarks({
        session,
        entityType,
        limit: toLimit(searchParams.get('limit'), 30, 100),
        cursor: searchParams.get('cursor'),
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'internal_error' } },
      { status: 500 }
    );
  }
}
