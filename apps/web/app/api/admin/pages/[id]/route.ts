/**
 * Admin Pages [id] API
 *
 * GET /api/admin/pages/[id] - Get page detail for review
 * PATCH /api/admin/pages/[id] - Moderate a page (approve/reject/hide/unhide/reopen)
 * DELETE /api/admin/pages/[id] - Delete a page
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, publishedPages, users, pageSubscriptions, pageUpdateEvents } from '@/lib/db';
import { eq, count, desc } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import type { ModerationAction } from '@/lib/types/admin';
import { z } from 'zod';

const moderatePageSchema = z.object({
  moderation_status: z.enum(['approved', 'rejected', 'hidden', 'pending']),
  rejection_reason: z.string().max(500).optional(),
});

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'pages.review');

    const { id } = await params;

    const [page] = await db
      .select({
        id: publishedPages.id,
        uid: publishedPages.uid,
        userId: publishedPages.userId,
        title: publishedPages.title,
        description: publishedPages.description,
        html: publishedPages.html,
        coverUrl: publishedPages.coverUrl,
        visibility: publishedPages.visibility,
        moderationStatus: publishedPages.moderationStatus,
        publishedAt: publishedPages.publishedAt,
        lastPublishedAt: publishedPages.lastPublishedAt,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        commentCount: publishedPages.commentCount,
        tags: publishedPages.tags,
        categoryId: publishedPages.categoryId,
        authorDisplayName: publishedPages.authorDisplayName,
        authorAvatarUrl: publishedPages.authorAvatarUrl,
        authorUsername: users.username,
        authorEmail: users.email,
      })
      .from(publishedPages)
      .leftJoin(users, eq(users.id, publishedPages.userId))
      .where(eq(publishedPages.id, id));

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Fetch subscriber count
    const [subCount] = await db
      .select({ value: count() })
      .from(pageSubscriptions)
      .where(eq(pageSubscriptions.publishedPageId, id));

    const subscriberCount = subCount?.value ?? 0;

    // Fetch last 10 update events
    const updateEvents = await db
      .select({
        version: pageUpdateEvents.version,
        eventType: pageUpdateEvents.eventType,
        importance: pageUpdateEvents.importance,
        title: pageUpdateEvents.title,
        changeSummary: pageUpdateEvents.changeSummary,
        createdAt: pageUpdateEvents.createdAt,
      })
      .from(pageUpdateEvents)
      .where(eq(pageUpdateEvents.publishedPageId, id))
      .orderBy(desc(pageUpdateEvents.createdAt))
      .limit(10);

    return NextResponse.json({ page, subscriberCount, updateEvents });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get page detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'pages.review');

    const { id } = await params;
    const body = await request.json();
    const data = moderatePageSchema.parse(body);

    const session = await getSession();

    await db
      .update(publishedPages)
      .set({
        moderationStatus: data.moderation_status,
      })
      .where(eq(publishedPages.id, id));

    // Log the moderation action
    if (session?.userId) {
      const actionMap: Partial<Record<string, ModerationAction>> = {
        approved: 'approve',
        rejected: 'reject',
        hidden: 'hide',
        // 'pending' (reopen) has no corresponding ModerationAction, skip logging
      };
      const action = actionMap[data.moderation_status];
      if (action) {
        await createModerationLog({
          adminId: session.userId,
          entityType: 'published_page',
          entityId: id,
          action,
          reason: data.rejection_reason || `Page ${data.moderation_status}`,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Moderate page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'pages.review');

    const { id } = await params;

    const [page] = await db
      .select({ id: publishedPages.id, title: publishedPages.title })
      .from(publishedPages)
      .where(eq(publishedPages.id, id));

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    await db.delete(publishedPages).where(eq(publishedPages.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'published_page',
      entityId: id,
      action: 'delete',
      reason: `Deleted page: ${page.title}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
