import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  queryUsersFindFirst: vi.fn(),
  updateWhere: vi.fn(),
  insertValues: vi.fn(),
  AuthError: class AuthError extends Error {
    public status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
    }
  },
}));

vi.mock('@/lib/auth', () => ({
  AuthError: mocks.AuthError,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      users: {
        findFirst: mocks.queryUsersFindFirst,
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.updateWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
  users: {
    id: 'id',
    role: 'role',
  },
  moderationLogs: {
    adminId: 'adminId',
    entityType: 'entityType',
    entityId: 'entityId',
    action: 'action',
    reason: 'reason',
    metadata: 'metadata',
  },
}));

import { PATCH } from './route';

const superAdminSession = {
  userId: 'super-admin-1',
  username: 'superadmin',
  userSlug: 'superadmin',
  email: 'superadmin@example.com',
  role: 'super_admin' as const,
  avatarUrl: null,
  expiresAt: Date.now() + 3600000,
};

const regularAdminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'moderator' as const,
  avatarUrl: null,
  expiresAt: Date.now() + 3600000,
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/users/user-1/role', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const baseTargetUser = {
  id: 'user-1',
  role: 'user' as const,
};

describe('PATCH /api/admin/users/[id]/role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(superAdminSession);
    mocks.queryUsersFindFirst.mockResolvedValue(baseTargetUser);
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.insertValues.mockResolvedValue([{ id: 'log-id' }]);
  });

  it('changes user role successfully', async () => {
    const response = await PATCH(makeRequest({ role: 'developer' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('developer');
    expect(body.user.previousRole).toBe('user');
    expect(mocks.updateWhere).toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'super-admin-1',
        entityType: 'user',
        entityId: 'user-1',
        action: 'role_change',
      })
    );
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const response = await PATCH(makeRequest({ role: 'developer' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: users.ban', 403));

    const response = await PATCH(makeRequest({ role: 'developer' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Missing permission: users.ban');
  });

  it('returns 400 for invalid role in body', async () => {
    const response = await PATCH(makeRequest({ role: 'super_admin' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue(null);

    const response = await PATCH(makeRequest({ role: 'developer' }), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('User not found');
  });

  it('returns 403 when trying to change super_admin role', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue({
      id: 'super-1',
      role: 'super_admin',
    });

    const response = await PATCH(makeRequest({ role: 'user' }), {
      params: Promise.resolve({ id: 'super-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Cannot change super admin role');
  });

  it('returns 403 when trying to change own role', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue({
      id: 'super-admin-1',
      role: 'super_admin',
    });

    // Even though targetRole is not super_admin, the routes code checks
    // super_admin immutable first and self-demotion after non-super-admin checks.
    // So for a regular user changing their own role:
    mocks.requirePermission.mockResolvedValue({
      ...superAdminSession,
      userId: 'user-2',
      role: 'admin' as const,
    });
    mocks.queryUsersFindFirst.mockResolvedValue({
      id: 'user-2',
      role: 'user',
    });

    const response = await PATCH(makeRequest({ role: 'developer' }), {
      params: Promise.resolve({ id: 'user-2' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Cannot change your own role');
  });

  it('prevents non-super-admin from changing admin roles', async () => {
    mocks.requirePermission.mockResolvedValue({
      userId: 'regular-admin',
      username: 'regadmin',
      userSlug: 'regadmin',
      email: 'regadmin@example.com',
      role: 'moderator' as const,
      avatarUrl: null,
      expiresAt: Date.now() + 3600000,
    });
    mocks.queryUsersFindFirst.mockResolvedValue({
      id: 'support-1',
      role: 'support',
    });

    const response = await PATCH(makeRequest({ role: 'user' }), {
      params: Promise.resolve({ id: 'support-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Only super admin can change admin roles');
  });

  it('prevents non-super-admin from assigning admin roles', async () => {
    mocks.requirePermission.mockResolvedValue(regularAdminSession);
    mocks.queryUsersFindFirst.mockResolvedValue({
      id: 'user-1',
      role: 'developer',
    });

    const response = await PATCH(makeRequest({ role: 'moderator' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Cannot assign admin roles');
  });

  it('super admin can change admin role to user', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue({
      id: 'admin-3',
      role: 'admin',
    });

    const response = await PATCH(makeRequest({ role: 'user' }), {
      params: Promise.resolve({ id: 'admin-3' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('user');
    expect(body.user.previousRole).toBe('admin');
  });
});
