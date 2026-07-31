/**
 * Admin Comments Batch API
 *
 * POST /api/admin/comments/batch - Batch delete comments
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, comments } from '@/lib/db';
import { inArray } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const batchCommentsSchema = z.object({
  action: z.enum(['delete']),
  ids: z.array(z.string().min(1)).min(1).max(100),
});

/** @ignore */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, 'content.moderate');

    const body = await request.json();
    const { action, ids } = batchCommentsSchema.parse(body);

    const errors: { id: string; error: string }[] = [];
    let affected = 0;

    if (action === 'delete') {
      // Verify all comments exist first
      const existingComments = await db
        .select({ id: comments.id })
        .from(comments)
        .where(inArray(comments.id, ids));

      const existingIds = new Set(existingComments.map((c) => c.id));

      for (const id of ids) {
        if (!existingIds.has(id)) {
          errors.push({ id, error: 'Comment not found' });
          continue;
        }
      }

      // Delete all existing comments
      if (existingIds.size > 0) {
        await db.delete(comments).where(inArray(comments.id, [...existingIds]));
        affected = existingIds.size;

        // Create moderation log for batch
        await createModerationLog({
          adminId: session.userId,
          entityType: 'comment',
          entityId: ids.join(','),
          action: 'delete',
          reason: `Batch deleted ${affected} comments`,
        });
      }
    }

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
    console.error('Batch comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
