/**
 * Admin Package Details API
 *
 * GET /api/admin/packages/[id] - Get package details for review
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getPackageDetails } from '@/lib/admin';

/**
 * GET /api/admin/packages/[id]
 *
 * Get full package details for admin review, including review history and stats.
 *
 * Required permission: packages.review
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
