'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { RegisterFormSchema } from '@/lib/validations/user';
import type { RegisterFormInput } from '@/lib/validations/user';

export function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function getStrength() {
    if (!password) return { label: '', level: 0, color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { label: t('auth.passwordWeak'), level: 1, color: 'bg-red-500' };
    if (score <= 4) return { label: t('auth.passwordMedium'), level: 2, color: 'bg-yellow-500' };
    return { label: t('auth.passwordStrong'), level: 3, color: 'bg-green-500' };
  }

  const strength = getStrength();

  function validate(): RegisterFormInput | null {
    const result = RegisterFormSchema.safeParse({
      email, username, displayName, password, confirmPassword, agreeToTerms,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      }
      setFieldErrors(errors);
      return null;
    }
    setFieldErrors({});
    return result.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = validate();
    if (!data) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          displayName: data.displayName,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || t('auth.somethingWentWrong'));
        return;
      }

      router.push('/mcp-market');
      router.refresh();
    } catch {
      setError(t('auth.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  const isValid = email.trim() && username.trim() && password && confirmPassword && agreeToTerms;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
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
          onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
          disabled={isLoading}
        />
        {fieldErrors.email && (
          <p className="text-xs text-destructive">{fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">{t('auth.username')}</Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          placeholder={t('auth.usernamePlaceholder')}
          value={username}
          onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {t('auth.usernameHint')}
        </p>
        {fieldErrors.username && (
          <p className="text-xs text-destructive">{fieldErrors.username}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">{t('auth.displayName')}</Label>
        <Input
          id="displayName"
          type="text"
          autoComplete="name"
          placeholder={t('auth.displayNamePlaceholder')}
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); clearFieldError('displayName'); }}
          disabled={isLoading}
        />
        {fieldErrors.displayName && (
          <p className="text-xs text-destructive">{fieldErrors.displayName}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        {password && (
          <div className="space-y-1">
            <div className="flex gap-1">
              <div className={`h-1 flex-1 rounded ${strength.level >= 1 ? strength.color : 'bg-border'}`} />
              <div className={`h-1 flex-1 rounded ${strength.level >= 2 ? strength.color : 'bg-border'}`} />
              <div className={`h-1 flex-1 rounded ${strength.level >= 3 ? strength.color : 'bg-border'}`} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('auth.passwordStrength')}: {strength.label}
            </p>
          </div>
        )}
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        {fieldErrors.confirmPassword && (
          <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="agreeToTerms"
          className="mt-1 h-4 w-4 rounded accent-primary"
          checked={agreeToTerms}
          onChange={(e) => { setAgreeToTerms(e.target.checked); clearFieldError('agreeToTerms'); }}
          disabled={isLoading}
        />
        <Label htmlFor="agreeToTerms" className="text-sm font-normal leading-tight">
          {t('auth.agreeToTerms')}{' '}
          <Link href="/terms" className="text-primary hover:underline">
            {t('auth.termsOfService')}
          </Link>
          {' '}{t('auth.and')}{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            {t('auth.privacyStatement')}
          </Link>
        </Label>
      </div>
      {fieldErrors.agreeToTerms && (
        <p className="text-xs text-destructive">{fieldErrors.agreeToTerms}</p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading || !isValid}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.createAccount')}
      </Button>
    </form>
  );
}
