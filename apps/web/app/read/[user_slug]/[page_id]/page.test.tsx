import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  decryptSession: vi.fn(),
  getPublishedPageContext: vi.fn(),
  canReadPage: vi.fn(),
  ensureCommunityEntityForPage: vi.fn(),
  recordPageView: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  consoleError: vi.spyOn(console, 'error').mockImplementation(() => undefined),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/lib/auth/jwe', () => ({
  decryptSession: mocks.decryptSession,
}));

vi.mock('@/lib/services/community', () => ({
  canReadPage: mocks.canReadPage,
  ensureCommunityEntityForPage: mocks.ensureCommunityEntityForPage,
  getPublishedPageContext: mocks.getPublishedPageContext,
  recordPageView: mocks.recordPageView,
}));

import ReadPage from './page';

describe('/read/[user_slug]/[page_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consoleError.mockClear();
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
    mocks.getPublishedPageContext.mockResolvedValue({
      page: {
        id: 'page-row-1',
        uid: 'demo',
        userId: 'author-1',
        title: 'Demo page',
        description: 'Demo description',
        html: '<!doctype html><html><body>Demo</body></html>',
        viewCount: 10,
        readCount: 4,
        likeCount: 2,
        favoriteCount: 1,
        commentCount: 3,
      },
      author: {
        id: 'author-1',
        userSlug: 'alice',
        displayName: 'Alice',
      },
    });
    mocks.canReadPage.mockReturnValue(true);
    mocks.ensureCommunityEntityForPage.mockResolvedValue({
      id: 'entity-1',
      reactionsCount: 2,
      favoritesCount: 1,
      commentsCount: 3,
    });
    mocks.recordPageView.mockResolvedValue(undefined);
  });

  it('still renders when recording the page view fails', async () => {
    mocks.recordPageView.mockRejectedValue(new Error('stats unavailable'));

    const element = await ReadPage({
      params: Promise.resolve({ user_slug: 'alice', page_id: 'demo' }),
    });
    render(element);

    expect(screen.getByRole('heading', { name: 'Demo page' })).toBeInTheDocument();
    expect(screen.getByText('11 views')).toBeInTheDocument();
    expect(screen.getByText('5 reads')).toBeInTheDocument();
    expect(mocks.recordPageView).toHaveBeenCalledWith({
      context: expect.objectContaining({
        page: expect.objectContaining({ id: 'page-row-1' }),
        author: expect.objectContaining({ userSlug: 'alice' }),
      }),
      session: null,
      source: 'read_shell',
      route: '/read',
    });
    expect(mocks.consoleError).toHaveBeenCalledWith(
      'Failed to record read_shell page view:',
      expect.any(Error)
    );
  });
});
