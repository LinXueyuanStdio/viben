'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { resetPasswordSchema } from '@/lib/validations/user';
import type { ResetPasswordInput } from '@/lib/validations/user';

export function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { token },
  });

  const passwordValue = watch('password', '');

  function getStrength() {
    if (!passwordValue) return { label: '', level: 0, color: '' };
    let score = 0;
    if (passwordValue.length >= 8) score++;
    if (passwordValue.length >= 12) score++;
    if (/[A-Z]/.test(passwordValue)) score++;
    if (/[a-z]/.test(passwordValue)) score++;
    if (/[0-9]/.test(passwordValue)) score++;
    if (/[^A-Za-z0-9]/.test(passwordValue)) score++;

    if (score <= 2) return { label: t('auth.passwordWeak'), level: 1, color: 'bg-red-500' };
    if (score <= 4) return { label: t('auth.passwordMedium'), level: 2, color: 'bg-yellow-500' };
    return { label: t('auth.passwordStrong'), level: 3, color: 'bg-green-500' };
  }

  const strength = getStrength();

  async function onSubmit(data: ResetPasswordInput) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || t('auth.somethingWentWrong'));
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch {
      setError(t('auth.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <div>
          <h3 className="text-lg font-semibold">{t('auth.passwordResetSuccess')}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t('auth.passwordResetRedirect')}
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
        {t('auth.invalidResetToken')}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <input type="hidden" {...register('token')} />

      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.newPassword')}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={t('auth.passwordPlaceholder')}
            disabled={isLoading}
            {...register('password')}
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
        {passwordValue && (
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
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={isLoading}
            {...register('confirmPassword')}
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
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !isValid}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('auth.resetPassword')}
      </Button>
    </form>
  );
}
