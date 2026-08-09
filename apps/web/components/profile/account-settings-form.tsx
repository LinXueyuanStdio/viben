'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmailCard } from '@/components/profile/email-card';
import { ConnectedAccountsCard } from '@/components/profile/connected-accounts-card';

// ============================================
// Types
// ============================================

interface AccountSettingsFormProps {
  user: {
    id: string;
    username: string;
    email: string;
    hasPassword: boolean;
    createdAt: string | null;
    lastLoginAt: string | null;
  };
}

// ============================================
// Account Settings Form
// ============================================

export function AccountSettingsForm({ user }: AccountSettingsFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const provider = searchParams.get("provider");
    if (!error) return;
    toast.error(t(`profile.settings.oauthError.${error}`, provider ? { provider } : {}));
  }, [searchParams, t]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // ============================================
  // Password change
  // ============================================

  const handlePasswordChange = async () => {
    if (user.hasPassword && !currentPassword) {
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
        body: JSON.stringify(
          user.hasPassword
            ? { currentPassword, newPassword }
            : { newPassword }
        ),
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
      toast.error(err instanceof Error ? err.message : t('profile.password.changeFailed'));
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

  return (
    <div className="space-y-8">
      {/* Section 1: Account Info */}
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
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">注册时间</Label>
              <p className="text-sm font-medium">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '—'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">最后登录</Label>
              <p className="text-sm font-medium">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Email Management */}
      <EmailCard email={user.email} />

      {/* Connected Accounts */}
      <ConnectedAccountsCard />

      {/* Section 2: Security */}
      <section className="rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{t('profile.sections.security')}</h2>
          <p className="text-sm text-muted-foreground">
            {user.hasPassword
              ? t('profile.sections.securityDesc')
              : t('profile.password.oauthDesc')}
          </p>
        </div>
        <div className="p-6 space-y-4">
          {user.hasPassword && (
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
          )}
          <div className="space-y-2">
            <Label htmlFor="newPassword">
              {user.hasPassword
                ? t('profile.password.newPassword')
                : t('profile.password.setPassword')}
            </Label>
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
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordChange(); }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handlePasswordChange}
            disabled={
              isChangingPassword
              || (user.hasPassword && !currentPassword)
              || !newPassword
              || !confirmPassword
            }
          >
            {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.password.title')}
          </Button>
        </div>
      </section>

      {/* Section 3: Danger Zone */}
      <section className="rounded-lg border border-destructive/30">
        <div className="border-b border-destructive/20 px-6 py-4">
          <h2 className="text-lg font-semibold text-destructive">{t('profile.sections.danger')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.sections.dangerDesc')}</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{t('profile.danger.description')}</p>
          <Button type="button" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            {t('profile.danger.deleteAccount')}
          </Button>
        </div>
      </section>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.danger.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('profile.danger.confirmDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              <Trans
                i18nKey="profile.danger.typeToConfirm"
                values={{ username: user.username }}
                components={{ strong: <strong className="text-destructive" /> }}
              />
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
