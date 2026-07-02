import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOptionalSession } from '@/lib/auth/middleware';
import { db, publishedPages } from '@/lib/db';
import { canReadPage } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ user_slug: string; page_id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { user_slug, page_id } = await params;
  const { searchParams } = new URL(request.url);
  const fields = searchParams.get('fields') ?? 'all';
  const session = await getOptionalSession(request);

  const needsHtml = fields === 'html' || fields === 'all';

  const columns = {
    id: publishedPages.id,
    uid: publishedPages.uid,
    userId: publishedPages.userId,
    title: publishedPages.title,
    description: publishedPages.description,
    ...(needsHtml ? { html: publishedPages.html } : {}),
    authorSlug: publishedPages.authorSlug,
    authorDisplayName: publishedPages.authorDisplayName,
    authorAvatarUrl: publishedPages.authorAvatarUrl,
    sidePageUid: publishedPages.sidePageUid,
    visibility: publishedPages.visibility,
    moderationStatus: publishedPages.moderationStatus,
    publishedAt: publishedPages.publishedAt,
    tags: publishedPages.tags,
    coverUrl: publishedPages.coverUrl,
    viewCount: publishedPages.viewCount,
    likeCount: publishedPages.likeCount,
    commentCount: publishedPages.commentCount,
    bookmarkCount: publishedPages.bookmarkCount,
    shareCount: publishedPages.shareCount,
  };

  const rows = await db
    .select(columns)
    .from(publishedPages)
    .where(
      and(
        eq(publishedPages.authorSlug, user_slug),
        eq(publishedPages.uid, page_id),
      ),
    )
    .limit(1);

  if (!rows.length || !canReadPage(rows[0] as any, session)) {
    return NextResponse.json(
      { error: { code: 'not_found' } },
      { status: 404 },
    );
  }

  const p = rows[0];
  const isPublic = p.visibility === 'public' && p.moderationStatus === 'approved';

  const meta = {
    userSlug: p.authorSlug,
    pageId: p.uid,
    pageDbId: p.id,
    title: p.title,
    description: p.description,
    authorDisplayName: p.authorDisplayName,
    authorAvatarUrl: p.authorAvatarUrl,
    sidePageUid: p.sidePageUid,
    visibility: p.visibility,
    publishedAt: p.publishedAt,
    tags: p.tags,
    coverUrl: p.coverUrl,
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    bookmarkCount: p.bookmarkCount,
    shareCount: p.shareCount,
    isAuthor: session?.userId === p.userId,
    hasSidePage: !!p.sidePageUid,
    communityEntityId: p.id,
  };

  const data =
    fields === 'meta'
      ? { meta }
      : fields === 'html'
        ? { html: (p as any).html }
        : { html: (p as any).html, meta };

  const response = NextResponse.json(data);

  response.headers.set(
    'Cache-Control',
    isPublic
      ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400, must-revalidate'
      : 'private, no-cache, no-store, must-revalidate',
  );
  response.headers.set('Vary', 'Cookie, Accept-Encoding');
  response.headers.set('ETag', `"${p.uid}"`);

  return response;
}
