'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from '@/components/ui/viben-tabs';
import { cn } from '@/lib/utils/index';
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

interface HomeTabBarProps {
  /** 移动端是否仅显示图标（隐藏文字标签） */
  iconOnly?: boolean
  className?: string
}

export function HomeTabBar({ iconOnly = false, className }: HomeTabBarProps) {
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
    <VibenTabs value={activeTab} onValueChange={handleTabChange} className={cn("h-full", className)}>
      <VibenTabsList variant="underline" className="h-full gap-1">
        {HOME_TABS.map((tab) => (
          <VibenTabsTrigger key={tab.key} value={tab.key} variant="underline">
            <tab.icon className="h-4 w-4" />
            {!iconOnly && <span className="ml-1.5">{tab.label}</span>}
            {'external' in tab && tab.external && !iconOnly && <ExternalLink className="ml-1 h-3 w-3 opacity-50" />}
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
    </VibenTabs>
  );
}
