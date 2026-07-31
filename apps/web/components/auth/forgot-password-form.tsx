'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ForgotPasswordBody } from '@/lib/validations/user';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    const result = ForgotPasswordBody.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? t('auth.invalidEmail'));
      return false;
    }
    setFieldError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error || t('auth.somethingWentWrong'));
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError(t('auth.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <div>
          <h3 className="text-lg font-semibold">{t('auth.checkYourEmail')}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t('auth.checkYourEmailDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          disabled={isLoading}
        />
        {fieldError && (
          <p className="text-xs text-destructive">{fieldError}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.sendResetLink')}
      </Button>
    </form>
  );
}
