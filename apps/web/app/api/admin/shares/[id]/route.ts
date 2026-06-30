/**
 * Admin Share Revoke API
 *
 * PATCH /api/admin/shares/[id] - Revoke a share link (set revokedAt)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, shareLinks } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

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
      entityType: 'share_link',
      entityId: id,
      action: 'revoke',
      reason: 'Administrative revocation',
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
