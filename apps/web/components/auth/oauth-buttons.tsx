'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GithubIcon as Github } from '@/components/ui/icons';

export function OAuthButtons() {
  const { t } = useTranslation();

  const handleGitHubLogin = () => {
    // Read redirect param directly from window.location to avoid
    // useSearchParams() — which requires a <Suspense> boundary in the
    // parent tree that /login doesn't currently provide.
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    const params = new URLSearchParams();
    if (redirect) params.set('redirect', redirect);
    const qs = params.toString();
    window.location.href = `/api/auth/github${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="grid gap-2">
      <Button variant="outline" onClick={handleGitHubLogin} type="button">
        <Github className="mr-2 h-4 w-4" />
        {t('auth.continueWithGitHub')}
      </Button>
    </div>
  );
}
