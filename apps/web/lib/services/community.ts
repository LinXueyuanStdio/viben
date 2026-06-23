import { and, count, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  communityComments,
  communityEntities,
  communityFavorites,
  communityReactions,
  db,
  momentAttachments,
  momentTopicItems,
  momentTopics,
  moments,
  notifications,
  operationRevisions,
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

export type PublicPageContext = {
  page: typeof publishedPages.$inferSelect;
  author: typeof users.$inferSelect;
};

export type CursorParts = {
  created_at: string;
  id: string;
};

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

export async function getPublishedPageContext(
  userSlug: string,
  pageId: string
): Promise<PublicPageContext | null> {
  const author = await db.query.users.findFirst({
    where: eq(users.userSlug, userSlug),
  });

  if (!author) return null;

  const page = await db.query.publishedPages.findFirst({
    where: and(eq(publishedPages.userId, author.id), eq(publishedPages.uid, pageId)),
  });

  if (!page) return null;

  return { page, author };
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
  const canonicalPath = `/read/${encodeURIComponent(context.author.userSlug)}/${encodeURIComponent(context.page.uid)}`;

  await db
    .insert(communityEntities)
    .values({
      entityType: 'published_page',
      entityId: context.page.id,
      ownerUserId: context.page.userId,
      visibility: context.page.visibility,
      status: isPublicPage(context.page) || context.page.visibility !== 'private' ? 'active' : 'hidden',
      title: context.page.title,
      canonicalPath,
    })
    .onConflictDoUpdate({
      target: [communityEntities.entityType, communityEntities.entityId],
      set: {
        ownerUserId: context.page.userId,
        visibility: context.page.visibility,
        status: isPublicPage(context.page) || context.page.visibility !== 'private' ? 'active' : 'hidden',
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
        db.query.communityFavorites.findFirst({
          where: and(
            eq(communityFavorites.communityEntityId, entity.id),
            eq(communityFavorites.userId, session.userId)
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
      favorites_count: entity.favoritesCount,
      comments_count: entity.commentsCount,
      canonical_path: entity.canonicalPath,
    },
    viewer: {
      is_authenticated: Boolean(session),
      has_reacted: Boolean(reaction),
      has_favorited: Boolean(favorite),
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
        eq(communityComments.status, 'active')
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

  return db.transaction(async (tx) => {
    const entity = await tx.query.communityEntities.findFirst({
      where: and(
        eq(communityEntities.entityType, params.entityType),
        eq(communityEntities.entityId, params.entityId),
        eq(communityEntities.status, 'active'),
        eq(communityEntities.visibility, 'public')
      ),
    });

    if (!entity) {
      throw new Error('community_entity_not_found');
    }

    let parent: typeof communityComments.$inferSelect | null = null;
    if (params.parentCommentId) {
      parent =
        (await tx.query.communityComments.findFirst({
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

    const [comment] = await tx
      .insert(communityComments)
      .values({
        communityEntityId: entity.id,
        parentCommentId: parent?.id ?? null,
        userId: params.session.userId,
        content,
        depth: parent ? 1 : 0,
      })
      .returning();

    await tx
      .update(communityEntities)
      .set({ commentsCount: sql`${communityEntities.commentsCount} + 1` })
      .where(eq(communityEntities.id, entity.id));

    if (parent) {
      await tx
        .update(communityComments)
        .set({ repliesCount: sql`${communityComments.repliesCount} + 1` })
        .where(eq(communityComments.id, parent.id));
    }

    return comment;
  });
}

export async function toggleReaction(params: {
  entityType: 'published_page' | 'moment' | 'comment';
  entityId: string;
  reactionType: 'like';
  session: Session;
}) {
  return db.transaction(async (tx) => {
    let entity = await tx.query.communityEntities.findFirst({
      where: and(
        eq(communityEntities.entityType, params.entityType),
        eq(communityEntities.entityId, params.entityId),
        eq(communityEntities.status, 'active'),
        eq(communityEntities.visibility, 'public')
      ),
    });

    if (!entity && params.entityType === 'comment') {
      const comment = await tx.query.communityComments.findFirst({
        where: eq(communityComments.id, params.entityId),
      });
      if (!comment) throw new Error('community_entity_not_found');
      const [created] = await tx
        .insert(communityEntities)
        .values({
          entityType: 'comment',
          entityId: comment.id,
          ownerUserId: comment.userId,
          visibility: 'public',
          status: comment.status === 'active' ? 'active' : 'hidden',
          title: 'Comment',
        })
        .onConflictDoUpdate({
          target: [communityEntities.entityType, communityEntities.entityId],
          set: { status: comment.status === 'active' ? 'active' : 'hidden' },
        })
        .returning();
      entity = created;
    }

    if (!entity || !canUseCommunityEntity(entity)) throw new Error('community_entity_not_found');

    const existing = await tx.query.communityReactions.findFirst({
      where: and(
        eq(communityReactions.communityEntityId, entity.id),
        eq(communityReactions.userId, params.session.userId),
        eq(communityReactions.reactionType, params.reactionType)
      ),
    });

    if (existing) {
      await tx
        .delete(communityReactions)
        .where(eq(communityReactions.id, existing.id));
      await tx
        .update(communityEntities)
        .set({ reactionsCount: sql`greatest(${communityEntities.reactionsCount} - 1, 0)` })
        .where(eq(communityEntities.id, entity.id));
      if (params.entityType === 'comment') {
        await tx
          .update(communityComments)
          .set({ reactionsCount: sql`greatest(${communityComments.reactionsCount} - 1, 0)` })
          .where(eq(communityComments.id, params.entityId));
      }
    } else {
      await tx.insert(communityReactions).values({
        communityEntityId: entity.id,
        userId: params.session.userId,
        reactionType: params.reactionType,
      });
      await tx
        .update(communityEntities)
        .set({ reactionsCount: sql`${communityEntities.reactionsCount} + 1` })
        .where(eq(communityEntities.id, entity.id));
      if (params.entityType === 'comment') {
        await tx
          .update(communityComments)
          .set({ reactionsCount: sql`${communityComments.reactionsCount} + 1` })
          .where(eq(communityComments.id, params.entityId));
      }
    }

    const updated = await tx.query.communityEntities.findFirst({
      where: eq(communityEntities.id, entity.id),
    });

    return {
      has_reacted: !existing,
      reaction_type: params.reactionType,
      reactions_count: updated?.reactionsCount ?? 0,
    };
  });
}

export async function toggleFavorite(params: {
  entityType: 'published_page' | 'moment';
  entityId: string;
  session: Session;
}) {
  return db.transaction(async (tx) => {
    const entity = await tx.query.communityEntities.findFirst({
      where: and(
        eq(communityEntities.entityType, params.entityType),
        eq(communityEntities.entityId, params.entityId),
        eq(communityEntities.status, 'active'),
        eq(communityEntities.visibility, 'public')
      ),
    });

    if (!entity || !canUseCommunityEntity(entity)) throw new Error('community_entity_not_found');

    const existing = await tx.query.communityFavorites.findFirst({
      where: and(
        eq(communityFavorites.communityEntityId, entity.id),
        eq(communityFavorites.userId, params.session.userId)
      ),
    });

    if (existing) {
      await tx.delete(communityFavorites).where(eq(communityFavorites.id, existing.id));
      await tx
        .update(communityEntities)
        .set({ favoritesCount: sql`greatest(${communityEntities.favoritesCount} - 1, 0)` })
        .where(eq(communityEntities.id, entity.id));
    } else {
      await tx.insert(communityFavorites).values({
        communityEntityId: entity.id,
        userId: params.session.userId,
      });
      await tx
        .update(communityEntities)
        .set({ favoritesCount: sql`${communityEntities.favoritesCount} + 1` })
        .where(eq(communityEntities.id, entity.id));
    }

    const updated = await tx.query.communityEntities.findFirst({
      where: eq(communityEntities.id, entity.id),
    });

    return {
      has_favorited: !existing,
      favorites_count: updated?.favoritesCount ?? 0,
    };
  });
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
        snapshotCoverAssetId: params.context.page.coverAssetId,
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
          snapshotCoverAssetId: params.context.page.coverAssetId,
          deletedAt: null,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function getBrowseHistory(session: Session, limit: number) {
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
        eq(publishedPages.moderationStatus, 'approved')
      )
    )
    .orderBy(desc(userBrowseHistory.lastViewedAt))
    .limit(limit);

  return {
    items: rows.map(({ history, page, author }) => ({
      id: history.id,
      entity_type: history.entityType,
      entity_id: history.entityId,
      title: page.title,
      description: page.description,
      user_slug: author.userSlug,
      page_id: page.uid,
      url: `/read/${encodeURIComponent(author.userSlug)}/${encodeURIComponent(page.uid)}`,
      last_viewed_at: history.lastViewedAt.toISOString(),
      view_count: history.viewCount,
      last_source: history.lastSource,
    })),
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

  const targetUrl = `/read/${encodeURIComponent(params.context.author.userSlug)}/${encodeURIComponent(params.context.page.uid)}`;
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

  await db.transaction(async (tx) => {
    const existing = await tx.query.userFollows.findFirst({
      where: and(
        eq(userFollows.followerUserId, params.follower.userId),
        eq(userFollows.followeeUserId, followee.id)
      ),
    });

    if (existing) {
      await tx
        .update(userFollows)
        .set({ notifyLevel: params.notifyLevel, updatedAt: sql`now()` })
        .where(eq(userFollows.id, existing.id));
      return;
    }

    await tx.insert(userFollows).values({
      followerUserId: params.follower.userId,
      followeeUserId: followee.id,
      notifyLevel: params.notifyLevel,
    });
    await tx
      .update(users)
      .set({ followersCount: sql`${users.followersCount} + 1` })
      .where(eq(users.id, followee.id));
  });

  const updated = await db.query.users.findFirst({ where: eq(users.id, followee.id) });
  return { following: true, followers_count: updated?.followersCount ?? 0 };
}

export async function unfollowUser(params: { follower: Session; followeeSlug: string }) {
  const followee = await db.query.users.findFirst({
    where: eq(users.userSlug, params.followeeSlug),
  });
  if (!followee) throw new Error('user_not_found');

  await db.transaction(async (tx) => {
    const existing = await tx.query.userFollows.findFirst({
      where: and(
        eq(userFollows.followerUserId, params.follower.userId),
        eq(userFollows.followeeUserId, followee.id)
      ),
    });
    if (!existing) return;
    await tx.delete(userFollows).where(eq(userFollows.id, existing.id));
    await tx
      .update(users)
      .set({ followersCount: sql`greatest(${users.followersCount} - 1, 0)` })
      .where(eq(users.id, followee.id));
  });

  const updated = await db.query.users.findFirst({ where: eq(users.id, followee.id) });
  return { following: false, followers_count: updated?.followersCount ?? 0 };
}

export async function subscribeToPage(params: {
  context: PublicPageContext;
  session: Session;
  notifyLevel: 'all' | 'major' | 'none';
}) {
  if (!canReadPage(params.context.page, params.session)) throw new Error('permission_denied');

  await db.transaction(async (tx) => {
    const existing = await tx.query.pageSubscriptions.findFirst({
      where: and(
        eq(pageSubscriptions.userId, params.session.userId),
        eq(pageSubscriptions.publishedPageId, params.context.page.id)
      ),
    });
    if (existing) {
      await tx
        .update(pageSubscriptions)
        .set({ notifyLevel: params.notifyLevel, updatedAt: sql`now()` })
        .where(eq(pageSubscriptions.id, existing.id));
      return;
    }
    await tx.insert(pageSubscriptions).values({
      userId: params.session.userId,
      publishedPageId: params.context.page.id,
      notifyLevel: params.notifyLevel,
      lastSeenVersion: params.context.page.currentVersion ?? 0,
    });
    await tx
      .update(publishedPages)
      .set({ subscriberCount: sql`${publishedPages.subscriberCount} + 1` })
      .where(eq(publishedPages.id, params.context.page.id));
  });

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
  await db.transaction(async (tx) => {
    const existing = await tx.query.pageSubscriptions.findFirst({
      where: and(
        eq(pageSubscriptions.userId, params.session.userId),
        eq(pageSubscriptions.publishedPageId, params.context.page.id)
      ),
    });
    if (!existing) return;
    await tx.delete(pageSubscriptions).where(eq(pageSubscriptions.id, existing.id));
    await tx
      .update(publishedPages)
      .set({ subscriberCount: sql`greatest(${publishedPages.subscriberCount} - 1, 0)` })
      .where(eq(publishedPages.id, params.context.page.id));
  });

  const updated = await db.query.publishedPages.findFirst({
    where: eq(publishedPages.id, params.context.page.id),
  });

  return { subscribed: false, subscriber_count: updated?.subscriberCount ?? 0 };
}

export async function listSubscriptionFeed(session: Session, limit: number) {
  const follows = await db.query.userFollows.findMany({
    where: eq(userFollows.followerUserId, session.userId),
  });
  const subscriptions = await db.query.pageSubscriptions.findMany({
    where: eq(pageSubscriptions.userId, session.userId),
  });

  const followeeIds = follows.map((follow) => follow.followeeUserId);
  const subscribedPageIds = subscriptions.map((subscription) => subscription.publishedPageId);

  if (followeeIds.length === 0 && subscribedPageIds.length === 0) {
    return { items: [], next_cursor: null, has_more: false };
  }

  const predicates = [];
  if (followeeIds.length > 0) predicates.push(inArray(pageUpdateEvents.userId, followeeIds));
  if (subscribedPageIds.length > 0) predicates.push(inArray(pageUpdateEvents.publishedPageId, subscribedPageIds));

  const rows = await db
    .select({
      event: pageUpdateEvents,
      page: publishedPages,
    })
    .from(pageUpdateEvents)
    .innerJoin(publishedPages, eq(publishedPages.id, pageUpdateEvents.publishedPageId))
    .where(
      and(
        or(...predicates),
        eq(publishedPages.visibility, 'public'),
        eq(publishedPages.moderationStatus, 'approved')
      )
    )
    .orderBy(desc(pageUpdateEvents.createdAt), desc(pageUpdateEvents.id))
    .limit(limit + 1);

  const visibleRows = rows.slice(0, limit);
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
          ?.lastSeenVersion ?? -1) >= event.version,
      url: `/read/${encodeURIComponent(event.userSlug)}/${encodeURIComponent(event.pageId)}`,
    })),
    next_cursor:
      rows.length > limit
        ? encodeCursor({
            created_at: visibleRows[visibleRows.length - 1].event.createdAt.toISOString(),
            id: visibleRows[visibleRows.length - 1].event.id,
          })
        : null,
    has_more: rows.length > limit,
  };
}

export async function listNotifications(session: Session, limit: number, unreadOnly: boolean) {
  const rows = await db.query.notifications.findMany({
    where: and(
      eq(notifications.recipientUserId, session.userId),
      unreadOnly ? isNull(notifications.readAt) : undefined
    ),
    orderBy: [desc(notifications.createdAt), desc(notifications.id)],
    limit: limit + 1,
    with: {
      publishedPage: true,
    },
  });

  const unreadCount = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, session.userId), isNull(notifications.readAt)));

  const visibleRows = rows
    .filter((notification) => {
      if (!notification.publishedPageId) return true;
      if (!('publishedPage' in notification) || !notification.publishedPage) return false;
      return canReadPage(notification.publishedPage, session);
    })
    .slice(0, limit);
  return {
    items: visibleRows.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read_at: notification.readAt?.toISOString() ?? null,
      created_at: notification.createdAt.toISOString(),
      published_page_id: notification.publishedPageId,
      page_update_event_id: notification.pageUpdateEventId,
    })),
    next_cursor:
      rows.length > limit
        ? encodeCursor({
            created_at: visibleRows[visibleRows.length - 1].createdAt.toISOString(),
            id: visibleRows[visibleRows.length - 1].id,
          })
        : null,
    has_more: rows.length > limit,
    unread_count: unreadCount[0]?.value ?? 0,
  };
}

export async function listMoments(params: {
  feedType: 'following' | 'latest' | 'recommended';
  session: Session | null;
  limit: number;
}) {
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
        authorIds && authorIds.length > 0 ? inArray(moments.authorUserId, authorIds) : undefined
      )
    )
    .orderBy(desc(moments.createdAt), desc(moments.id))
    .limit(params.limit);

  const momentIds = rows.map(({ moment }) => moment.id);
  const attachments =
    momentIds.length > 0
      ? await db.query.momentAttachments.findMany({
          where: inArray(momentAttachments.momentId, momentIds),
          orderBy: [momentAttachments.sortOrder],
        })
      : [];

  return {
    items: rows.map(({ moment, author }) => ({
      moment: {
        uid: moment.uid,
        kind: moment.kind,
        body: moment.body,
        visibility: moment.visibility,
        like_count: moment.likeCount,
        comment_count: moment.commentCount,
        repost_count: moment.repostCount,
        created_at: moment.createdAt.toISOString(),
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
        })),
      topics: [],
      viewer_state: {
        is_authenticated: Boolean(params.session),
        can_edit: params.session?.userId === moment.authorUserId,
        can_delete: params.session?.userId === moment.authorUserId,
      },
    })),
    next_cursor: null,
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

export async function listRanking(params: {
  rankingKey: string;
  timeWindow: string;
  limit: number;
}) {
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
      read_url: `/read/${encodeURIComponent(author.userSlug)}/${encodeURIComponent(page.uid)}`,
      category_id: page.categoryId,
      cover_url: null,
      tags: page.tags,
      published_at: page.publishedAt.toISOString(),
      last_published_at: page.lastPublishedAt.toISOString(),
      stats: {
        view_count: page.viewCount,
        read_count: page.readCount,
        like_count: page.likeCount,
        favorite_count: page.favoriteCount,
        comment_count: page.commentCount,
        share_count: page.shareCount,
        repost_count: page.repostCount,
      },
    })),
    next_cursor: null,
    has_more: rows.length > params.limit,
    seed: null,
  };
}

export async function getHomeConfig(surface: string, locale: string) {
  const revision = (await db.query.operationRevisions.findFirst({
    where: and(
      eq(operationRevisions.surface, surface),
      eq(operationRevisions.status, 'published'),
      eq(operationRevisions.locale, locale)
    ),
    orderBy: [desc(operationRevisions.revisionNumber)],
  })) ?? (locale === 'default'
    ? null
    : await db.query.operationRevisions.findFirst({
        where: and(
          eq(operationRevisions.surface, surface),
          eq(operationRevisions.status, 'published'),
          eq(operationRevisions.locale, 'default')
        ),
        orderBy: [desc(operationRevisions.revisionNumber)],
      }));

  if (revision) {
    return {
      surface,
      locale,
      resolved_locale: revision.locale,
      revision_id: revision.id,
      revision_number: revision.revisionNumber,
      generated_at: new Date().toISOString(),
      slots: (revision.snapshot as { slots?: unknown[] }).slots ?? [],
      fallback_used: false,
    };
  }

  const pages = await db
    .select({
      page: publishedPages,
      author: users,
    })
    .from(publishedPages)
    .innerJoin(users, eq(users.id, publishedPages.userId))
    .where(and(eq(publishedPages.visibility, 'public'), eq(publishedPages.moderationStatus, 'approved')))
    .orderBy(desc(publishedPages.lastPublishedAt))
    .limit(12);

  return {
    surface,
    locale,
    resolved_locale: 'default',
    revision_id: null,
    revision_number: null,
    generated_at: new Date().toISOString(),
    slots: [
      {
        slot_key: 'latest_public_pages',
        layout_type: 'grid',
        metadata: {},
        items: pages.map(({ page, author }) => ({
          item_type: 'published_page',
          title: page.title,
          description: page.description,
          target_url: `/read/${encodeURIComponent(author.userSlug)}/${encodeURIComponent(page.uid)}`,
          entity_type: 'published_page',
          entity_id: page.uid,
          user_slug: author.userSlug,
          page_id: page.uid,
          stats: {
            view_count: page.viewCount,
            read_count: page.readCount,
            like_count: page.likeCount,
            favorite_count: page.favoriteCount,
            comment_count: page.commentCount,
          },
        })),
      },
    ],
    fallback_used: true,
  };
}
