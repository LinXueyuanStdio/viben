'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Sparkles,
  FolderKanban,
  Settings,
  User,
  Building2,
  Layers,
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Flag,
} from 'lucide-react';
import type { AdminPermission, UserRole } from '@/lib/types/admin';
import { ROLE_PERMISSIONS, ADMIN_ROLES } from '@/lib/types/admin';

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

interface AdminNavItem {
  name: string;
  href: string;
  icon: typeof Package;
  permission?: AdminPermission;
  badgeCount?: number;
}

interface SidebarProps {
  userRole?: string;
  pendingPackagesCount?: number;
  pendingReportsCount?: number;
}

function hasPermission(role: string, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role as UserRole] ?? [];
  return permissions.includes(permission);
}

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

export function Sidebar({
  userRole,
  pendingPackagesCount = 0,
  pendingReportsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();

  const showAdmin = userRole && isAdminRole(userRole);

  const adminNavigation: AdminNavItem[] = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    {
      name: 'Packages',
      href: '/admin/packages',
      icon: Package,
      permission: 'packages.review',
      badgeCount: pendingPackagesCount,
    },
    {
      name: 'Content',
      href: '/admin/content',
      icon: MessageSquare,
      permission: 'content.moderate',
    },
    {
      name: 'Reports',
      href: '/admin/reports',
      icon: Flag,
      permission: 'reports.view',
      badgeCount: pendingReportsCount,
    },
  ];

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
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
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

        {/* Admin Section */}
        {showAdmin && (
          <>
            <div className="my-4 border-t" />
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </span>
            </div>
            {adminNavigation.map((item) => {
              // Skip items requiring permission the user doesn't have
              if (item.permission && !hasPermission(userRole, item.permission)) {
                return null;
              }

              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);

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
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {item.badgeCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </>
        )}
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
