import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOptionalSession } from '@/lib/auth/middleware';
import {
  canReadPage,
  createShareLink,
  getPublishedPageContext,
} from '@/lib/services/community';

/**
 * 创建分享链接
 * @summary 创建分享链接
 * @description 为已发布页面创建分享链接，支持指定分享渠道（默认 copy_link）。需要页面可读权限，通过 getOptionalSession 获取可选的用户会话。页面不可分享或无权限时返回 403。成功后返回 `{ share_link }`。
 * @body CreateShareBody
 * @response 200:SuccessResponse:返回生成的分享链接
 * @response 400:ErrorResponse:参数无效
 * @response 403:ErrorResponse:页面不可分享或权限不足
 * @tag Community
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession(request);
  const body = await request.json();

  if (
    body.entity_type !== 'published_page' ||
    typeof body.user_slug !== 'string' ||
    typeof body.page_id !== 'string'
  ) {
    return NextResponse.json(
      { error: { code: 'invalid_input', message: 'Invalid share payload' } },
      { status: 400 }
    );
  }

  const context = await getPublishedPageContext(body.user_slug, body.page_id);
  if (!context || !canReadPage(context.page, session)) {
    return NextResponse.json(
      { error: { code: 'permission_denied', message: 'Page is not shareable' } },
      { status: 403 }
    );
  }

  try {
    return NextResponse.json({
      share_link: await createShareLink({
        context,
        session,
        channel: typeof body.channel === 'string' ? body.channel : 'copy_link',
      }),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: { code, message: code } }, { status: 400 });
  }
}
