import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/index';

interface PageHeaderProps {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * PageHeader displays an icon + title in the marketplace style
 * Icon is displayed in a rounded container with primary background
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
