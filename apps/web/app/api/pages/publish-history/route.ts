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

    const publishedPage = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.userId, session.userId),
        eq(publishedPages.uid, uid)
      ),
    });

    if (!publishedPage) {
      return NextResponse.json(
        { success: false, error: 'Published page not found' },
        { status: 404 }
      );
    }

    const records = await db.query.publishedPageRecords.findMany({
      where: and(
        eq(publishedPageRecords.userId, session.userId),
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
        url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}/versions/${record.version}`,
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
