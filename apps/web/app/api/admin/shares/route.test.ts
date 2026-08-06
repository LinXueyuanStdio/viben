/**
 * Tests for Admin Shares list API
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

// sql must be callable (tagged template literal) AND have properties (sql.TRUE)
function sql(strings: any, ...exprs: any[]) {
  return { type: 'sql', value: 'tagged' };
}
Object.assign(sql, {
  TRUE: { type: 'sql', value: 'TRUE' },
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  or: vi.fn((...conditions: any[]) => ({ type: 'or', conditions })),
  isNull: vi.fn((field: any) => ({ type: 'isNull', field })),
  isNotNull: vi.fn((field: any) => ({ type: 'isNotNull', field })),
  lt: vi.fn((a: any, b: any) => ({ type: 'lt', a, b })),
  sql,
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

  return { db, shareLinks: {}, users: {} };
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

describe('GET /api/admin/shares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated shares list', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      {
        id: 'share-1', uid: 'abc123', entityType: 'published_page', entityId: 'page-1',
        channel: 'copy_link', targetUrl: 'https://example.com/share/abc123',
        htmlDirectUrl: 'https://example.com/page', expiresAt: null, revokedAt: null,
        openCount: 10, uniqueOpenCount: 5, createdAt: new Date('2025-01-15T10:00:00Z'),
        createdByUserId: 'user-1', createdByUsername: 'alice', createdByDisplayName: 'Alice',
      },
      {
        id: 'share-2', uid: 'def456', entityType: 'published_page', entityId: 'page-2',
        channel: 'copy_link', targetUrl: 'https://example.com/share/def456',
        htmlDirectUrl: 'https://example.com/page2', expiresAt: new Date('2025-01-01T00:00:00Z'), revokedAt: null,
        openCount: 3, uniqueOpenCount: 2, createdAt: new Date('2025-01-14T10:00:00Z'),
        createdByUserId: 'user-2', createdByUsername: 'bob', createdByDisplayName: 'Bob',
      },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?page=1&limit=20`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.shares).toHaveLength(2);
    expect(json.shares[0].id).toBe('share-1');
    expect(json.shares[0].uid).toBe('abc123');
    expect(json.shares[0].status).toBe('active');
    expect(json.shares[1].status).toBe('expired');
    expect(json.shares[1].createdBy).toEqual({ userId: 'user-2', username: 'bob', displayName: 'Bob' });
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.totalPages).toBe(1);
  });

  it('filters by status=active', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [
      { id: 'share-1', uid: 'abc123', entityType: 'published_page', entityId: 'page-1', channel: 'copy_link', targetUrl: 'https://example.com/share/abc123', htmlDirectUrl: 'https://example.com/page', expiresAt: null, revokedAt: null, openCount: 10, uniqueOpenCount: 5, createdAt: new Date('2025-01-15T10:00:00Z'), createdByUserId: 'user-1', createdByUsername: 'alice', createdByDisplayName: 'Alice' },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?status=active`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.shares).toHaveLength(1);
    expect(json.shares[0].status).toBe('active');
  });

  it('filters by status=expired', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [
      { id: 'share-2', uid: 'def456', entityType: 'published_page', entityId: 'page-2', channel: 'copy_link', targetUrl: 'https://example.com/share/def456', htmlDirectUrl: 'https://example.com/page2', expiresAt: new Date('2025-01-01T00:00:00Z'), revokedAt: null, openCount: 3, uniqueOpenCount: 2, createdAt: new Date('2025-01-14T10:00:00Z'), createdByUserId: 'user-2', createdByUsername: 'bob', createdByDisplayName: 'Bob' },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?status=expired`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.shares).toHaveLength(1);
    expect(json.shares[0].status).toBe('expired');
  });

  it('filters by status=revoked', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [
      { id: 'share-3', uid: 'ghi789', entityType: 'published_page', entityId: 'page-3', channel: 'copy_link', targetUrl: 'https://example.com/share/ghi789', htmlDirectUrl: 'https://example.com/page3', expiresAt: null, revokedAt: new Date('2025-01-10T00:00:00Z'), openCount: 1, uniqueOpenCount: 1, createdAt: new Date('2025-01-13T10:00:00Z'), createdByUserId: 'user-3', createdByUsername: 'charlie', createdByDisplayName: 'Charlie' },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?status=revoked`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.shares).toHaveLength(1);
    expect(json.shares[0].status).toBe('revoked');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: content.moderate');
  });

  it('returns 400 for invalid status value', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?status=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when page is less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 when limit exceeds 100', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares?limit=101`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 200 with empty shares array and zero pagination', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/shares`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.shares).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.totalPages).toBe(0);
  });
});
