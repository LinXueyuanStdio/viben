/**
 * Tests for Admin Feedbacks list API
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin']) {
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
  return { db, feedbacks: {}, users: {} };
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

describe('GET /api/admin/feedbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectResults = [
      [{ count: 2 }],
      [
        { id: 'fb-1', pageId: 'page-1', category: 'bug', rating: 3, content: 'Found a bug',
          reporterId: 'u1', reporterName: 'user1', reporterDisplayName: 'User One', createdAt: new Date().toISOString() },
        { id: 'fb-2', pageId: 'page-2', category: 'suggestion', rating: 5, content: 'Great idea',
          reporterId: 'u2', reporterName: 'user2', reporterDisplayName: 'User Two', createdAt: new Date().toISOString() },
      ],
    ];
    mocks.selectCallCount = 0;
  });

  it('returns 200 with paginated feedbacks', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.feedbacks).toHaveLength(2);
    expect(json.pagination.total).toBe(2);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBe(20);
  });

  it('filters by category', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks?category=bug`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts category=all', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks?category=all`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts custom pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks?page=2&limit=5`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(5);
  });

  it('returns empty feedbacks', async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.feedbacks).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  it('returns 400 for invalid category', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks?category=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing feedbacks.view permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: feedbacks.view', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/feedbacks`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
