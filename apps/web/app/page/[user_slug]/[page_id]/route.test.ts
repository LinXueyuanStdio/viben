import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findPublishedPage: vi.fn(),
  findUser: vi.fn(),
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

import { GET } from './route';

describe('GET /page/[user_slug]/[page_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      userSlug: 'alice',
    });
  });

  it('returns the stored HTML document directly', async () => {
    mocks.findPublishedPage.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      description: 'Demo description',
      html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
    });

    const response = await GET(
      new Request('https://viben-web.vercel.app/page/alice/demo'),
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
  });

  it('returns 404 when no page exists for the user and page id', async () => {
    mocks.findPublishedPage.mockResolvedValue(null);

    const response = await GET(
      new Request('https://viben-web.vercel.app/page/alice/missing'),
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
      new Request('https://viben-web.vercel.app/page/missing/demo'),
      {
        params: Promise.resolve({ user_slug: 'missing', page_id: 'demo' }),
      }
    );

    expect(response.status).toBe(404);
    expect(mocks.findPublishedPage).not.toHaveBeenCalled();
  });
});
