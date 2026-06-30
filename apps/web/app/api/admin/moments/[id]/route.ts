/**
 * Admin Moments [id] API
 *
 * GET /api/admin/moments/[id] - Get moment detail
 * PATCH /api/admin/moments/[id] - Hide/unhide a moment
 * DELETE /api/admin/moments/[id] - Soft-delete a moment
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, moments, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'moments.moderate');
    const { id } = await params;

    const [moment] = await db
      .select({
        id: moments.id,
        uid: moments.uid,
        kind: moments.kind,
        body: moments.body,
        bodyFormat: moments.bodyFormat,
        visibility: moments.visibility,
        likeCount: moments.likeCount,
        commentCount: moments.commentCount,
        repostCount: moments.repostCount,
        viewCount: moments.viewCount,
        isPinned: moments.isPinned,
        isDeleted: moments.isDeleted,
        createdAt: moments.createdAt,
        updatedAt: moments.updatedAt,
        authorId: moments.authorUserId,
        authorName: users.displayName,
        authorUsername: users.username,
      })
      .from(moments)
      .leftJoin(users, eq(users.id, moments.authorUserId))
      .where(eq(moments.id, id));

    if (!moment) {
      return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
    }

    return NextResponse.json({ moment });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get moment detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateMomentSchema = z.object({
  action: z.enum(['hide', 'unhide', 'delete']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'moments.moderate');
    const { id } = await params;
    const body = await request.json();
    const { action } = updateMomentSchema.parse(body);

    if (action === 'delete') {
      await db
        .update(moments)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(moments.id, id));
    } else if (action === 'hide') {
      await db
        .update(moments)
        .set({ visibility: 'private' })
        .where(eq(moments.id, id));
    } else if (action === 'unhide') {
      await db
        .update(moments)
        .set({ visibility: 'public' })
        .where(eq(moments.id, id));
    }

    await createModerationLog({
      adminId: session.userId,
      entityType: 'moment',
      entityId: id,
      action: action === 'delete' ? 'delete' : action === 'hide' ? 'hide' : 'unhide',
      reason: `Moment ${action}d`,
    });

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
    console.error('Update moment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.delete');
    const { id } = await params;

    await db
      .update(moments)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(moments.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'moment',
      entityId: id,
      action: 'delete',
      reason: 'Moment deleted by admin',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete moment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
