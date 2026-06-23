import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getOptionalSession } from '@/lib/auth/middleware';
import { db, publishedPages, users } from '@/lib/db';
import { canReadPage, recordPageView } from '@/lib/services/community';

interface PublishedPageRouteContext {
  params: Promise<{
    user_slug: string;
    page_id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: PublishedPageRouteContext
) {
  const { user_slug: userSlug, page_id: pageId } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, userSlug),
  });

  if (!user) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  const page = await db.query.publishedPages.findFirst({
    where: and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.uid, pageId)
    ),
  });

  if (!page) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  const session = await getOptionalSession(request);
  if (!canReadPage(page, session)) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  void recordPageView({
    context: { page, author: user },
    session,
    source: 'html_direct',
    route: '/page',
  }).catch((error) => {
    console.error('Failed to record html_direct page view:', error);
  });

  return new Response(page.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
