/**
 * Admin Package Releases API
 *
 * GET /api/admin/packages/releases - List releases for a package
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ZodError } from 'zod';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, packageReleases } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

const releasesQuerySchema = z.object({
  entityType: z.enum(['mcp', 'skill']),
  entityId: z.string().min(1),
});

/**
 * GET /api/admin/packages/releases
 *
 * List package releases ordered by createdAt desc.
 *
 * Query parameters:
 * - entityType: 'mcp' | 'skill' (required)
 * - entityId: string (required)
 *
 * Required permission: packages.review
 * @ignore
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin permission
    await requirePermission(request, 'packages.review');

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = releasesQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const releases = await db
      .select({
        id: packageReleases.id,
        version: packageReleases.version,
        releaseNotes: packageReleases.releaseNotes,
        downloadUrl: packageReleases.downloadUrl,
        checksum: packageReleases.checksum,
        fileSize: packageReleases.fileSize,
        createdAt: packageReleases.createdAt,
      })
      .from(packageReleases)
      .where(
        and(
          eq(packageReleases.entityType, query.entityType),
          eq(packageReleases.entityId, query.entityId)
        )
      )
      .orderBy(desc(packageReleases.createdAt));

    return NextResponse.json({ releases });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List package releases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
