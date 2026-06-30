import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { createMoment, listMoments } from '@/lib/services/community';
import { getSession } from '@/lib/auth/cookies';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const feedType = (request.nextUrl.searchParams.get('feed_type') as 'following' | 'latest' | 'recommended') ?? 'latest';
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 30) : 10;
    const cursor = request.nextUrl.searchParams.get('cursor');

    const result = await listMoments({ feedType, session, limit, cursor });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const visibility =
      body.visibility === 'unlisted' || body.visibility === 'private'
        ? body.visibility
        : 'public';
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((topic: unknown): topic is string => typeof topic === 'string')
      : [];

    return NextResponse.json({
      moment: await createMoment({
        session,
        body: typeof body.body === 'string' ? body.body : null,
        visibility,
        topics,
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
