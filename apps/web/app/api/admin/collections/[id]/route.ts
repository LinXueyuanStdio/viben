/**
 * Admin Collection Delete API
 *
 * DELETE /api/admin/collections/[id] - Delete a collection
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, collections } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.delete');
    const { id } = await params;

    const collection = await db.query.collections.findFirst({
      where: eq(collections.id, id),
    });

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    await db.delete(collections).where(eq(collections.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'collection',
      entityId: id,
      action: 'delete',
      reason: `Deleted collection: ${collection.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete collection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
