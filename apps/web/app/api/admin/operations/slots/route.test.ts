/**
 * Tests for Admin Operations Slots list/create API
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
        orderBy: vi.fn(() => thenable(_selectResult)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => thenable(_insertResult)),
      })),
    })),
  };

  return { db, operationSlots: {} };
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

describe('GET /api/admin/operations/slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [];
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns all operation slots', async () => {
    _selectResult = [
      { id: 'slot-1', uid: 'hero-banner', surface: 'home', slotKey: 'hero', name: 'Hero Banner', layoutType: 'banner', locale: 'default', sortOrder: 0, isActive: true },
      { id: 'slot-2', uid: 'featured-grid', surface: 'home', slotKey: 'featured', name: 'Featured Grid', layoutType: 'grid', locale: 'default', sortOrder: 1, isActive: true },
    ];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.slots).toHaveLength(2);
    expect(json.slots[0].uid).toBe('hero-banner');
    expect(json.slots[1].uid).toBe('featured-grid');
  });

  it('returns empty array when no slots exist', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.slots).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: operations.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`);
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: operations.manage');
  });
});

describe('POST /api/admin/operations/slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('creates a new operation slot', async () => {
    _selectResult = [];
    _insertResult = [{ id: 'new-slot', uid: 'hero-banner', surface: 'home', slotKey: 'hero', name: 'Hero Banner', layoutType: 'banner', locale: 'default', sortOrder: 0, isActive: true }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`, {
      method: 'POST',
      body: JSON.stringify({
        uid: 'hero-banner',
        surface: 'home',
        slot_key: 'hero',
        name: 'Hero Banner',
        layout_type: 'banner',
        locale: 'default',
        max_items: 5,
      }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.slot.id).toBe('new-slot');
    expect(json.slot.uid).toBe('hero-banner');
    expect(json.slot.name).toBe('Hero Banner');
  });

  it('returns 409 for duplicate UID', async () => {
    _selectResult = [{ id: 'existing-slot' }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`, {
      method: 'POST',
      body: JSON.stringify({
        uid: 'duplicate-uid',
        surface: 'home',
        slot_key: 'hero',
        name: 'Duplicate',
        layout_type: 'banner',
      }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain('已存在');
  });

  it('returns 400 for missing required fields', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for empty uid', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`, {
      method: 'POST',
      body: JSON.stringify({
        uid: '',
        surface: 'home',
        slot_key: 'hero',
        name: 'Test',
        layout_type: 'banner',
      }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots`, {
      method: 'POST',
      body: JSON.stringify({
        uid: 'test',
        surface: 'home',
        slot_key: 'hero',
        name: 'Test',
        layout_type: 'banner',
      }),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});
