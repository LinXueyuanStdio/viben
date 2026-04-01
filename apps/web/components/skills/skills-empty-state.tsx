'use client';

import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';

interface SkillsEmptyStateProps {
  hasSearchQuery: boolean;
}

export function SkillsEmptyState({ hasSearchQuery }: SkillsEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Zap className="h-12 w-12 mb-4 opacity-50" />
      <h3 className="text-lg font-medium">{t('skills.grid.noSkillsFound')}</h3>
      {hasSearchQuery && (
        <p className="text-sm mt-1">
          {t('skills.grid.tryAdjusting')}
        </p>
      )}
    </div>
  );
}
