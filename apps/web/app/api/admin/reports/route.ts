/**
 * Admin Reports API
 *
 * GET /api/admin/reports - List reports for admin management
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, reports, users } from '@/lib/db';
import { eq, desc, count, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listReportsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['pending', 'resolved', 'dismissed', 'all']).default('pending'),
});

/**
 * GET /api/admin/reports
 *
 * List reports with filtering and pagination.
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: 'pending' | 'resolved' | 'dismissed' | 'all' (default: 'pending')
 *
 * Required permission: reports.view
 * @ignore
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin permission
    await requirePermission(request, 'reports.view');

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = listReportsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: SQL[] = [];
    if (status !== 'all') {
      conditions.push(eq(reports.status, status));
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(reports)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Get reports with reporter info
    const reportList = await db
      .select({
        id: reports.id,
        entityType: reports.entityType,
        entityId: reports.entityId,
        reason: reports.reason,
        description: reports.description,
        status: reports.status,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        reporterId: reports.reporterId,
        reporterName: users.username,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      reports: reportList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List admin reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
