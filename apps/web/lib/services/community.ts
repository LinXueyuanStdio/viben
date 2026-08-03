import { cache } from "react";
import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  communityComments,
  communityEntities,
  communityBookmarks,
  communityReactions,
  db,
  momentAttachments,
  momentTopicItems,
  momentTopics,
  moments,
  notifications,
  pageSubscriptions,
  pageUpdateEvents,
  publishedPages,
  rankingItems,
  rankingSnapshots,
  shareEvents,
  shareLinks,
  userBrowseHistory,
  userFollows,
  users,
  viewEvents,
} from '@/lib/db';
import type { Session } from '@/lib/auth/types';

type PageUpdateNotificationTx = Pick<typeof db, 'insert' | 'query'>;

export type PublicPageContext = {
  page: typeof publishedPages.$inferSelect;
  author: typeof users.$inferSelect;
};

export type CursorParts = {
  created_at: string;
  id: string;
};

export interface MomentFeedItem {
  moment: {
    id: string
    uid: string
    kind: string
    body: string | null
    visibility: string
    like_count: number
    comment_count: number
    repost_count: number
    created_at: string
    source: string | null
    quote_text: string | null
    view_count: number | null
    bookmark_count: number | null
  }
  author: {
    id: string
    user_slug: string
    display_name: string | null
    avatar_url: string | null
  }
  attachments: Array<{
    attachment_type: string
    attachment_id: string
    attachment_uid: string | null
    title: string
    description: string | null
    cover_url: string | null
    author_name_snapshot: string | null
    view_count_snapshot: number | null
    comment_count_snapshot: number | null
  }>
  viewer_state: {
    is_authenticated: boolean
    can_edit: boolean
    can_delete: boolean
    has_liked: boolean
    has_bookmarked: boolean
  }
  topics: unknown[]
}

export interface ListMomentsResult {
  items: MomentFeedItem[]
  next_cursor: string | null
  has_more: boolean
  feed_type: string
  fallback_feed_type: string | null
}

export function encodeCursor(parts: CursorParts): string {
  return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | null): CursorParts | null {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorParts>;
    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'string') {
      return { created_at: parsed.created_at, id: parsed.id };
    }
  } catch {
    return null;
  }

  return null;
}

export function isPublicPage(page: typeof publishedPages.$inferSelect): boolean {
  return page.visibility === 'public' && page.moderationStatus === 'approved';
}

export function isDirectLinkReadablePage(page: typeof publishedPages.$inferSelect): boolean {
  return (
    (page.visibility === 'public' || page.visibility === 'unlisted') &&
    page.moderationStatus === 'approved'
  );
}

export const getPublishedPageContext = cache(
  async (userSlug: string, pageId: string): Promise<PublicPageContext | null> => {
    const page = await db.query.publishedPages.findFirst({
      where: and(
        eq(publishedPages.authorSlug, userSlug),
        eq(publishedPages.uid, pageId),
      ),
    })
    if (!page) return null

    const author = await db.query.users.findFirst({
      where: eq(users.id, page.userId),
    })
    if (!author) return null

    return { page, author }
  }
)

export async function searchPublishedPagesByAuthor(
  authorSlug: string,
  opts?: { query?: string; limit?: number }
): Promise<Array<{ uid: string; title: string; authorSlug: string }>> {
  const { query, limit = 20 } = opts ?? {}
  const conditions = [
    eq(publishedPages.authorSlug, authorSlug),
    eq(publishedPages.visibility, "public"),
    eq(publishedPages.moderationStatus, "approved"),
  ]
  if (query) {
    conditions.push(ilike(publishedPages.uid, `%${query}%`))
  }

  return db
    .select({
      uid: publishedPages.uid,
      title: publishedPages.title,
      authorSlug: publishedPages.authorSlug,
    })
    .from(publishedPages)
    .where(and(...conditions))
    .orderBy(desc(publishedPages.lastPublishedAt))
    .limit(limit)
}

export function canReadPage(
  page: typeof publishedPages.$inferSelect,
  session: Session | null
): boolean {
  if (isDirectLinkReadablePage(page)) return true;
  return Boolean(session && session.userId === page.userId);
}

function canUseCommunityEntity(entity: typeof communityEntities.$inferSelect): boolean {
  return entity.status === 'active' && entity.visibility === 'public';
}

export async function ensureCommunityEntityForPage(context: PublicPageContext) {
  const canonicalPath = `/${encodeURIComponent(context.author.userSlug)}/${encodeURIComponent(context.page.uid)}?tab=read`;
  const status = isPublicPage(context.page) ? 'active' : 'hidden';

  await db
    .insert(communityEntities)
    .values({
      entityType: 'published_page',
      entityId: context.page.id,
      ownerUserId: context.page.userId,
      visibility: context.page.visibility,
      status,
      title: context.page.title,
      canonicalPath,
    })
    .onConflictDoUpdate({
      target: [communityEntities.entityType, communityEntities.entityId],
      set: {
        ownerUserId: context.page.userId,
        visibility: context.page.visibility,
        status,
        title: context.page.title,
        canonicalPath,
        updatedAt: sql`now()`,
      },
    });

  const entity = await db.query.communityEntities.findFirst({
    where: and(
      eq(communityEntities.entityType, 'published_page'),
      eq(communityEntities.entityId, context.page.id)
    ),
  });

  if (!entity) {
    throw new Error('Community entity was not found after upsert');
  }

  return entity;
}

export async function getCommunitySummary(
  entityType: 'published_page' | 'moment' | 'comment',
  entityId: string,
  session: Session | null
) {
  const entity = await db.query.communityEntities.findFirst({
    where: and(eq(communityEntities.entityType, entityType), eq(communityEntities.entityId, entityId)),
  });

  if (!entity || !canUseCommunityEntity(entity)) return null;

  const [reaction, favorite] = session
    ? await Promise.all([
        db.query.communityReactions.findFirst({
          where: and(
            eq(communityReactions.communityEntityId, entity.id),
            eq(communityReactions.userId, session.userId),
            eq(communityReactions.reactionType, 'like')
          ),
        }),
        db.query.communityBookmarks.findFirst({
          where: and(
            eq(communityBookmarks.communityEntityId, entity.id),
            eq(communityBookmarks.userId, session.userId)
          ),
        }),
      ])
    : [null, null];

  return {
    entity: {
      id: entity.id,
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      visibility: entity.visibility,
      status: entity.status,
      reactions_count: entity.reactionsCount,
      bookmarks_count: entity.bookmarksCount,
      comments_count: entity.commentsCount,
      canonical_path: entity.canonicalPath,
    },
    viewer: {
      is_authenticated: Boolean(session),
      has_reacted: Boolean(reaction),
      has_bookmarked: Boolean(favorite),
      can_comment: Boolean(session),
      can_moderate: session?.role === 'admin' || session?.role === 'super_admin' || session?.role === 'moderator',
    },
  };
}

export async function listCommunityComments(params: {
  entityType: 'published_page' | 'moment' | 'comment';
  entityId: string;
  parentCommentId: string | null;
  limit: number;
  cursor?: string | null;
  session: Session | null;
}) {
  const entity = await db.query.communityEntities.findFirst({
    where: and(
      eq(communityEntities.entityType, params.entityType),
      eq(communityEntities.entityId, params.entityId)
    ),
  });

  if (!entity || !canUseCommunityEntity(entity)) {
    return { comments: [], next_cursor: null };
  }

  const decodedCursor = decodeCursor(params.cursor ?? null);
  const cursorCreatedAt = decodedCursor ? new Date(decodedCursor.created_at) : null;
  const cursorPredicate =
    decodedCursor && cursorCreatedAt && !Number.isNaN(cursorCreatedAt.getTime())
      ? or(
          lt(communityComments.createdAt, cursorCreatedAt),
          and(
            eq(communityComments.createdAt, cursorCreatedAt),
            lt(communityComments.id, decodedCursor.id)
          )
        )
      : undefined;

  const rows = await db
    .select({
      comment: communityComments,
      author: {
        id: users.id,
        userSlug: users.userSlug,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(communityComments)
    .innerJoin(users, eq(users.id, communityComments.userId))
    .where(
      and(
        eq(communityComments.communityEntityId, entity.id),
        params.parentCommentId
          ? eq(communityComments.parentCommentId, params.parentCommentId)
          : isNull(communityComments.parentCommentId),
        eq(communityComments.status, 'active'),
        cursorPredicate
      )
    )
    .orderBy(desc(communityComments.createdAt), desc(communityComments.id))
    .limit(params.limit + 1);

  const visibleRows = rows.slice(0, params.limit);
  const commentEntities =
    params.session && visibleRows.length > 0
      ? await db.query.communityEntities.findMany({
          where: and(
            eq(communityEntities.entityType, 'comment'),
            inArray(communityEntities.entityId, visibleRows.map(({ comment }) => comment.id))
          ),
        })
      : [];
  const entityIdToCommentId = new Map(
    commentEntities.map((commentEntity) => [commentEntity.id, commentEntity.entityId])
  );
  const reactionRows =
    params.session && commentEntities.length > 0
      ? await db.query.communityReactions.findMany({
          where: and(
            eq(communityReactions.userId, params.session.userId),
            inArray(
              communityReactions.communityEntityId,
              commentEntities.map((commentEntity) => commentEntity.id)
            )
          ),
        })
      : [];
  const reactedCommentIds = new Set(
    reactionRows
      .map((reaction) => entityIdToCommentId.get(reaction.communityEntityId))
      .filter((commentId): commentId is string => Boolean(commentId))
  );

  return {
    comments: visibleRows.map(({ comment, author }) => ({
      id: comment.id,
      content: comment.content,
      status: comment.status,
      depth: comment.depth,
      replies_count: comment.repliesCount,
      reactions_count: comment.reactionsCount,
      viewer_has_reacted: reactedCommentIds.has(comment.id),
      created_at: comment.createdAt.toISOString(),
      updated_at: comment.updatedAt.toISOString(),
      author: {
        id: author.id,
        user_slug: author.userSlug,
        display_name: author.displayName,
        avatar_url: author.avatarUrl,
      },
    })),
    next_cursor:
      rows.length > params.limit
        ? encodeCursor({
            created_at: visibleRows[visibleRows.length - 1].comment.createdAt.toISOString(),
            id: visibleRows[visibleRows.length - 1].comment.id,
          })
        : null,
  };
}

export async function createCommunityComment(params: {
  entityType: 'published_page' | 'moment';
  entityId: string;
  parentCommentId: string | null;
  content: string;
  session: Session;
}) {
  const content = params.content.trim();
  if (!content) {
    throw new Error('comment_content_empty');
  }
  if (content.length > 2000) {
    throw new Error('comment_content_too_long');
  }

  const entity = await ensureCommunityEntity(params.entityType, params.entityId);

  let parent: typeof communityComments.$inferSelect | null = null;
  if (params.parentCommentId) {
    parent =
      (await db.query.communityComments.findFirst({
        where: and(
          eq(communityComments.id, params.parentCommentId),
          eq(communityComments.communityEntityId, entity.id),
          eq(communityComments.status, 'active')
        ),
      })) ?? null;

    if (!parent || parent.depth !== 0) {
      throw new Error('comment_not_found');
    }
  }

  const [comment] = await db
    .insert(communityComments)
    .values({
      communityEntityId: entity.id,
      parentCommentId: parent?.id ?? null,
      userId: params.session.userId,
      content,
      depth: parent ? 1 : 0,
    })
    .returning();

  await db
    .update(communityEntities)
    .set({ commentsCount: sql`${communityEntities.commentsCount} + 1` })
    .where(eq(communityEntities.id, entity.id));

  // Also update the source table's denormalized counter
  if (params.entityType === 'published_page') {
    await db.update(publishedPages)
      .set({ commentCount: sql`${publishedPages.commentCount} + 1` })
      .where(eq(publishedPages.id, params.entityId));
  } else if (params.entityType === 'moment') {
    await db.update(moments)
      .set({ commentCount: sql`${moments.commentCount} + 1` })
      .where(eq(moments.id, params.entityId));
  }

  if (parent) {
    await db
      .update(communityComments)
      .set({ repliesCount: sql`${communityComments.repliesCount} + 1` })
      .where(eq(communityComments.id, parent.id));
  }

  return comment;
}

export async function updateCommunityComment(params: {
  commentId: string;
  content: string;
  session: Session;
}) {
  const content = params.content.trim();
  if (!content) throw new Error('comment_content_empty');
  if (content.length > 2000) throw new Error('comment_content_too_long');

  const comment = await db.query.communityComments.findFirst({
    where: and(
      eq(communityComments.id, params.commentId),
      eq(communityComments.status, 'active')
    ),
  });
  if (!comment) throw new Error('comment_not_found');
  const entity = await db.query.communityEntities.findFirst({
    where: eq(communityEntities.id, comment.communityEntityId),
  });
  if (!canManageComment(params.session, comment, entity)) throw new Error('permission_denied');

  const [updated] = await db
    .update(communityComments)
    .set({ content, updatedAt: sql`now()` })
    .where(eq(communityComments.id, params.commentId))
    .returning();

  return {
    comment: {
      id: updated?.id ?? comment.id,
      content: updated?.content ?? content,
      updated_at: (updated?.updatedAt ?? new Date()).toISOString(),
    },
  };
}

export async function deleteCommunityComment(params: {
  commentId: string;
  session: Session;
}) {
  const comment = await db.query.communityComments.findFirst({
    where: and(
      eq(communityComments.id, params.commentId),
      eq(communityComments.status, 'active')
    ),
  });
  if (!comment) throw new Error('comment_not_found');
  const entity = await db.query.communityEntities.findFirst({
    where: eq(communityEntities.id, comment.communityEntityId),
  });
  if (!canManageComment(params.session, comment, entity)) throw new Error('permission_denied');

  const replies =
    comment.parentCommentId === null
      ? await db.query.communityComments.findMany({
          where: and(
            eq(communityComments.parentCommentId, params.commentId),
            eq(communityComments.status, 'active')
          ),
        })
      : [];
  const deletedCount = 1 + replies.length;

  await db
    .update(communityComments)
    .set({
      status: 'deleted',
      deletedAt: new Date(),
      deletedByUserId: params.session.userId,
    })
    .where(eq(communityComments.id, params.commentId));
  if (replies.length > 0) {
    await db
      .update(communityComments)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        deletedByUserId: params.session.userId,
      })
      .where(inArray(communityComments.id, replies.map((reply) => reply.id)));
  }
  await db
    .update(communityEntities)
    .set({ commentsCount: sql`greatest(${communityEntities.commentsCount} - ${deletedCount}, 0)` })
    .where(eq(communityEntities.id, comment.communityEntityId));

  if (comment.parentCommentId) {
    await db
      .update(communityComments)
      .set({ repliesCount: sql`greatest(${communityComments.repliesCount} - 1, 0)` })
      .where(eq(communityComments.id, comment.parentCommentId));
  }

  // Also update the source table's denormalized counter
  if (entity) {
    if (entity.entityType === 'published_page') {
      await db.update(publishedPages)
        .set({ commentCount: sql`greatest(${publishedPages.commentCount} - ${deletedCount}, 0)` })
        .where(eq(publishedPages.id, entity.entityId));
    } else if (entity.entityType === 'moment') {
      await db.update(moments)
        .set({ commentCount: sql`greatest(${moments.commentCount} - ${deletedCount}, 0)` })
        .where(eq(moments.id, entity.entityId));
    }
  }

  return { success: true, deleted_count: deletedCount };
}

function canManageComment(
  session: Session,
  comment: typeof communityComments.$inferSelect,
  entity?: typeof communityEntities.$inferSelect | null
): boolean {
  return (
    session.userId === comment.userId ||
    session.userId === entity?.ownerUserId ||
    session.role === 'admin' ||
    session.role === 'super_admin' ||
    session.role === 'moderator'
  );
}

export async function ensureCommunityEntity(
  entityType: 'published_page' | 'moment' | 'comment',
  entityId: string
): Promise<typeof communityEntities.$inferSelect> {
  const existing = await db.query.communityEntities.findFirst({
    where: and(
      eq(communityEntities.entityType, entityType),
      eq(communityEntities.entityId, entityId),
      eq(communityEntities.status, 'active'),
      eq(communityEntities.visibility, 'public')
    ),
  });
  if (existing) return existing;

  if (entityType === 'comment') {
    const [comment] = await db.select().from(communityComments).where(
      and(eq(communityComments.id, entityId), eq(communityComments.status, 'active'))
    );
    if (!comment) throw new Error('community_entity_not_found');
    const [created] = await db.insert(communityEntities).values({
      entityType: 'comment', entityId: comment.id, ownerUserId: comment.userId,
      visibility: 'public', status: comment.status === 'active' ? 'active' : 'hidden', title: 'Comment',
    }).onConflictDoUpdate({
      target: [communityEntities.entityType, communityEntities.entityId],
      set: { status: comment.status === 'active' ? 'active' : 'hidden' },
    }).returning();
    return created;
  }

  if (entityType === 'published_page') {
    const [page] = await db.select({ userId: publishedPages.userId, title: publishedPages.title })
      .from(publishedPages).where(eq(publishedPages.id, entityId));
    if (!page) throw new Error('community_entity_not_found');
    const [created] = await db.insert(communityEntities).values({
      entityType: 'published_page', entityId, ownerUserId: page.userId,
      visibility: 'public', status: 'active', title: page.title,
    }).onConflictDoUpdate({
      target: [communityEntities.entityType, communityEntities.entityId],
      set: { title: page.title, status: 'active', visibility: 'public' },
    }).returning();
    return created;
  }

  if (entityType === 'moment') {
    const [m] = await db.select({ userId: moments.authorUserId, body: moments.body })
      .from(moments).where(eq(moments.id, entityId));
    if (!m) throw new Error('community_entity_not_found');
    const title = (m.body || '').length > 80 ? `${(m.body || '').slice(0, 80)}...` : (m.body || '');
    const [created] = await db.insert(communityEntities).values({
      entityType: 'moment', entityId, ownerUserId: m.userId,
      visibility: 'public', status: 'active', title,
    }).onConflictDoUpdate({
      target: [communityEntities.entityType, communityEntities.entityId],
      set: { title, status: 'active', visibility: 'public' },
    }).returning();
    return created;
  }

  throw new Error('community_entity_not_found');
}

export async function toggleReaction(params: {
  entityType: 'published_page' | 'moment' | 'comment';
  entityId: string;
  reactionType: 'like';
  session: Session;
}) {
  const entity = await ensureCommunityEntity(params.entityType, params.entityId);
  if (!canUseCommunityEntity(entity)) throw new Error('community_entity_not_found');

  const existing = await db.query.communityReactions.findFirst({
    where: and(
      eq(communityReactions.communityEntityId, entity.id),
      eq(communityReactions.userId, params.session.userId),
      eq(communityReactions.reactionType, params.reactionType)
    ),
  });

  const delta = existing ? -1 : 1
  if (existing) {
    await db.delete(communityReactions).where(eq(communityReactions.id, existing.id));
    await db.update(communityEntities)
      .set({ reactionsCount: sql`greatest(${communityEntities.reactionsCount} - 1, 0)` })
      .where(eq(communityEntities.id, entity.id));
    if (params.entityType === 'comment') {
      await db.update(communityComments)
        .set({ reactionsCount: sql`greatest(${communityComments.reactionsCount} - 1, 0)` })
        .where(eq(communityComments.id, params.entityId));
    }
  } else {
    await db.insert(communityReactions).values({
      communityEntityId: entity.id, userId: params.session.userId, reactionType: params.reactionType,
    });
    await db.update(communityEntities)
      .set({ reactionsCount: sql`${communityEntities.reactionsCount} + 1` })
      .where(eq(communityEntities.id, entity.id));
    if (params.entityType === 'comment') {
      await db.update(communityComments)
        .set({ reactionsCount: sql`${communityComments.reactionsCount} + 1` })
        .where(eq(communityComments.id, params.entityId));
    }
  }

  // Also update the source table's denormalized counter
  if (params.entityType === 'published_page') {
    await db.update(publishedPages)
      .set({ likeCount: sql`greatest(${publishedPages.likeCount} + ${delta}, 0)` })
      .where(eq(publishedPages.id, params.entityId));
  } else if (params.entityType === 'moment') {
    await db.update(moments)
      .set({ likeCount: sql`greatest(${moments.likeCount} + ${delta}, 0)` })
      .where(eq(moments.id, params.entityId));
  }

  const [updated] = await db.select({ reactionsCount: communityEntities.reactionsCount })
    .from(communityEntities).where(eq(communityEntities.id, entity.id));

  return {
    has_reacted: !existing,
    reaction_type: params.reactionType,
    reactions_count: updated?.reactionsCount ?? 0,
  };
}

export async function toggleBookmark(params: {
  entityType: 'published_page' | 'moment';
  entityId: string;
  session: Session;
}) {
  const entity = await ensureCommunityEntity(params.entityType, params.entityId);
  if (!canUseCommunityEntity(entity)) throw new Error('community_entity_not_found');

  const existing = await db.query.communityBookmarks.findFirst({
    where: and(
      eq(communityBookmarks.communityEntityId, entity.id),
      eq(communityBookmarks.userId, params.session.userId)
    ),
  });

  const delta = existing ? -1 : 1
  if (existing) {
    await db.delete(communityBookmarks).where(eq(communityBookmarks.id, existing.id));
    await db.update(communityEntities)
      .set({ bookmarksCount: sql`greatest(${communityEntities.bookmarksCount} - 1, 0)` })
      .where(eq(communityEntities.id, entity.id));
  } else {
    await db.insert(communityBookmarks).values({
      communityEntityId: entity.id, userId: params.session.userId,
    });
    await db.update(communityEntities)
      .set({ bookmarksCount: sql`${communityEntities.bookmarksCount} + 1` })
      .where(eq(communityEntities.id, entity.id));
  }

  // Also update the source table's denormalized counter
  if (params.entityType === 'published_page') {
    await db.update(publishedPages)
      .set({ bookmarkCount: sql`greatest(${publishedPages.bookmarkCount} + ${delta}, 0)` })
      .where(eq(publishedPages.id, params.entityId));
  } else if (params.entityType === 'moment') {
    await db.update(moments)
      .set({ bookmarkCount: sql`greatest(${moments.bookmarkCount} + ${delta}, 0)` })
      .where(eq(moments.id, params.entityId));
  }

  const [updated] = await db.select({ bookmarksCount: communityEntities.bookmarksCount })
    .from(communityEntities).where(eq(communityEntities.id, entity.id));

  return {
    has_bookmarked: !existing,
    bookmarks_count: updated?.bookmarksCount ?? 0,
  };
}

export async function listCommunityBookmarks(params: {
  session: Session;
  entityType?: 'published_page' | 'moment';
  limit: number;
  cursor: string | null;
}) {
  const decodedCursor = decodeCursor(params.cursor);
  const cursorCreatedAt = decodedCursor ? new Date(decodedCursor.created_at) : null;
  const cursorPredicate =
    decodedCursor && cursorCreatedAt && !Number.isNaN(cursorCreatedAt.getTime())
      ? or(
          lt(communityBookmarks.createdAt, cursorCreatedAt),
          and(
            eq(communityBookmarks.createdAt, cursorCreatedAt),
            lt(communityBookmarks.id, decodedCursor.id)
          )
        )
      : undefined;

  const rows = await db
    .select({
      favorite: communityBookmarks,
      entity: communityEntities,
      page: publishedPages,
    })
    .from(communityBookmarks)
    .innerJoin(communityEntities, eq(communityEntities.id, communityBookmarks.communityEntityId))
    .leftJoin(
      publishedPages,
      and(
        eq(communityEntities.entityType, 'published_page'),
        eq(publishedPages.id, communityEntities.entityId)
      )
    )
    .where(
      and(
        eq(communityBookmarks.userId, params.session.userId),
        params.entityType ? eq(communityEntities.entityType, params.entityType) : undefined,
        eq(communityEntities.status, 'active'),
        eq(communityEntities.visibility, 'public'),
        or(
          eq(communityEntities.entityType, 'moment'),
          and(
            eq(publishedPages.visibility, 'public'),
            eq(publishedPages.moderationStatus, 'approved')
          )
        ),
        cursorPredicate
      )
    )
    .orderBy(desc(communityBookmarks.createdAt), desc(communityBookmarks.id))
    .limit(params.limit + 1);

  const visibleRows = rows.slice(0, params.limit);
  return {
    items: visibleRows.map(({ favorite, entity, page }) => ({
      id: favorite.id,
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      title: entity.title,
      canonical_path: entity.canonicalPath,
      cover_url: (page as { coverUrl: string | null } | undefined)?.coverUrl ?? null,
      created_at: favorite.createdAt.toISOString(),
    })),
    next_cursor:
      rows.length > params.limit
        ? encodeCursor({
            created_at: visibleRows[visibleRows.length - 1].favorite.createdAt.toISOString(),
            id: visibleRows[visibleRows.length - 1].favorite.id,
          })
        : null,
    has_more: rows.length > params.limit,
  };
}

export async function recordPageView(params: {
  context: PublicPageContext;
  session: Session | null;
  source: 'read_shell' | 'html_direct' | 'share_link' | 'card_preview' | 'repost';
  route: string;
  shareLinkId?: string | null;
}) {
  const [event] = await db
    .insert(viewEvents)
    .values({
      entityType: 'published_page',
      entityId: params.context.page.id,
      actorUserId: params.session?.userId ?? null,
      source: params.source,
      route: params.route,
      referrerType: params.shareLinkId ? 'share' : 'unknown',
      shareLinkId: params.shareLinkId ?? null,
    })
    .returning();

  await db
    .update(publishedPages)
    .set({
      viewCount: sql`${publishedPages.viewCount} + 1`,
      readCount:
        params.source === 'read_shell'
          ? sql`${publishedPages.readCount} + 1`
          : sql`${publishedPages.readCount}`,
      statsUpdatedAt: sql`now()`,
    })
    .where(eq(publishedPages.id, params.context.page.id));

  if (params.session) {
    await db
      .insert(userBrowseHistory)
      .values({
        userId: params.session.userId,
        entityType: 'published_page',
        entityId: params.context.page.id,
        lastViewEventId: event.id,
        lastSource: params.source,
        lastRoute: params.route,
        snapshotTitle: params.context.page.title,
        snapshotAuthorUserId: params.context.author.id,
        coverUrl: params.context.page.coverUrl,
      })
      .onConflictDoUpdate({
        target: [userBrowseHistory.userId, userBrowseHistory.entityType, userBrowseHistory.entityId],
        set: {
          lastViewEventId: event.id,
          lastViewedAt: sql`now()`,
          viewCount: sql`${userBrowseHistory.viewCount} + 1`,
          lastSource: params.source,
          lastRoute: params.route,
          snapshotTitle: params.context.page.title,
          snapshotAuthorUserId: params.context.author.id,
          coverUrl: params.context.page.coverUrl,
          deletedAt: null,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function getBrowseHistory(
  session: Session,
  limit: number,
  cursor?: string | null,
) {
  const decodedCursor = cursor ? decodeCursor(cursor) : null
  const cursorPredicate =
    decodedCursor
      ? or(
          lt(userBrowseHistory.lastViewedAt, new Date(decodedCursor.created_at)),
          and(
            eq(userBrowseHistory.lastViewedAt, new Date(decodedCursor.created_at)),
            lt(userBrowseHistory.id, decodedCursor.id),
          ),
        )
      : undefined

  const rows = await db
    .select({
      history: userBrowseHistory,
      page: publishedPages,
      author: users,
    })
    .from(userBrowseHistory)
    .innerJoin(publishedPages, eq(publishedPages.id, userBrowseHistory.entityId))
    .innerJoin(users, eq(users.id, publishedPages.userId))
    .where(
      and(
        eq(userBrowseHistory.userId, session.userId),
        eq(userBrowseHistory.entityType, 'published_page'),
        isNull(userBrowseHistory.deletedAt),
        eq(publishedPages.visibility, 'public'),
        eq(publishedPages.moderationStatus, 'approved'),
        cursorPredicate,
      )
    )
    .orderBy(desc(userBrowseHistory.lastViewedAt), desc(userBrowseHistory.id))
    .limit(limit + 1);

  const visibleRows = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const cursorSource = hasMore ? visibleRows.at(-1)?.history : null

  return {
    items: visibleRows.map(({ history, page, author }) => ({
      id: history.id,
      entity_type: history.entityType,
      entity_id: history.entityId,
      title: page.title,
      description: page.description,
      user_slug: author.userSlug,
      page_id: page.uid,
      url: `/${encodeURIComponent(author.userSlug)}/${encodeURIComponent(page.uid)}?tab=read`,
      last_viewed_at: history.lastViewedAt.toISOString(),
      view_count: history.viewCount,
      last_source: history.lastSource,
      cover_url: page.coverUrl ?? null,
      author_display_name: page.authorDisplayName ?? author.displayName ?? null,
      author_slug: author.userSlug,
      author_avatar_url: author.avatarUrl ?? null,
      last_progress: history.lastProgress ?? null,
      stats: {
        views: page.viewCount,
        likes: page.likeCount,
        comments: page.commentCount,
        bookmarks: page.bookmarkCount,
      },
    })),
    next_cursor: cursorSource
      ? encodeCursor({
          created_at: cursorSource.lastViewedAt.toISOString(),
          id: cursorSource.id,
        })
      : null,
    has_more: hasMore,
  };
}

export async function createShareLink(params: {
  context: PublicPageContext;
  session: Session | null;
  channel: string;
}) {
  if (!isDirectLinkReadablePage(params.context.page)) {
    throw new Error('permission_denied');
  }

  const targetUrl = `/${encodeURIComponent(params.context.author.userSlug)}/${encodeURIComponent(params.context.page.uid)}?tab=read`;
  const htmlDirectUrl = `/page/${encodeURIComponent(params.context.author.userSlug)}/${encodeURIComponent(params.context.page.uid)}`;
  const uid = crypto.randomUUID().replaceAll('-', '');

  const [link] = await db
    .insert(shareLinks)
    .values({
      uid,
      entityType: 'published_page',
      entityId: params.context.page.id,
      createdByUserId: params.session?.userId ?? null,
      visibilitySnapshot: params.context.page.visibility,
      channel: params.channel,
      targetUrl,
      htmlDirectUrl,
    })
    .returning();

  await db.insert(shareEvents).values({
    shareLinkId: link.id,
    entityType: 'published_page',
    entityId: params.context.page.id,
    actorUserId: params.session?.userId ?? null,
    eventType: 'link_created',
    channel: params.channel,
    sourceRoute: targetUrl,
  });

  await db
    .update(publishedPages)
    .set({ shareCount: sql`${publishedPages.shareCount} + 1` })
    .where(eq(publishedPages.id, params.context.page.id));

  return {
    uid: link.uid,
    url: `${targetUrl}?share_id=${encodeURIComponent(link.uid)}`,
    target_url: targetUrl,
    html_direct_url: htmlDirectUrl,
    channel: link.channel,
  };
}

export async function followUser(params: {
  follower: Session;
  followeeSlug: string;
  notifyLevel: 'all' | 'major' | 'none';
}) {
  const followee = await db.query.users.findFirst({
    where: eq(users.userSlug, params.followeeSlug),
  });
  if (!followee) throw new Error('user_not_found');
  if (followee.id === params.follower.userId) throw new Error('cannot_follow_self');

  const existing = await db.query.userFollows.findFirst({
    where: and(
      eq(userFollows.followerUserId, params.follower.userId),
      eq(userFollows.followeeUserId, followee.id)
    ),
  });

  if (existing) {
    await db
      .update(userFollows)
      .set({ notifyLevel: params.notifyLevel, updatedAt: sql`now()` })
      .where(eq(userFollows.id, existing.id));
  } else {
    await db.insert(userFollows).values({
      followerUserId: params.follower.userId,
      followeeUserId: followee.id,
      notifyLevel: params.notifyLevel,
    });
    await db
      .update(users)
      .set({ followersCount: sql`${users.followersCount} + 1` })
      .where(eq(users.id, followee.id));
  }

  const updated = await db.query.users.findFirst({ where: eq(users.id, followee.id) });
  return { following: true, followers_count: updated?.followersCount ?? 0 };
}

export async function unfollowUser(params: { follower: Session; followeeSlug: string }) {
  const followee = await db.query.users.findFirst({
    where: eq(users.userSlug, params.followeeSlug),
  });
  if (!followee) throw new Error('user_not_found');

  const existing = await db.query.userFollows.findFirst({
    where: and(
      eq(userFollows.followerUserId, params.follower.userId),
      eq(userFollows.followeeUserId, followee.id)
    ),
  });
  if (existing) {
    await db.delete(userFollows).where(eq(userFollows.id, existing.id));
    await db
      .update(users)
      .set({ followersCount: sql`greatest(${users.followersCount} - 1, 0)` })
      .where(eq(users.id, followee.id));
  }

  const updated = await db.query.users.findFirst({ where: eq(users.id, followee.id) });
  return { following: false, followers_count: updated?.followersCount ?? 0 };
}

export async function subscribeToPage(params: {
  context: PublicPageContext;
  session: Session;
  notifyLevel: 'all' | 'major' | 'none';
}) {
  if (!canReadPage(params.context.page, params.session)) throw new Error('permission_denied');

  const existing = await db.query.pageSubscriptions.findFirst({
    where: and(
      eq(pageSubscriptions.userId, params.session.userId),
      eq(pageSubscriptions.publishedPageId, params.context.page.id)
    ),
  });
  if (existing) {
    await db
      .update(pageSubscriptions)
      .set({ notifyLevel: params.notifyLevel, updatedAt: sql`now()` })
      .where(eq(pageSubscriptions.id, existing.id));
  } else {
    await db.insert(pageSubscriptions).values({
      userId: params.session.userId,
      publishedPageId: params.context.page.id,
      notifyLevel: params.notifyLevel,
      lastSeenVersion: params.context.page.currentVersion ?? 0,
    });
    await db
      .update(publishedPages)
      .set({ subscriberCount: sql`${publishedPages.subscriberCount} + 1` })
      .where(eq(publishedPages.id, params.context.page.id));
  }

  const updated = await db.query.publishedPages.findFirst({
    where: eq(publishedPages.id, params.context.page.id),
  });

  return {
    subscribed: true,
    subscriber_count: updated?.subscriberCount ?? 0,
    notify_level: params.notifyLevel,
    last_seen_version: params.context.page.currentVersion ?? 0,
  };
}

export async function unsubscribeFromPage(params: {
  context: PublicPageContext;
  session: Session;
}) {
  const existing = await db.query.pageSubscriptions.findFirst({
    where: and(
      eq(pageSubscriptions.userId, params.session.userId),
      eq(pageSubscriptions.publishedPageId, params.context.page.id)
    ),
  });
  if (existing) {
    await db.delete(pageSubscriptions).where(eq(pageSubscriptions.id, existing.id));
    await db
      .update(publishedPages)
      .set({ subscriberCount: sql`greatest(${publishedPages.subscriberCount} - 1, 0)` })
      .where(eq(publishedPages.id, params.context.page.id));
  }

  const updated = await db.query.publishedPages.findFirst({
    where: eq(publishedPages.id, params.context.page.id),
  });

  return { subscribed: false, subscriber_count: updated?.subscriberCount ?? 0 };
}

export async function updatePageSubscription(params: {
  context: PublicPageContext;
  session: Session;
  notifyLevel?: 'all' | 'major' | 'none';
  lastSeenVersion?: number;
}) {
  if (!canReadPage(params.context.page, params.session)) throw new Error('permission_denied');

  const existing = await db.query.pageSubscriptions.findFirst({
    where: and(
      eq(pageSubscriptions.userId, params.session.userId),
      eq(pageSubscriptions.publishedPageId, params.context.page.id)
    ),
  });
  if (!existing) throw new Error('subscription_not_found');

  const nextLastSeenVersion =
    typeof params.lastSeenVersion === 'number'
      ? Math.max(existing.lastSeenVersion, params.lastSeenVersion)
      : existing.lastSeenVersion;
  const nextNotifyLevel = params.notifyLevel ?? existing.notifyLevel;

  await db
    .update(pageSubscriptions)
    .set({
      notifyLevel: nextNotifyLevel,
      lastSeenVersion: nextLastSeenVersion,
      updatedAt: sql`now()`,
    })
    .where(eq(pageSubscriptions.id, existing.id));

  return {
    subscribed: true,
    notify_level: nextNotifyLevel,
    last_seen_version: nextLastSeenVersion,
  };
}

export async function recordPageUpdateAndNotify(
  tx: PageUpdateNotificationTx,
  params: {
    publishedPageId: string;
    userId: string;
    userSlug: string;
    pageId: string;
    version: number;
    eventType: 'published' | 'updated' | 'republished' | 'unpublished';
    importance: 'normal' | 'major';
    title: string;
    description: string | null;
    visibility: string;
  }
) {
  const [createdEvent] = await tx
    .insert(pageUpdateEvents)
    .values({
      publishedPageId: params.publishedPageId,
      userId: params.userId,
      userSlug: params.userSlug,
      pageId: params.pageId,
      version: params.version,
      eventType: params.eventType,
      importance: params.importance,
      title: params.title,
      description: params.description,
      visibility: params.visibility,
    })
    .onConflictDoNothing()
    .returning();

  const event =
    createdEvent ??
    (await tx.query.pageUpdateEvents.findFirst({
      where: and(
        eq(pageUpdateEvents.publishedPageId, params.publishedPageId),
        eq(pageUpdateEvents.version, params.version),
        eq(pageUpdateEvents.eventType, params.eventType)
      ),
    }));

  if (!event || params.eventType === 'unpublished' || params.visibility !== 'public') return;

  const recipients = await getPageUpdateNotificationRecipients(tx, params);
  if (recipients.length === 0) return;

  await tx
    .insert(notifications)
    .values(
      recipients.map((recipientUserId) => ({
        recipientUserId,
        actorUserId: params.userId,
        type: params.eventType === 'published' ? 'page_published' : 'page_updated',
        pageUpdateEventId: event.id,
        publishedPageId: params.publishedPageId,
        title: params.title,
        body: params.description,
      }))
    )
    .onConflictDoNothing();
}

async function getPageUpdateNotificationRecipients(
  tx: PageUpdateNotificationTx,
  params: {
    publishedPageId: string;
    userId: string;
    importance: 'normal' | 'major';
  }
) {
  const [subscriptions, follows] = await Promise.all([
    tx.query.pageSubscriptions.findMany({
      where: eq(pageSubscriptions.publishedPageId, params.publishedPageId),
    }),
    tx.query.userFollows.findMany({
      where: eq(userFollows.followeeUserId, params.userId),
    }),
  ]);

  const recipients = new Set<string>();
  for (const subscription of subscriptions) {
    addNotificationRecipient(recipients, {
      recipientUserId: subscription.userId,
      actorUserId: params.userId,
      notifyLevel: subscription.notifyLevel,
      importance: params.importance,
    });
  }
  for (const follow of follows) {
    addNotificationRecipient(recipients, {
      recipientUserId: follow.followerUserId,
      actorUserId: params.userId,
      notifyLevel: follow.notifyLevel,
      importance: params.importance,
    });
  }

  return [...recipients];
}

function addNotificationRecipient(
  recipients: Set<string>,
  params: {
    recipientUserId: string;
    actorUserId: string;
    notifyLevel: 'all' | 'major' | 'none';
    importance: 'normal' | 'major';
  }
) {
  if (params.recipientUserId === params.actorUserId) return;
  if (params.notifyLevel === 'none') return;
  if (params.notifyLevel === 'major' && params.importance !== 'major') return;
  recipients.add(params.recipientUserId);
}

export async function listSubscriptionFeed(
  session: Session,
  options: {
    limit: number;
    cursor?: string | null;
    includeSeen?: boolean;
    source?: 'all' | 'followed_authors' | 'subscribed_pages';
  }
) {
  const limit = options.limit;
  const follows = await db.query.userFollows.findMany({
    where: eq(userFollows.followerUserId, session.userId),
  });
  const subscriptions = await db.query.pageSubscriptions.findMany({
    where: eq(pageSubscriptions.userId, session.userId),
  });

  const followeeIds = follows.map((follow) => follow.followeeUserId);
  const subscribedPageIds = subscriptions.map((subscription) => subscription.publishedPageId);

  const source = options.source ?? 'all';
  const sourcePredicates = [];
  if (source !== 'subscribed_pages' && followeeIds.length > 0) {
    sourcePredicates.push(inArray(pageUpdateEvents.userId, followeeIds));
  }
  if (source !== 'followed_authors' && subscribedPageIds.length > 0) {
    sourcePredicates.push(inArray(pageUpdateEvents.publishedPageId, subscribedPageIds));
  }

  if (sourcePredicates.length === 0) {
    return { items: [], next_cursor: null, has_more: false };
  }

  const decodedCursor = decodeCursor(options.cursor ?? null);
  const cursorCreatedAt = decodedCursor ? new Date(decodedCursor.created_at) : null;
  const cursorPredicate =
    decodedCursor && cursorCreatedAt && !Number.isNaN(cursorCreatedAt.getTime())
      ? or(
          lt(pageUpdateEvents.createdAt, cursorCreatedAt),
          and(
            eq(pageUpdateEvents.createdAt, cursorCreatedAt),
            lt(pageUpdateEvents.id, decodedCursor.id)
          )
        )
      : undefined;

  const includeSeen = options.includeSeen ?? true;
  const unseenPredicates = includeSeen
    ? []
    : subscriptions
        .filter((subscription) => subscribedPageIds.includes(subscription.publishedPageId))
        .map((subscription) =>
          and(
            eq(pageUpdateEvents.publishedPageId, subscription.publishedPageId),
            gt(pageUpdateEvents.version, subscription.lastSeenVersion)
          )
        );
  const seenPredicate =
    includeSeen || unseenPredicates.length === 0 ? undefined : or(...unseenPredicates);

  const rows = await db
    .select({
      event: pageUpdateEvents,
      page: publishedPages,
    })
    .from(pageUpdateEvents)
    .innerJoin(publishedPages, eq(publishedPages.id, pageUpdateEvents.publishedPageId))
    .where(
      and(
        or(...sourcePredicates),
        cursorPredicate,
        seenPredicate,
        eq(publishedPages.visibility, 'public'),
        eq(publishedPages.moderationStatus, 'approved')
      )
    )
    .orderBy(desc(pageUpdateEvents.createdAt), desc(pageUpdateEvents.id))
    .limit(limit + 1);

  const eventIds = rows.map(({ event }) => event.id);
  const readNotifications =
    eventIds.length > 0
      ? await db.query.notifications.findMany({
          where: and(
            eq(notifications.recipientUserId, session.userId),
            inArray(notifications.pageUpdateEventId, eventIds)
          ),
        })
      : [];
  const readEventIds = new Set(
    readNotifications
      .filter((notification) => notification.readAt)
      .map((notification) => notification.pageUpdateEventId)
      .filter((eventId): eventId is string => Boolean(eventId))
  );

  const filteredRows = includeSeen
    ? rows
    : rows.filter(({ event }) => {
        const subscription = subscriptions.find(
          (item) => item.publishedPageId === event.publishedPageId
        );
        const subscriptionSeen = (subscription?.lastSeenVersion ?? -1) >= event.version;
        return !subscriptionSeen && !readEventIds.has(event.id);
      });
  const visibleRows = filteredRows.slice(0, limit);
  return {
    items: visibleRows.map(({ event }) => ({
      event_id: event.id,
      published_page_id: event.publishedPageId,
      user_slug: event.userSlug,
      page_id: event.pageId,
      version: event.version,
      event_type: event.eventType,
      importance: event.importance,
      title: event.title,
      description: event.description,
      change_summary: event.changeSummary,
      created_at: event.createdAt.toISOString(),
      source_reasons: [
        ...(subscribedPageIds.includes(event.publishedPageId) ? ['subscribed_page'] : []),
        ...(followeeIds.includes(event.userId) ? ['followed_author'] : []),
      ],
      is_seen:
        (subscriptions.find((subscription) => subscription.publishedPageId === event.publishedPageId)
          ?.lastSeenVersion ?? -1) >= event.version || readEventIds.has(event.id),
      url: `/${encodeURIComponent(event.userSlug)}/${encodeURIComponent(event.pageId)}?tab=read`,
    })),
    next_cursor:
      filteredRows.length > limit
        ? encodeCursor({
            created_at: visibleRows[visibleRows.length - 1].event.createdAt.toISOString(),
            id: visibleRows[visibleRows.length - 1].event.id,
          })
        : null,
    has_more: filteredRows.length > limit,
  };
}

export async function listNotifications(
  session: Session,
  limit: number,
  unreadOnly: boolean,
  cursor: string | null = null
) {
  const decodedCursor = decodeCursor(cursor);
  const cursorCreatedAt = decodedCursor ? new Date(decodedCursor.created_at) : null;
  const cursorPredicate =
    decodedCursor && cursorCreatedAt && !Number.isNaN(cursorCreatedAt.getTime())
      ? or(
          lt(notifications.createdAt, cursorCreatedAt),
          and(
            eq(notifications.createdAt, cursorCreatedAt),
            lt(notifications.id, decodedCursor.id)
          )
        )
      : undefined;

  const notificationVisibilityPredicate = getNotificationVisibilityPredicate(session);
  const rows = await db
    .select({
      notification: notifications,
    })
    .from(notifications)
    .leftJoin(publishedPages, eq(publishedPages.id, notifications.publishedPageId))
    .where(
      and(
        eq(notifications.recipientUserId, session.userId),
        unreadOnly ? isNull(notifications.readAt) : undefined,
        cursorPredicate,
        notificationVisibilityPredicate
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const unreadCount = await db
    .select({ value: count() })
    .from(notifications)
    .leftJoin(publishedPages, eq(publishedPages.id, notifications.publishedPageId))
    .where(
      and(
        eq(notifications.recipientUserId, session.userId),
        isNull(notifications.readAt),
        notificationVisibilityPredicate
      )
    );

  const visibleRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const cursorSource = hasMore ? visibleRows.at(-1)?.notification : null;

  return {
    items: visibleRows.map(({ notification }) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read_at: notification.readAt?.toISOString() ?? null,
      created_at: notification.createdAt.toISOString(),
      published_page_id: notification.publishedPageId,
      page_update_event_id: notification.pageUpdateEventId,
      actor_name: notification.actorName ?? null,
      actor_avatar_url: notification.actorAvatarUrl ?? null,
      page_uid: notification.pageUid ?? null,
      page_author_slug: notification.pageAuthorSlug ?? null,
    })),
    next_cursor: cursorSource
      ? encodeCursor({
          created_at: cursorSource.createdAt.toISOString(),
          id: cursorSource.id,
        })
      : null,
    has_more: hasMore,
    unread_count: unreadCount[0]?.value ?? 0,
  };
}

export async function markNotificationsRead(params: {
  session: Session;
  notificationIds: string[];
  beforeCursor: string | null;
}) {
  if (params.notificationIds.length === 0 && !params.beforeCursor) {
    return { success: true, updated_count: 0 };
  }

  const cursor = decodeCursor(params.beforeCursor);
  if (params.beforeCursor && !cursor) {
    throw new Error('invalid_cursor');
  }
  const cursorCreatedAt = cursor ? new Date(cursor.created_at) : null;
  const cursorPredicate =
    cursor && cursorCreatedAt && !Number.isNaN(cursorCreatedAt.getTime())
      ? or(
          lt(notifications.createdAt, cursorCreatedAt),
          and(
            eq(notifications.createdAt, cursorCreatedAt),
            lt(notifications.id, cursor.id)
          )
        )
      : undefined;
  const idPredicate =
    params.notificationIds.length > 0
      ? inArray(notifications.id, params.notificationIds)
      : undefined;
  const where = and(
    eq(notifications.recipientUserId, params.session.userId),
    idPredicate,
    cursorPredicate
  );

  const rows = await db.query.notifications.findMany({
    where,
  });
  const pageUpdateEventIds = rows
    .map((notification) => notification.pageUpdateEventId)
    .filter((eventId): eventId is string => Boolean(eventId));
  const events =
    pageUpdateEventIds.length > 0
      ? await db.query.pageUpdateEvents.findMany({
          where: inArray(pageUpdateEvents.id, pageUpdateEventIds),
        })
      : [];
  const eventById = new Map(events.map((event) => [event.id, event]));

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(where);

  for (const notification of rows) {
    const event = notification.pageUpdateEventId
      ? eventById.get(notification.pageUpdateEventId)
      : null;
    if (!event) continue;
    await advancePageSubscriptionSeenVersion({
      userId: params.session.userId,
      publishedPageId: event.publishedPageId,
      version: event.version,
    });
  }

  return {
    success: true,
    updated_count: rows.length,
  };
}

async function advancePageSubscriptionSeenVersion(params: {
  userId: string;
  publishedPageId: string;
  version: number;
}) {
  const subscription = await db.query.pageSubscriptions.findFirst({
    where: and(
      eq(pageSubscriptions.userId, params.userId),
      eq(pageSubscriptions.publishedPageId, params.publishedPageId)
    ),
  });
  if (!subscription) return;

  const nextLastSeenVersion = Math.max(subscription.lastSeenVersion, params.version);
  if (nextLastSeenVersion === subscription.lastSeenVersion) return;

  await db
    .update(pageSubscriptions)
    .set({
      lastSeenVersion: nextLastSeenVersion,
      updatedAt: sql`now()`,
    })
    .where(eq(pageSubscriptions.id, subscription.id));
}

function getNotificationVisibilityPredicate(session: Session) {
  return or(
    isNull(notifications.publishedPageId),
    and(
      eq(publishedPages.id, notifications.publishedPageId),
      or(
        and(
          inArray(publishedPages.visibility, ['public', 'unlisted']),
          eq(publishedPages.moderationStatus, 'approved')
        ),
        eq(publishedPages.userId, session.userId)
      )
    )
  );
}

export async function listMoments(params: {
  feedType: 'following' | 'latest' | 'recommended';
  session: Session | null;
  limit: number;
  cursor?: string | null;
}): Promise<ListMomentsResult> {
  let authorIds: string[] | null = null;
  let fallbackFeedType: string | null = null;

  if (params.feedType === 'following') {
    if (!params.session) {
      throw new Error('login_required');
    }
    const follows = await db.query.userFollows.findMany({
      where: eq(userFollows.followerUserId, params.session.userId),
    });
    authorIds = follows.map((follow) => follow.followeeUserId);
    if (authorIds.length === 0) {
      fallbackFeedType = 'recommended';
      authorIds = null;
    }
  }

  // Decode cursor
  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;
  if (params.cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(params.cursor, 'base64url').toString('utf8'));
      if (parsed.created_at) cursorCreatedAt = new Date(parsed.created_at);
      if (parsed.id) cursorId = parsed.id;
    } catch { /* invalid cursor, start from beginning */ }
  }

  const rows = await db
    .select({
      moment: moments,
      author: {
        id: users.id,
        userSlug: users.userSlug,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(moments)
    .innerJoin(users, eq(users.id, moments.authorUserId))
    .where(
      and(
        eq(moments.visibility, 'public'),
        eq(moments.isDeleted, false),
        authorIds && authorIds.length > 0 ? inArray(moments.authorUserId, authorIds) : undefined,
        cursorCreatedAt && cursorId
          ? or(
              lt(moments.createdAt, cursorCreatedAt),
              and(eq(moments.createdAt, cursorCreatedAt), lt(moments.id, cursorId))
            )
          : undefined,
      )
    )
    .orderBy(desc(moments.createdAt), desc(moments.id))
    .limit(params.limit + 1); // Fetch one extra to determine has_more

  const momentIds = rows.map(({ moment }) => moment.id);
  const attachments =
    momentIds.length > 0
      ? await db.query.momentAttachments.findMany({
          where: inArray(momentAttachments.momentId, momentIds),
          orderBy: [momentAttachments.sortOrder],
        })
      : [];

  // Query viewer interaction state (has liked / has bookmarked)
  const viewerLikedMomentIds = new Set<string>();
  const viewerBookmarkedMomentIds = new Set<string>();
  if (params.session && momentIds.length > 0) {
    const entities = await db.query.communityEntities.findMany({
      where: and(
        eq(communityEntities.entityType, 'moment'),
        inArray(communityEntities.entityId, momentIds),
        eq(communityEntities.status, 'active'),
      ),
      columns: { id: true, entityId: true },
    });
    const entityIdToMomentId = new Map(entities.map((e) => [e.id, e.entityId]));
    const entityIds = entities.map((e) => e.id);

    if (entityIds.length > 0) {
      const [reactions, favorites] = await Promise.all([
        db.query.communityReactions.findMany({
          where: and(
            inArray(communityReactions.communityEntityId, entityIds),
            eq(communityReactions.userId, params.session!.userId),
            eq(communityReactions.reactionType, 'like'),
          ),
          columns: { communityEntityId: true },
        }),
        db.query.communityBookmarks.findMany({
          where: and(
            inArray(communityBookmarks.communityEntityId, entityIds),
            eq(communityBookmarks.userId, params.session!.userId),
          ),
          columns: { communityEntityId: true },
        }),
      ]);

      for (const r of reactions) {
        const mId = entityIdToMomentId.get(r.communityEntityId);
        if (mId) viewerLikedMomentIds.add(mId);
      }
      for (const f of favorites) {
        const mId = entityIdToMomentId.get(f.communityEntityId);
        if (mId) viewerBookmarkedMomentIds.add(mId);
      }
    }
  }

  // Compute pagination
  const hasMore = rows.length > params.limit;
  const items = rows.slice(0, params.limit);
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ created_at: lastItem.moment.createdAt.toISOString(), id: lastItem.moment.id }),
      'utf8',
    ).toString('base64url');
  }

  return {
    items: items.map(({ moment, author }) => ({
      moment: {
        id: moment.id,
        uid: moment.uid,
        kind: moment.kind,
        body: moment.body,
        visibility: moment.visibility,
        like_count: moment.likeCount,
        comment_count: moment.commentCount,
        repost_count: moment.repostCount,
        created_at: moment.createdAt.toISOString(),
        source: moment.source,
        quote_text: moment.quoteText,
        view_count: moment.viewCount,
        bookmark_count: moment.bookmarkCount,
      },
      author: {
        id: author.id,
        user_slug: author.userSlug,
        display_name: author.displayName,
        avatar_url: author.avatarUrl,
      },
      attachments: attachments
        .filter((attachment) => attachment.momentId === moment.id)
        .map((attachment) => ({
          attachment_type: attachment.attachmentType,
          attachment_id: attachment.attachmentId,
          attachment_uid: attachment.attachmentUid,
          title: attachment.titleSnapshot,
          description: attachment.descriptionSnapshot,
          cover_url: attachment.coverUrlSnapshot,
          author_name_snapshot: attachment.authorNameSnapshot,
          view_count_snapshot: attachment.viewCountSnapshot,
          comment_count_snapshot: attachment.commentCountSnapshot,
        })),
      topics: [],
      viewer_state: {
        is_authenticated: Boolean(params.session),
        can_edit: params.session?.userId === moment.authorUserId,
        can_delete: params.session?.userId === moment.authorUserId,
        has_liked: viewerLikedMomentIds.has(moment.id),
        has_bookmarked: viewerBookmarkedMomentIds.has(moment.id),
      },
    })),
    next_cursor: nextCursor,
    has_more: hasMore,
    feed_type: fallbackFeedType ?? params.feedType,
    fallback_feed_type: fallbackFeedType,
  };
}

export async function createMoment(params: {
  session: Session;
  body: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  topics: string[];
}) {
  const body = params.body?.trim() ?? '';
  if (!body && params.topics.length === 0) throw new Error('moment_empty');

  const [moment] = await db
    .insert(moments)
    .values({
      uid: crypto.randomUUID().slice(0, 12),
      authorUserId: params.session.userId,
      kind: 'post',
      body,
      visibility: params.visibility,
      topicCount: params.topics.length,
    })
    .returning();

  for (const rawTopic of params.topics.slice(0, 5)) {
    const slug = normalizeTopic(rawTopic);
    if (!slug) continue;
    const [topic] = await db
      .insert(momentTopics)
      .values({ slug, displayName: rawTopic.replace(/^#/, '') })
      .onConflictDoUpdate({
        target: [momentTopics.slug],
        set: { updatedAt: sql`now()` },
      })
      .returning();
    await db
      .insert(momentTopicItems)
      .values({ momentId: moment.id, topicId: topic.id, source: 'body' })
      .onConflictDoNothing();
  }

  return { uid: moment.uid, body: moment.body, visibility: moment.visibility };
}

function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export const listRanking = cache(async (params: {
  rankingKey: string;
  timeWindow: string;
  limit: number;
}) => {
  const snapshot = await db.query.rankingSnapshots.findFirst({
    where: and(
      eq(rankingSnapshots.rankingKey, params.rankingKey),
      eq(rankingSnapshots.timeWindow, params.timeWindow),
      eq(rankingSnapshots.status, 'ready'),
      lt(rankingSnapshots.validFrom, new Date())
    ),
    orderBy: [desc(rankingSnapshots.generatedAt), desc(rankingSnapshots.createdAt)],
  });

  if (!snapshot) {
    return {
      ranking_key: params.rankingKey,
      time_window: params.timeWindow,
      scope_type: 'global',
      scope_id: null,
      snapshot_id: null,
      algorithm_version: null,
      generated_at: null,
      items: [],
      next_cursor: null,
      has_more: false,
      seed: null,
      error_code: 'ranking_snapshot_not_found',
    };
  }

  const rows = await db
    .select({
      item: rankingItems,
      page: publishedPages,
      author: users,
    })
    .from(rankingItems)
    .innerJoin(publishedPages, eq(publishedPages.id, rankingItems.entityId))
    .innerJoin(users, eq(users.id, publishedPages.userId))
    .where(
      and(
        eq(rankingItems.snapshotId, snapshot.id),
        eq(publishedPages.visibility, 'public'),
        eq(publishedPages.moderationStatus, 'approved')
      )
    )
    .orderBy(rankingItems.rank)
    .limit(params.limit + 1);

  const visibleRows = rows.slice(0, params.limit);
  return {
    ranking_key: snapshot.rankingKey,
    time_window: snapshot.timeWindow,
    scope_type: snapshot.scopeType,
    scope_id: snapshot.scopeId,
    snapshot_id: snapshot.id,
    algorithm_version: snapshot.algorithmVersion,
    generated_at: snapshot.generatedAt?.toISOString() ?? null,
    items: visibleRows.map(({ item, page, author }) => ({
      rank: item.rank,
      entity_type: item.entityType,
      entity_id: item.entityId,
      score: item.score,
      reason: item.reason,
      title: page.title,
      description: page.description,
      user_slug: author.userSlug,
      page_id: page.uid,
      read_url: `/${encodeURIComponent(author.userSlug)}/${encodeURIComponent(page.uid)}?tab=read`,
      category_id: page.categoryId,
      cover_url: page.coverUrl,
      tags: page.tags,
      published_at: page.publishedAt.toISOString(),
      last_published_at: page.lastPublishedAt.toISOString(),
      delta: item.delta,
      score_label: item.scoreLabel,
      view_count: item.viewCount,
      like_count: item.likeCount,
      comment_count: item.commentCount,
      author_display_name: item.authorDisplayName,
      author_avatar_url: item.authorAvatarUrl,
      stats: {
        view_count: page.viewCount,
        read_count: page.readCount,
        like_count: page.likeCount,
        bookmark_count: page.bookmarkCount,
        comment_count: page.commentCount,
        share_count: page.shareCount,
        repost_count: page.repostCount,
      },
    })),
    next_cursor: null,
    has_more: rows.length > params.limit,
    seed: null,
  };
});

export async function listPagesByTag(tag: string, limit: number = 20) {
  const rows = await db
    .select({
      page: publishedPages,
      author: users,
    })
    .from(publishedPages)
    .innerJoin(users, eq(users.id, publishedPages.userId))
    .where(and(
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved"),
      sql`${publishedPages.tags} @> ${JSON.stringify([tag])}::jsonb`
    ))
    .orderBy(desc(publishedPages.lastPublishedAt))
    .limit(limit)

  return rows.map(({ page, author }) => ({
    ...page,
    author: {
      id: author.id,
      user_slug: author.userSlug,
      display_name: author.displayName,
      avatar_url: author.avatarUrl,
    },
  }))
}
