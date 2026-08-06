/**
 * Tests for Admin Pages list API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  countData: [{ count: 0 }] as any[],
  listData: [] as any[],
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
  selectCallCount: 0,
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
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

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(() => {
      mocks.selectCallCount++;
      const result = mocks.selectCallCount === 1 ? mocks.countData : mocks.listData;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => thenable(result)),
          leftJoin: vi.fn(() => thenable(result)),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => thenable(result)),
            })),
          })),
        })),
      };
    }),
  };

  return { db, publishedPages: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

describe('GET /api/admin/pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.countData = [{ count: 2 }];
    mocks.listData = [
      { id: 'page-1', title: 'Test Page 1', moderationStatus: 'pending', authorUsername: 'user1' },
      { id: 'page-2', title: 'Test Page 2', moderationStatus: 'pending', authorUsername: 'user2' },
    ];
    mocks.selectCallCount = 0;
  });

  // ======== Successful response ========

  it('returns 200 with paginated pages', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pages).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
  });

  it('returns empty pages', async () => {
    mocks.countData = [{ count: 0 }];
    mocks.listData = [];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pages).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  // ======== Query params ========

  it('filters by moderation_status', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages?moderation_status=approved`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts moderation_status=all', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages?moderation_status=all`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts custom pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages?page=2&limit=10`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(10);
  });

  // ======== Validation ========

  it('returns 400 for invalid moderation_status', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages?moderation_status=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for limit exceeding 50', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages?limit=100`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  // ======== Permission ========

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: pages.review', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: pages.review');
  });

  // ======== Server error ========

  it('returns 500 on unexpected error', async () => {
    mocks.countData = false as any;
    mocks.listData = false as any;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/pages`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
