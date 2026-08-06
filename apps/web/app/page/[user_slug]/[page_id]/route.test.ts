import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findPublishedPage: vi.fn(),
  findUser: vi.fn(),
  recordPageView: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.findUser,
      },
      publishedPages: {
        findFirst: mocks.findPublishedPage,
      },
    },
  },
  users: {
    id: 'id',
    userSlug: 'userSlug',
  },
  publishedPages: {
    uid: 'uid',
    userId: 'userId',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock('@/lib/services/community', () => ({
  canReadPage: vi.fn((page, session) =>
    page.visibility === 'public' && page.moderationStatus === 'approved'
      ? true
      : session?.userId === page.userId
  ),
  recordPageView: mocks.recordPageView,
}));

vi.mock('@/lib/auth/middleware', () => ({
  getOptionalSession: vi.fn(() => null),
}));

import { GET } from './route';

describe('GET /page/[user_slug]/[page_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      userSlug: 'alice',
    });
    mocks.recordPageView.mockResolvedValue(undefined);
  });

  it('returns the stored HTML document directly', async () => {
    mocks.findPublishedPage.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      description: 'Demo description',
      html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
      visibility: 'public',
      moderationStatus: 'approved',
    });

    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/demo`),
      {
        params: Promise.resolve({ user_slug: 'alice', page_id: 'demo' }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe(
      '<!doctype html><html><body><h1>Demo HTML</h1></body></html>'
    );
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { field: 'userSlug', value: 'alice' },
    });
    expect(mocks.findPublishedPage).toHaveBeenCalledWith({
      where: {
        type: 'and',
        conditions: [
          { field: 'userId', value: 'user-1' },
          { field: 'uid', value: 'demo' },
        ],
      },
    });
    expect(mocks.recordPageView).toHaveBeenCalledWith({
      context: {
        page: {
          uid: 'demo',
          userId: 'user-1',
          title: 'Demo',
          description: 'Demo description',
          html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
          visibility: 'public',
          moderationStatus: 'approved',
        },
        author: {
          id: 'user-1',
          userSlug: 'alice',
        },
      },
      session: null,
      source: 'html_direct',
      route: '/page',
    });
  });

  it('does not inject community interaction markup into the raw HTML document', async () => {
    mocks.findPublishedPage.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      description: 'Demo description',
      html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
      visibility: 'public',
      moderationStatus: 'approved',
    });

    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/demo`),
      {
        params: Promise.resolve({ user_slug: 'alice', page_id: 'demo' }),
      }
    );

    const html = await response.text();

    expect(html).not.toContain('CommunityInteractions');
    expect(html).not.toContain('Add a comment');
    expect(html).not.toContain('/api/community');
  });

  it('does not return private HTML to anonymous visitors', async () => {
    mocks.findPublishedPage.mockResolvedValue({
      uid: 'secret',
      userId: 'user-1',
      title: 'Secret',
      description: null,
      html: '<!doctype html><html><body><h1>Secret</h1></body></html>',
      visibility: 'private',
      moderationStatus: 'approved',
    });

    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/secret`) as never,
      {
        params: Promise.resolve({ user_slug: 'alice', page_id: 'secret' }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
    expect(mocks.recordPageView).not.toHaveBeenCalled();
  });

  it('returns 404 when no page exists for the user and page id', async () => {
    mocks.findPublishedPage.mockResolvedValue(null);

    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/missing`),
      {
        params: Promise.resolve({ user_slug: 'alice', page_id: 'missing' }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
  });

  it('returns 404 when no user exists for the slug', async () => {
    mocks.findUser.mockResolvedValue(null);
    mocks.findPublishedPage.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      html: '<html></html>',
    });

    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/missing/demo`),
      {
        params: Promise.resolve({ user_slug: 'missing', page_id: 'demo' }),
      }
    );

    expect(response.status).toBe(404);
    expect(mocks.findPublishedPage).not.toHaveBeenCalled();
  });
});
