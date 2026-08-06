import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  listCommunityBookmarks: vi.fn(),
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
  listCommunityBookmarks: mocks.listCommunityBookmarks,
}));

import { GET } from './route';

describe('GET /api/community/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      userId: 'reader-1',
      username: 'reader',
      userSlug: 'reader',
      email: 'reader@example.com',
      role: 'user',
      expiresAt: Date.now() + 1000,
    });
    mocks.listCommunityBookmarks.mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
    });
  });

  it('passes snake_case favorite filters to the service', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/community/favorites?entity_type=published_page&limit=5&cursor=cursor-1`
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.listCommunityBookmarks).toHaveBeenCalledWith({
      session: expect.objectContaining({ userId: 'reader-1' }),
      entityType: 'published_page',
      limit: 5,
      cursor: 'cursor-1',
    });
  });
});
