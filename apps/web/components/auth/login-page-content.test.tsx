import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { LoginPageContent } from './login-page-content';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.oauthError.invalid_state': 'Your sign-in request expired. Please try again.',
        'auth.oauthError.no_token':
          'The provider did not return an access token. Please try signing in again.',
        'auth.oauthError.no_email':
          'We could not access your email address. Please grant email access and try again.',
        'auth.oauthError.oauth_failed': 'Third-party sign-in failed. Please try again.',
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('./login-form', () => ({
  LoginForm: () => <div />,
}));

vi.mock('./oauth-buttons', () => ({
  OAuthButtons: () => <div />,
}));

describe('LoginPageContent OAuth errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/login');
  });

  it.each([
    ['invalid_state', 'Your sign-in request expired. Please try again.'],
    ['no_token', 'The provider did not return an access token. Please try signing in again.'],
    [
      'no_email',
      'We could not access your email address. Please grant email access and try again.',
    ],
    ['oauth_failed', 'Third-party sign-in failed. Please try again.'],
  ])('shows the %s OAuth error once', async (error, message) => {
    window.history.replaceState(null, '', `/login?error=${error}`);

    render(
      <StrictMode>
        <LoginPageContent />
      </StrictMode>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
    expect(toast.error).toHaveBeenCalledWith(message, {
      id: `login-oauth-error-${error}`,
    });
  });
});
