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

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${session.userId}), hashtext(${uid}))`);

      const publishedPage = await tx.query.publishedPages.findFirst({
        where: and(
          eq(publishedPages.userId, session.userId),
          eq(publishedPages.uid, uid)
        ),
      });

      if (!publishedPage) {
        return {
          status: 404,
          body: { success: false, error: 'Published page not found' },
        };
      }

      if (publishedPage.currentVersion === version) {
        return {
          status: 400,
          body: { success: false, error: 'Selected version is already current' },
        };
      }

      const publishedVersion = await tx.query.publishedPageVersions.findFirst({
        where: and(
          eq(publishedPageVersions.userId, session.userId),
          eq(publishedPageVersions.uid, uid),
          eq(publishedPageVersions.version, version)
        ),
      });

      if (!publishedVersion) {
        return {
          status: 404,
          body: { success: false, error: 'Published page version not found' },
        };
      }

      await tx
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
            eq(publishedPages.userId, session.userId),
            eq(publishedPages.uid, uid)
          )
        );

      const latestRecord = await tx.query.publishedPageRecords.findFirst({
        where: and(
          eq(publishedPageRecords.userId, session.userId),
          eq(publishedPageRecords.uid, uid)
        ),
        orderBy: [desc(publishedPageRecords.recordNumber)],
      });

      await tx.insert(publishedPageRecords).values({
        publishedPageId: publishedPage.id,
        uid,
        userId: session.userId,
        recordNumber: (latestRecord?.recordNumber ?? 0) + 1,
        version: publishedVersion.version,
        action: 'rollback',
        title: publishedVersion.title,
        icon: publishedVersion.icon,
        description: publishedVersion.description,
      });

      return {
        status: 200,
        body: {
          success: true,
          page_uid: uid,
          version: publishedVersion.version,
          url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
        },
      };
    });

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
