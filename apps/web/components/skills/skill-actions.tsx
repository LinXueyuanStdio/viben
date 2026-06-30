'use client';

import { useTranslation } from 'react-i18next';
import { Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookmarkButton } from '@/components/social';
import { toast } from 'sonner';
import { useState } from 'react';

interface SkillActionsProps {
  packageId: string;
  bookmarksCount: number;
  isAuthenticated: boolean;
}

export function SkillActions({
  packageId,
  bookmarksCount,
  isAuthenticated,
}: SkillActionsProps) {
  const { t } = useTranslation();
  const [isInstallClicked, setIsInstallClicked] = useState(false);

  const handleInstall = async () => {
    const installCommand = `viben skill install ${packageId}`;
    try {
      await navigator.clipboard.writeText(installCommand);
      setIsInstallClicked(true);
      toast.success(t('skills.actions.installCommandCopied', 'Install command copied to clipboard'));
      setTimeout(() => setIsInstallClicked(false), 2000);
    } catch {
      toast(t('skills.actions.installCommand', installCommand), {
        description: t('skills.actions.installCommandHint', 'Run this command in your terminal to install.'),
        duration: 5000,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <BookmarkButton
        entityType="skill"
        entityId={packageId}
        initialCount={bookmarksCount}
        isAuthenticated={isAuthenticated}
      />
      <Button onClick={handleInstall}>
        {isInstallClicked ? (
          <Check className="mr-2 h-4 w-4" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {isInstallClicked ? t('skills.actions.copied', 'Copied!') : t('skills.actions.install')}
      </Button>
    </div>
  );
}

SkillActions.displayName = 'SkillActions';
