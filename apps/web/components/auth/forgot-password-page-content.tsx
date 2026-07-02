'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export function ForgotPasswordPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{t('auth.forgotPasswordTitle')}</h1>
        <p className="text-muted-foreground">
          {t('auth.forgotPasswordDescription')}
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </div>
  );
}
