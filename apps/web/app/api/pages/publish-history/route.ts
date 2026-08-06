import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db, publishedPageRecords, publishedPages } from '@/lib/db';
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
 * 获取页面发布历史
 * @summary 获取页面发布历史记录
 * @description 根据页面 uid 查询用户已发布页面的所有历史版本记录，需登录。响应包含 page_uid、current_version、records（版本记录列表，含标题、图标、描述、是否当前版本等）
 * @body PublishHistoryBody
 * @response 200:PublishHistoryResponse:发布历史列表
 * @response 400:ErrorResponse:缺少 uid 参数
 * @response 404:ErrorResponse:发布页面不存在
 * @responseSet auth
 * @auth bearer
 * @tag Pages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { uid } = body;

    if (typeof uid !== 'string' || !uid.trim()) {
      return NextResponse.json(
        { success: false, error: 'uid is required' },
        { status: 400 }
      );
    }

    await ensurePublishedPagesTable();

    const { findEditablePage } = await import("@/lib/db/page-auth");
    const publishedPage = await findEditablePage(uid, session.userId);

    if (!publishedPage) {
      return NextResponse.json(
        { success: false, error: 'Published page not found' },
        { status: 404 }
      );
    }

    const records = await db.query.publishedPageRecords.findMany({
      where: and(
        eq(publishedPageRecords.userId, publishedPage.userId),
        eq(publishedPageRecords.uid, uid)
      ),
      orderBy: [desc(publishedPageRecords.recordNumber)],
    });

    return NextResponse.json({
      success: true,
      page_uid: uid,
      current_version: publishedPage.currentVersion,
      records: records.map((record) => ({
        id: record.id,
        record_number: record.recordNumber,
        version: record.version,
        action: record.action,
        title: record.title,
        icon: record.icon,
        description: record.description,
        created_at: toIsoString(record.createdAt),
        is_current: record.version === publishedPage.currentVersion,
        url: `/page/${encodeURIComponent(publishedPage.authorSlug)}/${encodeURIComponent(uid)}/versions/${record.version}`,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('Publish history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load publish history',
        details: getErrorDetails(error),
      },
      { status: 500 }
    );
  }
}
