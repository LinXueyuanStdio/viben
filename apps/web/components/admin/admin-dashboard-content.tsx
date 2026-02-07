'use client';

import { useTranslation } from 'react-i18next';
import { Package, Flag, Activity, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/admin/stats-card';
import { RecentActivityList } from '@/components/admin/recent-activity';
import { PendingQueuePreview } from '@/components/admin/pending-queue';
import type { AdminStats } from '@/lib/admin/stats';

interface AdminDashboardContentProps {
  stats: AdminStats;
}

export function AdminDashboardContent({ stats }: AdminDashboardContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">
          {t('dashboard.admin.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.admin.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.admin.pendingPackages')}
          value={stats.pendingPackages}
          icon={<Package className="h-4 w-4" />}
          href="/admin/packages"
        />
        <StatsCard
          title={t('dashboard.admin.openReports')}
          value={stats.openReports}
          icon={<Flag className="h-4 w-4" />}
          href="/admin/reports"
        />
        <StatsCard
          title={t('dashboard.admin.todayActions')}
          value={stats.todayActions}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatsCard
          title={t('dashboard.admin.totalUsers')}
          value={stats.totalUsers}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Recent Activity and Pending Queue */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.admin.recentModeration')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivityList activities={stats.recentActivity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.admin.pendingQueue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PendingQueuePreview items={stats.pendingQueue} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
