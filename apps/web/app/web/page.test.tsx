import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebPage from './page';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('../components/community/community-home', () => ({
  CommunityHome: ({ session }: { session: unknown }) => (
    <main>
      <div data-testid="session-state">{session ? 'signed-in' : 'anonymous'}</div>
    </main>
  ),
}));

vi.mock('@/lib/auth/cookies', () => ({
  getSession: mocks.getSession,
}));

describe('WebCommunityHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(null);
  });

  it('passes the current session into the web community homepage', async () => {
    mocks.getSession.mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      userSlug: 'alice',
      email: 'alice@example.com',
      role: 'user',
      expiresAt: Date.now() + 1000,
    });

    render(await WebPage());

    expect(screen.getByTestId('session-state')).toHaveTextContent('signed-in');
  });
});
