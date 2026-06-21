import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
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

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

import PublishedPage from './page';

describe('/page/[user_id]/[page_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries by user id and page id before rendering the sandboxed iframe', async () => {
    mocks.findFirst.mockResolvedValue({
      uid: 'demo',
      userId: 'user-1',
      title: 'Demo',
      description: 'Demo description',
      html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
    });

    const element = await PublishedPage({
      params: Promise.resolve({ user_id: 'user-1', page_id: 'demo' }),
    });
    render(element);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        type: 'and',
        conditions: [
          { field: 'userId', value: 'user-1' },
          { field: 'uid', value: 'demo' },
        ],
      },
    });

    const iframe = screen.getByTitle('Demo');
    expect(iframe).toHaveAttribute(
      'srcDoc',
      '<!doctype html><html><body><h1>Demo HTML</h1></body></html>'
    );
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-popups allow-modals allow-downloads'
    );
  });

  it('returns not found when no page exists for the user and page id', async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      PublishedPage({
        params: Promise.resolve({ user_id: 'user-1', page_id: 'missing' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalled();
  });
});
