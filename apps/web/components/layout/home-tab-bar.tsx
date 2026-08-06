'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from '@/components/ui/viben-tabs';
import { cn } from '@/lib/utils/index';
import { Home, MessageSquare, TrendingUp, Grid3X3, ShoppingBag, ExternalLink } from 'lucide-react';

const HOME_TAB_KEYS = [
  { key: 'home', i18nKey: 'nav.home', href: '/', icon: Home },
  { key: 'moment', i18nKey: 'nav.moment', href: '/moment', icon: MessageSquare },
  { key: 'leaderboard', i18nKey: 'nav.leaderboard', href: '/leaderboard', icon: TrendingUp },
  { key: 'category', i18nKey: 'nav.category', href: '/category', icon: Grid3X3 },
  { key: 'market', i18nKey: 'nav.market', href: '/market', icon: ShoppingBag, external: true },
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

export const HomeTabBar = React.memo(function HomeTabBar({ iconOnly = false, className }: HomeTabBarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveActiveTab(pathname);

  const handleTabChange = (value: string) => {
    const tab = HOME_TAB_KEYS.find((t) => t.key === value);
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
        {HOME_TAB_KEYS.map((tab) => (
          <VibenTabsTrigger key={tab.key} value={tab.key} variant="underline">
            <tab.icon className="h-4 w-4" />
            {!iconOnly && <span className="ml-1.5">{t(tab.i18nKey)}</span>}
            {'external' in tab && tab.external && !iconOnly && <ExternalLink className="ml-1 h-3 w-3 opacity-50" />}
          </VibenTabsTrigger>
        ))}
      </VibenTabsList>
    </VibenTabs>
  );
});
