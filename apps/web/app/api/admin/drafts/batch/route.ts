/**
 * Admin Drafts Batch API
 *
 * POST /api/admin/drafts/batch - Batch delete drafts
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, drafts } from '@/lib/db';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

const batchDraftsSchema = z.object({
  action: z.enum(['delete']),
  ids: z.array(z.string().min(1)).min(1).max(100),
});

/** @ignore */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'content.delete');

    const body = await request.json();
    const { action, ids } = batchDraftsSchema.parse(body);

    const errors: { id: string; error: string }[] = [];
    let affected = 0;

    if (action === 'delete') {
      // Verify all drafts exist first
      const existingDrafts = await db
        .select({ id: drafts.id })
        .from(drafts)
        .where(inArray(drafts.id, ids));

      const existingIds = new Set(existingDrafts.map((d) => d.id));

      for (const id of ids) {
        if (!existingIds.has(id)) {
          errors.push({ id, error: 'Draft not found' });
        }
      }

      // Delete all existing drafts
      if (existingIds.size > 0) {
        await db.delete(drafts).where(inArray(drafts.id, [...existingIds]));
        affected = existingIds.size;
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
    console.error('Batch drafts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
