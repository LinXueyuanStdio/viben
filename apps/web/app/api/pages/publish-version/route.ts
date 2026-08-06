import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db, publishedPageVersions } from '@/lib/db';
import { ensurePublishedPagesTable } from '@/lib/db/published-pages';

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return undefined;
  }
}

/**
 * 获取发布版本详情
 * @summary 获取指定版本的页面内容
 * @description 根据页面 uid 和版本号查询已发布页面的特定版本完整内容，需登录。响应包含 title、icon、description、html、created_at 等完整字段
 * @body PublishVersionBody
 * @response 200:PublishVersionResponse:发布版本详情（含 HTML 内容）
 * @response 400:ErrorResponse:缺少参数或参数格式错误
 * @response 404:ErrorResponse:发布版本不存在
 * @responseSet auth
 * @auth bearer
 * @tag Pages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { uid, version } = body;

    if (typeof uid !== 'string' || !uid.trim() || !Number.isInteger(version) || version < 1) {
      return NextResponse.json(
        { success: false, error: 'uid and version are required' },
        { status: 400 }
      );
    }

    await ensurePublishedPagesTable();

    const { findEditablePage } = await import("@/lib/db/page-auth");
    const page = await findEditablePage(uid, session.userId);
    if (!page) {
      return NextResponse.json(
        { success: false, error: 'Published page not found' },
        { status: 404 }
      );
    }

    const publishedVersion = await db.query.publishedPageVersions.findFirst({
      where: and(
        eq(publishedPageVersions.userId, page.userId),
        eq(publishedPageVersions.uid, uid),
        eq(publishedPageVersions.version, version)
      ),
    });

    if (!publishedVersion) {
      return NextResponse.json(
        { success: false, error: 'Published page version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      page_uid: uid,
      version: publishedVersion.version,
      title: publishedVersion.title,
      icon: publishedVersion.icon,
      description: publishedVersion.description,
      html: publishedVersion.html,
      created_at: toIsoString(publishedVersion.createdAt),
      url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}/versions/${publishedVersion.version}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('Publish version error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load publish version',
        details: getErrorDetails(error),
      },
      { status: 500 }
    );
  }
}
