'use client';

import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookmarkButton } from '@/components/social';
import { toast } from 'sonner';
import { useState } from 'react';

interface McpActionsProps {
  packageId: string;
  bookmarksCount: number;
  repositoryUrl: string | null;
  isAuthenticated: boolean;
}

export function McpActions({
  packageId,
  bookmarksCount,
  repositoryUrl,
  isAuthenticated,
}: McpActionsProps) {
  const { t } = useTranslation();
  const [isInstallClicked, setIsInstallClicked] = useState(false);

  const handleInstall = async () => {
    const installCommand = `viben install ${packageId}`;
    try {
      await navigator.clipboard.writeText(installCommand);
      setIsInstallClicked(true);
      toast.success(t('marketplace.installCommandCopied', 'Install command copied to clipboard'));
      setTimeout(() => setIsInstallClicked(false), 2000);
    } catch {
      toast(t('marketplace.installCommand', installCommand), {
        description: t('marketplace.installCommandHint', 'Run this command in your terminal to install.'),
        duration: 5000,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <BookmarkButton
        entityType="mcp"
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
        {isInstallClicked ? t('marketplace.copied', 'Copied!') : t('marketplace.install')}
      </Button>
      {repositoryUrl && (
        <Button variant="outline" asChild>
          <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('marketplace.repository')}
          </a>
        </Button>
      )}
    </div>
  );
}

McpActions.displayName = 'McpActions';
