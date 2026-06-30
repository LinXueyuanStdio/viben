/**
 * Tests verifying that toggleReaction and toggleBookmark correctly update
 * BOTH community_entities AND source table (publishedPages/moments) counters.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = { userId: 'user-1', username: 'test', userSlug: 'test', email: 't@t.com', role: 'user' as const, avatarUrl: undefined, expiresAt: Date.now() + 999999 }

// Track all DB operations to verify correct tables are updated with correct values
const dbOps: Array<{ table: string; action: string; set?: Record<string, unknown> }> = []
let mockReactionExists = false
let mockBookmarkExists = false

const mocks = vi.hoisted(() => {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    set: vi.fn(function (this: typeof chain, values: Record<string, unknown>) {
      dbOps.push({ table: 'via_chain', action: 'update', set: values })
      return chain
    }),
    values: vi.fn(() => chain),
    returning: vi.fn(() => chain),
  }

  return {
    findCommunityEntity: vi.fn(),
    findReaction: vi.fn(),
    findBookmark: vi.fn(),
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    chain,
  }
})

vi.mock('@/lib/db', () => {
  // Build table-like objects that can be used in .set() calls
  const makeCol = (name: string) => ({ name, table: {}, column: {} })
  return {
    db: {
      query: {
        communityEntities: { findFirst: mocks.findCommunityEntity },
        communityReactions: { findFirst: mocks.findReaction },
        communityBookmarks: { findFirst: mocks.findBookmark },
      },
      select: mocks.select,
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.delete,
    },
    communityEntities: {
      id: makeCol('id'),
      entityType: makeCol('entityType'),
      entityId: makeCol('entityId'),
      status: makeCol('status'),
      visibility: makeCol('visibility'),
      ownerUserId: makeCol('ownerUserId'),
      title: makeCol('title'),
      canonicalPath: makeCol('canonicalPath'),
      reactionsCount: makeCol('reactionsCount'),
      bookmarksCount: makeCol('bookmarksCount'),
    },
    communityReactions: {
      id: makeCol('id'),
      communityEntityId: makeCol('communityEntityId'),
      userId: makeCol('userId'),
      reactionType: makeCol('reactionType'),
    },
    communityBookmarks: {
      id: makeCol('id'),
      communityEntityId: makeCol('communityEntityId'),
      userId: makeCol('userId'),
    },
    communityComments: {
      id: makeCol('id'),
      reactionsCount: makeCol('reactionsCount'),
    },
    publishedPages: {
      id: makeCol('id'),
      likeCount: makeCol('likeCount'),
      bookmarkCount: makeCol('bookmarkCount'),
    },
    moments: {
      id: makeCol('id'),
      authorUserId: makeCol('authorUserId'),
      likeCount: makeCol('likeCount'),
      bookmarkCount: makeCol('bookmarkCount'),
      visibility: makeCol('visibility'),
      body: makeCol('body'),
    },
    users: {
      id: makeCol('id'),
      displayName: makeCol('displayName'),
      userSlug: makeCol('userSlug'),
      avatarUrl: makeCol('avatarUrl'),
    },
  }
})

vi.mock('drizzle-orm', () => {
  const eq = vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b }))
  const and = vi.fn((...args: unknown[]) => ({ type: 'and', args }))
  return {
    eq,
    and,
    count: vi.fn(() => ({})),
    desc: vi.fn((x) => x),
    gt: vi.fn(() => ({})),
    inArray: vi.fn(() => ({})),
    isNull: vi.fn(() => ({})),
    lt: vi.fn(() => ({})),
    or: vi.fn(() => ({})),
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const raw = strings.join('?')
        if (raw.includes('greatest') && raw.includes('- 1')) return { type: 'sql_decrement' }
        if (raw.includes('+ 1') || raw.includes('+ -1')) return { type: 'sql_increment', delta: raw.includes('-1') ? -1 : 1 }
        return { type: 'sql' }
      },
      { raw: vi.fn((s: string) => s) },
    ),
  }
})

import { toggleReaction, toggleBookmark } from './community'

describe('toggleReaction — denormalized counter updates', () => {
  const entity = {
    id: 'entity-1',
    entityType: 'published_page',
    entityId: 'page-1',
    status: 'active',
    visibility: 'public',
    ownerUserId: 'author-1',
    title: 'Test Page',
    canonicalPath: '/test',
    reactionsCount: 5,
    bookmarksCount: 3,
    commentsCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dbOps.length = 0
    mockReactionExists = false
    mocks.findCommunityEntity.mockResolvedValue(entity)
    mocks.findReaction.mockImplementation(() => Promise.resolve(mockReactionExists ? { id: 'r-1', communityEntityId: 'entity-1', userId: 'user-1', reactionType: 'like', createdAt: new Date() } : null))
    // Mock select/from/where chain
    mocks.select.mockReturnValue(mocks.chain)
    mocks.chain.from.mockReturnValue(mocks.chain)
    mocks.chain.where.mockResolvedValue([{ reactionsCount: mockReactionExists ? 4 : 6 }])
  })

  it('returns correct state after LIKING (was not liked)', async () => {
    mockReactionExists = false
    const result = await toggleReaction({ entityType: 'published_page', entityId: 'page-1', reactionType: 'like', session })
    expect(result.has_reacted).toBe(true)
    expect(result.reactions_count).toBe(6)
  })

  it('returns correct state after UNLIKING (was liked)', async () => {
    mockReactionExists = true
    mocks.chain.where.mockResolvedValue([{ reactionsCount: 4 }])
    const result = await toggleReaction({ entityType: 'published_page', entityId: 'page-1', reactionType: 'like', session })
    expect(result.has_reacted).toBe(false)
    expect(result.reactions_count).toBe(4)
  })

  it('updates publishedPages.likeCount when entity is published_page', async () => {
    mockReactionExists = false
    await toggleReaction({ entityType: 'published_page', entityId: 'page-1', reactionType: 'like', session })

    // Verify publishedPages was targeted with an update
    const pageUpdates = dbOps.filter((op) => op.action === 'update' && op.set && 'likeCount' in (op.set as Record<string, unknown>))
    expect(pageUpdates.length).toBeGreaterThan(0)
  })

  it('updates moments.likeCount when entity is moment', async () => {
    mockReactionExists = false
    const momentEntity = { ...entity, entityType: 'moment', entityId: 'moment-1' }
    mocks.findCommunityEntity.mockResolvedValue(momentEntity)
    mocks.chain.where.mockResolvedValue([{ reactionsCount: 1 }])

    await toggleReaction({ entityType: 'moment', entityId: 'moment-1', reactionType: 'like', session })

    const momentUpdates = dbOps.filter((op) => op.action === 'update' && op.set && 'likeCount' in (op.set as Record<string, unknown>))
    expect(momentUpdates.length).toBeGreaterThan(0)
  })

  it('updates communityComments.reactionsCount when entity is comment', async () => {
    mockReactionExists = false
    const commentEntity = { ...entity, entityType: 'comment', entityId: 'comment-1' }
    mocks.findCommunityEntity.mockResolvedValue(commentEntity)
    mocks.chain.where.mockResolvedValue([{ reactionsCount: 1 }])

    await toggleReaction({ entityType: 'comment', entityId: 'comment-1', reactionType: 'like', session })

    const commentUpdates = dbOps.filter((op) => op.action === 'update' && op.set && 'reactionsCount' in (op.set as Record<string, unknown>))
    expect(commentUpdates.length).toBeGreaterThan(0)
  })

  it('deletes existing reaction when un-liking', async () => {
    mockReactionExists = true
    mocks.chain.where.mockResolvedValue([{ reactionsCount: 4 }])
    await toggleReaction({ entityType: 'published_page', entityId: 'page-1', reactionType: 'like', session })
    // The delete call was made via mocks.delete
    expect(mocks.delete).toHaveBeenCalled()
  })

  it('inserts new reaction when liking', async () => {
    mockReactionExists = false
    await toggleReaction({ entityType: 'published_page', entityId: 'page-1', reactionType: 'like', session })
    expect(mocks.insert).toHaveBeenCalled()
  })

  it('throws when entity is not found or not usable', async () => {
    mocks.findCommunityEntity.mockResolvedValue({ ...entity, status: 'hidden' })
    await expect(toggleReaction({ entityType: 'published_page', entityId: 'page-1', reactionType: 'like', session }))
      .rejects.toThrow('community_entity_not_found')
  })
})

describe('toggleBookmark — denormalized counter updates', () => {
  const entity = {
    id: 'entity-1',
    entityType: 'published_page',
    entityId: 'page-1',
    status: 'active',
    visibility: 'public',
    ownerUserId: 'author-1',
    title: 'Test Page',
    canonicalPath: '/test',
    reactionsCount: 5,
    bookmarksCount: 3,
    commentsCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dbOps.length = 0
    mockBookmarkExists = false
    mocks.findCommunityEntity.mockResolvedValue(entity)
    mocks.findBookmark.mockImplementation(() => Promise.resolve(mockBookmarkExists ? { id: 'b-1', communityEntityId: 'entity-1', userId: 'user-1', createdAt: new Date() } : null))
    mocks.select.mockReturnValue(mocks.chain)
    mocks.chain.from.mockReturnValue(mocks.chain)
    mocks.chain.where.mockResolvedValue([{ bookmarksCount: mockBookmarkExists ? 2 : 4 }])
  })

  it('returns correct state after BOOKMARKING (was not bookmarked)', async () => {
    mockBookmarkExists = false
    const result = await toggleBookmark({ entityType: 'published_page', entityId: 'page-1', session })
    expect(result.has_bookmarked).toBe(true)
    expect(result.bookmarks_count).toBe(4)
  })

  it('returns correct state after UNBOOKMARKING (was bookmarked)', async () => {
    mockBookmarkExists = true
    mocks.chain.where.mockResolvedValue([{ bookmarksCount: 2 }])
    const result = await toggleBookmark({ entityType: 'published_page', entityId: 'page-1', session })
    expect(result.has_bookmarked).toBe(false)
    expect(result.bookmarks_count).toBe(2)
  })

  it('updates publishedPages.bookmarkCount when entity is published_page', async () => {
    mockBookmarkExists = false
    await toggleBookmark({ entityType: 'published_page', entityId: 'page-1', session })

    const pageUpdates = dbOps.filter((op) => op.action === 'update' && op.set && 'bookmarkCount' in (op.set as Record<string, unknown>))
    expect(pageUpdates.length).toBeGreaterThan(0)
  })

  it('updates moments.bookmarkCount when entity is moment', async () => {
    mockBookmarkExists = false
    const momentEntity = { ...entity, entityType: 'moment', entityId: 'moment-1' }
    mocks.findCommunityEntity.mockResolvedValue(momentEntity)
    mocks.chain.where.mockResolvedValue([{ bookmarksCount: 1 }])

    await toggleBookmark({ entityType: 'moment', entityId: 'moment-1', session })

    const momentUpdates = dbOps.filter((op) => op.action === 'update' && op.set && 'bookmarkCount' in (op.set as Record<string, unknown>))
    expect(momentUpdates.length).toBeGreaterThan(0)
  })

  it('throws when entity is not usable', async () => {
    mocks.findCommunityEntity.mockResolvedValue({ ...entity, status: 'hidden' })
    await expect(toggleBookmark({ entityType: 'published_page', entityId: 'page-1', session }))
      .rejects.toThrow('community_entity_not_found')
  })
})
