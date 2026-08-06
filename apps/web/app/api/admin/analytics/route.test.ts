import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  dbSelect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/db', () => ({
  db: { select: mocks.dbSelect },
  entityStatsDaily: {
    statDate: {},
    entityType: {},
    entityId: {},
    viewCount: {},
    uniqueViewerCount: {},
    readCount: {},
    likeCount: {},
    bookmarkCount: {},
    commentCount: {},
    shareCount: {},
    repostCount: {},
    subscriberCount: {},
  },
}));

vi.mock('drizzle-orm', async () => ({
  sql: vi.fn(() => ({ mapWith: vi.fn().mockReturnThis(), as: vi.fn().mockReturnThis() })),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

import { GET } from './route';

function createChainMock<T>(data: T) {
  const resolved = Promise.resolve(data);
  const mock: any = {
    then: (resolve: any, reject: any) => resolved.then(resolve, reject),
    catch: (reject: any) => resolved.catch(reject),
  };
  mock.from = vi.fn(() => mock);
  mock.where = vi.fn(() => mock);
  mock.groupBy = vi.fn(() => mock);
  mock.orderBy = vi.fn(() => mock);
  mock.limit = vi.fn(() => mock);
  mock.offset = vi.fn(() => mock);
  return mock;
}

const mockSummary = {
  totalViews: 5000,
  totalUniqueViewers: 1200,
  totalReads: 3000,
  totalLikes: 450,
  totalBookmarks: 200,
  totalComments: 150,
  totalShares: 80,
  totalReposts: 30,
  totalSubscribers: 400,
};

const mockDailyStats = [
  {
    statDate: new Date('2026-07-01'),
    viewCount: 500,
    uniqueViewerCount: 120,
    readCount: 300,
    likeCount: 45,
    bookmarkCount: 20,
    commentCount: 15,
    shareCount: 8,
    repostCount: 3,
    subscriberCount: 40,
  },
  {
    statDate: new Date('2026-07-02'),
    viewCount: 600,
    uniqueViewerCount: 150,
    readCount: 350,
    likeCount: 50,
    bookmarkCount: 25,
    commentCount: 20,
    shareCount: 10,
    repostCount: 5,
    subscriberCount: 45,
  },
];

const mockTopEntities = [
  {
    entityType: 'page',
    entityId: 'page-1',
    totalViews: 1500,
    totalUniqueViewers: 400,
    totalReads: 900,
    totalLikes: 120,
    totalBookmarks: 60,
    totalComments: 40,
    totalShares: 20,
    totalReposts: 8,
    totalSubscribers: 100,
  },
];

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      userId: 'admin-1',
      username: 'admin',
      userSlug: 'admin',
      email: 'admin@example.com',
      role: 'super_admin',
      expiresAt: Date.now() + 1000,
    });
    mocks.dbSelect
      .mockReturnValueOnce(createChainMock(mockDailyStats))
      .mockReturnValueOnce(createChainMock([mockSummary]))
      .mockReturnValueOnce(createChainMock(mockTopEntities));
  });

  it('returns 401 when requirePermission rejects with AuthError(status=401)', async () => {
    mocks.requirePermission.mockRejectedValue(
      new (await import('@/lib/auth')).AuthError('Authentication required', 401)
    );

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it('returns 403 when requirePermission rejects with AuthError(status=403)', async () => {
    mocks.requirePermission.mockRejectedValue(
      new (await import('@/lib/auth')).AuthError('Insufficient permissions', 403)
    );

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 200 with full analytics data structure', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics?range=7d`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('summary');
    expect(json).toHaveProperty('dailyStats');
    expect(json).toHaveProperty('topEntities');
    expect(json).toHaveProperty('meta');
    expect(json.summary.totalViews).toBe(5000);
    expect(json.summary.totalUniqueViewers).toBe(1200);
    expect(json.summary.totalReads).toBe(3000);
    expect(json.summary.totalLikes).toBe(450);
    expect(json.summary.totalBookmarks).toBe(200);
    expect(json.dailyStats).toHaveLength(2);
    expect(json.dailyStats[0].viewCount).toBe(500);
    expect(json.topEntities).toHaveLength(1);
    expect(json.topEntities[0].entityType).toBe('page');
    expect(json.meta.range).toBe('7d');
    expect(json.meta.entityType).toBeNull();
    expect(mocks.dbSelect).toHaveBeenCalledTimes(3);
  });

  it('returns 400 for invalid range parameter', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics?range=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
    expect(json).toHaveProperty('details');
  });

  it('handles custom date range with start_date and end_date', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics?start_date=2026-06-01&end_date=2026-06-30`
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.meta.startDate).toContain('2026-06-01');
    expect(json.meta.endDate).toContain('2026-06-30');
  });

  it('handles entity_type filter parameter', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics?entity_type=page`
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.meta.entityType).toBe('page');
  });

  it('handles empty results gracefully', async () => {
    mocks.dbSelect.mockReset();
    mocks.dbSelect
      .mockReturnValueOnce(createChainMock([]))
      .mockReturnValueOnce(createChainMock([]))
      .mockReturnValueOnce(createChainMock([]));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary.totalViews).toBe(0);
    expect(json.summary.totalUniqueViewers).toBe(0);
    expect(json.summary.totalReads).toBe(0);
    expect(json.dailyStats).toEqual([]);
    expect(json.topEntities).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mocks.dbSelect.mockReset();
    mocks.dbSelect.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
