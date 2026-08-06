/**
 * Tests for Admin Notifications [id] API (DELETE)
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

let _findFirstResult: any = null;

vi.mock('@/lib/db', () => {
  const db = {
    query: {
      notifications: {
        findFirst: vi.fn(() => Promise.resolve(_findFirstResult)),
      },
    },
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };

  return { db, notifications: {} };
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

describe('DELETE /api/admin/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _findFirstResult = {
      id: 'notif-1',
      type: 'comment',
      title: 'New comment',
    };
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue('log-1');
  });

  it('deletes a notification and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications/notif-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('notif-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith({
      adminId: 'admin-1',
      entityType: 'notification',
      entityId: 'notif-1',
      action: 'delete',
      reason: 'Deleted notification of type "comment"',
    });
  });

  it('returns 404 when notification not found', async () => {
    _findFirstResult = undefined;

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications/nonexistent`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Notification not found');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications/notif-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('notif-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.delete', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/notifications/notif-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('notif-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: content.delete');
    expect(mocks.createModerationLog).not.toHaveBeenCalled();
  });
});
