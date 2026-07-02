import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  queryUsersFindFirst: vi.fn(),
  updateWhere: vi.fn(),
  createModerationLog: vi.fn(),
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
  },
  users: {
    id: 'id',
    warnedAt: 'warnedAt',
    warnedReason: 'warnedReason',
  },
}));

vi.mock('@/lib/admin/logs', () => ({
  createModerationLog: mocks.createModerationLog,
}));

import { POST } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'super_admin' as const,
  avatarUrl: null,
  expiresAt: Date.now() + 3600000,
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/users/user-1/warn', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const baseTargetUser = {
  id: 'user-1',
  role: 'user' as const,
};

describe('POST /api/admin/users/[id]/warn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.queryUsersFindFirst.mockResolvedValue(baseTargetUser);
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.createModerationLog.mockResolvedValue('log-id');
  });

  it('warns a user successfully', async () => {
    const response = await POST(makeRequest({ reason: 'Inappropriate content' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mocks.updateWhere).toHaveBeenCalled();
    expect(mocks.createModerationLog).toHaveBeenCalledWith({
      adminId: 'admin-1',
      entityType: 'user',
      entityId: 'user-1',
      action: 'warn',
      reason: 'Inappropriate content',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const response = await POST(makeRequest({ reason: 'Test' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: users.warn', 403));

    const response = await POST(makeRequest({ reason: 'Test' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Missing permission: users.warn');
  });

  it('returns 400 when reason is missing', async () => {
    const response = await POST(makeRequest({}), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when reason is empty string', async () => {
    const response = await POST(makeRequest({ reason: '' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 404 when user not found', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue(null);

    const response = await POST(makeRequest({ reason: 'Test' }), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('User not found');
  });

  it('returns 403 when warning yourself', async () => {
    mocks.requirePermission.mockResolvedValue({ ...adminSession, userId: 'user-1' });
    mocks.queryUsersFindFirst.mockResolvedValue({ id: 'user-1', role: 'user' });

    const response = await POST(makeRequest({ reason: 'Test' }), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Cannot warn yourself');
  });

  it('returns 403 when warning a super_admin', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue({ id: 'super-1', role: 'super_admin' });

    const response = await POST(makeRequest({ reason: 'Test' }), {
      params: Promise.resolve({ id: 'super-1' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Cannot warn a super admin');
  });

  it('returns 403 when warning an admin', async () => {
    mocks.queryUsersFindFirst.mockResolvedValue({ id: 'admin-2', role: 'admin' });

    const response = await POST(makeRequest({ reason: 'Test' }), {
      params: Promise.resolve({ id: 'admin-2' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Cannot warn a super admin');
  });
});
