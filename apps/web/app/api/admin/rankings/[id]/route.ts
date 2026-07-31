/**
 * Admin Rankings [id] API
 *
 * GET /api/admin/rankings/[id] - Get snapshot detail with items
 * DELETE /api/admin/rankings/[id] - Delete a ranking snapshot
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, rankingSnapshots, rankingItems } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'rankings.view');

    const { id } = await params;

    const [snapshot] = await db
      .select()
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.id, id));

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(rankingItems)
      .where(eq(rankingItems.snapshotId, id))
      .orderBy(asc(rankingItems.rank));

    return NextResponse.json({ snapshot, items });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get ranking detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'rankings.manage');

    const { id } = await params;

    const [snapshot] = await db
      .select({ id: rankingSnapshots.id })
      .from(rankingSnapshots)
      .where(eq(rankingSnapshots.id, id));

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    // Delete items first (FK has ON DELETE CASCADE, but explicit is safer for DB compatibility)
    await db.delete(rankingItems).where(eq(rankingItems.snapshotId, id));
    await db.delete(rankingSnapshots).where(eq(rankingSnapshots.id, id));

    return NextResponse.json({ success: true, message: 'Snapshot deleted' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete ranking snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
