'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, MessageSquare, TrendingUp, Grid3X3, ShoppingBag, ExternalLink } from 'lucide-react';

const HOME_TABS = [
  { key: 'home', label: '首页', href: '/', icon: Home },
  { key: 'moment', label: '动态', href: '/moment', icon: MessageSquare },
  { key: 'leaderboard', label: '榜单', href: '/leaderboard', icon: TrendingUp },
  { key: 'category', label: '分类', href: '/category', icon: Grid3X3 },
  { key: 'market', label: '市场', href: '/market', icon: ShoppingBag, external: true },
] as const;

function resolveActiveTab(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/moment')) return 'moment';
  if (pathname.startsWith('/leaderboard')) return 'leaderboard';
  if (pathname.startsWith('/category')) return 'category';
  return 'home';
}

export function HomeTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveActiveTab(pathname);

  const handleTabChange = (value: string) => {
    const tab = HOME_TABS.find((t) => t.key === value);
    if (!tab) return;
    if ('external' in tab && tab.external) {
      window.open(tab.href, '_blank');
      return;
    }
    router.push(tab.href);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        {HOME_TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            <tab.icon className="mr-1.5 h-4 w-4" />
            {tab.label}
            {'external' in tab && tab.external && <ExternalLink className="ml-1 h-3 w-3 opacity-50" />}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
