/**
 * Admin Moments [id] API
 *
 * GET /api/admin/moments/[id] - Get moment detail (with attachments and repost chain)
 * PATCH /api/admin/moments/[id] - Hide/unhide/toggle_pin/delete a moment
 * DELETE /api/admin/moments/[id] - Soft-delete a moment (or hard delete with ?force=true)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, moments, users, momentAttachments, reposts } from '@/lib/db';
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
        attachmentCount: moments.attachmentCount,
        viewCount: moments.viewCount,
        isPinned: moments.isPinned,
        isDeleted: moments.isDeleted,
        createdAt: moments.createdAt,
        updatedAt: moments.updatedAt,
        repostOfMomentId: moments.repostOfMomentId,
        replyToMomentId: moments.replyToMomentId,
        authorId: moments.authorUserId,
        authorDisplayName: users.displayName,
        authorUsername: users.username,
      })
      .from(moments)
      .leftJoin(users, eq(users.id, moments.authorUserId))
      .where(eq(moments.id, id));

    if (!moment) {
      return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
    }

    // Fetch attachments
    const attachments = await db
      .select()
      .from(momentAttachments)
      .where(eq(momentAttachments.momentId, id))
      .orderBy(momentAttachments.sortOrder);

    // Fetch repost chain data
    let sourceRepost: Record<string, unknown> | null = null;
    let repostChain: Record<string, unknown>[] = [];

    // If this moment is a repost, find the source repost record and original moment
    if (moment.kind === 'repost' || moment.repostOfMomentId) {
      const repostRecords = await db
        .select({
          repost: {
            id: reposts.id,
            entityType: reposts.entityType,
            entityId: reposts.entityId,
            userId: reposts.userId,
            momentId: reposts.momentId,
            comment: reposts.comment,
            visibility: reposts.visibility,
            status: reposts.status,
            failureReason: reposts.failureReason,
            createdAt: reposts.createdAt,
          },
          reposterName: users.displayName,
          reposterUsername: users.username,
        })
        .from(reposts)
        .leftJoin(users, eq(users.id, reposts.userId))
        .where(eq(reposts.momentId, id));

      if (repostRecords.length > 0) {
        sourceRepost = repostRecords[0];
      }
    }

    // Find reposts that reference this moment (other moments that reposted this one)
    if (moment.repostOfMomentId) {
      // This moment is a repost of another moment - find the original
      const [originalMoment] = await db
        .select({
          id: moments.id,
          uid: moments.uid,
          kind: moments.kind,
          body: moments.body,
          visibility: moments.visibility,
          createdAt: moments.createdAt,
          authorId: moments.authorUserId,
          authorDisplayName: users.displayName,
          authorUsername: users.username,
        })
        .from(moments)
        .leftJoin(users, eq(users.id, moments.authorUserId))
        .where(eq(moments.id, moment.repostOfMomentId));

      if (originalMoment) {
        repostChain.push({ direction: 'upstream', moment: originalMoment });
      }
    }

    // Find downstream reposts (moments that reposted this one)
    const downstreamMoments = await db
      .select({
        id: moments.id,
        uid: moments.uid,
        kind: moments.kind,
        body: moments.body,
        visibility: moments.visibility,
        createdAt: moments.createdAt,
        repostCount: moments.repostCount,
        authorId: moments.authorUserId,
        authorDisplayName: users.displayName,
        authorUsername: users.username,
      })
      .from(moments)
      .leftJoin(users, eq(users.id, moments.authorUserId))
      .where(eq(moments.repostOfMomentId, id))
      .orderBy(moments.createdAt);

    for (const dm of downstreamMoments) {
      repostChain.push({ direction: 'downstream', moment: dm });
    }

    return NextResponse.json({ moment, attachments, sourceRepost, repostChain });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get moment detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateMomentSchema = z.object({
  action: z.enum(['hide', 'unhide', 'delete', 'toggle_pin']),
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
    } else if (action === 'toggle_pin') {
      // Toggle isPinned: fetch current value first, then flip
      const [current] = await db
        .select({ isPinned: moments.isPinned })
        .from(moments)
        .where(eq(moments.id, id));
      if (!current) {
        return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
      }
      await db
        .update(moments)
        .set({ isPinned: !current.isPinned })
        .where(eq(moments.id, id));
    }

    await createModerationLog({
      adminId: session.userId,
      entityType: 'moment',
      entityId: id,
      action: action === 'delete' ? 'delete' : action === 'hide' ? 'hide' : action === 'unhide' ? 'unhide' : 'feature',
      reason: `Moment ${action === 'toggle_pin' ? 'pin toggled' : `${action}d`}`,
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

    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get('force') === 'true' || searchParams.get('force') === '1';

    if (force) {
      // Hard delete: remove the moment row (cascades to attachments and topic items)
      // Clean up reposts referencing this moment
      await db.delete(reposts).where(eq(reposts.momentId, id));
      // Clean up other moments that reposted this one
      await db
        .update(moments)
        .set({ repostOfMomentId: null })
        .where(eq(moments.repostOfMomentId, id));
      // Delete the moment itself
      await db.delete(moments).where(eq(moments.id, id));
    } else {
      // Soft delete
      await db
        .update(moments)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(eq(moments.id, id));
    }

    await createModerationLog({
      adminId: session.userId,
      entityType: 'moment',
      entityId: id,
      action: 'delete',
      reason: force ? 'Moment permanently deleted by admin' : 'Moment deleted by admin',
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
