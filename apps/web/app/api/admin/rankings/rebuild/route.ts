/**
 * Admin Rankings Rebuild API
 *
 * POST /api/admin/rankings/rebuild - Trigger a ranking rebuild
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'rankings.manage');

    // TODO: Integrate with the actual ranking rebuild pipeline in packages/core
    // For now, this is a placeholder endpoint that will be connected to the
    // ranking service when it's implemented.

    return NextResponse.json({
      success: true,
      message: '榜单重建任务已提交',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Rebuild rankings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
