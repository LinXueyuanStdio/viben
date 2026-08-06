import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  listSubscriptionFeed: vi.fn(),
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
  listSubscriptionFeed: mocks.listSubscriptionFeed,
}));

import { GET } from './route';

describe('GET /api/feed/subscriptions', () => {
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
    mocks.listSubscriptionFeed.mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
    });
  });

  it('passes cursor include_seen and source to subscription feed service', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/feed/subscriptions?limit=5&cursor=cursor-1&include_seen=false&source=subscribed_pages`
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.listSubscriptionFeed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'reader-1' }),
      {
        limit: 5,
        cursor: 'cursor-1',
        includeSeen: false,
        source: 'subscribed_pages',
      }
    );
  });
});
