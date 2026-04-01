'use client';

import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/social';

interface SkillActionsProps {
  packageId: string;
  favoritesCount: number;
  isAuthenticated: boolean;
}

export function SkillActions({
  packageId,
  favoritesCount,
  isAuthenticated,
}: SkillActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <FavoriteButton
        entityType="skill"
        entityId={packageId}
        initialCount={favoritesCount}
        isAuthenticated={isAuthenticated}
      />
      <Button>
        <Download className="mr-2 h-4 w-4" />
        {t('skills.actions.install')}
      </Button>
    </div>
  );
}

SkillActions.displayName = 'SkillActions';
