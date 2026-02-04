/**
 * Admin Package Feature API
 *
 * POST /api/admin/packages/[id]/feature - Feature or unfeature a package
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import {
  getPackageType,
  getPackageStatus,
  updateMcpPackageStatus,
  updateSkillPackageStatus,
  createModerationLog,
} from '@/lib/admin';
import { featurePackageSchema } from '@/lib/validations/admin';
import { ZodError } from 'zod';

/**
 * POST /api/admin/packages/[id]/feature
 *
 * Feature or unfeature a package.
 *
 * Request body:
 * - featured: boolean (true to feature, false to unfeature)
 *
 * Notes:
 * - Package must be 'approved' status to be featured
 * - Unfeaturing changes status back to 'approved'
 *
 * Required permission: packages.feature
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin permission
    const session = await requirePermission(request, 'packages.feature');

    const { id } = await params;

    // Check if package exists and get its type
    const packageType = await getPackageType(id);

    if (!packageType) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const data = featurePackageSchema.parse(body);

    // Get current status
    const currentStatus = await getPackageStatus(id, packageType);

    if (data.featured) {
      // Can only feature approved or featured packages
      if (currentStatus !== 'approved' && currentStatus !== 'featured') {
        return NextResponse.json(
          { error: 'Package must be approved before it can be featured' },
          { status: 400 }
        );
      }

      // Already featured
      if (currentStatus === 'featured') {
        return NextResponse.json({
          success: true,
          package: {
            id,
            status: 'featured',
            featuredAt: null, // Keep existing
            featuredBy: null,
          },
        });
      }

      // Update to featured
      if (packageType === 'mcp') {
        await updateMcpPackageStatus(id, 'featured', session.userId);
      } else {
        await updateSkillPackageStatus(id, 'featured', session.userId);
      }

      // Create moderation log
      await createModerationLog({
        adminId: session.userId,
        entityType: packageType,
        entityId: id,
        action: 'feature',
      });

      return NextResponse.json({
        success: true,
        package: {
          id,
          status: 'featured',
          featuredAt: new Date(),
          featuredBy: session.userId,
        },
      });
    } else {
      // Unfeature - only if currently featured
      if (currentStatus !== 'featured') {
        return NextResponse.json({
          success: true,
          package: {
            id,
            status: currentStatus,
            featuredAt: null,
            featuredBy: null,
          },
        });
      }

      // Update to approved (unfeature)
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
        action: 'unfeature',
      });

      return NextResponse.json({
        success: true,
        package: {
          id,
          status: 'approved',
          featuredAt: null,
          featuredBy: null,
        },
      });
    }
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
    console.error('Feature package error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
