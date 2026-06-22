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

    const publishedVersion = await db.query.publishedPageVersions.findFirst({
      where: and(
        eq(publishedPageVersions.userId, session.userId),
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
