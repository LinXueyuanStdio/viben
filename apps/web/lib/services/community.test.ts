import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findCommunityEntity: vi.fn(),
  findCommunityEntities: vi.fn(),
  findCommunityComment: vi.fn(),
  findCommunityComments: vi.fn(),
  findReaction: vi.fn(),
  findFavorite: vi.fn(),
  findPageUpdateEvent: vi.fn(),
  findPageUpdateEvents: vi.fn(),
  findPageSubscriptions: vi.fn(),
  findUserFollows: vi.fn(),
  findPageSubscription: vi.fn(),
  findNotifications: vi.fn(),
  select: vi.fn(),
  selectFrom: vi.fn(),
  selectInnerJoin: vi.fn(),
  selectLeftJoin: vi.fn(),
  selectWhere: vi.fn(),
  selectOrderBy: vi.fn(),
  selectLimit: vi.fn(),
  countFrom: vi.fn(),
  countLeftJoin: vi.fn(),
  countWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  transaction: vi.fn(),
  insertValues: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  returning: vi.fn(),
  txFindCommunityEntity: vi.fn(),
  txFindCommunityComment: vi.fn(),
  txFindReaction: vi.fn(),
  txFindPageUpdateEvent: vi.fn(),
  txFindPageSubscriptions: vi.fn(),
  txFindUserFollows: vi.fn(),
  txInsert: vi.fn(),
  txInsertValues: vi.fn(),
  txOnConflictDoUpdate: vi.fn(),
  txOnConflictDoNothing: vi.fn(),
  txReturning: vi.fn(),
  txUpdate: vi.fn(),
  txUpdateSet: vi.fn(),
  txUpdateWhere: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      communityEntities: {
        findFirst: mocks.findCommunityEntity,
        findMany: mocks.findCommunityEntities,
      },
      communityComments: {
        findFirst: mocks.findCommunityComment,
        findMany: mocks.findCommunityComments,
      },
      communityReactions: {
        findFirst: mocks.findReaction,
      },
      communityBookmarks: {
        findFirst: mocks.findFavorite,
      },
      pageUpdateEvents: {
        findFirst: mocks.findPageUpdateEvent,
        findMany: mocks.findPageUpdateEvents,
      },
      pageSubscriptions: {
        findFirst: mocks.findPageSubscription,
        findMany: mocks.findPageSubscriptions,
      },
      userFollows: {
        findMany: mocks.findUserFollows,
      },
      notifications: {
        findMany: mocks.findNotifications,
      },
    },
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    transaction: mocks.transaction,
  },
  communityEntities: {
    id: 'communityEntityId',
    entityType: 'communityEntityType',
    entityId: 'communityEntityEntityId',
    ownerUserId: 'communityEntityOwnerUserId',
    status: 'communityEntityStatus',
    visibility: 'communityEntityVisibility',
    title: 'communityEntityTitle',
    canonicalPath: 'communityEntityCanonicalPath',
    reactionsCount: 'communityEntityReactionsCount',
    updatedAt: 'communityEntityUpdatedAt',
  },
  communityReactions: {
    communityEntityId: 'reactionCommunityEntityId',
    userId: 'reactionUserId',
    reactionType: 'reactionType',
  },
  communityBookmarks: {
    communityEntityId: 'favoriteCommunityEntityId',
    userId: 'favoriteUserId',
  },
  communityComments: {
    id: 'commentId',
    communityEntityId: 'commentCommunityEntityId',
    userId: 'commentUserId',
    status: 'commentStatus',
    reactionsCount: 'commentReactionsCount',
    createdAt: 'commentCreatedAt',
    parentCommentId: 'commentParentCommentId',
  },
  pageUpdateEvents: {
    id: 'pageUpdateEventId',
    createdAt: 'pageUpdateEventCreatedAt',
    publishedPageId: 'pageUpdateEventPublishedPageId',
    userId: 'pageUpdateEventUserId',
    version: 'pageUpdateEventVersion',
    eventType: 'pageUpdateEventType',
  },
  pageSubscriptions: {
    id: 'pageSubscriptionId',
    userId: 'pageSubscriptionUserId',
    publishedPageId: 'pageSubscriptionPublishedPageId',
    notifyLevel: 'pageSubscriptionNotifyLevel',
    lastSeenVersion: 'pageSubscriptionLastSeenVersion',
  },
  userFollows: {
    followerUserId: 'userFollowFollowerUserId',
    followeeUserId: 'userFollowFolloweeUserId',
  },
  notifications: {
    recipientUserId: 'notificationRecipientUserId',
    publishedPageId: 'notificationPublishedPageId',
    pageUpdateEventId: 'notificationPageUpdateEventId',
    readAt: 'notificationReadAt',
    createdAt: 'notificationCreatedAt',
    id: 'notificationId',
  },
  publishedPages: {
    id: 'publishedPageId',
    userId: 'publishedPageUserId',
    visibility: 'publishedPageVisibility',
    moderationStatus: 'publishedPageModerationStatus',
  },
  users: {
    id: 'userId',
    userSlug: 'userSlug',
    displayName: 'displayName',
    avatarUrl: 'avatarUrl',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  count: vi.fn(() => 'count(*)'),
  desc: vi.fn((field) => ({ direction: 'desc', field })),
  eq: vi.fn((field, value) => ({ field, value })),
  gt: vi.fn((field, value) => ({ type: 'gt', field, value })),
  inArray: vi.fn((field, values) => ({ type: 'inArray', field, values })),
  isNull: vi.fn((field) => ({ type: 'isNull', field })),
  lt: vi.fn((field, value) => ({ type: 'lt', field, value })),
  or: vi.fn((...conditions) => ({ type: 'or', conditions })),
  sql: vi.fn((strings) => ({ type: 'sql', sql: strings.raw.join('?') })),
}));

import {
  canReadPage,
  deleteCommunityComment,
  ensureCommunityEntityForPage,
  getCommunitySummary,
  listCommunityComments,
  listCommunityBookmarks,
  listNotifications,
  listSubscriptionFeed,
  markNotificationsRead,
  recordPageUpdateAndNotify,
  toggleReaction,
  updateCommunityComment,
  updatePageSubscription,
} from './community';

describe('community service permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findReaction.mockResolvedValue(null);
    mocks.findFavorite.mockResolvedValue(null);
    mocks.findCommunityComment.mockResolvedValue(null);
    mocks.findCommunityComments.mockResolvedValue([]);
    mocks.select.mockImplementation((selection) => {
      if (
        'notification' in selection ||
        'event' in selection ||
        'comment' in selection ||
        'favorite' in selection
      ) {
        return { from: mocks.selectFrom };
      }
      return { from: mocks.countFrom };
    });
    mocks.selectFrom.mockReturnValue({
      leftJoin: mocks.selectLeftJoin,
      innerJoin: mocks.selectInnerJoin,
    });
    mocks.selectInnerJoin.mockReturnValue({
      leftJoin: mocks.selectLeftJoin,
      where: mocks.selectWhere,
    });
    mocks.selectLeftJoin.mockReturnValue({
      where: mocks.selectWhere,
    });
    mocks.selectWhere.mockReturnValue({
      orderBy: mocks.selectOrderBy,
    });
    mocks.selectOrderBy.mockReturnValue({
      limit: mocks.selectLimit,
    });
    mocks.selectLimit.mockResolvedValue([]);
    mocks.countFrom.mockReturnValue({
      leftJoin: mocks.countLeftJoin,
    });
    mocks.countLeftJoin.mockReturnValue({
      where: mocks.countWhere,
    });
    mocks.countWhere.mockResolvedValue([{ value: 0 }]);
    mocks.insert.mockReturnValue({
      values: mocks.insertValues,
    });
    mocks.update.mockReturnValue({
      set: mocks.updateSet,
    });
    mocks.updateSet.mockReturnValue({
      where: mocks.updateWhere,
    });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.insertValues.mockReturnValue({
      onConflictDoUpdate: mocks.onConflictDoUpdate,
    });
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.returning.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        query: {
          communityEntities: {
            findFirst: mocks.txFindCommunityEntity,
          },
          communityComments: {
            findFirst: mocks.txFindCommunityComment,
          },
          communityReactions: {
            findFirst: mocks.txFindReaction,
          },
          pageUpdateEvents: {
            findFirst: mocks.txFindPageUpdateEvent,
          },
          pageSubscriptions: {
            findMany: mocks.txFindPageSubscriptions,
          },
          userFollows: {
            findMany: mocks.txFindUserFollows,
          },
        },
        insert: mocks.txInsert,
        update: mocks.txUpdate,
      })
    );
    mocks.txInsert.mockReturnValue({
      values: mocks.txInsertValues,
    });
    mocks.txInsertValues.mockReturnValue({
      onConflictDoUpdate: mocks.txOnConflictDoUpdate,
      onConflictDoNothing: mocks.txOnConflictDoNothing,
    });
    mocks.txOnConflictDoUpdate.mockReturnValue({
      returning: mocks.txReturning,
    });
    mocks.txOnConflictDoNothing.mockReturnValue({
      returning: mocks.txReturning,
    });
    mocks.txReturning.mockResolvedValue([]);
    mocks.txUpdate.mockReturnValue({
      set: mocks.txUpdateSet,
    });
    mocks.txUpdateSet.mockReturnValue({
      where: mocks.txUpdateWhere,
    });
    mocks.txUpdateWhere.mockResolvedValue(undefined);
    mocks.findPageSubscriptions.mockResolvedValue([]);
    mocks.findUserFollows.mockResolvedValue([]);
    mocks.findPageSubscription.mockResolvedValue(null);
    mocks.findNotifications.mockResolvedValue([]);
    mocks.findPageUpdateEvents.mockResolvedValue([]);
  });

  it('allows anonymous direct-link access to approved unlisted pages', () => {
    expect(
      canReadPage(
        {
          visibility: 'unlisted',
          moderationStatus: 'approved',
          userId: 'owner-1',
        } as never,
        null
      )
    ).toBe(true);
  });

  it('does not expose non-public community entity summaries', async () => {
    mocks.findCommunityEntity.mockResolvedValue({
      id: 'entity-1',
      entityType: 'published_page',
      entityId: 'page-1',
      visibility: 'unlisted',
      status: 'active',
      reactionsCount: 0,
      bookmarksCount: 0,
      commentsCount: 0,
      canonicalPath: '/read/alice/demo',
    });

    await expect(getCommunitySummary('published_page', 'page-1', null)).resolves.toBeNull();
    expect(mocks.findReaction).not.toHaveBeenCalled();
    expect(mocks.findFavorite).not.toHaveBeenCalled();
  });

  it('hides community entities for unlisted pages from public interaction surfaces', async () => {
    mocks.findCommunityEntity.mockResolvedValue({
      id: 'entity-1',
      entityType: 'published_page',
      entityId: 'page-row-1',
      visibility: 'unlisted',
      status: 'hidden',
      reactionsCount: 0,
      bookmarksCount: 0,
      commentsCount: 0,
      canonicalPath: '/read/alice/demo',
    });

    await ensureCommunityEntityForPage({
      page: {
        id: 'page-row-1',
        uid: 'demo',
        userId: 'author-1',
        title: 'Demo',
        visibility: 'unlisted',
        moderationStatus: 'approved',
      },
      author: {
        id: 'author-1',
        userSlug: 'alice',
      },
    } as never);

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'unlisted',
        status: 'hidden',
      })
    );
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          visibility: 'unlisted',
          status: 'hidden',
        }),
      })
    );
  });

  it('hides community entities for public pages that are not approved', async () => {
    mocks.findCommunityEntity.mockResolvedValue({
      id: 'entity-1',
      entityType: 'published_page',
      entityId: 'page-row-1',
      visibility: 'public',
      status: 'hidden',
      reactionsCount: 0,
      bookmarksCount: 0,
      commentsCount: 0,
      canonicalPath: '/read/alice/demo',
    });

    await ensureCommunityEntityForPage({
      page: {
        id: 'page-row-1',
        uid: 'demo',
        userId: 'author-1',
        title: 'Demo',
        visibility: 'public',
        moderationStatus: 'pending',
      },
      author: {
        id: 'author-1',
        userSlug: 'alice',
      },
    } as never);

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'public',
        status: 'hidden',
      })
    );
  });

  it('does not create a public reaction target for comments whose parent entity is not public and active', async () => {
    mocks.txFindCommunityEntity
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.txFindCommunityComment.mockResolvedValue({
      id: 'comment-1',
      communityEntityId: 'parent-entity-1',
      userId: 'comment-author-1',
      status: 'active',
    });

    await expect(
      toggleReaction({
        entityType: 'comment',
        entityId: 'comment-1',
        reactionType: 'like',
        session: {
          userId: 'reader-1',
          username: 'reader',
          userSlug: 'reader',
          email: 'reader@example.com',
          role: 'user',
          expiresAt: Date.now() + 1000,
        },
      })
    ).rejects.toThrow('community_entity_not_found');
    expect(mocks.txInsert).not.toHaveBeenCalled();
  });

  it('rejects reactions for existing comment entities when their parent entity is no longer public and active', async () => {
    mocks.txFindCommunityEntity
      .mockResolvedValueOnce({
        id: 'comment-entity-1',
        entityType: 'comment',
        entityId: 'comment-1',
        visibility: 'public',
        status: 'active',
        reactionsCount: 0,
      })
      .mockResolvedValueOnce(null);
    mocks.txFindCommunityComment.mockResolvedValue({
      id: 'comment-1',
      communityEntityId: 'parent-entity-1',
      userId: 'comment-author-1',
      status: 'active',
    });

    await expect(
      toggleReaction({
        entityType: 'comment',
        entityId: 'comment-1',
        reactionType: 'like',
        session: {
          userId: 'reader-1',
          username: 'reader',
          userSlug: 'reader',
          email: 'reader@example.com',
          role: 'user',
          expiresAt: Date.now() + 1000,
        },
      })
    ).rejects.toThrow('community_entity_not_found');
    expect(mocks.txFindReaction).not.toHaveBeenCalled();
    expect(mocks.txInsert).not.toHaveBeenCalled();
  });

  it('filters notifications for pages the recipient can no longer read', async () => {
    const now = new Date('2026-06-24T00:00:00.000Z');
    mocks.selectLimit.mockResolvedValue([
      {
        notification: {
          id: 'visible',
          type: 'page_updated',
          title: 'Visible update',
          body: null,
          readAt: null,
          createdAt: now,
          publishedPageId: 'page-visible',
          pageUpdateEventId: 'event-visible',
        },
      },
    ]);
    mocks.countWhere.mockResolvedValue([{ value: 1 }]);

    const result = await listNotifications(
      {
        userId: 'recipient-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      30,
      false
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'visible',
      title: 'Visible update',
      published_page_id: 'page-visible',
    });
    expect(mocks.selectWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'and',
        conditions: expect.arrayContaining([
          expect.objectContaining({
            type: 'or',
            conditions: expect.arrayContaining([
              { type: 'isNull', field: 'notificationPublishedPageId' },
              expect.objectContaining({
                type: 'and',
                conditions: expect.arrayContaining([
                  { field: 'publishedPageId', value: 'notificationPublishedPageId' },
                  expect.objectContaining({
                    type: 'or',
                    conditions: expect.arrayContaining([
                      expect.objectContaining({
                        type: 'and',
                        conditions: expect.arrayContaining([
                          {
                            type: 'inArray',
                            field: 'publishedPageVisibility',
                            values: ['public', 'unlisted'],
                          },
                          { field: 'publishedPageModerationStatus', value: 'approved' },
                        ]),
                      }),
                      { field: 'publishedPageUserId', value: 'recipient-1' },
                    ]),
                  }),
                ]),
              }),
            ]),
          }),
        ]),
      })
    );
    expect(result.unread_count).toBe(1);
  });

  it('does not create a notification cursor when permission filtering removes every fetched row', async () => {
    mocks.selectLimit.mockResolvedValue([]);
    mocks.countWhere.mockResolvedValue([{ value: 0 }]);

    const result = await listNotifications(
      {
        userId: 'recipient-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      1,
      false
    );

    expect(result.items).toEqual([]);
    expect(result.next_cursor).toBeNull();
    expect(result.has_more).toBe(false);
    expect(result.unread_count).toBe(0);
  });

  it('applies notification cursors before fetching the next page', async () => {
    const cursor = 'eyJjcmVhdGVkX2F0IjoiMjAyNi0wNi0yNFQwMDowMDowMC4wMDBaIiwiaWQiOiJub3RpZmljYXRpb24tMiJ9';

    mocks.selectLimit.mockResolvedValue([]);

    await listNotifications(
      {
        userId: 'recipient-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      30,
      false,
      cursor
    );

    expect(mocks.selectWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'and',
        conditions: expect.arrayContaining([
          expect.objectContaining({
            type: 'or',
            conditions: expect.arrayContaining([
              {
                type: 'lt',
                field: 'notificationCreatedAt',
                value: new Date('2026-06-24T00:00:00.000Z'),
              },
              expect.objectContaining({
                type: 'and',
                conditions: expect.arrayContaining([
                  {
                    field: 'notificationCreatedAt',
                    value: new Date('2026-06-24T00:00:00.000Z'),
                  },
                  {
                    type: 'lt',
                    field: 'notificationId',
                    value: 'notification-2',
                  },
                ]),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('creates one notification for users matched by both page subscription and author follow', async () => {
    mocks.txReturning.mockResolvedValueOnce([
      {
        id: 'event-1',
        publishedPageId: 'page-1',
        userId: 'author-1',
        userSlug: 'alice',
        pageId: 'demo',
        version: 1,
        eventType: 'published',
        importance: 'normal',
        title: 'Demo',
        description: 'Demo page',
        visibility: 'public',
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ]);
    mocks.txFindPageSubscriptions.mockResolvedValue([
      {
        userId: 'reader-1',
        publishedPageId: 'page-1',
        notifyLevel: 'all',
      },
      {
        userId: 'author-1',
        publishedPageId: 'page-1',
        notifyLevel: 'all',
      },
    ]);
    mocks.txFindUserFollows.mockResolvedValue([
      {
        followerUserId: 'reader-1',
        followeeUserId: 'author-1',
        notifyLevel: 'all',
      },
    ]);

    await recordPageUpdateAndNotify(createTransactionMock(), {
      publishedPageId: 'page-1',
      userId: 'author-1',
      userSlug: 'alice',
      pageId: 'demo',
      version: 1,
      eventType: 'published',
      importance: 'normal',
      title: 'Demo',
      description: 'Demo page',
      visibility: 'public',
    });

    expect(mocks.txInsertValues).toHaveBeenCalledWith([
      {
        recipientUserId: 'reader-1',
        actorUserId: 'author-1',
        type: 'page_published',
        pageUpdateEventId: 'event-1',
        publishedPageId: 'page-1',
        title: 'Demo',
        body: 'Demo page',
      },
    ]);
  });

  it('does not fan out notifications for non-public page updates', async () => {
    mocks.txReturning.mockResolvedValueOnce([
      {
        id: 'event-private',
        publishedPageId: 'page-1',
        userId: 'author-1',
        userSlug: 'alice',
        pageId: 'demo',
        version: 2,
        eventType: 'updated',
        importance: 'normal',
        title: 'Private update',
        description: null,
        visibility: 'private',
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ]);

    await recordPageUpdateAndNotify(createTransactionMock(), {
      publishedPageId: 'page-1',
      userId: 'author-1',
      userSlug: 'alice',
      pageId: 'demo',
      version: 2,
      eventType: 'updated',
      importance: 'normal',
      title: 'Private update',
      description: null,
      visibility: 'private',
    });

    expect(mocks.txFindPageSubscriptions).not.toHaveBeenCalled();
    expect(mocks.txFindUserFollows).not.toHaveBeenCalled();
    expect(mocks.txInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'private',
      })
    );
    expect(mocks.txInsertValues).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'page_updated',
        }),
      ])
    );
  });

  it('respects notify levels when generating page update notifications', async () => {
    mocks.txReturning.mockResolvedValueOnce([
      {
        id: 'event-2',
        publishedPageId: 'page-1',
        userId: 'author-1',
        userSlug: 'alice',
        pageId: 'demo',
        version: 2,
        eventType: 'updated',
        importance: 'normal',
        title: 'Demo update',
        description: null,
        visibility: 'public',
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ]);
    mocks.txFindPageSubscriptions.mockResolvedValue([
      {
        userId: 'reader-all',
        publishedPageId: 'page-1',
        notifyLevel: 'all',
      },
      {
        userId: 'reader-major',
        publishedPageId: 'page-1',
        notifyLevel: 'major',
      },
      {
        userId: 'reader-none',
        publishedPageId: 'page-1',
        notifyLevel: 'none',
      },
    ]);
    mocks.txFindUserFollows.mockResolvedValue([]);

    await recordPageUpdateAndNotify(createTransactionMock(), {
      publishedPageId: 'page-1',
      userId: 'author-1',
      userSlug: 'alice',
      pageId: 'demo',
      version: 2,
      eventType: 'updated',
      importance: 'normal',
      title: 'Demo update',
      description: null,
      visibility: 'public',
    });

    expect(mocks.txInsertValues).toHaveBeenCalledWith([
      {
        recipientUserId: 'reader-all',
        actorUserId: 'author-1',
        type: 'page_updated',
        pageUpdateEventId: 'event-2',
        publishedPageId: 'page-1',
        title: 'Demo update',
        body: null,
      },
    ]);
  });

  it('applies cursor source and includeSeen filters to subscription feed queries', async () => {
    const cursor = 'eyJjcmVhdGVkX2F0IjoiMjAyNi0wNi0yNFQwMDowMDowMC4wMDBaIiwiaWQiOiJldmVudC0yIn0';
    mocks.findPageSubscriptions.mockResolvedValue([
      {
        publishedPageId: 'page-1',
        lastSeenVersion: 3,
      },
    ]);
    mocks.findUserFollows.mockResolvedValue([
      {
        followeeUserId: 'author-1',
      },
    ]);

    await listSubscriptionFeed(
      {
        userId: 'reader-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      {
        limit: 20,
        cursor,
        includeSeen: false,
        source: 'subscribed_pages',
      }
    );

    const where = mocks.selectWhere.mock.calls.at(-1)?.[0];
    expect(where).toMatchObject({ type: 'and' });
    expect(where.conditions[0]).toEqual({
      type: 'or',
      conditions: [
        { type: 'inArray', field: 'pageUpdateEventPublishedPageId', values: ['page-1'] },
      ],
    });
    expect(where.conditions[1]).toMatchObject({
      type: 'or',
      conditions: [
        {
          type: 'lt',
          field: 'pageUpdateEventCreatedAt',
          value: new Date('2026-06-24T00:00:00.000Z'),
        },
        {
          type: 'and',
          conditions: [
            {
              field: 'pageUpdateEventCreatedAt',
              value: new Date('2026-06-24T00:00:00.000Z'),
            },
            { type: 'lt', field: 'pageUpdateEventId', value: 'event-2' },
          ],
        },
      ],
    });
    expect(where.conditions[2]).toEqual({
      type: 'or',
      conditions: [
        {
          type: 'and',
          conditions: [
            { field: 'pageUpdateEventPublishedPageId', value: 'page-1' },
            { type: 'gt', field: 'pageUpdateEventVersion', value: 3 },
          ],
        },
      ],
    });
    expect(where.conditions).toEqual(
      expect.arrayContaining([
        { field: 'publishedPageVisibility', value: 'public' },
        { field: 'publishedPageModerationStatus', value: 'approved' },
      ])
    );
  });

  it('updates page subscription without rolling back lastSeenVersion', async () => {
    mocks.findPageSubscription.mockResolvedValue({
      id: 'subscription-1',
      userId: 'reader-1',
      publishedPageId: 'page-1',
      notifyLevel: 'all',
      lastSeenVersion: 7,
    });

    const result = await updatePageSubscription({
      context: {
        page: {
          id: 'page-1',
          userId: 'author-1',
          visibility: 'public',
          moderationStatus: 'approved',
        },
        author: {
          id: 'author-1',
          userSlug: 'alice',
        },
      } as never,
      session: {
        userId: 'reader-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      notifyLevel: 'major',
      lastSeenVersion: 3,
    });

    expect(mocks.updateSet).toHaveBeenCalledWith({
      notifyLevel: 'major',
      lastSeenVersion: 7,
      updatedAt: { type: 'sql', sql: 'now()' },
    });
    expect(result).toMatchObject({
      subscribed: true,
      notify_level: 'major',
      last_seen_version: 7,
    });
  });

  it('marks notifications read and advances matching page subscription versions', async () => {
    mocks.findNotifications.mockResolvedValue([
      {
        id: 'notification-1',
        recipientUserId: 'reader-1',
        pageUpdateEventId: 'event-1',
        publishedPageId: 'page-1',
      },
    ]);
    mocks.findPageUpdateEvents.mockResolvedValue([
      {
        id: 'event-1',
        publishedPageId: 'page-1',
        version: 6,
      },
    ]);
    mocks.findPageSubscription.mockResolvedValue({
      id: 'subscription-1',
      userId: 'reader-1',
      publishedPageId: 'page-1',
      notifyLevel: 'all',
      lastSeenVersion: 3,
    });

    const result = await markNotificationsRead({
      session: {
        userId: 'reader-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      notificationIds: ['notification-1'],
      beforeCursor: null,
    });

    expect(mocks.updateSet).toHaveBeenCalledWith({ readAt: expect.any(Date) });
    expect(mocks.updateSet).toHaveBeenCalledWith({
      lastSeenVersion: 6,
      updatedAt: { type: 'sql', sql: 'now()' },
    });
    expect(result).toEqual({ success: true, updated_count: 1 });
  });

  it('rejects invalid before_cursor instead of marking all notifications read', async () => {
    await expect(
      markNotificationsRead({
        session: {
          userId: 'reader-1',
          username: 'reader',
          userSlug: 'reader',
          email: 'reader@example.com',
          role: 'user',
          expiresAt: Date.now() + 1000,
        },
        notificationIds: [],
        beforeCursor: 'not-a-cursor',
      })
    ).rejects.toThrow('invalid_cursor');

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('applies comment cursors to descending created_at/id pagination', async () => {
    const cursor = 'eyJjcmVhdGVkX2F0IjoiMjAyNi0wNi0yNFQwMDowMDowMC4wMDBaIiwiaWQiOiJjb21tZW50LTIifQ';
    mocks.findCommunityEntity.mockResolvedValue({
      id: 'entity-1',
      entityType: 'published_page',
      entityId: 'page-1',
      visibility: 'public',
      status: 'active',
    });

    await listCommunityComments({
      entityType: 'published_page',
      entityId: 'page-1',
      parentCommentId: null,
      limit: 20,
      cursor,
      session: null,
    });

    expect(mocks.selectWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'and',
        conditions: expect.arrayContaining([
          expect.objectContaining({
            type: 'or',
            conditions: expect.arrayContaining([
              {
                type: 'lt',
                field: 'commentCreatedAt',
                value: new Date('2026-06-24T00:00:00.000Z'),
              },
              expect.objectContaining({
                type: 'and',
                conditions: expect.arrayContaining([
                  {
                    field: 'commentCreatedAt',
                    value: new Date('2026-06-24T00:00:00.000Z'),
                  },
                  { type: 'lt', field: 'commentId', value: 'comment-2' },
                ]),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('rejects comment edits from non-author regular users', async () => {
    mocks.findCommunityComment.mockResolvedValue({
      id: 'comment-1',
      userId: 'author-1',
      communityEntityId: 'entity-1',
      status: 'active',
      content: 'Original',
    });

    await expect(
      updateCommunityComment({
        commentId: 'comment-1',
        content: 'Updated',
        session: {
          userId: 'reader-1',
          username: 'reader',
          userSlug: 'reader',
          email: 'reader@example.com',
          role: 'user',
          expiresAt: Date.now() + 1000,
        },
      })
    ).rejects.toThrow('permission_denied');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('lets the entity owner delete a top-level comment and active replies', async () => {
    mocks.findCommunityComment.mockResolvedValueOnce({
      id: 'comment-1',
      userId: 'comment-author-1',
      communityEntityId: 'entity-1',
      parentCommentId: null,
      status: 'active',
    });
    mocks.findCommunityEntity.mockResolvedValueOnce({
      id: 'entity-1',
      ownerUserId: 'page-author-1',
    });
    mocks.findCommunityComments.mockResolvedValueOnce([
      {
        id: 'reply-1',
        userId: 'reply-author-1',
        communityEntityId: 'entity-1',
        parentCommentId: 'comment-1',
        status: 'active',
      },
      {
        id: 'reply-2',
        userId: 'reply-author-2',
        communityEntityId: 'entity-1',
        parentCommentId: 'comment-1',
        status: 'active',
      },
    ]);

    const result = await deleteCommunityComment({
      commentId: 'comment-1',
      session: {
        userId: 'page-author-1',
        username: 'alice',
        userSlug: 'alice',
        email: 'alice@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
    });

    expect(result).toEqual({ success: true, deleted_count: 3 });
    expect(mocks.findCommunityComments).toHaveBeenCalled();
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        commentsCount: { type: 'sql', sql: 'greatest(? - ?, 0)' },
      })
    );
  });

  it('filters favorite pages by current published page visibility', async () => {
    await listCommunityBookmarks({
      session: {
        userId: 'reader-1',
        username: 'reader',
        userSlug: 'reader',
        email: 'reader@example.com',
        role: 'user',
        expiresAt: Date.now() + 1000,
      },
      entityType: 'published_page',
      limit: 20,
      cursor: null,
    });

    expect(mocks.selectWhere).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'and',
        conditions: expect.arrayContaining([
          expect.objectContaining({
            type: 'or',
            conditions: expect.arrayContaining([
              expect.objectContaining({
                type: 'and',
                conditions: expect.arrayContaining([
                  { field: 'publishedPageVisibility', value: 'public' },
                  { field: 'publishedPageModerationStatus', value: 'approved' },
                ]),
              }),
            ]),
          }),
        ]),
      })
    );
  });
});

function createTransactionMock() {
  return {
    query: {
      communityEntities: {
        findFirst: mocks.txFindCommunityEntity,
      },
      communityComments: {
        findFirst: mocks.txFindCommunityComment,
      },
      communityReactions: {
        findFirst: mocks.txFindReaction,
      },
      pageUpdateEvents: {
        findFirst: mocks.txFindPageUpdateEvent,
      },
      pageSubscriptions: {
        findMany: mocks.txFindPageSubscriptions,
      },
      userFollows: {
        findMany: mocks.txFindUserFollows,
      },
    },
    insert: mocks.txInsert,
    update: mocks.txUpdate,
  } as never;
}
