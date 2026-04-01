'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Sparkles,
  Layers,
  BarChart3,
  LayoutDashboard,
  Upload,
  PackageSearch,
  Heart,
  Key,
  User,
  Settings,
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

type IconComponent = React.ComponentType<{ className?: string }>;

interface RouteConfig {
  labelKey: string;
  icon: IconComponent;
  parent?: string; // Parent route for nested breadcrumbs
}

// Route configuration - maps paths to their display info
const routeConfig: Record<string, RouteConfig> = {
  // Main navigation
  '/mcp': { labelKey: 'nav.mcpMarketplace', icon: Package },
  '/skills': { labelKey: 'nav.skillsMarket', icon: Sparkles },
  '/collections': { labelKey: 'nav.collections', icon: Layers },

  // "我的" section
  '/settings/favorites': { labelKey: 'nav.favorites', icon: Heart, parent: '/settings' },
  '/settings/tokens': { labelKey: 'nav.apiKeys', icon: Key, parent: '/settings' },

  // "创作者" section
  '/publish': { labelKey: 'nav.publish', icon: Upload },
  '/my-packages': { labelKey: 'nav.myPackages', icon: PackageSearch },
  '/analytics': { labelKey: 'nav.analytics', icon: BarChart3 },

  // Profile
  '/profile': { labelKey: 'nav.profile', icon: User },
  '/profile/settings': { labelKey: 'nav.settings', icon: Settings, parent: '/profile' },

  // Admin section
  '/admin': { labelKey: 'nav.dashboard', icon: LayoutDashboard },
  '/admin/packages': { labelKey: 'nav.packages', icon: Package, parent: '/admin' },
};

// Section roots - used as parent labels
const sectionRoots: Record<string, RouteConfig> = {
  '/settings': { labelKey: 'nav.my', icon: Heart },
  '/admin': { labelKey: 'nav.admin', icon: LayoutDashboard },
  '/profile': { labelKey: 'nav.profile', icon: User },
};

export function HeaderBreadcrumb() {
  const { t } = useTranslation();
  const pathname = usePathname();

  // Find the matching route config
  // Try exact match first, then prefix match for dynamic routes
  let matchedPath = pathname;
  let config = routeConfig[pathname];

  if (!config) {
    // Try to find a prefix match (e.g., /mcp/[id] matches /mcp)
    const prefixMatches = Object.keys(routeConfig)
      .filter((path) => pathname.startsWith(path + '/') || pathname === path)
      .sort((a, b) => b.length - a.length); // Longest match first

    if (prefixMatches.length > 0) {
      matchedPath = prefixMatches[0];
      config = routeConfig[matchedPath];
    }
  }

  // Build breadcrumb items
  const breadcrumbItems: Array<{
    href: string;
    labelKey: string;
    icon: IconComponent;
    isLast: boolean;
  }> = [];

  if (config) {
    // Add parent section if exists
    if (config.parent && sectionRoots[config.parent]) {
      const parentConfig = sectionRoots[config.parent];
      breadcrumbItems.push({
        href: config.parent === '/settings' ? '/settings/favorites' : config.parent,
        labelKey: parentConfig.labelKey,
        icon: parentConfig.icon,
        isLast: false,
      });
    }

    // Add current page
    breadcrumbItems.push({
      href: matchedPath,
      labelKey: config.labelKey,
      icon: config.icon,
      isLast: true,
    });

    // If we're on a detail page (pathname !== matchedPath), show it
    if (pathname !== matchedPath) {
      // Update the last item to not be last
      breadcrumbItems[breadcrumbItems.length - 1].isLast = false;

      // Extract the ID/slug from the URL
      const detailSegment = pathname.slice(matchedPath.length + 1).split('/')[0];
      if (detailSegment) {
        breadcrumbItems.push({
          href: pathname,
          labelKey: detailSegment, // Will be displayed as-is (not translated)
          icon: config.icon,
          isLast: true,
        });
      }
    }
  }

  // If no breadcrumbs, return empty div to maintain header layout
  if (breadcrumbItems.length === 0) {
    return <div />;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <BreadcrumbItem key={`${item.href}-${index}`}>
            {index > 0 && <BreadcrumbSeparator />}
            {item.isLast ? (
              <BreadcrumbPage className="flex items-center gap-1.5">
                <item.icon className="h-4 w-4" />
                {routeConfig[item.href] || sectionRoots[item.href]
                  ? t(item.labelKey)
                  : item.labelKey}
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={item.href} className="flex items-center gap-1.5">
                  <item.icon className="h-4 w-4" />
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
