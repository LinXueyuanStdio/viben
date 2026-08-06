/**
 * Tests for Admin Collection [id] API (GET detail, PATCH update, DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
  selectResults: [] as any[][],
  selectCallCount: 0,
  queryFindFirstResult: null as any,
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) { super(message); this.name = 'AuthError'; }
  },
}));

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('@/lib/admin/logs', () => ({
  createModerationLog: mocks.createModerationLog,
}));

function thenable(value: any) {
  const obj: any = {
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin', 'returning', 'values', 'set']) {
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
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    query: {
      collections: {
        findFirst: vi.fn(() => Promise.resolve(mocks.queryFindFirstResult)),
      },
    },
  };
  return { db, collections: {}, collectionItems: {}, mcpPackages: {}, skillPackages: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  inArray: vi.fn((field: any, values: any[]) => ({ type: 'inArray', field, values })),
}));

import { GET, PATCH, DELETE } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

const mockCollection = {
  id: 'col-1', name: 'Best MCPs', slug: 'best-mcps', description: 'A collection',
  isPublic: true, itemCount: 2, forksCount: 0, bookmarksCount: 3,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  forkedFromId: null, ownerId: 'u1', ownerName: 'dev', ownerDisplayName: 'Dev',
};

describe('GET /api/admin/collections/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectCallCount = 0;
    // Results: collection, items, mcpPackages, skillPackages
    mocks.selectResults = [
      [mockCollection],
      [{ id: 'item-1', itemId: 'pkg-1', itemType: 'mcp', note: null, position: 0, addedAt: new Date().toISOString() }],
      [{ id: 'pkg-1', name: 'test-mcp', slug: 'test-mcp' }],
      [],
    ];
  });

  it('returns 200 with collection, items and resolved names', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`);
    const response = await GET(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.collection.id).toBe('col-1');
    expect(json.items).toHaveLength(1);
    expect(json.items[0].itemName).toBe('test-mcp');
  });

  it('returns 404 when collection not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Collection not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`);
    const response = await GET(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/admin/collections/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.queryFindFirstResult = mockCollection;
  });

  it('updates collection name', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });
    const response = await PATCH(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'edit',
      entityType: 'collection',
    }));
  });

  it('updates collection description and visibility', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'New desc', isPublic: false }),
    });
    const response = await PATCH(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns success with "No changes" when no changes detected', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Best MCPs', description: 'A collection', isPublic: true }),
    });
    const response = await PATCH(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.message).toBe('No changes');
  });

  it('returns 404 when collection not found', async () => {
    mocks.queryFindFirstResult = null;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Collection not found');
  });

  it('returns 400 for invalid request body', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PATCH(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });
});

describe('DELETE /api/admin/collections/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.queryFindFirstResult = mockCollection;
  });

  it('deletes a collection and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'collection',
      action: 'delete',
    }));
  });

  it('returns 404 when collection not found', async () => {
    mocks.queryFindFirstResult = null;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/nonexistent`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Collection not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/collections/col-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('col-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});
