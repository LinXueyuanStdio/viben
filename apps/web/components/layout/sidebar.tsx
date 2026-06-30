'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Home,
  Grid3X3,
  TrendingUp,
  MessageSquare,
  Search,
  Bell,
  Clock,
  Package,
  Sparkles,
  Layers,
  BarChart3,
  LayoutDashboard,
  Upload,
  PackageSearch,
  LogIn,
  Bookmark,
  Key,
  Users,
  Flag,
  ScrollText,
  FileText,
  Activity,
  Star,
  FileEdit,
  Image,
  Download,
  Share2,
} from 'lucide-react';
import type { AdminPermission, UserRole } from '@/lib/types/admin';
import { ROLE_PERMISSIONS, ADMIN_ROLES } from '@/lib/types/admin';

const navigation = [
  { nameKey: 'nav.mcpMarketplace', href: '/mcp-market', icon: Package },
  { nameKey: 'nav.skillsMarket', href: '/skill-market', icon: Sparkles },
  { nameKey: 'nav.collections', href: '/collections', icon: Layers },
];

// "我的" section - personal account related
const myNavigation = [
  { nameKey: 'nav.favorites', href: '/settings/favorites', icon: Bookmark },
  { nameKey: 'nav.apiKeys', href: '/settings/tokens', icon: Key },
  { nameKey: 'nav.myPackages', href: '/settings/packages', icon: PackageSearch },
];

// "浏览" section - community browsing, always visible
const browseNavigation = [
  { nameKey: 'nav.home', href: '/', icon: Home },
  { nameKey: 'nav.category', href: '/category', icon: Grid3X3 },
  { nameKey: 'nav.leaderboard', href: '/leaderboard', icon: TrendingUp },
  { nameKey: 'nav.moment', href: '/moment', icon: MessageSquare },
  { nameKey: 'nav.tags', href: '/tags', icon: Grid3X3 },
  { nameKey: 'nav.author', href: '/author', icon: Users },
  { nameKey: 'nav.search', href: '/search', icon: Search },
];

// "记录" section - personal records, visible only when logged in
const recordsNavigation = [
  { nameKey: 'nav.notifications', href: '/notifications', icon: Bell },
  { nameKey: 'nav.history', href: '/history', icon: Clock },
];

// "创作者" section - publishing and analytics
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
  collapsed: boolean
  session?: { role?: string; username?: string; email?: string; avatarUrl?: string; userSlug?: string } | null
  pendingPackagesCount?: number
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
  collapsed,
  session,
  pendingPackagesCount = 0,
}: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const userRole = session?.role;
  const username = session?.username;
  const email = session?.email;
  const avatarUrl = session?.avatarUrl;

  const isLoggedIn = Boolean(userRole);
  const userSlug = session?.userSlug;
  const showAdmin = userRole && isAdminRole(userRole);

  // Admin navigation organized by functional workflow
  const adminGroups: { label: string; items: AdminNavItem[] }[] = [
    {
      label: t('nav.adminOverview', '总览'),
      items: [
        { name: t('adminNav.dashboard'), href: '/admin', icon: LayoutDashboard },
        { name: t('adminNav.logs'), href: '/admin/logs', icon: ScrollText, permission: 'admin.access' },
      ],
    },
    {
      label: t('nav.adminModeration', '审核'),
      items: [
        {
          name: t('adminNav.packages'),
          href: '/admin/packages',
          icon: Package,
          permission: 'packages.review',
          badgeCount: pendingPackagesCount,
        },
        { name: t('adminNav.pageReview'), href: '/admin/pages', icon: FileText, permission: 'pages.review' },
        { name: t('adminNav.comments'), href: '/admin/comments', icon: MessageSquare, permission: 'content.moderate' },
        { name: t('adminNav.collections'), href: '/admin/collections', icon: Layers, permission: 'content.moderate' },
        { name: t('adminNav.moments'), href: '/admin/moments', icon: Clock, permission: 'moments.moderate' },
        { name: t('adminNav.reports'), href: '/admin/reports', icon: Flag, permission: 'reports.view' },
        { name: t('adminNav.feedbacks'), href: '/admin/feedbacks', icon: MessageSquare, permission: 'feedbacks.view' },
        { name: t('adminNav.ratings'), href: '/admin/ratings', icon: Star, permission: 'content.moderate' },
      ],
    },
    {
      label: t('nav.adminContentOps', '运营'),
      items: [
        { name: t('adminNav.categories'), href: '/admin/categories', icon: Grid3X3, permission: 'categories.manage' },
        { name: t('adminNav.topics'), href: '/admin/topics', icon: MessageSquare, permission: 'topics.manage' },
        { name: t('adminNav.rankings'), href: '/admin/rankings', icon: TrendingUp, permission: 'rankings.view' },
        { name: t('adminNav.operations'), href: '/admin/operations', icon: Layers, permission: 'operations.manage' },
      ],
    },
    {
      label: t('nav.adminUsersGroup', '用户'),
      items: [
        { name: t('adminNav.users'), href: '/admin/users', icon: Users, permission: 'users.view' },
        { name: t('adminNav.drafts'), href: '/admin/drafts', icon: FileEdit, permission: 'content.delete' },
      ],
    },
    {
      label: t('nav.adminAnalytics', '数据'),
      items: [
        { name: t('adminNav.analytics'), href: '/admin/analytics', icon: BarChart3, permission: 'rankings.view' },
        { name: t('adminNav.searchAnalytics'), href: '/admin/search-analytics', icon: Search, permission: 'rankings.view' },
        { name: t('adminNav.downloads'), href: '/admin/downloads', icon: Download, permission: 'rankings.view' },
        { name: t('adminNav.activity'), href: '/admin/activity', icon: Activity, permission: 'rankings.view' },
      ],
    },
    {
      label: t('nav.adminSystem', '系统'),
      items: [
        { name: t('adminNav.media'), href: '/admin/media', icon: Image, permission: 'content.moderate' },
        { name: t('adminNav.shares'), href: '/admin/shares', icon: Share2, permission: 'content.moderate' },
        { name: t('adminNav.notifications'), href: '/admin/notifications', icon: Bell, permission: 'admin.access' },
        { name: t('adminNav.apiKeys'), href: '/admin/api-keys', icon: Key, permission: 'users.view' },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-background transition-[width] duration-200 ease-out overflow-hidden",
        collapsed ? "w-0 border-r-0" : "w-[var(--sidebar-w)]"
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {/* Browse Section — always visible */}
        <div className="px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('nav.browse', '浏览')}
          </span>
        </div>
        {browseNavigation.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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

        <div className="my-4 border-t" />

        {/* Market Section */}
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

        {/* Records Section — Only visible to logged-in users */}
        {isLoggedIn && (
          <>
            <div className="my-4 border-t" />
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('nav.records', '记录')}
              </span>
            </div>
            {recordsNavigation.map((item) => {
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

        {/* My Section - Only visible to logged-in users */}
        {isLoggedIn && (
          <>
            <div className="my-4 border-t" />
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('nav.my')}
              </span>
            </div>
            {myNavigation.map((item) => {
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

        {/* Admin Section — grouped by function */}
        {showAdmin && (
          <>
            <div className="my-4 border-t" />
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('nav.admin')}
              </span>
            </div>
            {adminGroups.map((group) => {
              // Filter items by permission
              const visibleItems = group.items.filter(
                (item) => !item.permission || hasPermission(userRole, item.permission)
              );
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.label} className="mb-1">
                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground/60">
                      {group.label}
                    </span>
                  </div>
                  {visibleItems.map((item) => {
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
                </div>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom Area */}
      <div className="border-t p-4">
        {/* User Section */}
        {isLoggedIn && username ? (
          <Link
            href={userSlug ? `/${encodeURIComponent(userSlug)}` : "#"}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg p-2',
              'text-left transition-colors duration-200',
              'hover:bg-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              userSlug && pathname === `/${userSlug}` && 'bg-primary/10'
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
          </Link>
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
