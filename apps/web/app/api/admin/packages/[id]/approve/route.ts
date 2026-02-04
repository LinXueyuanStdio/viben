/**
 * Admin Package Approve API
 *
 * POST /api/admin/packages/[id]/approve - Approve a package
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
import { approvePackageSchema } from '@/lib/validations/admin';
import { ZodError } from 'zod';

/**
 * POST /api/admin/packages/[id]/approve
 *
 * Approve a pending package.
 *
 * Request body (optional):
 * - note: string (internal note for moderation log)
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

    // Parse optional request body
    let note: string | undefined;
    try {
      const body = await request.json();
      const data = approvePackageSchema.parse(body);
      note = data.note;
    } catch {
      // Body is optional, ignore parse errors
    }

    // Update package status
    if (packageType === 'mcp') {
      await updateMcpPackageStatus(id, 'approved', session.userId);
    } else {
      await updateSkillPackageStatus(id, 'approved', session.userId);
    }

    // Create moderation log
    await createModerationLog({
      adminId: session.userId,
      entityType: packageType,
      entityId: id,
      action: 'approve',
      reason: note,
    });

    return NextResponse.json({
      success: true,
      package: {
        id,
        status: 'approved',
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
    console.error('Approve package error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
