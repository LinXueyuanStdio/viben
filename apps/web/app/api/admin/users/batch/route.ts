/**
 * Admin Users Batch API
 *
 * POST /api/admin/users/batch - Batch ban/unban/delete users
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const batchUsersSchema = z.object({
  action: z.enum(['ban', 'unban', 'delete']),
  ids: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, 'users.ban');

    const body = await request.json();
    const { action, ids, reason } = batchUsersSchema.parse(body);

    if (action === 'ban' && !reason) {
      return NextResponse.json(
        { error: 'Reason is required for ban action' },
        { status: 400 }
      );
    }

    const errors: { id: string; error: string }[] = [];
    let affected = 0;

    // Fetch target users
    const targetUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.id, ids));

    const targetMap = new Map(targetUsers.map((u) => [u.id, u]));

    for (const id of ids) {
      try {
        const targetUser = targetMap.get(id);
        if (!targetUser) {
          errors.push({ id, error: 'User not found' });
          continue;
        }

        if (targetUser.id === session.userId) {
          errors.push({ id, error: 'Cannot perform action on yourself' });
          continue;
        }

        if (targetUser.role === 'super_admin') {
          errors.push({ id, error: 'Cannot perform action on super admin' });
          continue;
        }

        if (action === 'ban') {
          await db
            .update(users)
            .set({
              bannedAt: new Date(),
              bannedReason: reason ?? null,
            })
            .where(eq(users.id, id));
        } else if (action === 'unban') {
          await db
            .update(users)
            .set({
              bannedAt: null,
              bannedReason: null,
            })
            .where(eq(users.id, id));
        } else if (action === 'delete') {
          await db.delete(users).where(eq(users.id, id));
        }

        affected++;
      } catch (err) {
        errors.push({
          id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Create moderation log for batch
    await createModerationLog({
      adminId: session.userId,
      entityType: 'user',
      entityId: ids.join(','),
      action,
      reason: reason ?? `Batch ${action} ${affected} users`,
    });

    return NextResponse.json({
      success: errors.length === 0,
      affected,
      errors: errors.length > 0 ? errors : undefined,
    });
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
    console.error('Batch users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
