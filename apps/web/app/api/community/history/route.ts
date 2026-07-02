import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { getBrowseHistory } from '@/lib/services/community';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
    const cursor = request.nextUrl.searchParams.get('cursor');

    return NextResponse.json(await getBrowseHistory(session, limit, cursor));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
