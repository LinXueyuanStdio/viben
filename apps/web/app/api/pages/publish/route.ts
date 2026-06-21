import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, publishedPages } from '@/lib/db';
import { ensurePublishedPagesTable } from '@/lib/db/published-pages';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { and, eq } from 'drizzle-orm';

interface IconPayload {
  type: string;
  value: string;
}

function isIconPayload(value: unknown): value is IconPayload {
  if (!value || typeof value !== 'object') return false;
  const icon = value as Record<string, unknown>;
  return typeof icon.type === 'string' && typeof icon.value === 'string';
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

    // Upsert: update if uid exists for this user, otherwise insert
    const existing = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.userId, session.userId),
        eq(publishedPages.uid, uid)
      ),
    });

    if (existing) {
      await db
        .update(publishedPages)
        .set({
          title,
          icon: icon ?? null,
          description: description ?? null,
          html,
        })
        .where(eq(publishedPages.id, existing.id));

      return NextResponse.json({
        success: true,
        page_uid: uid,
        url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
        updated: true,
      });
    }

    // Insert new
    await db.insert(publishedPages).values({
      uid,
      userId: session.userId,
      title,
      icon: icon ?? null,
      description: description ?? null,
      html,
    });

    return NextResponse.json({
      success: true,
      page_uid: uid,
      url: `/page/${encodeURIComponent(session.userSlug)}/${encodeURIComponent(uid)}`,
      updated: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Publish page error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
