/**
 * Tests for Admin Comment [id] API (GET detail, PATCH edit, DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
  selectResults: [] as any[][],
  selectCallCount: 0,
  queryFindFirstResult: null as any,
  updateReturningResult: [] as any[],
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

function thenable(value: any) {
  const obj: any = {
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin', 'returning', 'values', 'set']) {
    obj[m] = () => obj;
  }
  return obj;
}

function createSelectChain() {
  mocks.selectCallCount++;
  const result = mocks.selectResults[mocks.selectCallCount - 1] ?? [];
  return { from: vi.fn(() => thenable(result)) };
}

vi.mock('@/lib/db', () => {
  const db = {
    select: vi.fn(createSelectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => thenable(mocks.updateReturningResult)),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
    query: {
      comments: {
        findFirst: vi.fn(() => Promise.resolve(mocks.queryFindFirstResult)),
      },
    },
  };
  return { db, comments: {}, users: {} };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => ({ type: 'eq', field, value })),
}));

import { GET, PATCH, DELETE } from './route';

const adminSession = {
  userId: 'admin-1', username: 'admin', userSlug: 'admin',
  email: 'admin@example.com', role: 'moderator', expiresAt: Date.now() + 3600,
};

function params(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

const mockComment = {
  id: 'comment-1', entityType: 'mcp', entityId: 'pkg-1', content: 'Nice package!',
  parentId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  userId: 'u1', username: 'dev', displayName: 'Dev', avatarUrl: null,
};

describe('GET /api/admin/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectCallCount = 0;
    mocks.selectResults = [[mockComment]];
  });

  it('returns 200 with comment details and user info', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`);
    const response = await GET(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.comment.id).toBe('comment-1');
    expect(json.comment.content).toBe('Nice package!');
    expect(json.comment.user.username).toBe('dev');
  });

  it('returns 404 when comment not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Comment not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`);
    const response = await GET(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/admin/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.queryFindFirstResult = mockComment;
    mocks.updateReturningResult = [{ ...mockComment, content: 'Updated content' }];
  });

  it('updates comment content', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Updated content' }),
    });
    const response = await PATCH(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.comment.content).toBe('Updated content');
  });

  it('returns 404 when comment not found', async () => {
    mocks.queryFindFirstResult = null;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Test' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Comment not found');
  });

  it('returns 400 for empty content', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`, {
      method: 'PATCH',
      body: JSON.stringify({ content: '' }),
    });
    const response = await PATCH(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when content exceeds max length', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'x'.repeat(5001) }),
    });
    const response = await PATCH(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 403 when missing content.moderate permission', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: content.moderate', 403));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`, {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Test' }),
    });
    const response = await PATCH(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(403);
  });
});

describe('DELETE /api/admin/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.queryFindFirstResult = mockComment;
  });

  it('deletes a comment and creates moderation log', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'comment',
      action: 'delete',
    }));
  });

  it('returns 404 when comment not found', async () => {
    mocks.queryFindFirstResult = null;
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/nonexistent`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Comment not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/comments/comment-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('comment-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});
