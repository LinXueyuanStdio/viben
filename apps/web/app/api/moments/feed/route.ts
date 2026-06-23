import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, getOptionalSession } from '@/lib/auth/middleware';
import { listMoments } from '@/lib/services/community';

export async function GET(request: NextRequest) {
  const feedType = request.nextUrl.searchParams.get('feed_type');
  if (feedType !== 'following' && feedType !== 'latest' && feedType !== 'recommended') {
    return NextResponse.json({ error: 'invalid_feed_type' }, { status: 400 });
  }

  const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
  const session = await getOptionalSession(request);

  try {
    return NextResponse.json(await listMoments({ feedType, session, limit }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'login_required' ? 401 : 500 });
  }
}
