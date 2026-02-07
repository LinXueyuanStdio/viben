'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { LoginForm } from './login-form';
import { OAuthButtons } from './oauth-buttons';

export function LoginPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{t('auth.signInTitle')}</h1>
        <p className="text-muted-foreground">
          {t('auth.signInDescription')}
        </p>
      </div>

      <OAuthButtons />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t('auth.orContinueWith')}
          </span>
        </div>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="text-primary hover:underline">
          {t('auth.signUp')}
        </Link>
      </p>
    </div>
  );
}
