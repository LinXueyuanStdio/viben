import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { listSubscriptionFeed } from '@/lib/services/community';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
    const cursor = request.nextUrl.searchParams.get('cursor');
    const includeSeen = request.nextUrl.searchParams.get('include_seen') !== 'false';
    const rawSource = request.nextUrl.searchParams.get('source');
    const source =
      rawSource === 'followed_authors' || rawSource === 'subscribed_pages'
        ? rawSource
        : 'all';

    return NextResponse.json(
      await listSubscriptionFeed(session, { limit, cursor, includeSeen, source })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
