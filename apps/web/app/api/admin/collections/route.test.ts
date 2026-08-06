/**
 * Tests for Admin Collections list API
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin']) {
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
  return { db, collections: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  like: vi.fn((field: any, pattern: any) => ({ type: 'like', field, pattern })),
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

describe('GET /api/admin/collections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectResults = [
      [{ count: 2 }],
      [
        { id: 'col-1', name: 'Best MCPs', isPublic: true, itemCount: 5, ownerName: 'user1' },
        { id: 'col-2', name: 'My Tools', isPublic: false, itemCount: 3, ownerName: 'user2' },
      ],
    ];
    mocks.selectCallCount = 0;
  });

  it('returns 200 with paginated collections', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.collections).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
  });

  it('filters by visibility=public', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections?visibility=public`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('filters by visibility=private', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections?visibility=private`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('filters by search query', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections?search=best`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts custom pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections?page=2&limit=10`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(10);
  });

  it('returns empty collections', async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.collections).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  it('returns 400 for invalid visibility', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections?visibility=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing content.moderate permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
