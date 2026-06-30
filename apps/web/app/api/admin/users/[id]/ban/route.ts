/**
 * Admin User Ban/Unban API
 *
 * POST /api/admin/users/[id]/ban - Ban or unban a user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const banSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'users.ban');
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = banSchema.parse(body);

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.id === session.userId) {
      return NextResponse.json(
        { error: 'Cannot ban/unban yourself' },
        { status: 403 }
      );
    }

    if (targetUser.role === 'super_admin' || targetUser.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot ban a super admin' },
        { status: 403 }
      );
    }

    if (action === 'ban') {
      if (!reason) {
        return NextResponse.json(
          { error: 'Reason is required for ban' },
          { status: 400 }
        );
      }
      await db
        .update(users)
        .set({
          bannedAt: new Date(),
          bannedReason: reason,
        })
        .where(eq(users.id, id));
    } else {
      await db
        .update(users)
        .set({
          bannedAt: null,
          bannedReason: null,
        })
        .where(eq(users.id, id));
    }

    await createModerationLog({
      adminId: session.userId,
      entityType: 'user',
      entityId: id,
      action,
      reason: reason || `User ${action}ned`,
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
    console.error('Ban user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
