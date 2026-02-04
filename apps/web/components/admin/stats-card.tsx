import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  href,
  trend,
  className,
}: StatsCardProps) {
  const content = (
    <Card
      className={cn(
        'transition-colors',
        href && 'cursor-pointer hover:border-primary/50',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {trend && (
          <p
            className={cn(
              'text-xs',
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
