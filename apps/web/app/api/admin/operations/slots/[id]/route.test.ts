/**
 * Tests for Admin Operations Slots [id] API (PATCH/DELETE)
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

  return { db, operationSlots: {} };
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

describe('PATCH /api/admin/operations/slots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('updates a slot name', async () => {
    _updateResult = [{ id: 'slot-1', uid: 'hero-banner', name: 'Updated Banner', layoutType: 'banner', isActive: true }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Banner' }),
    });
    const response = await PATCH(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.slot.name).toBe('Updated Banner');
  });

  it('toggles is_active', async () => {
    _updateResult = [{ id: 'slot-1', uid: 'hero-banner', name: 'Hero Banner', layoutType: 'banner', isActive: false }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
    const response = await PATCH(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.slot.isActive).toBe(false);
  });

  it('returns 404 when slot not found', async () => {
    _updateResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Slot not found');
  });

  it('returns 400 for invalid body', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const response = await PATCH(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: operations.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await PATCH(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: operations.manage');
  });
});

describe('DELETE /api/admin/operations/slots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('deletes a slot', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/operations/slots/slot-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('slot-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});
