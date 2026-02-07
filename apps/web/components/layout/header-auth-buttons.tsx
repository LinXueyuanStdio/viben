'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function HeaderAuthButtons() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" asChild>
        <Link href="/login">{t('auth.signIn')}</Link>
      </Button>
      <Button asChild>
        <Link href="/register">{t('auth.signUp')}</Link>
      </Button>
    </div>
  );
}
