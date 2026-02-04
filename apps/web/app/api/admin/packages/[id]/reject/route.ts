/**
 * Admin Package Reject API
 *
 * POST /api/admin/packages/[id]/reject - Reject a package
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import {
  getPackageType,
  updateMcpPackageStatus,
  updateSkillPackageStatus,
  createModerationLog,
} from '@/lib/admin';
import { rejectPackageSchema } from '@/lib/validations/admin';
import { ZodError } from 'zod';

/**
 * POST /api/admin/packages/[id]/reject
 *
 * Reject a package with a required reason.
 *
 * Request body:
 * - reason: string (required - shown to package author)
 *
 * Required permission: packages.approve
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin permission
    const session = await requirePermission(request, 'packages.approve');

    const { id } = await params;

    // Check if package exists and get its type
    const packageType = await getPackageType(id);

    if (!packageType) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const data = rejectPackageSchema.parse(body);

    // Update package status
    if (packageType === 'mcp') {
      await updateMcpPackageStatus(id, 'rejected', session.userId, data.reason);
    } else {
      await updateSkillPackageStatus(id, 'rejected', session.userId, data.reason);
    }

    // Create moderation log
    await createModerationLog({
      adminId: session.userId,
      entityType: packageType,
      entityId: id,
      action: 'reject',
      reason: data.reason,
    });

    return NextResponse.json({
      success: true,
      package: {
        id,
        status: 'rejected',
        rejectionReason: data.reason,
        reviewedAt: new Date(),
        reviewedBy: session.userId,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Reject package error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
