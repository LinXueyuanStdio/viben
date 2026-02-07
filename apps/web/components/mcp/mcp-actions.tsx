'use client';

import { useTranslation } from 'react-i18next';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/social';

interface McpActionsProps {
  packageId: string;
  favoritesCount: number;
  repositoryUrl: string | null;
  isAuthenticated: boolean;
}

export function McpActions({
  packageId,
  favoritesCount,
  repositoryUrl,
  isAuthenticated,
}: McpActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <FavoriteButton
        entityType="mcp"
        entityId={packageId}
        initialCount={favoritesCount}
        isAuthenticated={isAuthenticated}
      />
      <Button>
        <Download className="mr-2 h-4 w-4" />
        {t('marketplace.install')}
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
