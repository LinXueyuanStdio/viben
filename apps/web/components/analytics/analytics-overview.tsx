'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Download, Bookmark, TrendingUp } from 'lucide-react';

interface AnalyticsOverviewProps {
  totalPackages: number;
  totalDownloads: number;
  totalFavorites: number;
}

export function AnalyticsOverview({
  totalPackages,
  totalDownloads,
  totalFavorites,
}: AnalyticsOverviewProps) {
  const { t } = useTranslation();

  const stats = [
    {
      titleKey: 'dashboard.analytics.totalPackages',
      value: totalPackages,
      icon: Package,
      descriptionKey: 'dashboard.analytics.totalPackagesDesc',
    },
    {
      titleKey: 'dashboard.analytics.totalDownloads',
      value: totalDownloads.toLocaleString(),
      icon: Download,
      descriptionKey: 'dashboard.analytics.totalDownloadsDesc',
    },
    {
      titleKey: 'dashboard.analytics.totalFavorites',
      value: totalFavorites.toLocaleString(),
      icon: Bookmark,
      descriptionKey: 'dashboard.analytics.totalFavoritesDesc',
    },
    {
      titleKey: 'dashboard.analytics.avgPerPackage',
      value:
        totalPackages > 0
          ? Math.round(totalDownloads / totalPackages).toLocaleString()
          : '0',
      icon: TrendingUp,
      descriptionKey: 'dashboard.analytics.avgPerPackageDesc',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.titleKey}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t(stat.titleKey)}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{t(stat.descriptionKey)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
