'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ArrowLeft, Download, Heart, Star, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface McpAnalyticsHeaderProps {
  packageId: string;
  packageName: string;
  downloadsCount: number;
  weekDownloads: number;
  weekChange: number;
  bookmarksCount: number;
  ratingAvg: number;
  ratingCount: number;
}

export function McpAnalyticsHeader({
  packageId,
  packageName,
  downloadsCount,
  weekDownloads,
  weekChange,
  bookmarksCount,
  ratingAvg,
  ratingCount,
}: McpAnalyticsHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/mcp-market/${packageId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {t('analytics.titleWithName', { name: packageName })}
          </h1>
          <p className="text-muted-foreground">
            {t('analytics.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.totalDownloads')}
            </CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {downloadsCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.thisWeek')}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekDownloads}</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.fromLastWeek', {
                change: weekChange >= 0 ? `+${weekChange}` : weekChange
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('marketplace.favorites')}
            </CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookmarksCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('marketplace.rating')}
            </CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ratingAvg > 0 ? ratingAvg.toFixed(1) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('marketplace.ratingWithCount', { count: ratingCount })}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
