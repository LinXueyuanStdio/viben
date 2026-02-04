'use client';

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
  { label: string; className: string; icon?: typeof Star }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  featured: {
    label: 'Featured',
    className: 'bg-primary text-primary-foreground',
    icon: Star,
  },
};

export function ModerationBadge({ status, className }: ModerationBadgeProps) {
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
      {config.label}
    </Badge>
  );
}
