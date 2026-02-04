'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Package,
  Sparkles,
  FolderKanban,
  Settings,
  User,
  Building2,
  Layers,
  BarChart3,
} from 'lucide-react';

const navigation = [
  { name: 'MCP Marketplace', href: '/mcp', icon: Package },
  { name: 'Skills', href: '/skills', icon: Sparkles },
  { name: 'Collections', href: '/collections', icon: Layers },
  { name: 'Workspaces', href: '/workspaces', icon: FolderKanban },
  { name: 'Organizations', href: '/orgs', icon: Building2 },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const userNavigation = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-semibold">Browse MCP</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Navigation */}
      <div className="border-t p-4">
        {userNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
