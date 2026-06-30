'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Upload, Camera } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================
// Types
// ============================================

interface ProfileSettingsFormProps {
  user: {
    id: string;
    username: string;
    userSlug: string;
    displayName: string;
    bio: string | null;
    email: string;
    avatarUrl: string | null;
    websiteUrl: string | null;
    createdAt: Date | string;
  };
}

// ============================================
// Profile Settings Form
// ============================================

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // Form states
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Danger zone states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Profile form schema
  const profileSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .min(1, t('profile.validation.displayNameRequired'))
          .max(100, t('profile.validation.displayNameMax')),
        bio: z.string().max(500, t('profile.validation.bioMax')).optional(),
        websiteUrl: z
          .string()
          .url(t('profile.validation.websiteUrlInvalid'))
          .optional()
          .or(z.literal('')),
      }),
    [t]
  );

  type ProfileValues = z.infer<typeof profileSchema>;

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema as any),
    defaultValues: {
      displayName: user.displayName,
      bio: user.bio || '',
      websiteUrl: user.websiteUrl || '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  // ============================================
  // Unsaved changes warning
  // ============================================

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

  // ============================================
  // Avatar upload
  // ============================================

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file extension (more reliable than MIME type)
      const validExtensions = ['png', 'jpg', 'jpeg', 'webp'];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!validExtensions.includes(extension)) {
        toast.error(t('profile.toast.avatarUploadFailed') + ': ' + 'Unsupported format. Use PNG, JPEG, or WebP.');
        return;
      }

      // Validate file size (2MB max for avatar)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('profile.toast.avatarUploadFailed') + ': ' + 'File too large. Maximum size is 2MB.');
        return;
      }

      setAvatarUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        // Include kind so the media asset is tagged correctly
        formData.append('kind', 'avatar');

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
        }
        const uploadData = await uploadRes.json();

        if (!uploadData.url) {
          throw new Error('Upload succeeded but no URL returned');
        }

        // Update user avatarUrl via PATCH
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
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t('profile.toast.avatarUploadFailed');
        toast.error(message);
      } finally {
        setAvatarUploading(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [t, router]
  );

  // ============================================
  // Profile form submit
  // ============================================

  const onSubmit = async (data: ProfileValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      toast.success(t('profile.toast.profileUpdated'));
      router.refresh();
      form.reset(data);
    } catch {
      toast.error(t('profile.toast.failedToUpdateProfile'));
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Password change
  // ============================================

  const handlePasswordChange = async () => {
    // Client-side validation
    if (!currentPassword) {
      toast.error(t('profile.password.incorrectCurrent'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('profile.password.minLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.password.mismatch'));
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to change password');
      }

      toast.success(t('profile.password.changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.password.changeFailed');
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ============================================
  // Delete account
  // ============================================

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user.username) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/users/me', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete account');
      toast.success(t('profile.danger.deleted'));
      router.push('/');
      router.refresh();
    } catch {
      toast.error(t('profile.danger.deleteFailed'));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // ============================================
  // Bio character count
  // ============================================

  const bioValue = form.watch('bio') || '';
  const bioLength = bioValue.length;

  // ============================================
  // Render
  // ============================================

  return (
    <div className="mt-6 space-y-8">
      {/* ============================================
          Section 1: Profile
          ============================================ */}
      <section className="rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{t('profile.sections.profile')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.sections.profileDesc')}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="space-y-2">
            <Label>{t('profile.form.avatar')}</Label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="group relative cursor-pointer rounded-full"
                disabled={avatarUploading}
              >
                <Avatar className="h-20 w-20 ring-2 ring-border group-hover:ring-primary transition-all">
                  <AvatarImage src={avatarUrl || undefined} />
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
            <Input id="displayName" {...register('displayName')} />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName.message}</p>
            )}
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
              {...register('bio')}
            />
            {errors.bio && (
              <p className="text-sm text-destructive">{errors.bio.message}</p>
            )}
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">{t('profile.form.websiteUrl')}</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder={t('profile.form.websiteUrlPlaceholder')}
              {...register('websiteUrl')}
            />
            {errors.websiteUrl && (
              <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>
            )}
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSaving || !isDirty}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('profile.form.saveChanges')}
            </Button>
            {isDirty && (
              <span className="text-xs text-muted-foreground">
                {t('profile.form.unsavedChanges')}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ============================================
          Section 2: Account
          ============================================ */}
      <section className="rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{t('profile.sections.account')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.sections.accountDesc')}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">{t('profile.form.username')}</Label>
            <Input id="username" value={user.username} disabled />
            <p className="text-xs text-muted-foreground">{t('profile.form.usernameCannotChange')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('profile.form.email')}</Label>
            <Input id="email" value={user.email} disabled />
            <p className="text-xs text-muted-foreground">{t('profile.form.emailManagedByOAuth')}</p>
          </div>
        </div>
      </section>

      {/* ============================================
          Section 3: Security — Change Password
          ============================================ */}
      <section className="rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{t('profile.sections.security')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.sections.securityDesc')}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('profile.password.currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('profile.password.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('profile.password.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePasswordChange();
              }}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handlePasswordChange}
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.password.title')}
          </Button>
        </div>
      </section>

      {/* ============================================
          Section 4: Danger Zone
          ============================================ */}
      <section className="rounded-lg border border-destructive/30">
        <div className="border-b border-destructive/20 px-6 py-4">
          <h2 className="text-lg font-semibold text-destructive">{t('profile.sections.danger')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.sections.dangerDesc')}</p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{t('profile.danger.description')}</p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            {t('profile.danger.deleteAccount')}
          </Button>
        </div>
      </section>

      {/* ============================================
          Delete Account Dialog
          ============================================ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.danger.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('profile.danger.confirmDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>
              Type <strong className="text-destructive">{user.username}</strong> to confirm:
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={user.username}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== user.username}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('profile.danger.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
