/**
 * Admin Rating Delete API
 *
 * DELETE /api/admin/ratings/[id] - Delete a rating
 * The [id] param is encoded as "userId__entityType__entityId" since ratings uses a composite primary key.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, ratings } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.moderate');
    const { id } = await params;

    // Decode composite key: userId__entityType__entityId
    const parts = id.split('__');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid rating identifier' }, { status: 400 });
    }

    const [userId, entityType, entityId] = parts;

    const rating = await db.query.ratings.findFirst({
      where: and(
        eq(ratings.userId, userId),
        eq(ratings.entityType, entityType as 'mcp' | 'skill'),
        eq(ratings.entityId, entityId)
      ),
    });

    if (!rating) {
      return NextResponse.json({ error: 'Rating not found' }, { status: 404 });
    }

    await db
      .delete(ratings)
      .where(
        and(
          eq(ratings.userId, userId),
          eq(ratings.entityType, entityType as 'mcp' | 'skill'),
          eq(ratings.entityId, entityId)
        )
      );

    await createModerationLog({
      adminId: session.userId,
      entityType: entityType as 'mcp' | 'skill',
      entityId,
      action: 'delete',
      reason: `Removed rating (score: ${rating.score}) by user ${userId}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete rating error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
