'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Upload,
  PackageSearch,
  LogIn,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import type { AdminPermission, UserRole } from '@/lib/types/admin';
import { ROLE_PERMISSIONS, ADMIN_ROLES } from '@/lib/types/admin';

const navigation = [
  { nameKey: 'nav.mcpMarketplace', href: '/mcp', icon: Package },
  { nameKey: 'nav.skills', href: '/skills', icon: Sparkles },
  { nameKey: 'nav.collections', href: '/collections', icon: Layers },
  { nameKey: 'workspace.workspaces', href: '/workspaces', icon: FolderKanban },
  { nameKey: 'nav.organizations', href: '/orgs', icon: Building2 },
];

const creatorNavigation = [
  { nameKey: 'nav.publish', href: '/publish', icon: Upload },
  { nameKey: 'nav.myPackages', href: '/my-packages', icon: PackageSearch },
  { nameKey: 'nav.analytics', href: '/analytics', icon: BarChart3 },
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
  username?: string;
  email?: string;
  avatarUrl?: string;
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

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Sidebar({
  userRole,
  username,
  email,
  avatarUrl,
  pendingPackagesCount = 0,
  pendingReportsCount = 0,
}: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const isLoggedIn = Boolean(userRole);
  const showAdmin = userRole && isAdminRole(userRole);

  const adminNavigation: AdminNavItem[] = [
    { name: t('nav.dashboard'), href: '/admin', icon: LayoutDashboard },
    {
      name: t('nav.packages'),
      href: '/admin/packages',
      icon: Package,
      permission: 'packages.review',
      badgeCount: pendingPackagesCount,
    },
    {
      name: t('nav.content'),
      href: '/admin/content',
      icon: MessageSquare,
      permission: 'content.moderate',
    },
    {
      name: t('nav.reports'),
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
          <span className="font-serif text-xl font-semibold">Viben</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
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

        {/* Creator Section - Only visible to logged-in users */}
        {isLoggedIn && (
          <>
            <div className="my-4 border-t" />
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('nav.creator')}
              </span>
            </div>
            {creatorNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
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
          </>
        )}

        {/* Admin Section */}
        {showAdmin && (
          <>
            <div className="my-4 border-t" />
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('nav.admin')}
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

      {/* Bottom Area */}
      <div className="border-t p-4">
        {/* User Section */}
        {isLoggedIn && username ? (
          <>
            {/* Settings Link - Only visible when logged in */}
            <Link
              href="/profile/settings"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === '/profile/settings'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Settings className="h-4 w-4" />
              {t('common.settings')}
            </Link>

            <Separator className="my-3" />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg p-2',
                  'text-left transition-colors duration-200',
                  'hover:bg-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <Avatar className="h-8 w-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
                  <AvatarFallback className="text-xs">
                    {getInitials(username)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{username}</p>
                  {email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {email}
                    </p>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{username}</p>
                  {email && (
                    <p className="text-xs text-muted-foreground">{email}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex cursor-pointer items-center">
                  <User className="mr-2 h-4 w-4" />
                  {t('auth.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/settings" className="flex cursor-pointer items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('common.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href="/api/auth/logout"
                  className="flex cursor-pointer items-center text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('auth.signOut')}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              {t('auth.signIn')}
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
