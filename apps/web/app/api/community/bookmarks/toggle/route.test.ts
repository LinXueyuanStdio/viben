import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  toggleBookmark: vi.fn(),
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

vi.mock('@/lib/services/community', () => ({
  toggleBookmark: mocks.toggleBookmark,
}));

import { POST } from './route';

describe('POST /api/community/bookmarks/toggle', () => {
  const session = { userId: 'user-1', username: 'test', userSlug: 'test', email: 't@t.com', role: 'user' as const, expiresAt: Date.now() + 999999 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue(session);
  });

  it('toggles a bookmark on a moment', async () => {
    mocks.toggleBookmark.mockResolvedValue({ has_bookmarked: true, bookmarks_count: 3 });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'moment-1' }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.has_bookmarked).toBe(true);
    expect(json.bookmarks_count).toBe(3);
    expect(mocks.toggleBookmark).toHaveBeenCalledWith({
      entityType: 'moment',
      entityId: 'moment-1',
      session,
    });
  });

  it('toggles off a bookmark (un-bookmark)', async () => {
    mocks.toggleBookmark.mockResolvedValue({ has_bookmarked: false, bookmarks_count: 2 });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'moment-1' }),
    });

    const json = await (await POST(request)).json();
    expect(json.has_bookmarked).toBe(false);
    expect(json.bookmarks_count).toBe(2);
  });

  it('supports bookmarks on published_page entities', async () => {
    mocks.toggleBookmark.mockResolvedValue({ has_bookmarked: true, bookmarks_count: 1 });

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'published_page', entity_id: 'page-1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    mocks.requireAuth.mockRejectedValue(new (await import('@/lib/auth/middleware')).AuthError('Not authenticated', 401));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'm1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for missing entity_id', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when community entity not found', async () => {
    mocks.toggleBookmark.mockRejectedValue(new Error('community_entity_not_found'));

    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'moment', entity_id: 'no-such-moment' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
