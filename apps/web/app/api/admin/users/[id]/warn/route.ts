/**
 * Admin User Warn API
 *
 * POST /api/admin/users/[id]/warn - Send a warning to a user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const warnSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'users.warn');
    const { id } = await params;
    const body = await request.json();
    const { reason } = warnSchema.parse(body);

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.id === session.userId) {
      return NextResponse.json(
        { error: 'Cannot warn yourself' },
        { status: 403 }
      );
    }

    // Prevent warning super_admin and admin (legacy equivalent)
    if (targetUser.role === 'super_admin' || targetUser.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot warn a super admin' },
        { status: 403 }
      );
    }

    await db
      .update(users)
      .set({
        warnedAt: new Date(),
        warnedReason: reason,
      })
      .where(eq(users.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'user',
      entityId: id,
      action: 'warn',
      reason,
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
    console.error('Warn user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
