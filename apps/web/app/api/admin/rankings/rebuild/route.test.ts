/**
 * Tests for Admin Rankings Rebuild API
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
  obj.catch = (onRejected: any) => obj.then(undefined, onRejected);
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'returning', 'values', 'set']) {
    obj[m] = () => obj;
  }
  return obj;
}

const selectQueue: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  desc: vi.fn((field: any) => ({ type: 'desc', field })),
  gte: vi.fn((field: any, value: any) => ({ type: 'gte', field, value })),
  lte: vi.fn((field: any, value: any) => ({ type: 'lte', field, value })),
  count: vi.fn(() => ({ type: 'count' })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(selectQueue.shift() ?? [])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => thenable(undefined)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => thenable(undefined)),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => thenable(undefined)),
    })),
  };

  return { db, rankingSnapshots: {}, rankingItems: {}, publishedPages: {} };
});

import { POST } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

function snapshotResult() {
  return [{
    id: 'new-snapshot',
    rankingKey: 'published_page',
    entityType: 'published_page',
    timeWindow: '7d',
    status: 'ready',
    itemCount: 0,
    validFrom: new Date(),
  }];
}

describe('POST /api/admin/rankings/rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('rebuilds ranking with default entityType and timeWindow', async () => {
    // First select: pages query (empty)
    // Second select: final snapshot lookup
    selectQueue.push([], snapshotResult());

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toContain('重建完成');
    expect(json.snapshot.id).toBe('new-snapshot');
    expect(json.snapshot.status).toBe('ready');
  });

  it('rebuilds with explicit entityType and timeWindow', async () => {
    selectQueue.push([], snapshotResult());

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ entityType: 'published_page', timeWindow: '30d' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 400 for unsupported entityType', async () => {
    selectQueue.push([]); // Only need pages query (no snapshot lookup for error path)

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ entityType: 'mcp_package' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('not yet supported');
  });

  it('returns 400 for invalid timeWindow', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ entityType: 'published_page', timeWindow: 'invalid' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for invalid entityType', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ entityType: 'invalid' }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing rankings.manage permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: rankings.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/rankings/rebuild`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: rankings.manage');
  });
});
