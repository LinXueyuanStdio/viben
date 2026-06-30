'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ProfileSettingsHeaderProps {
  userSlug?: string
}

export function ProfileSettingsHeader({ userSlug }: ProfileSettingsHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={userSlug ? `/${encodeURIComponent(userSlug)}` : "/profile"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('profile.settings.backToProfile')}
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('profile.settings.title')}</h1>
          <p className="text-muted-foreground">
            {t('profile.settings.description')}
          </p>
        </div>
      </div>
    </>
  );
}
