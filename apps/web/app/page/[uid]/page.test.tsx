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
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

import PublishedPage from './page';

describe('/page/[uid]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders published HTML in a sandboxed iframe', async () => {
    mocks.findFirst.mockResolvedValue({
      uid: 'demo',
      title: 'Demo',
      description: 'Demo description',
      html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
    });

    const element = await PublishedPage({ params: Promise.resolve({ uid: 'demo' }) });
    render(element);

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

  it('returns not found for unknown uid', async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      PublishedPage({ params: Promise.resolve({ uid: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalled();
  });
});
