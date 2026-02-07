'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProfileSettingsFormProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    bio: string | null;
    email: string;
  };
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Create schema with translated messages
  const profileSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .min(1, t('profile.validation.displayNameRequired'))
          .max(100, t('profile.validation.displayNameMax')),
        bio: z.string().max(500, t('profile.validation.bioMax')).optional(),
      }),
    [t]
  );

  type ProfileValues = z.infer<typeof profileSchema>;

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user.displayName,
      bio: user.bio || '',
    },
  });

  async function onSubmit(data: ProfileValues) {
    setIsLoading(true);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast.success(t('profile.toast.profileUpdated'));
      router.refresh();
    } catch {
      toast.error(t('profile.toast.failedToUpdateProfile'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">{t('profile.form.username')}</Label>
        <Input id="username" value={user.username} disabled />
        <p className="text-xs text-muted-foreground">
          {t('profile.form.usernameCannotChange')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('profile.form.email')}</Label>
        <Input id="email" value={user.email} disabled />
        <p className="text-xs text-muted-foreground">
          {t('profile.form.emailManagedByOAuth')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">{t('profile.form.displayName')}</Label>
        <Input id="displayName" {...form.register('displayName')} />
        {form.formState.errors.displayName && (
          <p className="text-sm text-destructive">
            {form.formState.errors.displayName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">{t('profile.form.bio')}</Label>
        <Textarea
          id="bio"
          placeholder={t('profile.form.bioPlaceholder')}
          {...form.register('bio')}
        />
        {form.formState.errors.bio && (
          <p className="text-sm text-destructive">
            {form.formState.errors.bio.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('profile.form.saveChanges')}
      </Button>
    </form>
  );
}
