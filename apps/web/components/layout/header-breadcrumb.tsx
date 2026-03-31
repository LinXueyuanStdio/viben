'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Heart, Key, Settings } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbConfig {
  labelKey: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Map paths to their display info
const pathConfig: Record<string, BreadcrumbConfig> = {
  '/settings': { labelKey: 'nav.my', icon: Settings },
  '/settings/favorites': { labelKey: 'nav.favorites', icon: Heart },
  '/settings/tokens': { labelKey: 'nav.apiKeys', icon: Key },
};

export function HeaderBreadcrumb() {
  const { t } = useTranslation();
  const pathname = usePathname();

  // Only show breadcrumbs for settings pages
  if (!pathname.startsWith('/settings')) {
    return null;
  }

  // Build breadcrumb items based on current path
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbItems: Array<{
    href: string;
    labelKey: string;
    icon?: React.ComponentType<{ className?: string }>;
    isLast: boolean;
  }> = [];

  // Always start with "我的" as root for settings section
  breadcrumbItems.push({
    href: '/settings/favorites',
    labelKey: 'nav.my',
    icon: Settings,
    isLast: segments.length === 1,
  });

  // Add the specific settings page
  if (segments.length > 1) {
    const config = pathConfig[pathname];
    if (config) {
      breadcrumbItems.push({
        href: pathname,
        labelKey: config.labelKey,
        icon: config.icon,
        isLast: true,
      });
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <BreadcrumbItem key={item.href}>
            {index > 0 && <BreadcrumbSeparator />}
            {item.isLast ? (
              <BreadcrumbPage className="flex items-center gap-1.5">
                {item.icon && <item.icon className="h-4 w-4" />}
                {t(item.labelKey)}
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={item.href} className="flex items-center gap-1.5">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {t(item.labelKey)}
                </Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
