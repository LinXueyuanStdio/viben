'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OfficialSkillErrorPage({ error, reset }: ErrorPageProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error('Skill detail page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        {t('marketplace.failedToLoad', 'Failed to load skill')}
      </h2>
      <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
        {t('marketplace.failedToLoadHint', 'Something went wrong while loading this skill. Please try again.')}
      </p>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {t('marketplace.retry', 'Retry')}
      </Button>
    </div>
  );
}
