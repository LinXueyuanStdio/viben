'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Key, Package, Heart } from 'lucide-react';

const navigation = [
  { nameKey: 'settings.nav.apiKeys', href: '/settings/tokens', icon: Key },
  { nameKey: 'settings.nav.myPackages', href: '/settings/packages', icon: Package },
  { nameKey: 'settings.nav.favorites', href: '/settings/favorites', icon: Heart },
];

export function SettingsSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0">
      <h2 className="mb-4 text-lg font-semibold">{t('settings.title')}</h2>
      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.nameKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
