'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

export function OAuthButtons() {
  const { t } = useTranslation();

  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github';
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
