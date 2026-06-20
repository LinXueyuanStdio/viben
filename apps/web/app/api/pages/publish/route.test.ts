import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  execute: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      publishedPages: {
        findFirst: mocks.findFirst,
      },
    },
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
    update: vi.fn(() => ({
      set: mocks.updateSet,
    })),
    execute: mocks.execute,
  },
  publishedPages: {
    uid: 'uid',
    id: 'id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
}));

import { POST } from './route';

function requestWithBody(body: unknown) {
  return new NextRequest('http://localhost/api/pages/publish', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/pages/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'developer',
      expiresAt: Date.now() + 3600000,
    });
    mocks.findFirst.mockResolvedValue(null);
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.execute.mockResolvedValue(undefined);
  });

  it('creates a published page with icon and description', async () => {
    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
      html: '<!doctype html><html><body>Demo</body></html>',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      url: '/page/demo',
      updated: false,
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
      html: '<!doctype html><html><body>Demo</body></html>',
    });
    expect(mocks.execute).toHaveBeenCalled();
  });

  it('updates an existing page owned by the current user', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'published-1',
      uid: 'demo',
      userId: 'user-1',
    });

    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo v2',
      description: 'Updated',
      html: '<html><body>Updated</body></html>',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      page_uid: 'demo',
      url: '/page/demo',
      updated: true,
    });
    expect(mocks.updateSet).toHaveBeenCalledWith({
      title: 'Demo v2',
      icon: null,
      description: 'Updated',
      html: '<html><body>Updated</body></html>',
    });
  });

  it('rejects updates for a page owned by another user', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'published-1',
      uid: 'demo',
      userId: 'user-2',
    });

    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      html: '<html><body>Demo</body></html>',
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'You do not own this page',
    });
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('rejects an invalid icon payload', async () => {
    const response = await POST(requestWithBody({
      uid: 'demo',
      title: 'Demo',
      icon: 'file-text',
      html: '<html><body>Demo</body></html>',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'icon must be an object with string type and value',
    });
  });
});
