import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { followUser, unfollowUser } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ user_slug: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug } = await params;
    const body = await request.json().catch(() => ({}));
    const notifyLevel =
      body.notify_level === 'major' || body.notify_level === 'none' ? body.notify_level : 'all';

    return NextResponse.json(await followUser({ follower: session, followeeSlug: userSlug, notifyLevel }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'cannot_follow_self' ? 400 : 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug } = await params;
    return NextResponse.json(await unfollowUser({ follower: session, followeeSlug: userSlug }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
}
