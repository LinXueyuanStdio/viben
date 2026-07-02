/**
 * Admin Reports [id] API
 *
 * PATCH /api/admin/reports/[id] - Resolve or dismiss a report
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, reports, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';
import { z } from 'zod';

const updateReportSchema = z.object({
  action: z.enum(['resolve', 'dismiss']),
});

/**
 * GET /api/admin/reports/[id]
 *
 * Get full report details including reporter and resolver info.
 *
 * Required permission: reports.view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin permission
    await requirePermission(request, 'reports.view');

    const { id } = await params;

    const [report] = await db
      .select({
        id: reports.id,
        entityType: reports.entityType,
        entityId: reports.entityId,
        reason: reports.reason,
        description: reports.description,
        status: reports.status,
        resolution: reports.resolution,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        reporterId: reports.reporterId,
        reporterName: users.username,
        resolvedBy: reports.resolvedBy,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .where(eq(reports.id, id));

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get report detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
