import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('./components/community/community-home', () => ({
  CommunityHome: ({ session }: { session: unknown }) => (
    <main>
      <h1>Discover published work</h1>
      <a href="/home">/home</a>
      <div data-testid="session-state">{session ? 'signed-in' : 'anonymous'}</div>
    </main>
  ),
}));

vi.mock('@/lib/auth/cookies', () => ({
  getSession: mocks.getSession,
}));

describe('CommunityHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(null);
  });

  it('renders the community discovery homepage at root', async () => {
    render(await Page());

    expect(screen.getByRole('heading', { name: 'Discover published work' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/home' })).toHaveAttribute('href', '/home');
    expect(screen.getByTestId('session-state')).toHaveTextContent('anonymous');
  });

  it('passes the current session into the community homepage', async () => {
    mocks.getSession.mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      userSlug: 'alice',
      email: 'alice@example.com',
      role: 'user',
      expiresAt: Date.now() + 1000,
    });

    render(await Page());

    expect(screen.getByTestId('session-state')).toHaveTextContent('signed-in');
  });
});
