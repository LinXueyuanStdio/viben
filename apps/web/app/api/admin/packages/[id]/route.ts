/**
 * Admin Package Details API
 *
 * GET /api/admin/packages/[id] - Get package details for review
 * DELETE /api/admin/packages/[id] - Hard delete a package
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import {
  getPackageDetails,
  getPackageType,
  deleteMcpPackage,
  deleteSkillPackage,
  db,
  moderationLogs,
} from '@/lib/admin';

/**
 * GET /api/admin/packages/[id]
 *
 * Get full package details for admin review, including review history and stats.
 *
 * Required permission: packages.review
 * @ignore
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin permission
    await requirePermission(request, 'packages.review');

    const { id } = await params;

    // Fetch package details
    const pkg = await getPackageDetails(id);

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    return NextResponse.json({ package: pkg });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get admin package details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/packages/[id]
 *
 * Hard delete a package permanently from the database.
 *
 * Required permission: packages.review
 * @ignore
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin permission
    const session = await requirePermission(request, 'packages.review');

    const { id } = await params;

    // Check if package exists and get its type
    const packageType = await getPackageType(id);

    if (!packageType) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Hard delete from the appropriate table
    if (packageType === 'mcp') {
      await deleteMcpPackage(id);
    } else {
      await deleteSkillPackage(id);
    }

    // Create moderation log
    await db.insert(moderationLogs).values({
      adminId: session.userId,
      entityType: packageType,
      entityId: id,
      action: 'delete',
      reason: null,
      metadata: null,
    });

    return NextResponse.json({
      success: true,
      package: {
        id,
        deleted: true,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete admin package error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
