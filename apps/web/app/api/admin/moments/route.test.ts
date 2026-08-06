/**
 * Tests for Admin Moments list API
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  selectResults: [] as any[][],
  selectCallCount: 0,
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', '$dynamic']) {
    obj[m] = () => obj;
  }
  return obj;
}

function createSelectChain() {
  mocks.selectCallCount++;
  const result = mocks.selectResults[mocks.selectCallCount - 1] ?? [];
  return { from: vi.fn(() => thenable(result)) };
}

vi.mock('@/lib/db', () => {
  const db = { select: vi.fn(createSelectChain) };
  return { db, moments: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  sql: vi.fn(() => ({ type: 'sql' })),
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

describe('GET /api/admin/moments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    // Results: count, data
    mocks.selectResults = [
      [{ count: 2 }],
      [
        { id: 'mom-1', uid: 'M001', kind: 'post', body: 'Hello world', visibility: 'public',
          likeCount: 5, commentCount: 2, repostCount: 0, viewCount: 100, isPinned: false,
          isDeleted: false, createdAt: new Date().toISOString(), authorName: 'Dev', authorUsername: 'dev' },
        { id: 'mom-2', uid: 'M002', kind: 'repost', body: 'RT', visibility: 'public',
          likeCount: 0, commentCount: 0, repostCount: 0, viewCount: 10, isPinned: true,
          isDeleted: false, createdAt: new Date().toISOString(), authorName: 'User2', authorUsername: 'user2' },
      ],
    ];
    mocks.selectCallCount = 0;
  });

  it('returns 200 with paginated moments', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.moments).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
  });

  it('returns 200 for empty moments list', async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.moments).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  it('filters by kind', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?kind=post`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('filters by visibility', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?visibility=public`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('filters by search query', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?search=hello`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts include_deleted=true', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?include_deleted=true`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts custom pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?page=2&limit=5`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(5);
  });

  it('returns 400 for invalid kind', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?kind=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for invalid visibility', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?visibility=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing moments.moderate permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: moments.moderate', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
