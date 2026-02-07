'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { ActivityItem } from '@/lib/admin/stats';

interface RecentActivityListProps {
  activities: ActivityItem[];
}

const actionColors: Record<string, string> = {
  approve: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  reject: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  feature: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  unfeature: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ban: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  unban: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function RecentActivityList({ activities }: RecentActivityListProps) {
  const { t } = useTranslation();

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {t('dashboard.admin.noRecentActivity')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs',
                  actionColors[activity.action] ?? 'bg-gray-100 text-gray-800'
                )}
              >
                {t(`dashboard.admin.actions.${activity.action}`, { defaultValue: activity.action })}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t(`dashboard.admin.entityTypes.${activity.entityType}`, { defaultValue: activity.entityType })}
              </span>
            </div>
            <p className="text-sm font-medium">{activity.entityName}</p>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.admin.byAdmin', { name: activity.adminName })}
            </p>
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(activity.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}
