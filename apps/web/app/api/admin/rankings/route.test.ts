/**
 * Tests for Admin Rankings list API
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
    obj[m] = () => obj;
  }
  return obj;
}

let _selectResult: any[] = [];
let _countResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  count: vi.fn(() => ({ type: 'count' })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn((...args: any[]) => {
      const isCount = args[0]?.count?.type === 'count';
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => thenable(isCount ? _countResult : _selectResult)),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => thenable(_selectResult)),
            })),
          })),
        })),
      };
    }),
  };

  return { db, rankingSnapshots: {} };
});

import { GET } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'support',
  expiresAt: Date.now() + 3600000,
};

describe('GET /api/admin/rankings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    _countResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns paginated ranking snapshots', async () => {
    _countResult = [{ count: 2 }];
    _selectResult = [
      { id: 'snap-1', rankingKey: 'published_page_7d', entityType: 'published_page', timeWindow: '7d', status: 'ready', itemCount: 50, createdAt: new Date() },
      { id: 'snap-2', rankingKey: 'published_page_30d', entityType: 'published_page', timeWindow: '30d', status: 'building', itemCount: 0, createdAt: new Date() },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings?page=1&limit=10`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.snapshots).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
  });

  it('filters by status=ready', async () => {
    _countResult = [{ count: 1 }];
    _selectResult = [{ id: 'snap-1', rankingKey: 'published_page_7d', entityType: 'published_page', timeWindow: '7d', status: 'ready', itemCount: 50, createdAt: new Date() }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings?status=ready`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.snapshots).toHaveLength(1);
  });

  it('filters by status=failed', async () => {
    _countResult = [{ count: 0 }];
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings?status=failed`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.total).toBe(0);
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: rankings.view', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: rankings.view');
  });

  it('returns 400 for invalid status', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings?status=invalid`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings?page=0`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });
});
