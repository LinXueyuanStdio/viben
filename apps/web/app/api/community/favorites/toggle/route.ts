import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { toggleBookmark } from '@/lib/services/community';

/**
 * 切换收藏状态
 * @summary 切换收藏状态
 * @description 对指定实体（published_page / moment）添加或移除收藏，返回当前收藏状态。需通过 requireAuth 中间件登录。实体类型和实体 ID 在请求体中通过 Zod 验证。
 * @body ToggleBookmarkBody
 * @response 200:SuccessResponse:切换成功，返回当前收藏状态
 * @response 400:ErrorResponse:参数无效
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Community
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (
      (body.entity_type !== 'published_page' && body.entity_type !== 'moment') ||
      typeof body.entity_id !== 'string'
    ) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Invalid bookmark payload' } },
        { status: 400 }
      );
    }

    const result = await toggleBookmark({
      entityType: body.entity_type,
      entityId: body.entity_id,
      session,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }

    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: { code, message: code } }, { status: 400 });
  }
}
