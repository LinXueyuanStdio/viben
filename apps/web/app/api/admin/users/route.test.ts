import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  selectChainCount: 0,
  countData: [{ count: 0 }] as any[],
  listData: [] as any[],
  AuthError: class AuthError extends Error {
    public status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
    }
  },
}));

vi.mock('@/lib/auth', () => ({
  AuthError: mocks.AuthError,
  requirePermission: mocks.requirePermission,
}));

function createSelectChain(result: any) {
  const chain: any = vi.fn();
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => Promise.resolve(result).then(resolve);
  chain.catch = (reject: any) => Promise.resolve(result).catch(reject);
  return chain;
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => {
      mocks.selectChainCount++;
      if (mocks.selectChainCount === 1) {
        return createSelectChain(mocks.countData);
      }
      return createSelectChain(mocks.listData);
    }),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ id: 'log-id' }]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
  users: {
    id: 'id',
    username: 'username',
    email: 'email',
    displayName: 'displayName',
    avatarUrl: 'avatarUrl',
    role: 'role',
    createdAt: 'createdAt',
    lastLoginAt: 'lastLoginAt',
    bannedAt: 'bannedAt',
    warnedAt: 'warnedAt',
  },
  moderationLogs: {
    adminId: 'adminId',
    entityType: 'entityType',
    entityId: 'entityId',
    action: 'action',
    reason: 'reason',
    metadata: 'metadata',
    id: 'id',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  or: vi.fn((...conditions: unknown[]) => conditions[0] ?? null),
  like: vi.fn((column: unknown, pattern: string) => ({ type: 'like', column, pattern })),
  eq: vi.fn((column: unknown, value: unknown) => ({ type: 'eq', column, value })),
  desc: vi.fn((column: unknown) => ({ type: 'desc', column })),
  asc: vi.fn((column: unknown) => ({ type: 'asc', column })),
  count: vi.fn(() => ({ type: 'count' })),
  sql: vi.fn(),
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'super_admin' as const,
  avatarUrl: null,
  expiresAt: Date.now() + 3600000,
};

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/users');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

const baseUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  role: 'user',
  createdAt: new Date('2024-01-01'),
  lastLoginAt: new Date('2024-06-01'),
  bannedAt: null,
  warnedAt: null,
};

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectChainCount = 0;
    mocks.countData = [{ count: 3 }];
    mocks.listData = [
      baseUser,
      { ...baseUser, id: 'user-2', username: 'alice', email: 'alice@example.com', displayName: 'Alice' },
      { ...baseUser, id: 'user-3', username: 'bob', email: 'bob@example.com', displayName: 'Bob', role: 'developer' },
    ];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated users with default params', async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toHaveLength(3);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(NextRequest), 'users.view');
  });

  it('filters users by search term', async () => {
    mocks.countData = [{ count: 1 }];
    mocks.listData = [baseUser];

    const response = await GET(makeRequest({ search: 'test' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('filters users by role', async () => {
    mocks.countData = [{ count: 1 }];
    mocks.listData = [{ ...baseUser, role: 'developer' }];

    const response = await GET(makeRequest({ role: 'developer' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users[0].role).toBe('developer');
  });

  it('sorts by newest and oldest', async () => {
    mocks.countData = [{ count: 2 }];
    mocks.listData = [
      { ...baseUser, id: 'newer' },
      { ...baseUser, id: 'older' },
    ];

    const response = await GET(makeRequest({ sort: 'oldest' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toHaveLength(2);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: users.view', 403));

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Missing permission: users.view');
  });

  it('returns 400 for invalid role enum', async () => {
    const response = await GET(makeRequest({ role: 'invalid_role' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid query parameters');
    expect(body.details).toBeDefined();
  });

  it('returns 400 for invalid sort value', async () => {
    const response = await GET(makeRequest({ sort: 'invalid_sort' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const response = await GET(makeRequest({ page: '0' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid query parameters');
  });

  it('respects page and limit for pagination', async () => {
    mocks.countData = [{ count: 30 }];
    mocks.listData = [baseUser];

    const response = await GET(makeRequest({ page: '2', limit: '10' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 30,
      totalPages: 3,
    });
  });

  it('returns empty list when no users match', async () => {
    mocks.countData = [{ count: 0 }];
    mocks.listData = [];

    const response = await GET(makeRequest({ search: 'nonexistent' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(0);
  });
});
