import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  queryDraftsFindFirst: vi.fn(),
  deleteWhere: vi.fn(),
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
    select: vi.fn(),
    query: {
      drafts: {
        findFirst: mocks.queryDraftsFindFirst,
      },
    },
    delete: vi.fn(() => ({
      where: mocks.deleteWhere,
    })),
  },
  drafts: {
    id: 'id',
    userId: 'userId',
    packageType: 'packageType',
    data: 'data',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    expiresAt: 'expiresAt',
  },
  users: {
    id: 'id',
    username: 'username',
    displayName: 'displayName',
    avatarUrl: 'avatarUrl',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  or: vi.fn(),
  like: vi.fn(),
  eq: vi.fn((column: unknown, value: unknown) => ({ type: 'eq', column, value })),
  desc: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/lib/admin/logs', () => ({
  createModerationLog: mocks.createModerationLog,
}));

import { DELETE } from './route';

const adminSession = {
  userId: 'admin-1',
  username: 'admin',
  userSlug: 'admin',
  email: 'admin@example.com',
  role: 'super_admin' as const,
  avatarUrl: null,
  expiresAt: Date.now() + 3600000,
};

const baseDraft = {
  id: 'draft-1',
  userId: 'user-1',
  packageType: 'mcp' as const,
  data: { name: 'Test MCP' },
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2024-12-15'),
  expiresAt: new Date('2025-01-01'),
};

describe('DELETE /api/admin/drafts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.queryDraftsFindFirst.mockResolvedValue(baseDraft);
    mocks.deleteWhere.mockResolvedValue(undefined);
    mocks.createModerationLog.mockResolvedValue('log-id');
  });

  it('deletes a draft successfully', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/drafts/draft-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'draft-1' }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mocks.deleteWhere).toHaveBeenCalled();
    expect(mocks.createModerationLog).toHaveBeenCalledWith({
      adminId: 'admin-1',
      entityType: 'mcp',
      entityId: 'draft-1',
      action: 'delete',
      reason: 'Deleted mcp draft by user user-1',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/drafts/draft-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'draft-1' }) }
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when missing permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.delete', 403));

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/drafts/draft-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'draft-1' }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Missing permission: content.delete');
  });

  it('returns 404 when draft not found', async () => {
    mocks.queryDraftsFindFirst.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/drafts/nonexistent', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'nonexistent' }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Draft not found');
  });

  it('logs skill draft deletion with correct entityType', async () => {
    mocks.queryDraftsFindFirst.mockResolvedValue({
      ...baseDraft,
      id: 'skill-draft-1',
      userId: 'user-2',
      packageType: 'skill' as const,
      data: { title: 'Test Skill' },
    });

    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/drafts/skill-draft-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'skill-draft-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'skill',
        entityId: 'skill-draft-1',
        action: 'delete',
      })
    );
  });
});
