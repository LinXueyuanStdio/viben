import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.findUser,
      },
      publishedPages: {
        findMany: mocks.findMany,
      },
    },
  },
  users: {
    id: 'id',
    userSlug: 'userSlug',
  },
  publishedPages: {
    userId: 'userId',
    visibility: 'visibility',
    moderationStatus: 'moderationStatus',
    updatedAt: 'updatedAt',
    scheduledAt: 'scheduledAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  desc: vi.fn((field) => ({ direction: 'desc', field })),
  eq: vi.fn((field, value) => ({ field, value })),
  or: vi.fn((...conditions) => ({ type: 'or', conditions })),
  isNull: vi.fn((field) => ({ type: 'isNull', field })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: 'sql',
    strings: [...strings],
    values,
  })),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

import UserPublishedPages from './page';

describe('/page/[user_slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      userSlug: 'alice',
    });
  });

  it('lists published pages for the requested user', async () => {
    mocks.findMany.mockResolvedValue([
      {
        uid: 'demo',
        title: 'Demo',
        description: 'Demo description',
        html: '<!doctype html><html><body>Demo</body></html>',
      },
    ]);

    const element = await UserPublishedPages({
      params: Promise.resolve({ user_slug: 'alice' }),
    });
    render(element);

    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { field: 'userSlug', value: 'alice' },
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        type: 'and',
        conditions: [
          { field: 'userId', value: 'user-1' },
          { field: 'visibility', value: 'public' },
          { field: 'moderationStatus', value: 'approved' },
          {
            type: 'or',
            conditions: [
              { type: 'isNull', field: 'scheduledAt' },
              { type: 'sql', strings: ['', ' <= now()'], values: ['scheduledAt'] },
            ],
          },
        ],
      },
      orderBy: [{ direction: 'desc', field: 'updatedAt' }],
    });
    expect(screen.getByRole('link', { name: /Demo Demo description/i })).toHaveAttribute(
      'href',
      '/alice/demo?tab=read'
    );
  });

  it('returns not found when the slug does not match a user', async () => {
    mocks.findUser.mockResolvedValue(null);

    await expect(
      UserPublishedPages({
        params: Promise.resolve({ user_slug: 'missing' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
