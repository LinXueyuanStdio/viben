/**
 * Admin Reports [id] API
 *
 * PATCH /api/admin/reports/[id] - Resolve or dismiss a report
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, reports } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const updateReportSchema = z.object({
  action: z.enum(['resolve', 'dismiss']),
});

/**
 * PATCH /api/admin/reports/[id]
 *
 * Resolve or dismiss a report.
 *
 * Body:
 * - action: 'resolve' | 'dismiss'
 *
 * Required permission: reports.resolve
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin permission
    await requirePermission(request, 'reports.resolve');

    const { id } = await params;
    const body = await request.json();
    const { action } = updateReportSchema.parse(body);

    const session = await getSession();
    const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';

    await db
      .update(reports)
      .set({
        status: newStatus,
        resolvedAt: new Date(),
        resolvedBy: session?.userId ?? null,
      })
      .where(eq(reports.id, id));

    // Log the moderation action
    if (session?.userId) {
      await createModerationLog({
        adminId: session.userId,
        entityType: 'report',
        entityId: id,
        action: action === 'resolve' ? 'approve' : 'reject',
        reason: `Report ${action}d`,
      });
    }

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
    console.error('Update report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
