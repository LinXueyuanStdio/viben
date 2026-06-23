import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getOptionalSession: vi.fn(),
  requireAuth: vi.fn(),
  listCommunityComments: vi.fn(),
  createCommunityComment: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: class AuthError extends Error {
    constructor(message: string, public status = 401) {
      super(message);
      this.name = 'AuthError';
    }
  },
  getOptionalSession: mocks.getOptionalSession,
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/services/community', () => ({
  createCommunityComment: mocks.createCommunityComment,
  listCommunityComments: mocks.listCommunityComments,
}));

import { GET } from './route';

describe('GET /api/community/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOptionalSession.mockResolvedValue(null);
    mocks.listCommunityComments.mockResolvedValue({
      comments: [],
      next_cursor: null,
    });
  });

  it('passes snake_case cursor pagination to the comment service', async () => {
    const request = new NextRequest(
      'https://viben-web.vercel.app/api/community/comments?entity_type=published_page&entity_id=page-1&parent_comment_id=comment-parent&limit=5&cursor=cursor-1'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.listCommunityComments).toHaveBeenCalledWith({
      entityType: 'published_page',
      entityId: 'page-1',
      parentCommentId: 'comment-parent',
      limit: 5,
      cursor: 'cursor-1',
      session: null,
    });
  });
});
