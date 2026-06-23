import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.findFirst,
      },
      publishedPages: {
        findMany: mocks.findMany,
      },
    },
  },
  users: {
    id: 'id',
  },
  publishedPages: {
    userId: 'userId',
    visibility: 'visibility',
    moderationStatus: 'moderationStatus',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  desc: vi.fn((field) => ({ direction: 'desc', field })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

import UserPublishedPagesAlias from './page';

describe('/[user_id]/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: 'user-1',
      userSlug: 'alice',
    });
  });

  it('renders the same published page list for the requested user', async () => {
    mocks.findMany.mockResolvedValue([
      {
        uid: 'demo',
        title: 'Demo',
        description: 'Demo description',
        html: '<!doctype html><html><body>Demo</body></html>',
      },
    ]);

    const element = await UserPublishedPagesAlias({
      params: Promise.resolve({ user_id: 'user-1' }),
    });
    render(element);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { field: 'id', value: 'user-1' },
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        type: 'and',
        conditions: [
          { field: 'userId', value: 'user-1' },
          { field: 'visibility', value: 'public' },
          { field: 'moderationStatus', value: 'approved' },
        ],
      },
      orderBy: [{ direction: 'desc', field: 'updatedAt' }],
    });
    expect(screen.getByRole('link', { name: /Demo Demo description/i })).toHaveAttribute(
      'href',
      '/read/alice/demo'
    );
  });
});
