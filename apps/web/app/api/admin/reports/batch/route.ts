/**
 * Admin Reports Batch API
 *
 * POST /api/admin/reports/batch - Batch resolve/dismiss reports
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, reports } from '@/lib/db';
import { inArray } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const batchReportsSchema = z.object({
  action: z.enum(['resolve', 'dismiss']),
  ids: z.array(z.string().min(1)).min(1).max(100),
});

/** @ignore */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'reports.resolve');

    const body = await request.json();
    const { action, ids } = batchReportsSchema.parse(body);

    const session = await getSession();
    const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';

    let affected = 0;
    const errors: { id: string; error: string }[] = [];

    // Verify all reports exist first
    const existingReports = await db
      .select({ id: reports.id })
      .from(reports)
      .where(inArray(reports.id, ids));

    const existingIds = new Set(existingReports.map((r) => r.id));

    for (const id of ids) {
      if (!existingIds.has(id)) {
        errors.push({ id, error: 'Report not found' });
      }
    }

    // Update all existing reports
    if (existingIds.size > 0) {
      const idArray = [...existingIds];
      await db
        .update(reports)
        .set({
          status: newStatus,
          resolvedAt: new Date(),
          resolvedBy: session?.userId ?? null,
        })
        .where(inArray(reports.id, idArray));

      affected = existingIds.size;

      // Create moderation log for batch
      if (session?.userId) {
        await createModerationLog({
          adminId: session.userId,
          entityType: 'report',
          entityId: ids.join(','),
          action: action === 'resolve' ? 'approve' : 'reject',
          reason: `Batch ${action}d ${affected} reports`,
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
    console.error('Batch reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
