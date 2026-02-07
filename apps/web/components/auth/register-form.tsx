'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const username = formData.get('username') as string;
    const displayName = formData.get('displayName') as string;
    const password = formData.get('password') as string;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, displayName, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('auth.somethingWentWrong'));
        return;
      }

      router.push('/mcp');
      router.refresh();
    } catch {
      setError(t('auth.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">{t('auth.username')}</Label>
        <Input
          id="username"
          name="username"
          type="text"
          placeholder={t('auth.usernamePlaceholder')}
          required
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {t('auth.usernameHint')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">{t('auth.displayName')}</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          placeholder={t('auth.displayNamePlaceholder')}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {t('auth.passwordMinLength')}
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.createAccount')}
      </Button>
    </form>
  );
}
