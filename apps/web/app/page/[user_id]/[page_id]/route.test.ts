import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      publishedPages: {
        findFirst: mocks.findFirst,
      },
    },
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

describe('GET /page/[user_id]/[page_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the stored HTML document directly', async () => {
    mocks.findFirst.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      description: 'Demo description',
      html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
    });

    const response = await GET(
      new Request('https://viben-web.vercel.app/page/user-1/demo'),
      {
        params: Promise.resolve({ user_id: 'user-1', page_id: 'demo' }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe(
      '<!doctype html><html><body><h1>Demo HTML</h1></body></html>'
    );
    expect(mocks.findFirst).toHaveBeenCalledWith({
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
    mocks.findFirst.mockResolvedValue(null);

    const response = await GET(
      new Request('https://viben-web.vercel.app/page/user-1/missing'),
      {
        params: Promise.resolve({ user_id: 'user-1', page_id: 'missing' }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
  });
});
