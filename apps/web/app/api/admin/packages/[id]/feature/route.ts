/**
 * Admin Package Feature API
 *
 * POST /api/admin/packages/[id]/feature - Feature or unfeature a package
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import {
  getPackageType,
  getPackageStatus,
  db,
  mcpPackages,
  skillPackages,
  moderationLogs,
} from '@/lib/admin';
import { featurePackageSchema } from '@/lib/validations/admin';
import { ZodError } from 'zod';
import { eq } from 'drizzle-orm';
import type { PackageStatus } from '@/lib/types/admin';

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
          },
        });
      }

      // Update to featured
      const updateData: Record<string, unknown> = {
        status: 'featured' as PackageStatus,
        reviewedAt: new Date(),
        reviewedBy: session.userId,
        featuredAt: new Date(),
        featuredBy: session.userId,
      };

      if (packageType === 'mcp') {
        await db.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));
      } else {
        await db.update(skillPackages).set(updateData).where(eq(skillPackages.id, id));
      }

      // Create moderation log
      await db.insert(moderationLogs).values({
        adminId: session.userId,
        entityType: packageType,
        entityId: id,
        action: 'feature',
        reason: null,
        metadata: null,
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
      const updateData: Record<string, unknown> = {
        status: 'approved' as PackageStatus,
        reviewedAt: new Date(),
        reviewedBy: session.userId,
        featuredAt: null,
        featuredBy: null,
      };

      if (packageType === 'mcp') {
        await db.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));
      } else {
        await db.update(skillPackages).set(updateData).where(eq(skillPackages.id, id));
      }

      // Create moderation log
      await db.insert(moderationLogs).values({
        adminId: session.userId,
        entityType: packageType,
        entityId: id,
        action: 'unfeature',
        reason: null,
        metadata: null,
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
