/**
 * Admin Share [id] API
 *
 * GET /api/admin/shares/[id] - Get share link detail (with creator info)
 * PATCH /api/admin/shares/[id] - Revoke a share link (set revokedAt)
 * DELETE /api/admin/shares/[id] - Hard delete a share link
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, shareLinks, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'content.moderate');
    const { id } = await params;

    const [share] = await db
      .select({
        id: shareLinks.id,
        uid: shareLinks.uid,
        entityType: shareLinks.entityType,
        entityId: shareLinks.entityId,
        visibilitySnapshot: shareLinks.visibilitySnapshot,
        channel: shareLinks.channel,
        targetUrl: shareLinks.targetUrl,
        htmlDirectUrl: shareLinks.htmlDirectUrl,
        expiresAt: shareLinks.expiresAt,
        revokedAt: shareLinks.revokedAt,
        openCount: shareLinks.openCount,
        uniqueOpenCount: shareLinks.uniqueOpenCount,
        createdAt: shareLinks.createdAt,
        updatedAt: shareLinks.updatedAt,
        createdByUserId: shareLinks.createdByUserId,
        createdByUsername: users.username,
        createdByDisplayName: users.displayName,
      })
      .from(shareLinks)
      .leftJoin(users, eq(shareLinks.createdByUserId, users.id))
      .where(eq(shareLinks.id, id));

    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const status: 'active' | 'expired' | 'revoked' = share.revokedAt
      ? 'revoked'
      : share.expiresAt && new Date(share.expiresAt) <= new Date()
        ? 'expired'
        : 'active';

    return NextResponse.json({
      id: share.id,
      uid: share.uid,
      entityType: share.entityType,
      entityId: share.entityId,
      visibilitySnapshot: share.visibilitySnapshot,
      channel: share.channel,
      targetUrl: share.targetUrl,
      htmlDirectUrl: share.htmlDirectUrl,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      openCount: share.openCount,
      uniqueOpenCount: share.uniqueOpenCount,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
      status,
      createdBy: share.createdByUserId
        ? {
            userId: share.createdByUserId,
            username: share.createdByUsername,
            displayName: share.createdByDisplayName,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get share link detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.moderate');
    const { id } = await params;

    const shareLink = await db.query.shareLinks.findFirst({
      where: eq(shareLinks.id, id),
    });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    if (shareLink.revokedAt) {
      return NextResponse.json({ error: 'Share link already revoked' }, { status: 409 });
    }

    const now = new Date();
    await db
      .update(shareLinks)
      .set({ revokedAt: now, updatedAt: now })
      .where(eq(shareLinks.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'share',
      entityId: id,
      action: 'revoke',
      reason: 'Share link revoked by admin',
    });

    return NextResponse.json({
      success: true,
      revokedAt: now.toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Revoke share link error:', error);
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

    const shareLink = await db.query.shareLinks.findFirst({
      where: eq(shareLinks.id, id),
    });

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    await db.delete(shareLinks).where(eq(shareLinks.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'share',
      entityId: id,
      action: 'delete',
      reason: 'Share link permanently deleted by admin',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete share link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
