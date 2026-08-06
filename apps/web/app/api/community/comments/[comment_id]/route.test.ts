import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  updateCommunityComment: vi.fn(),
  deleteCommunityComment: vi.fn(),
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
  updateCommunityComment: mocks.updateCommunityComment,
  deleteCommunityComment: mocks.deleteCommunityComment,
}));

import { DELETE, PATCH } from './route';

describe('/api/community/comments/[comment_id]', () => {
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
    mocks.updateCommunityComment.mockResolvedValue({
      comment: { id: 'comment-1', content: 'Updated' },
    });
    mocks.deleteCommunityComment.mockResolvedValue({
      success: true,
      deleted_count: 1,
    });
  });

  it('patches an existing community comment', async () => {
    const response = await PATCH(
      new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments/comment-1`, {
        method: 'PATCH',
        body: JSON.stringify({ content: ' Updated ' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ comment_id: 'comment-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.updateCommunityComment).toHaveBeenCalledWith({
      commentId: 'comment-1',
      content: ' Updated ',
      session: expect.objectContaining({ userId: 'reader-1' }),
    });
  });

  it('deletes an existing community comment', async () => {
    const response = await DELETE(
      new NextRequest(`${process.env.NEXT_PUBLIC_APP_URL}/api/community/comments/comment-1`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ comment_id: 'comment-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteCommunityComment).toHaveBeenCalledWith({
      commentId: 'comment-1',
      session: expect.objectContaining({ userId: 'reader-1' }),
    });
  });
});
