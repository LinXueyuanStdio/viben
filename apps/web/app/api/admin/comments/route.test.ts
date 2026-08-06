/**
 * Tests for Admin Comments list API
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
  const db = {
    select: vi.fn(createSelectChain),
  };
  return { db, comments: {}, users: {}, mcpPackages: {}, skillPackages: {}, collections: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  like: vi.fn((field: any, pattern: any) => ({ type: 'like', field, pattern })),
  inArray: vi.fn((field: any, values: any[]) => ({ type: 'inArray', field, values })),
}));

import { GET } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

describe('GET /api/admin/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    // Results: count, data, then resolveEntityNames selects (mcp, skill, collection)
    mocks.selectResults = [
      [{ count: 1 }],
      [{ id: 'comment-1', entityType: 'mcp', entityId: 'pkg-1', content: 'Great!', userId: 'u1', username: 'dev', displayName: 'Dev', avatarUrl: null, createdAt: new Date().toISOString() }],
      [], // mcpPackages lookup
      [], // skillPackages lookup
      [], // collections lookup
    ];
    mocks.selectCallCount = 0;
  });

  it('returns 200 with comments and entity names', async () => {
    mocks.selectResults[2] = [{ id: 'pkg-1', name: 'test-mcp' }];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0].entityName).toBe('test-mcp');
    expect(json.comments[0].user).toBeDefined();
    expect(json.pagination.total).toBe(1);
  });

  it('falls back to truncated ID for unknown entity names', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.comments[0].entityName).toMatch(/^MCP /);
  });

  it('filters by entity_type', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments?entity_type=skill`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('filters by search query', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments?search=great`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
  });

  it('accepts custom pagination', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments?page=2&limit=10`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(10);
  });

  it('returns empty comments', async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.comments).toEqual([]);
    expect(json.pagination.total).toBe(0);
  });

  // ======== Validation ========

  it('returns 400 for invalid entity_type', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments?entity_type=invalid`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  it('returns 400 for page less than 1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments?page=0`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
  });

  // ======== Permission ========

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing content.moderate permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(403);
  });

  // ======== Server error ========

  it('returns 500 on unexpected error', async () => {
    mocks.selectResults = [false as any];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments`);
    const response = await GET(request);
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
