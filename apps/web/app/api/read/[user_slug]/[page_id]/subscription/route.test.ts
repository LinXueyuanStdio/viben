import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getPublishedPageContext: vi.fn(),
  updatePageSubscription: vi.fn(),
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
  getPublishedPageContext: mocks.getPublishedPageContext,
  subscribeToPage: vi.fn(),
  unsubscribeFromPage: vi.fn(),
  updatePageSubscription: mocks.updatePageSubscription,
}));

import { PATCH } from './route';

describe('PATCH /api/read/[user_slug]/[page_id]/subscription', () => {
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
    mocks.getPublishedPageContext.mockResolvedValue({
      page: { id: 'page-1', currentVersion: 8 },
      author: { id: 'author-1', userSlug: 'alice' },
    });
    mocks.updatePageSubscription.mockResolvedValue({
      subscribed: true,
      notify_level: 'major',
      last_seen_version: 5,
    });
  });

  it('passes notify_level and last_seen_version updates to the subscription service', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/read/alice/demo/subscription`, {
      method: 'PATCH',
      body: JSON.stringify({
        notify_level: 'major',
        last_seen_version: 5,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ user_slug: 'alice', page_id: 'demo' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updatePageSubscription).toHaveBeenCalledWith({
      context: expect.objectContaining({
        page: expect.objectContaining({ id: 'page-1' }),
      }),
      session: expect.objectContaining({ userId: 'reader-1' }),
      notifyLevel: 'major',
      lastSeenVersion: 5,
    });
  });
});
