import { and, eq } from 'drizzle-orm';
import { db, publishedPages, users } from '@/lib/db';

interface PublishedPageRouteContext {
  params: Promise<{
    user_slug: string;
    page_id: string;
  }>;
}

export async function GET(
  _request: Request,
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

  return new Response(page.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
