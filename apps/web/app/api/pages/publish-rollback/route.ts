import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db, publishedPageRecords, publishedPages, publishedPageVersions } from '@/lib/db';
import { ensurePublishedPagesTable } from '@/lib/db/published-pages';

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
 * 回滚发布页面
 * @summary 回滚页面到历史版本
 * @description 将已发布页面回滚到指定历史版本，需登录。回滚到当前版本返回 400，页面或版本不存在返回 404。成功返回 page_uid、version、url
 * @body PublishRollbackBody
 * @response 200:PublishRollbackResponse:回滚成功，返回页面信息和版本号
 * @response 400:ErrorResponse:参数无效或已是当前版本
 * @response 404:ErrorResponse:页面或版本不存在
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
    const publishedPage = await findEditablePage(uid, session.userId);

    let result: { status: number; body: Record<string, unknown> };

    if (!publishedPage) {
      result = {
        status: 404,
        body: { success: false, error: 'Published page not found' },
      };
    } else if (publishedPage.currentVersion === version) {
      result = {
        status: 400,
        body: { success: false, error: 'Selected version is already current' },
      };
    } else {
      const publishedVersion = await db.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, publishedPage.userId),
          eq(publishedPageVersions.uid, uid),
          eq(publishedPageVersions.version, version)
        ),
      });

      if (!publishedVersion) {
        result = {
          status: 404,
          body: { success: false, error: 'Published page version not found' },
        };
      } else {
        await db
          .update(publishedPages)
          .set({
            title: publishedVersion.title,
            icon: publishedVersion.icon,
            description: publishedVersion.description,
            html: publishedVersion.html,
            currentVersion: publishedVersion.version,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(publishedPages.userId, publishedPage.userId),
              eq(publishedPages.uid, uid)
            )
          );

        const latestRecord = await db.query.publishedPageRecords.findFirst({
          where: and(
            eq(publishedPageRecords.userId, publishedPage.userId),
            eq(publishedPageRecords.uid, uid)
          ),
          orderBy: [desc(publishedPageRecords.recordNumber)],
        });

        await db.insert(publishedPageRecords).values({
          publishedPageId: publishedPage.id,
          uid,
          userId: publishedPage.userId,
          recordNumber: (latestRecord?.recordNumber ?? 0) + 1,
          version: publishedVersion.version,
          action: 'rollback',
          title: publishedVersion.title,
          icon: publishedVersion.icon,
          description: publishedVersion.description,
        });

        result = {
          status: 200,
          body: {
            success: true,
            page_uid: uid,
            version: publishedVersion.version,
            url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
          },
        };
      }
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('Publish rollback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to rollback published page',
        details: getErrorDetails(error),
      },
      { status: 500 }
    );
  }
}
