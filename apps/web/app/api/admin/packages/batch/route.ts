/**
 * Admin Packages Batch API
 *
 * POST /api/admin/packages/batch - Batch approve/reject/delete packages
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import {
  getPackageType,
  deleteMcpPackage,
  deleteSkillPackage,
  db,
  mcpPackages,
  skillPackages,
  moderationLogs,
} from '@/lib/admin';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { PackageStatus } from '@/lib/types/admin';

const batchPackagesSchema = z.object({
  action: z.enum(['approve', 'reject', 'delete']),
  ids: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, 'packages.approve');

    const body = await request.json();
    const { action, ids, reason } = batchPackagesSchema.parse(body);

    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { error: 'Reason is required for reject action' },
        { status: 400 }
      );
    }

    const errors: { id: string; error: string }[] = [];
    let affected = 0;

    for (const id of ids) {
      try {
        if (action === 'delete') {
          const packageType = await getPackageType(id);
          if (!packageType) {
            errors.push({ id, error: 'Package not found' });
            continue;
          }

          if (packageType === 'mcp') {
            await deleteMcpPackage(id);
          } else {
            await deleteSkillPackage(id);
          }

          await db.insert(moderationLogs).values({
            adminId: session.userId,
            entityType: packageType,
            entityId: id,
            action: 'delete',
            reason: reason ?? null,
            metadata: null,
          });
          affected++;
        } else if (action === 'approve') {
          const packageType = await getPackageType(id);
          if (!packageType) {
            errors.push({ id, error: 'Package not found' });
            continue;
          }

          const updateData: Record<string, unknown> = {
            status: 'approved' as PackageStatus,
            reviewedAt: new Date(),
            reviewedBy: session.userId,
          };

          if (packageType === 'mcp') {
            await db.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));
          } else {
            await db.update(skillPackages).set(updateData).where(eq(skillPackages.id, id));
          }

          await db.insert(moderationLogs).values({
            adminId: session.userId,
            entityType: packageType,
            entityId: id,
            action: 'approve',
            reason: reason ?? null,
            metadata: null,
          });
          affected++;
        } else if (action === 'reject') {
          const packageType = await getPackageType(id);
          if (!packageType) {
            errors.push({ id, error: 'Package not found' });
            continue;
          }

          const updateData: Record<string, unknown> = {
            status: 'rejected' as PackageStatus,
            reviewedAt: new Date(),
            reviewedBy: session.userId,
            rejectionReason: reason,
          };

          if (packageType === 'mcp') {
            await db.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));
          } else {
            await db.update(skillPackages).set(updateData).where(eq(skillPackages.id, id));
          }

          await db.insert(moderationLogs).values({
            adminId: session.userId,
            entityType: packageType,
            entityId: id,
            action: 'reject',
            reason: reason ?? null,
            metadata: null,
          });
          affected++;
        }
      } catch (err) {
        errors.push({
          id,
          error: err instanceof Error ? err.message : 'Unknown error',
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
    console.error('Batch packages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
