/**
 * Admin Packages API
 *
 * GET /api/admin/packages - List packages for admin review
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { listPackagesForReview } from '@/lib/admin';
import { listAdminPackagesQuerySchema } from '@/lib/validations/admin';
import { ZodError } from 'zod';

/**
 * GET /api/admin/packages
 *
 * List packages for admin review with filtering and pagination.
 *
 * Query parameters:
 * - type: 'mcp' | 'skill' (optional)
 * - status: 'pending' | 'approved' | 'rejected' | 'featured' (default: 'pending')
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - sort: 'newest' | 'oldest' (default: 'oldest')
 *
 * Required permission: packages.review
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin permission
    await requirePermission(request, 'packages.review');

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = listAdminPackagesQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    // Fetch packages
    const result = await listPackagesForReview(query);

    return NextResponse.json(result);
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
    console.error('List admin packages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
