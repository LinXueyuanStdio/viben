import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import {
  getPublishedPageContext,
  subscribeToPage,
  unsubscribeFromPage,
  updatePageSubscription,
} from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ user_slug: string; page_id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug, page_id: pageId } = await params;
    const context = await getPublishedPageContext(userSlug, pageId);
    if (!context) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const notifyLevel =
      body.notify_level === 'major' || body.notify_level === 'none' ? body.notify_level : 'all';
    return NextResponse.json(await subscribeToPage({ context, session, notifyLevel }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'permission_denied' ? 403 : 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug, page_id: pageId } = await params;
    const context = await getPublishedPageContext(userSlug, pageId);
    if (!context) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    return NextResponse.json(await unsubscribeFromPage({ context, session }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug, page_id: pageId } = await params;
    const context = await getPublishedPageContext(userSlug, pageId);
    if (!context) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const notifyLevel =
      body.notify_level === 'all' || body.notify_level === 'major' || body.notify_level === 'none'
        ? body.notify_level
        : undefined;
    const lastSeenVersion =
      Number.isInteger(body.last_seen_version) && body.last_seen_version >= 0
        ? body.last_seen_version
        : undefined;

    return NextResponse.json(
      await updatePageSubscription({
        context,
        session,
        notifyLevel,
        lastSeenVersion,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'permission_denied' ? 403 : 400 });
  }
}
