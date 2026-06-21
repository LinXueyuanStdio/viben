import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, publishedPages, publishedPageVersions } from '@/lib/db';
import { ensurePublishedPagesTable } from '@/lib/db/published-pages';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { and, desc, eq, sql } from 'drizzle-orm';

interface IconPayload {
  type: string;
  value: string;
}

function isIconPayload(value: unknown): value is IconPayload {
  if (!value || typeof value !== 'object') return false;
  const icon = value as Record<string, unknown>;
  return typeof icon.type === 'string' && typeof icon.value === 'string';
}

function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

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

    const { uid, title, icon, description, html } = body;

    if (typeof uid !== 'string' || !uid.trim() || typeof title !== 'string' || !title.trim() || typeof html !== 'string' || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: uid, title, html' },
        { status: 400 }
      );
    }

    if (icon !== undefined && icon !== null && !isIconPayload(icon)) {
      return NextResponse.json(
        { error: 'icon must be an object with string type and value' },
        { status: 400 }
      );
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description must be a string' },
        { status: 400 }
      );
    }

    await ensurePublishedPagesTable();

    await db
      .insert(publishedPages)
      .values({
        uid,
        userId: session.userId,
        title,
        icon: icon ?? null,
        description: description ?? null,
        html,
      })
      .onConflictDoUpdate({
        target: [publishedPages.userId, publishedPages.uid],
        set: {
          title,
          icon: icon ?? null,
          description: description ?? null,
          html,
          updatedAt: sql`now()`,
        },
      });

    const publishedPage = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.userId, session.userId),
        eq(publishedPages.uid, uid)
      ),
    });

    if (!publishedPage) {
      throw new Error('Published page was not found after upsert');
    }

    const latestVersion = await db.query.publishedPageVersions.findFirst({
      where: and(
        eq(publishedPageVersions.userId, session.userId),
        eq(publishedPageVersions.uid, uid)
      ),
      orderBy: [desc(publishedPageVersions.version)],
    });

    await db.insert(publishedPageVersions).values({
      publishedPageId: publishedPage.id,
      uid,
      userId: session.userId,
      version: (latestVersion?.version ?? 0) + 1,
      title,
      icon: icon ?? null,
      description: description ?? null,
      html,
    });

    return NextResponse.json({
      success: true,
      page_uid: uid,
      url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
      updated: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Publish page error:', error);
    return NextResponse.json(
      {
        error: 'Failed to publish page',
        details: getErrorDetails(error),
      },
      { status: 500 }
    );
  }
}
