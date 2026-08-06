/**
 * Tests for Admin Operations Slot Items list/create API
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

let _selectResult: any[] = [];
let _insertResult: any[] = [];

vi.mock('@/lib/auth', () => ({
  requirePermission: mocks.requirePermission,
  AuthError: mocks.AuthError,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
  asc: vi.fn((field: any) => ({ type: 'asc', field })),
}));

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(_selectResult)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => thenable(_insertResult)),
      })),
    })),
  };

  return { db, operationItems: {} };
});

import { GET, POST } from './route';

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

describe('GET /api/admin/operations/slots/[id]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('lists items for a slot', async () => {
    _selectResult = [
      { id: 'item-1', uid: 'banner-1', slotId: 'slot-1', itemType: 'banner', title: 'Welcome', sortOrder: 0, visibility: 'published', isActive: true },
      { id: 'item-2', uid: 'banner-2', slotId: 'slot-1', itemType: 'banner', title: 'Promo', sortOrder: 1, visibility: 'draft', isActive: true },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`);
    const response = await GET(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(2);
    expect(json.items[0].uid).toBe('banner-1');
    expect(json.items[1].uid).toBe('banner-2');
  });

  it('returns empty items for slot with no items', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`);
    const response = await GET(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(0);
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`);
    const response = await GET(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});

describe('POST /api/admin/operations/slots/[id]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('creates a new item in a slot', async () => {
    _selectResult = [];
    _insertResult = [{ id: 'new-item', uid: 'banner-1', slotId: 'slot-1', itemType: 'banner', title: 'New Banner', sortOrder: 0, visibility: 'draft', isActive: true }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`, {
      method: 'POST',
      body: JSON.stringify({
        uid: 'banner-1',
        item_type: 'banner',
        title: 'New Banner',
        visibility: 'published',
      }),
    });
    const response = await POST(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.item.id).toBe('new-item');
    expect(json.item.uid).toBe('banner-1');
    expect(json.item.title).toBe('New Banner');
  });

  it('returns 409 for duplicate item UID', async () => {
    _selectResult = [{ id: 'existing-item' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`, {
      method: 'POST',
      body: JSON.stringify({
        uid: 'duplicate-uid',
        item_type: 'banner',
        title: 'Duplicate',
      }),
    });
    const response = await POST(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain('已存在');
  });

  it('returns 400 for missing required fields', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1/items`, {
      method: 'POST',
      body: JSON.stringify({
        uid: 'test',
        item_type: 'banner',
        title: 'Test',
      }),
    });
    const response = await POST(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});
