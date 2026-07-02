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
      drafts: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
  drafts: {
    id: 'id',
    userId: 'userId',
    packageType: 'packageType',
    data: 'data',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  users: {
    id: 'id',
    username: 'username',
    displayName: 'displayName',
    avatarUrl: 'avatarUrl',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  or: vi.fn((...conditions: unknown[]) => conditions[0] ?? null),
  like: vi.fn((column: unknown, pattern: string) => ({ type: 'like', column, pattern })),
  eq: vi.fn((column: unknown, value: unknown) => ({ type: 'eq', column, value })),
  desc: vi.fn((column: unknown) => ({ type: 'desc', column })),
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
  const url = new URL('http://localhost/api/admin/drafts');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

const baseDraft = {
  id: 'draft-1',
  userId: 'user-1',
  packageType: 'mcp',
  data: { name: 'My MCP', description: 'An MCP package' },
  expiresAt: new Date('2025-01-01'),
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2024-12-15'),
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
};

describe('GET /api/admin/drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectChainCount = 0;
    mocks.countData = [{ count: 2 }];
    mocks.listData = [
      baseDraft,
      { ...baseDraft, id: 'draft-2', packageType: 'skill', data: { title: 'My Skill' }, username: 'alice', displayName: 'Alice' },
    ];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated drafts with default params', async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts).toHaveLength(2);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(body.drafts[0].dataPreview).toBeDefined();
    expect(body.drafts[0].user).toBeDefined();
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(NextRequest), 'content.delete');
  });

  it('filters drafts by package_type', async () => {
    mocks.countData = [{ count: 1 }];
    mocks.listData = [baseDraft];

    const response = await GET(makeRequest({ package_type: 'mcp' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts).toHaveLength(1);
    expect(body.drafts[0].packageType).toBe('mcp');
  });

  it('filters drafts by search term', async () => {
    mocks.countData = [{ count: 1 }];
    mocks.listData = [{ ...baseDraft, username: 'searcheduser', displayName: 'Searched User' }];

    const response = await GET(makeRequest({ search: 'searched' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.delete', 403));

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Missing permission: content.delete');
  });

  it('returns 400 for invalid package_type', async () => {
    const response = await GET(makeRequest({ package_type: 'invalid' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid query parameters');
  });

  it('respects page and limit for pagination', async () => {
    mocks.countData = [{ count: 30 }];
    mocks.listData = [baseDraft];

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

  it('returns empty list when no drafts match', async () => {
    mocks.countData = [{ count: 0 }];
    mocks.listData = [];

    const response = await GET(makeRequest({ search: 'nonexistent' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });

  it('returns dataPreview from data.name', async () => {
    mocks.countData = [{ count: 1 }];
    mocks.listData = [{ ...baseDraft, data: { name: 'Named Package' } }];

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts[0].dataPreview).toBe('Named Package');
  });

  it('returns dataPreview from data.title', async () => {
    mocks.countData = [{ count: 1 }];
    mocks.listData = [{ ...baseDraft, data: { title: 'Titled Draft' } }];

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.drafts[0].dataPreview).toBe('Titled Draft');
  });
});
