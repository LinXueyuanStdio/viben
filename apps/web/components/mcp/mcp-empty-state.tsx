'use client';

import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';

interface McpEmptyStateProps {
  hasSearch?: boolean;
}

export function McpEmptyState({ hasSearch = false }: McpEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Package className="h-12 w-12 mb-4 opacity-50" />
      <h3 className="text-lg font-medium">{t('marketplace.noPackages')}</h3>
      {hasSearch && (
        <p className="text-sm mt-1">
          {t('marketplace.tryAdjustingSearch')}
        </p>
      )}
    </div>
  );
}
