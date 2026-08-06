/**
 * Tests for Admin Ratings list API
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
  return { db, ratings: {}, users: {}, mcpPackages: {}, skillPackages: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  inArray: vi.fn((field: any, values: any[]) => ({ type: 'inArray', field, values })),
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

describe('GET /api/admin/ratings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    // Results: count, data, mcpPackages, skillPackages
    mocks.selectResults = [
      [{ count: 1 }],
      [{
        userId: 'u1', entityType: 'mcp', entityId: 'pkg-1', score: 4,
        username: 'dev', displayName: 'Dev', avatarUrl: null, createdAt: new Date().toISOString(),
      }],
      [{ id: 'pkg-1', name: 'test-mcp' }],
      [],
    ];
    mocks.selectCallCount = 0;
  });

  it('returns 200 with paginated ratings and resolved entity names', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.ratings).toHaveLength(1);
    expect(json.ratings[0].entityName).toBe('test-mcp');
    expect(json.ratings[0].user.username).toBe('dev');
    expect(json.pagination.total).toBe(1);
  });

  it('filters by entity_type', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings?entity_type=skill`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts custom pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings?page=2&limit=10`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(10);
  });

  it('returns empty ratings', async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.ratings).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  it('returns 400 for invalid entity_type', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings?entity_type=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing content.moderate permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
