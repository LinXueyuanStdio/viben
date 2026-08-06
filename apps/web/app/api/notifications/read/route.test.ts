import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  markNotificationsRead: vi.fn(),
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
  markNotificationsRead: mocks.markNotificationsRead,
}));

import { POST } from './route';

describe('POST /api/notifications/read', () => {
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
    mocks.markNotificationsRead.mockResolvedValue({
      success: true,
      updated_count: 2,
    });
  });

  it('delegates batch notification read updates to the community service', async () => {
    const request = new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/read`, {
      method: 'POST',
      body: JSON.stringify({ notification_ids: ['notification-1', 'notification-2'] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.markNotificationsRead).toHaveBeenCalledWith({
      session: expect.objectContaining({ userId: 'reader-1' }),
      notificationIds: ['notification-1', 'notification-2'],
      beforeCursor: null,
    });
  });
});
