/**
 * Tests for Admin API Keys list API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

function thenable(value: any) {
  const obj: any = {
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin']) {
    obj[m] = () => obj;
  }
  return obj;
}

let _countResult: any[] = [];
let _selectResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  or: vi.fn((...conditions: any[]) => ({ type: 'or', conditions })),
  gt: vi.fn((a: any, b: any) => ({ type: 'gt', a, b })),
  lte: vi.fn((a: any, b: any) => ({ type: 'lte', a, b })),
  isNull: vi.fn((field: any) => ({ type: 'isNull', field })),
  isNotNull: vi.fn((field: any) => ({ type: 'isNotNull', field })),
  sql: (() => {
    function sql(strings: any, ...exprs: any[]) {
      return { type: 'sql', value: 'tagged' };
    }
    (sql as any).TRUE = { type: 'sql', value: 'TRUE' };
    return sql as any;
  })(),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn((...args: any[]) => {
      const isCount = args[0]?.count?.type === 'count';
      return {
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(() => thenable(isCount ? _countResult : _selectResult)),
                })),
              })),
            })),
          })),
          where: vi.fn(() => thenable(isCount ? _countResult : _selectResult)),
        })),
      };
    }),
  };

  return { db, apiKeys: {}, users: {} };
});

import { GET } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

describe('GET /api/admin/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated API keys list', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      { id: 'key-1', name: 'My API Key', keyPrefix: 'bmcp_abc123', scopes: ['read'], lastUsedAt: new Date('2025-01-15T10:00:00Z'), expiresAt: null, createdAt: new Date('2025-01-01T10:00:00Z'), userId: 'user-1', username: 'alice' },
      { id: 'key-2', name: 'Expired Key', keyPrefix: 'bmcp_def456', scopes: ['read', 'write'], lastUsedAt: null, expiresAt: new Date('2024-01-01T00:00:00Z'), createdAt: new Date('2024-01-01T00:00:00Z'), userId: 'user-2', username: 'bob' },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.apiKeys).toHaveLength(2);
    expect(json.apiKeys[0].id).toBe('key-1');
    expect(json.apiKeys[0].name).toBe('My API Key');
    expect(json.apiKeys[0].keyPrefix).toBe('bmcp_abc123');
    expect(json.pagination.total).toBe(2);
  });

  it('filters by status=active', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'key-1', name: 'My API Key', keyPrefix: 'bmcp_abc123', scopes: ['read'], lastUsedAt: new Date('2025-01-15T10:00:00Z'), expiresAt: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2025-01-01T10:00:00Z'), userId: 'user-1', username: 'alice' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?status=active`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.apiKeys).toHaveLength(1);
  });

  it('filters by status=expired', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'key-2', name: 'Expired Key', keyPrefix: 'bmcp_def456', scopes: ['read'], lastUsedAt: null, expiresAt: new Date('2024-01-01T00:00:00Z'), createdAt: new Date('2024-01-01T00:00:00Z'), userId: 'user-2', username: 'bob' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?status=expired`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.apiKeys).toHaveLength(1);
  });

  it('filters by status=permanent', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'key-1', name: 'Permanent Key', keyPrefix: 'bmcp_abc123', scopes: ['read'], lastUsedAt: new Date('2025-01-15T10:00:00Z'), expiresAt: null, createdAt: new Date('2025-01-01T10:00:00Z'), userId: 'user-1', username: 'alice' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?status=permanent`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.apiKeys).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: users.view', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: users.view');
  });

  it('returns 400 for invalid status value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?status=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when page is less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when limit exceeds 50', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys?limit=51`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 200 with empty apiKeys array and zero pagination', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.apiKeys).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });
});
