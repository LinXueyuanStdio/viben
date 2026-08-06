/**
 * Tests for Admin Topics [id] API (GET/PATCH/DELETE by ID)
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
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenable(_selectResult)),
      })),
    })),
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

  return { db, momentTopics: {} };
});

import { GET, PATCH, DELETE } from './route';

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

describe('GET /api/admin/topics/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('returns a single topic by ID', async () => {
    _selectResult = [{ id: 'topic-1', slug: 'ai', displayName: 'AI', description: null, isFeatured: true, isBlocked: false }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`);
    const response = await GET(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topic.id).toBe('topic-1');
    expect(json.topic.slug).toBe('ai');
    expect(json.topic.isFeatured).toBe(true);
  });

  it('returns 404 when topic not found', async () => {
    _selectResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/nonexistent`);
    const response = await GET(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Topic not found');
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Authentication required', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`);
    const response = await GET(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Authentication required');
  });
});

describe('PATCH /api/admin/topics/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('updates topic display name', async () => {
    _updateResult = [{ id: 'topic-1', slug: 'ai', displayName: 'Artificial Intelligence', isFeatured: false, isBlocked: false }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Artificial Intelligence' }),
    });
    const response = await PATCH(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topic.displayName).toBe('Artificial Intelligence');
  });

  it('toggles is_featured', async () => {
    _updateResult = [{ id: 'topic-1', slug: 'ai', displayName: 'AI', isFeatured: true, isBlocked: false }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`, {
      method: 'PATCH',
      body: JSON.stringify({ is_featured: true }),
    });
    const response = await PATCH(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topic.isFeatured).toBe(true);
  });

  it('toggles is_blocked', async () => {
    _updateResult = [{ id: 'topic-1', slug: 'ai', displayName: 'AI', isFeatured: false, isBlocked: true }];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`, {
      method: 'PATCH',
      body: JSON.stringify({ is_blocked: true }),
    });
    const response = await PATCH(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.topic.isBlocked).toBe(true);
  });

  it('returns 404 when updating non-existent topic', async () => {
    _updateResult = [];

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/nonexistent`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Test' }),
    });
    const response = await PATCH(request, { params: params('nonexistent') });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Topic not found');
  });

  it('returns 400 for invalid body', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`, {
      method: 'PATCH',
      body: JSON.stringify({ display_name: '' }),
    });
    const response = await PATCH(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid request body');
  });
});

describe('DELETE /api/admin/topics/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(adminSession);
  });

  it('deletes a topic', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 401 when permission denied', async () => {
    mocks.requirePermission.mockRejectedValue(new mocks.AuthError('Missing permission: topics.manage', 403));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/topics/topic-1`, {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: params('topic-1') });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Missing permission: topics.manage');
  });
});
