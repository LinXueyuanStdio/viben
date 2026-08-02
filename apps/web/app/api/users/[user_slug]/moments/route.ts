import { NextRequest, NextResponse } from 'next/server';
import { db, moments, momentAttachments, users } from '@/lib/db';
import { eq, and, desc, lt, inArray } from 'drizzle-orm';

/**
 * 获取用户动态列表（分页）
 * @description 获取指定用户的公开动态，支持游标分页。limit 默认 10、最大 20。返回 moments 列表及 nextCursor。
 * @pathParams UserSlugParams
 * @params MomentsQuery
 * @response 200:UserMomentsResponse:动态列表
 * @tag Users
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_slug: string }> }
) {
  try {
    const { user_slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 20);
    const cursor = searchParams.get('cursor');

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.userSlug, user_slug),
      columns: { id: true, displayName: true, userSlug: true, avatarUrl: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const whereClause = cursor
      ? and(
          eq(moments.authorUserId, user.id),
          eq(moments.visibility, 'public'),
          eq(moments.isDeleted, false),
          lt(moments.createdAt, new Date(cursor))
        )
      : and(
          eq(moments.authorUserId, user.id),
          eq(moments.visibility, 'public'),
          eq(moments.isDeleted, false)
        );

    const rows = await db.select().from(moments)
      .where(whereClause)
      .orderBy(desc(moments.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Fetch attachments
    let attachmentsMap = new Map<string, unknown[]>();
    if (items.length > 0) {
      const momentIds = items.map((m) => m.id);
      const attRows = await db.select({
        momentId: momentAttachments.momentId,
        coverUrl: momentAttachments.coverUrlSnapshot,
        title: momentAttachments.titleSnapshot,
        authorName: momentAttachments.authorNameSnapshot,
        viewCount: momentAttachments.viewCountSnapshot,
        commentCount: momentAttachments.commentCountSnapshot,
      }).from(momentAttachments)
        .where(inArray(momentAttachments.momentId, momentIds))
        .orderBy(momentAttachments.sortOrder);

      for (const a of attRows) {
        const list = attachmentsMap.get(a.momentId) ?? [];
        (list as unknown[]).push({
          cover_url: a.coverUrl,
          title: a.title,
          author_name: a.authorName,
          view_count: a.viewCount,
          comment_count: a.commentCount,
        });
        attachmentsMap.set(a.momentId, list);
      }
    }

    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ moments: items, attachments: Object.fromEntries(attachmentsMap), nextCursor });
  } catch (error) {
    console.error('Get user moments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
