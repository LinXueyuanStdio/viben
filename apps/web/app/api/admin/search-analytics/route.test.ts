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
  searchQueries: {
    id: {},
    query: {},
    resultCount: {},
    searchedAt: {},
    userId: {},
  },
}));

vi.mock('drizzle-orm', async () => ({
  sql: vi.fn(() => ({ mapWith: vi.fn().mockReturnThis(), as: vi.fn().mockReturnThis() })),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  count: vi.fn(() => ({})),
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

const mockTopSearches = [
  { query: 'react', count: 50, last_searched_at: '2026-07-02T10:00:00.000Z' },
  { query: 'typescript', count: 30, last_searched_at: '2026-07-01T15:00:00.000Z' },
];

const mockRecentSearches = [
  {
    id: 1,
    query: 'react',
    resultCount: 10,
    searchedAt: new Date('2026-07-02'),
    userId: 'user-1',
  },
  {
    id: 2,
    query: 'typescript',
    resultCount: 5,
    searchedAt: new Date('2026-07-01'),
    userId: null,
  },
];

const mockTotalCount = [{ count: 2 }];

describe('GET /api/admin/search-analytics', () => {
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
      .mockReturnValueOnce(createChainMock(mockTopSearches))
      .mockReturnValueOnce(createChainMock(mockRecentSearches))
      .mockReturnValueOnce(createChainMock(mockTotalCount));
  });

  it('returns 401 when requirePermission rejects with AuthError(status=401)', async () => {
    mocks.requirePermission.mockRejectedValue(
      new (await import('@/lib/auth')).AuthError('Authentication required', 401)
    );

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics`);
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

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 200 with topSearches, recentSearches, and pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('topSearches');
    expect(json).toHaveProperty('recentSearches');
    expect(json).toHaveProperty('pagination');
    expect(json.topSearches).toHaveLength(2);
    expect(json.topSearches[0].query).toBe('react');
    expect(json.topSearches[0].count).toBe(50);
    expect(json.recentSearches).toHaveLength(2);
    expect(json.recentSearches[0].query).toBe('react');
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.totalPages).toBe(1);
    expect(mocks.dbSelect).toHaveBeenCalledTimes(3);
  });

  it('returns 400 for invalid page parameter (page=0)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
    expect(json).toHaveProperty('details');
  });

  it('returns 400 for limit exceeding max (limit=200)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics?limit=200`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('handles date filter with start_date and end_date', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics?start_date=2026-06-01&end_date=2026-06-30`
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(1);
    expect(json.topSearches).toHaveLength(2);
  });

  it('handles empty results gracefully', async () => {
    mocks.dbSelect.mockReset();
    mocks.dbSelect
      .mockReturnValueOnce(createChainMock([]))
      .mockReturnValueOnce(createChainMock([]))
      .mockReturnValueOnce(createChainMock([{ count: 0 }]));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topSearches).toEqual([]);
    expect(json.recentSearches).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });

  it('returns 500 on unexpected error', async () => {
    mocks.dbSelect.mockReset();
    mocks.dbSelect.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/search-analytics`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
