import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      publishedPages: {
        findMany: mocks.findMany,
      },
    },
  },
  publishedPages: {
    userId: 'userId',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((field) => ({ direction: 'desc', field })),
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

import UserPublishedPages from './page';

describe('/page/[user_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      params: Promise.resolve({ user_id: 'user-1' }),
    });
    render(element);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { field: 'userId', value: 'user-1' },
      orderBy: [{ direction: 'desc', field: 'updatedAt' }],
    });
    expect(screen.getByRole('link', { name: /Demo Demo description/i })).toHaveAttribute(
      'href',
      '/page/user-1/demo'
    );
  });
});
