import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findCommunityEntity: vi.fn(),
  findReaction: vi.fn(),
  findFavorite: vi.fn(),
  findNotifications: vi.fn(),
  countSelect: vi.fn(),
  countFrom: vi.fn(),
  countWhere: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      communityEntities: {
        findFirst: mocks.findCommunityEntity,
      },
      communityReactions: {
        findFirst: mocks.findReaction,
      },
      communityFavorites: {
        findFirst: mocks.findFavorite,
      },
      notifications: {
        findMany: mocks.findNotifications,
      },
    },
    select: mocks.countSelect,
  },
  communityEntities: {
    id: 'communityEntityId',
    entityType: 'communityEntityType',
    entityId: 'communityEntityEntityId',
    status: 'communityEntityStatus',
    visibility: 'communityEntityVisibility',
  },
  communityReactions: {
    communityEntityId: 'reactionCommunityEntityId',
    userId: 'reactionUserId',
    reactionType: 'reactionType',
  },
  communityFavorites: {
    communityEntityId: 'favoriteCommunityEntityId',
    userId: 'favoriteUserId',
  },
  notifications: {
    recipientUserId: 'notificationRecipientUserId',
    readAt: 'notificationReadAt',
    createdAt: 'notificationCreatedAt',
    id: 'notificationId',
  },
  publishedPages: {
    visibility: 'publishedPageVisibility',
    moderationStatus: 'publishedPageModerationStatus',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  count: vi.fn(() => 'count(*)'),
  desc: vi.fn((field) => ({ direction: 'desc', field })),
  eq: vi.fn((field, value) => ({ field, value })),
  isNull: vi.fn((field) => ({ type: 'isNull', field })),
}));

import { canReadPage, getCommunitySummary, listNotifications } from './community';

describe('community service permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findReaction.mockResolvedValue(null);
    mocks.findFavorite.mockResolvedValue(null);
    mocks.countSelect.mockReturnValue({
      from: mocks.countFrom,
    });
    mocks.countFrom.mockReturnValue({
      where: mocks.countWhere,
    });
    mocks.countWhere.mockResolvedValue([{ value: 0 }]);
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
      favoritesCount: 0,
      commentsCount: 0,
      canonicalPath: '/read/alice/demo',
    });

    await expect(getCommunitySummary('published_page', 'page-1', null)).resolves.toBeNull();
    expect(mocks.findReaction).not.toHaveBeenCalled();
    expect(mocks.findFavorite).not.toHaveBeenCalled();
  });

  it('filters notifications for pages the recipient can no longer read', async () => {
    const now = new Date('2026-06-24T00:00:00.000Z');
    mocks.findNotifications.mockResolvedValue([
      {
        id: 'visible',
        type: 'page_updated',
        title: 'Visible update',
        body: null,
        readAt: null,
        createdAt: now,
        publishedPageId: 'page-visible',
        pageUpdateEventId: 'event-visible',
        publishedPage: {
          visibility: 'public',
          moderationStatus: 'approved',
          userId: 'author-1',
        },
      },
      {
        id: 'hidden',
        type: 'page_updated',
        title: 'Hidden update',
        body: null,
        readAt: null,
        createdAt: now,
        publishedPageId: 'page-hidden',
        pageUpdateEventId: 'event-hidden',
        publishedPage: {
          visibility: 'private',
          moderationStatus: 'approved',
          userId: 'author-1',
        },
      },
    ]);

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
  });
});
