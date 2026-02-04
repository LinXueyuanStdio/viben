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
  db,
  mcpPackages,
  skillPackages,
  moderationLogs,
} from '@/lib/admin';
import { approvePackageSchema } from '@/lib/validations/admin';
import { ZodError } from 'zod';
import { eq } from 'drizzle-orm';
import type { PackageStatus } from '@/lib/types/admin';

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
    const bodyText = await request.text();
    if (bodyText) {
      const data = approvePackageSchema.parse(JSON.parse(bodyText));
      note = data.note;
    }

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Update package status
      const updateData: Record<string, unknown> = {
        status: 'approved' as PackageStatus,
        reviewedAt: new Date(),
        reviewedBy: session.userId,
      };

      if (packageType === 'mcp') {
        await tx.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));
      } else {
        await tx.update(skillPackages).set(updateData).where(eq(skillPackages.id, id));
      }

      // Create moderation log
      await tx.insert(moderationLogs).values({
        adminId: session.userId,
        entityType: packageType,
        entityId: id,
        action: 'approve',
        reason: note ?? null,
        metadata: null,
      });
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
