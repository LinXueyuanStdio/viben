import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  listNotifications: vi.fn(),
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
  listNotifications: mocks.listNotifications,
}));

import { GET } from './route';

describe('GET /api/notifications', () => {
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
    mocks.listNotifications.mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
      unread_count: 0,
    });
  });

  it('passes snake_case filters and cursor to the notification service', async () => {
    const request = new NextRequest(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications?limit=5&unread_only=true&cursor=cursor-1`
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'reader-1' }),
      5,
      true,
      'cursor-1'
    );
  });
});
