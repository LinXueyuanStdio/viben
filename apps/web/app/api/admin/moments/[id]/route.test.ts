/**
 * Tests for Admin Moment [id] API (GET detail, PATCH moderate, DELETE)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createModerationLog: vi.fn(),
  selectResults: [] as any[][],
  selectCallCount: 0,
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
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'returning', 'values', 'set']) {
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
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };
  return { db, moments: {}, users: {}, momentAttachments: {}, reposts: {} };
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

const mockMoment = {
  id: 'mom-1', uid: 'M001', kind: 'post', body: 'Hello world',
  bodyFormat: 'markdown', visibility: 'public', likeCount: 5, commentCount: 2,
  repostCount: 0, attachmentCount: 1, viewCount: 100, isPinned: false,
  isDeleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  repostOfMomentId: null, replyToMomentId: null,
  authorId: 'u1', authorName: 'Dev', authorUsername: 'dev',
};

describe('GET /api/admin/moments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.selectCallCount = 0;
    // Results: moment, attachments, then no repost chain queries
    mocks.selectResults = [
      [mockMoment],
      [{ id: 'att-1', momentId: 'mom-1', url: '/img.jpg', type: 'image' }],
      // downstream reposts (for the `where(eq(moments.repostOfMomentId, id))` query)
      [],
    ];
  });

  it('returns 200 with moment, attachments and repostChain', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`);
    const response = await GET(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.moment.id).toBe('mom-1');
    expect(json.attachments).toHaveLength(1);
    expect(json.repostChain).toBeDefined();
  });

  it('returns 404 when moment not found', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Moment not found');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`);
    const response = await GET(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/admin/moments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
    mocks.selectCallCount = 0;
  });

  it('hides a moment', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'hide' }),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'hide',
      entityType: 'moment',
    }));
  });

  it('unhides a moment', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unhide' }),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'unhide',
    }));
  });

  it('soft-deletes a moment via PATCH', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'delete' }),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delete',
    }));
  });

  it('toggles pin on a moment', async () => {
    mocks.selectResults = [[{ isPinned: false }]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'toggle_pin' }),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'feature',
      reason: expect.stringContaining('pin toggled'),
    }));
  });

  it('returns 404 when toggling pin on non-existent moment', async () => {
    mocks.selectResults = [[]];
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'toggle_pin' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.error).toBe('Moment not found');
  });

  it('returns 400 for invalid action', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid' }),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 when action is missing', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'hide' }),
    });
    const response = await PATCH(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/admin/moments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
    mocks.createModerationLog.mockResolvedValue(undefined);
  });

  it('soft-deletes a moment by default', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delete',
      reason: expect.stringContaining('Moment deleted by admin'),
    }));
  });

  it('hard-deletes a moment with force=true', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1?force=true`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delete',
      reason: expect.stringContaining('permanently deleted'),
    }));
  });

  it('hard-deletes a moment with force=1', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1?force=1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.createModerationLog).toHaveBeenCalledWith(expect.objectContaining({
      reason: expect.stringContaining('permanently deleted'),
    }));
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/moments/mom-1`, { method: 'DELETE' });
    const response = await DELETE(request, { params: params('mom-1') });
    const json = await response.json();
    expect(response.status).toBe(401);
  });
});
