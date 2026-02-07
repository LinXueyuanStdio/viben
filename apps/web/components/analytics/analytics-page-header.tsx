'use client';

import { useTranslation } from 'react-i18next';

export function AnalyticsPageHeader() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-3xl font-bold">{t('dashboard.analytics.title')}</h1>
      <p className="mt-2 text-muted-foreground">
        {t('dashboard.analytics.subtitle')}
      </p>
    </div>
  );
}
