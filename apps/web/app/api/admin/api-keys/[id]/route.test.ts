/**
 * Tests for Admin API Keys [id] API (DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
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

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

let _selectResult: any[] = [];

vi.mock('@/lib/db', () => {
  function thenable(value: any) {
    const obj: any = {
      then(onFulfilled: any, onRejected?: any) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    };
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'returning', 'values']) {
      obj[m] = () => obj;
    }
    return obj;
  }

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(_selectResult)),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };

  return { db, apiKeys: {} };
});

import { DELETE } from './route';

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

describe('DELETE /api/admin/api-keys/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _selectResult = [{ name: 'My API Key', userId: 'user-1' }];
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue('log-1');
  });

  it('deletes an API key and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys/key-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('key-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith({
      adminId: 'admin-1',
      entityType: 'user',
      entityId: 'user-1',
      action: 'delete',
      reason: 'Revoked API key: My API Key',
    });
  });

  it('returns 404 when API key not found', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys/nonexistent`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('API key not found');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys/key-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('key-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: users.view', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/api-keys/key-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('key-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: users.view');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });
});
