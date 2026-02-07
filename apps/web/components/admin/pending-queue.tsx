'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { QueueItem } from '@/lib/admin/stats';
import { Package, Sparkles, Flag } from 'lucide-react';

interface PendingQueuePreviewProps {
  items: QueueItem[];
}

const typeConfig: Record<
  QueueItem['type'],
  { icon: typeof Package; color: string; href: string }
> = {
  mcp: {
    icon: Package,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    href: '/admin/packages/mcp',
  },
  skill: {
    icon: Sparkles,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    href: '/admin/packages/skills',
  },
  report: {
    icon: Flag,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    href: '/admin/reports',
  },
};

export function PendingQueuePreview({ items }: PendingQueuePreviewProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {t('dashboard.admin.noPendingItems')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const config = typeConfig[item.type];
        const Icon = config.icon;

        return (
          <Link
            key={item.id}
            href={config.href}
            className="flex items-start justify-between gap-4 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', config.color)}
                  >
                    {t(`dashboard.admin.entityTypes.${item.type}`, { defaultValue: item.type })}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.admin.byAuthor', { author: item.author })}
                </p>
              </div>
            </div>
            <time className="text-xs text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(item.submittedAt)}
            </time>
          </Link>
        );
      })}
    </div>
  );
}
