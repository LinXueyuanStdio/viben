/**
 * Admin Media Asset Delete API
 *
 * DELETE /api/admin/media/[id] - Delete a media asset
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, mediaAssets } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.moderate');
    const { id } = await params;

    const asset = await db.query.mediaAssets.findFirst({
      where: eq(mediaAssets.id, id),
    });

    if (!asset) {
      return NextResponse.json({ error: 'Media asset not found' }, { status: 404 });
    }

    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'media_asset' as const,
      entityId: id,
      action: 'delete',
      reason: `Deleted media asset of kind "${asset.kind}" from source "${asset.source}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete media asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
