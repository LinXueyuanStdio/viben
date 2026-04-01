'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PackageStatus } from '@/lib/types/admin';
import { Star } from 'lucide-react';

interface ModerationBadgeProps {
  status: PackageStatus;
  className?: string;
}

const statusConfig: Record<
  PackageStatus,
  { labelKey: string; className: string; icon?: typeof Star }
> = {
  pending: {
    labelKey: 'dashboard.admin.packages.status.pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  approved: {
    labelKey: 'dashboard.admin.packages.status.approved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  rejected: {
    labelKey: 'dashboard.admin.packages.status.rejected',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  featured: {
    labelKey: 'dashboard.admin.packages.status.featured',
    className: 'bg-primary text-primary-foreground',
    icon: Star,
  },
};

export function ModerationBadge({ status, className }: ModerationBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-transparent font-medium',
        config.className,
        className
      )}
    >
      {Icon && <Icon className="mr-1 h-3 w-3 fill-current" />}
      {t(config.labelKey)}
    </Badge>
  );
}
