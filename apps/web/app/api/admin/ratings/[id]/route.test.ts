/**
 * Tests for Admin Rating [id] API (DELETE with composite key)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
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

vi.mock('@/lib/db', () => {
  const db = {
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    query: {
      ratings: {
        findFirst: vi.fn(() => Promise.resolve(mocks.queryFindFirstResult)),
      },
    },
  };
  return { db, ratings: {} };
});

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

import { DELETE } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

const mockRating = {
  userId: 'u1', entityType: 'mcp', entityId: 'pkg-1', score: 4,
  createdAt: new Date().toISOString(),
};

describe('DELETE /api/admin/ratings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.queryFindFirstResult = mockRating;
  });

  it('deletes a rating using composite key', async () => {
    // Composite key: userId__entityType__entityId
    const compositeId = 'u1__mcp__pkg-1';
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings/u1__mcp__pkg-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params(compositeId) });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'mcp',
      entityId: 'pkg-1',
      action: 'delete',
      reason: expect.stringContaining('Removed rating (score: 4)'),
    }));
  });

  it('returns 400 when composite key has wrong number of parts', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings/invalid__key`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('invalid__key') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid rating identifier');
  });

  it('returns 400 when composite key has too many parts', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings/a__b__c__d`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('a__b__c__d') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid rating identifier');
  });

  it('returns 404 when rating not found', async () => {
    mocks.queryFindFirstResult = null;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings/u1__mcp__nonexistent`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('u1__mcp__nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Rating not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings/u1__mcp__pkg-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('u1__mcp__pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing content.moderate permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/ratings/u1__mcp__pkg-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('u1__mcp__pkg-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});
