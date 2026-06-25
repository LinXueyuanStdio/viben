import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityHome } from './community-home';
import type { Session } from '@/lib/auth/types';

const mocks = vi.hoisted(() => ({
  getHomeConfig: vi.fn(),
}));

vi.mock('@/lib/services/community', () => ({
  getHomeConfig: mocks.getHomeConfig,
}));

vi.mock('@/components/layout/header-auth-buttons', () => ({
  HeaderAuthButtons: () => <div data-testid="auth-buttons">auth buttons</div>,
}));

vi.mock('@/components/layout/user-menu', () => ({
  UserMenu: ({ session }: { session: Session }) => (
    <div data-testid="user-menu">{session.username}</div>
  ),
}));

describe('CommunityHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHomeConfig.mockResolvedValue({
      slots: [],
      fallback_used: false,
    });
  });

  it('shows the login entry when the visitor is anonymous', async () => {
    render(await CommunityHome({ session: null }));

    expect(screen.getByTestId('auth-buttons')).toBeInTheDocument();
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
  });

  it('shows the signed-in state when a session exists', async () => {
    render(
      await CommunityHome({
        session: {
          userId: 'user-1',
          username: 'alice',
          userSlug: 'alice',
          email: 'alice@example.com',
          role: 'user',
          expiresAt: Date.now() + 1000,
        },
      })
    );

    expect(screen.getByText('Signed in as alice')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toHaveTextContent('alice');
    expect(screen.queryByTestId('auth-buttons')).not.toBeInTheDocument();
  });
});
