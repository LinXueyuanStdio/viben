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
  activityEvents: {
    id: {},
    actorUserId: {},
    eventType: {},
    entityType: {},
    entityId: {},
    targetUserId: {},
    metadata: {},
    createdAt: {},
  },
  users: {
    id: {},
    username: {},
    displayName: {},
    avatarUrl: {},
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
  aliasedTable: vi.fn(() => ({})),
}));

import { GET } from './route';

function createChainMock<T>(data: T) {
  const resolved = Promise.resolve(data);
  const mock: any = {
    then: (resolve: any, reject: any) => resolved.then(resolve, reject),
    catch: (reject: any) => resolved.catch(reject),
  };
  mock.from = vi.fn(() => mock);
  mock.leftJoin = vi.fn(() => mock);
  mock.where = vi.fn(() => mock);
  mock.groupBy = vi.fn(() => mock);
  mock.orderBy = vi.fn(() => mock);
  mock.limit = vi.fn(() => mock);
  mock.offset = vi.fn(() => mock);
  return mock;
}

const mockEvents = [
  {
    id: 1,
    actorUserId: 'user-1',
    eventType: 'page.create',
    entityType: 'page',
    entityId: 'page-1',
    targetUserId: null,
    metadata: {},
    createdAt: new Date('2026-07-02'),
    actorUsername: 'admin',
    actorDisplayName: 'Admin',
    actorAvatarUrl: null,
    targetUsername: null,
    targetDisplayName: null,
  },
  {
    id: 2,
    actorUserId: 'user-2',
    eventType: 'page.update',
    entityType: 'page',
    entityId: 'page-2',
    targetUserId: null,
    metadata: {},
    createdAt: new Date('2026-07-01'),
    actorUsername: 'editor',
    actorDisplayName: 'Editor',
    actorAvatarUrl: '/avatar.png',
    targetUsername: null,
    targetDisplayName: null,
  },
];

const mockTotalCount = [{ count: 2 }];

describe('GET /api/admin/activity', () => {
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
      .mockReturnValueOnce(createChainMock(mockTotalCount))
      .mockReturnValueOnce(createChainMock(mockEvents));
  });

  it('returns 401 when requirePermission rejects with AuthError(status=401)', async () => {
    mocks.requirePermission.mockRejectedValue(
      new (await import('@/lib/auth')).AuthError('Authentication required', 401)
    );

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity`);
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

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Insufficient permissions');
  });

  it('returns 200 with events array and pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('events');
    expect(json).toHaveProperty('pagination');
    expect(json.events).toHaveLength(2);
    expect(json.events[0].id).toBe(1);
    expect(json.events[0].eventType).toBe('page.create');
    expect(json.events[0].entityType).toBe('page');
    expect(json.events[0].actorUsername).toBe('admin');
    expect(json.events[0].targetDisplayName).toBeNull();
    expect(json.events[1].actorAvatarUrl).toBe('/avatar.png');
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.totalPages).toBe(1);
    expect(mocks.dbSelect).toHaveBeenCalledTimes(2);
  });

  it('returns 400 for invalid page parameter (page=0)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
    expect(json).toHaveProperty('details');
  });

  it('returns 400 for limit exceeding max (limit=100)', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity?limit=100`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('handles event_type filter parameter', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity?event_type=page.create`
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(2);
    expect(json.events[0].eventType).toBe('page.create');
  });

  it('handles date filter with start_date and end_date', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity?start_date=2026-06-01&end_date=2026-06-30`
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.total).toBe(2);
    expect(json.events).toHaveLength(2);
  });

  it('handles empty results gracefully', async () => {
    mocks.dbSelect.mockReset();
    mocks.dbSelect
      .mockReturnValueOnce(createChainMock([{ count: 0 }]))
      .mockReturnValueOnce(createChainMock([]));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });

  it('returns 500 on unexpected error', async () => {
    mocks.dbSelect.mockReset();
    mocks.dbSelect.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/activity`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
