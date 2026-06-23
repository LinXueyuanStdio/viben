import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getOptionalSession } from '@/lib/auth/middleware';
import { db, publishedPages, publishedPageVersions, users } from '@/lib/db';
import { canReadPage } from '@/lib/services/community';

interface PublishedPageVersionRouteContext {
  params: Promise<{
    user_slug: string;
    page_id: string;
    version: string;
  }>;
}

function notFoundResponse() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: PublishedPageVersionRouteContext
) {
  const { user_slug: userSlug, page_id: pageId, version } = await params;
  const versionNumber = Number(version);

  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return notFoundResponse();
  }

  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, userSlug),
  });

  if (!user) {
    return notFoundResponse();
  }

  const page = await db.query.publishedPages.findFirst({
    where: and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.uid, pageId)
    ),
  });

  if (!page) {
    return notFoundResponse();
  }

  const session = await getOptionalSession(request);
  if (!canReadPage(page, session)) {
    return notFoundResponse();
  }

  const pageVersion = await db.query.publishedPageVersions.findFirst({
    where: and(
      eq(publishedPageVersions.userId, user.id),
      eq(publishedPageVersions.uid, pageId),
      eq(publishedPageVersions.version, versionNumber)
    ),
  });

  if (!pageVersion) {
    return notFoundResponse();
  }

  return new Response(pageVersion.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
