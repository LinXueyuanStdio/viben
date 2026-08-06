import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canReadPage: vi.fn(),
  getOptionalSession: vi.fn(),
  findPage: vi.fn(),
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
      publishedPages: {
        findFirst: mocks.findPage,
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
  publishedPages: {
    uid: 'pageUid',
    userId: 'pageUserId',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock('@/lib/auth/middleware', () => ({
  getOptionalSession: mocks.getOptionalSession,
}));

vi.mock('@/lib/services/community', () => ({
  canReadPage: mocks.canReadPage,
}));

import { GET } from './route';

describe('GET /page/[user_slug]/[page_id]/versions/[version]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      userSlug: 'alice',
    });
    mocks.findPage.mockResolvedValue({
      id: 'page-1',
      uid: 'demo',
      userId: 'user-1',
      visibility: 'public',
      moderationStatus: 'approved',
    });
    mocks.findVersion.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      version: 2,
      html: '<!doctype html><html><body><h1>Version 2</h1></body></html>',
    });
    mocks.getOptionalSession.mockResolvedValue(null);
    mocks.canReadPage.mockImplementation((page) =>
      (page.visibility === 'public' || page.visibility === 'unlisted') &&
      page.moderationStatus === 'approved'
    );
  });

  it('returns the stored version HTML document directly', async () => {
    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/demo/versions/2`),
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

  it('does not return private version HTML to anonymous visitors', async () => {
    mocks.findPage.mockResolvedValue({
      id: 'page-1',
      uid: 'demo',
      userId: 'user-1',
      visibility: 'private',
      moderationStatus: 'approved',
    });
    mocks.canReadPage.mockReturnValue(false);

    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/demo/versions/2`),
      {
        params: Promise.resolve({
          user_slug: 'alice',
          page_id: 'demo',
          version: '2',
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
    expect(mocks.findVersion).not.toHaveBeenCalled();
  });

  it('returns 404 for invalid version parameter', async () => {
    const response = await GET(
      new Request(`${process.env.NEXT_PUBLIC_APP_URL}/page/alice/demo/versions/latest`),
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
