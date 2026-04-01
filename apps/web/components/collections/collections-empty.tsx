'use client';

import { useTranslation } from 'react-i18next';

interface CollectionsEmptyProps {
  hasQuery: boolean;
}

export function CollectionsEmpty({ hasQuery }: CollectionsEmptyProps) {
  const { t } = useTranslation('collections');

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-lg text-muted-foreground">{t('noCollectionsFound')}</p>
      {hasQuery && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('tryAdjustingSearch')}
        </p>
      )}
    </div>
  );
}
