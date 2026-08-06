/**
 * Tests for Admin Operations Items [id] API (PATCH/DELETE)
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'returning', 'values', 'set']) {
    obj[m] = () => obj;
  }
  return obj;
}

let _updateResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => thenable(_updateResult)),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };

  return { db, operationItems: {} };
});

import { PATCH, DELETE } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator',
  expiresAt: Date.now() + 3600000,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('PATCH /api/admin/operations/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('updates an item title', async () => {
    _updateResult = [{ id: 'item-1', uid: 'banner-1', title: 'Updated Title', visibility: 'published', isActive: true, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    const response = await PATCH(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.item.title).toBe('Updated Title');
  });

  it('updates visibility to scheduled', async () => {
    _updateResult = [{ id: 'item-1', uid: 'banner-1', title: 'Banner', visibility: 'scheduled', isActive: true, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: 'scheduled', starts_at: '2026-07-10T00:00:00.000Z' }),
    });
    const response = await PATCH(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.item.visibility).toBe('scheduled');
  });

  it('archives an item', async () => {
    _updateResult = [{ id: 'item-1', uid: 'banner-1', title: 'Banner', visibility: 'archived', isActive: false, sortOrder: 0 }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: 'archived', is_active: false }),
    });
    const response = await PATCH(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.item.visibility).toBe('archived');
  });

  it('returns 404 when item not found', async () => {
    _updateResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Test' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Item not found');
  });

  it('returns 400 for invalid visibility', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: 'invalid' }),
    });
    const response = await PATCH(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Test' }),
    });
    const response = await PATCH(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});

describe('DELETE /api/admin/operations/items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('deletes an item', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: operations.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/items/item-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('item-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: operations.manage');
  });
});
