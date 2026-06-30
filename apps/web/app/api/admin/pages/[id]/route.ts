/**
 * Admin Pages [id] API
 *
 * GET /api/admin/pages/[id] - Get page detail for review
 * PATCH /api/admin/pages/[id] - Moderate a page (approve/reject/hide)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, publishedPages, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const moderatePageSchema = z.object({
  moderation_status: z.enum(['approved', 'rejected', 'hidden']),
  rejection_reason: z.string().max(500).optional(),
});

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
        authorName: publishedPages.authorName,
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

    return NextResponse.json({ page });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get page detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
      const actionMap: Record<string, 'approve' | 'reject' | 'delete'> = {
        approved: 'approve',
        rejected: 'reject',
        hidden: 'delete',
      };
      await createModerationLog({
        adminId: session.userId,
        entityType: 'collection', // Using existing enum value - treating published_page as collection for logging
        entityId: id,
        action: actionMap[data.moderation_status] || 'reject',
        reason: data.rejection_reason || `Page ${data.moderation_status}`,
      });
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
