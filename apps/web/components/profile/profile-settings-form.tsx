'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Camera } from 'lucide-react';

// ============================================
// Types
// ============================================

interface ProfileSettingsFormProps {
  user: {
    id: string;
    userSlug: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    websiteUrl: string | null;
  };
}

// ============================================
// Profile Settings Form
// ============================================

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl || '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);

  useEffect(() => {
    setAvatarUrl(user.avatarUrl);
  }, [user.avatarUrl]);

  const profileSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .min(1, t('profile.validation.displayNameRequired'))
          .max(100, t('profile.validation.displayNameMax')),
        bio: z.string().max(500, t('profile.validation.bioMax')).optional().or(z.literal('')),
        websiteUrl: z
          .string()
          .url(t('profile.validation.websiteUrlInvalid'))
          .optional()
          .or(z.literal('')),
      }),
    [t]
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function markDirty() { if (!isDirty) setIsDirty(true); }
  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  // ============================================
  // Avatar upload
  // ============================================

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validExtensions = ['png', 'jpg', 'jpeg', 'webp'];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!validExtensions.includes(extension)) {
        toast.error(t('profile.toast.avatarUploadFailed') + ': Unsupported format. Use PNG, JPEG, or WebP.');
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('profile.toast.avatarUploadFailed') + ': File too large. Maximum size is 2MB.');
        return;
      }

      setAvatarUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('kind', 'avatar');
        formData.append('user_slug', user.userSlug);
        formData.append('uid', user.id);

        const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
        }
        const uploadData = await uploadRes.json();
        if (!uploadData.url) throw new Error('Upload succeeded but no URL returned');

        const updateRes = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarUrl: uploadData.url }),
        });
        if (!updateRes.ok) {
          const errData = await updateRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update profile');
        }
        setAvatarUrl(uploadData.url);
        toast.success(t('profile.toast.avatarUpdated'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('profile.toast.avatarUploadFailed'));
      } finally {
        setAvatarUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [t, user.userSlug, user.id]
  );

  // ============================================
  // Profile form submit
  // ============================================

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();

    const result = profileSchema.safeParse({ displayName, bio: bio || '', websiteUrl: websiteUrl || '' });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      toast.success(t('profile.toast.profileUpdated'));
      setIsDirty(false);
      router.refresh();
    } catch {
      toast.error(t('profile.toast.failedToUpdateProfile'));
    } finally {
      setIsSaving(false);
    }
  }

  const bioLength = bio.length;

  return (
    <section className="rounded-lg border">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{t('profile.sections.profile')}</h2>
        <p className="text-sm text-muted-foreground">{t('profile.sections.profileDesc')}</p>
      </div>

      <form onSubmit={handleProfileSave} className="p-6 space-y-6">
        {/* Avatar */}
        <div className="space-y-2">
          <Label>{t('profile.form.avatar')}</Label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer rounded-full"
              disabled={avatarUploading}
            >
              <Avatar className="h-20 w-20 ring-2 ring-border group-hover:ring-primary transition-all">
                <AvatarImage key={avatarUrl} src={avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {user.displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
            </button>
            <div>
              <p className="text-sm text-muted-foreground">{t('profile.form.avatarHint')}</p>
              {avatarUploading && (
                <p className="text-sm font-medium text-primary animate-pulse">
                  {t('profile.form.avatarUploading')}
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">{t('profile.form.displayName')}</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); markDirty(); clearFieldError('displayName'); }}
          />
          {fieldErrors.displayName && <p className="text-sm text-destructive">{fieldErrors.displayName}</p>}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="bio">{t('profile.form.bio')}</Label>
            <span className={`text-xs ${bioLength > 500 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {t('profile.form.bioCount', { count: bioLength })}
            </span>
          </div>
          <Textarea
            id="bio"
            rows={4}
            placeholder={t('profile.form.bioPlaceholder')}
            value={bio}
            onChange={(e) => { setBio(e.target.value); markDirty(); }}
          />
          {fieldErrors.bio && <p className="text-sm text-destructive">{fieldErrors.bio}</p>}
        </div>

        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">{t('profile.form.websiteUrl')}</Label>
          <Input
            id="websiteUrl"
            type="url"
            placeholder={t('profile.form.websiteUrlPlaceholder')}
            value={websiteUrl}
            onChange={(e) => { setWebsiteUrl(e.target.value); markDirty(); }}
          />
          {fieldErrors.websiteUrl && <p className="text-sm text-destructive">{fieldErrors.websiteUrl}</p>}
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSaving || !isDirty}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.form.saveChanges')}
          </Button>
          {isDirty && <span className="text-xs text-muted-foreground">{t('profile.form.unsavedChanges')}</span>}
        </div>
      </form>
    </section>
  );
}
