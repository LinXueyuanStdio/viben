import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { eq, and, ne, desc } from 'drizzle-orm';
import { db, publishedPages, users } from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pageId = searchParams.get('page_id');
  const categoryId = searchParams.get('category_id');
  const authorId = searchParams.get('author_id');

  if (!pageId) {
    return NextResponse.json({ error: 'page_id is required' }, { status: 400 });
  }

  try {
    const relatedRows = await db
      .select({
        uid: publishedPages.uid,
        title: publishedPages.title,
        description: publishedPages.description,
        authorName: publishedPages.authorName,
        authorAvatarUrl: publishedPages.authorAvatarUrl,
        coverUrl: publishedPages.coverUrl,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        commentCount: publishedPages.commentCount,
        userSlug: users.userSlug,
      })
      .from(publishedPages)
      .innerJoin(users, eq(users.id, publishedPages.userId))
      .where(
        and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
          ne(publishedPages.uid, pageId),
          categoryId
            ? eq(publishedPages.categoryId, categoryId)
            : authorId
              ? eq(publishedPages.userId, authorId)
              : undefined
        )
      )
      .orderBy(desc(publishedPages.viewCount))
      .limit(3);

    function gradientCover(title: string): string {
      const hue = title.charCodeAt(0) % 360
      return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
    }

    return NextResponse.json(relatedRows.map((r) => ({
      data: {
        cover: r.coverUrl ? `url(${r.coverUrl})` : gradientCover(r.title),
        title: r.title,
        description: r.description ?? "",
        authorName: r.authorName ?? "?",
        authorAvatarUrl: r.authorAvatarUrl ?? undefined,
        authorFallbackText: r.authorName?.[0] ?? "?",
        commentCount: r.commentCount,
        stats: { views: r.viewCount, likes: r.likeCount },
      },
      href: `/${encodeURIComponent(r.userSlug)}/${encodeURIComponent(r.uid)}?tab=read`,
    })));
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
