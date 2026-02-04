import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getAdminStats } from '@/lib/admin/stats';

/**
 * GET /api/admin/stats
 *
 * Returns admin dashboard statistics.
 * Requires admin role (support, moderator, or super_admin).
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin access (minimum level 25 = support)
    await requireAdmin(request);

    const stats = await getAdminStats();

    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
