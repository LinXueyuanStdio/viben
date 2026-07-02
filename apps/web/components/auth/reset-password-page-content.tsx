'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ResetPasswordForm } from './reset-password-form';

export function ResetPasswordPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{t('auth.resetPasswordTitle')}</h1>
        <p className="text-muted-foreground">
          {t('auth.resetPasswordDescription')}
        </p>
      </div>

      <ResetPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </div>
  );
}
