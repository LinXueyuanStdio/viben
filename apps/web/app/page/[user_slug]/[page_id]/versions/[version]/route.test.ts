import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findVersion: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.findUser,
      },
      publishedPageVersions: {
        findFirst: mocks.findVersion,
      },
    },
  },
  users: {
    id: 'id',
    userSlug: 'userSlug',
  },
  publishedPageVersions: {
    uid: 'uid',
    userId: 'userId',
    version: 'version',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

import { GET } from './route';

describe('GET /page/[user_slug]/[page_id]/versions/[version]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      userSlug: 'alice',
    });
    mocks.findVersion.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      version: 2,
      html: '<!doctype html><html><body><h1>Version 2</h1></body></html>',
    });
  });

  it('returns the stored version HTML document directly', async () => {
    const response = await GET(
      new Request('https://viben-web.vercel.app/page/alice/demo/versions/2'),
      {
        params: Promise.resolve({
          user_slug: 'alice',
          page_id: 'demo',
          version: '2',
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe(
      '<!doctype html><html><body><h1>Version 2</h1></body></html>'
    );
  });

  it('returns 404 for invalid version parameter', async () => {
    const response = await GET(
      new Request('https://viben-web.vercel.app/page/alice/demo/versions/latest'),
      {
        params: Promise.resolve({
          user_slug: 'alice',
          page_id: 'demo',
          version: 'latest',
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(mocks.findVersion).not.toHaveBeenCalled();
  });
});
