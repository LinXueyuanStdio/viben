/**
 * Admin Feedbacks [id] API
 *
 * GET /api/admin/feedbacks/[id] - Get feedback detail
 * DELETE /api/admin/feedbacks/[id] - Delete a feedback
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, feedbacks, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'feedbacks.view');
    const { id } = await params;

    const [feedback] = await db
      .select({
        id: feedbacks.id,
        pageId: feedbacks.pageId,
        category: feedbacks.category,
        rating: feedbacks.rating,
        content: feedbacks.content,
        createdAt: feedbacks.createdAt,
        reporterId: feedbacks.reporterId,
        reporterName: users.username,
        reporterDisplayName: users.displayName,
      })
      .from(feedbacks)
      .leftJoin(users, eq(users.id, feedbacks.reporterId))
      .where(eq(feedbacks.id, id));

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get feedback detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'feedbacks.resolve');
    const { id } = await params;

    const feedback = await db.query.feedbacks.findFirst({
      where: eq(feedbacks.id, id),
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    await db.delete(feedbacks).where(eq(feedbacks.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'feedback',
      entityId: id,
      action: 'delete',
      reason: `Deleted feedback: ${feedback.content.slice(0, 100)}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
