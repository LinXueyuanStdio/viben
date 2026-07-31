/**
 * Admin Notifications [id] API
 *
 * DELETE /api/admin/notifications/[id] - Delete a notification
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, notifications } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.delete');
    const { id } = await params;

    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await db.delete(notifications).where(eq(notifications.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'notification',
      entityId: id,
      action: 'delete',
      reason: `Deleted notification of type "${notification.type}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
